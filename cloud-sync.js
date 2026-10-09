import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,sendPasswordResetEmail} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {getFirestore,doc,onSnapshot,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';
import {emptyProgress,diffProgress,applyPatch,mergePatches} from './progress-merge.mjs';
const auth=getAuth(initializeApp(firebaseConfig)),db=getFirestore();
let user=null,unsubscribe=null,epoch=0,queue=[],baseline=emptyProgress(),timer=null,writing=false,ready=false;
const copy=x=>structuredClone(x), status=text=>{document.querySelector('#syncStatus').textContent=text;};
function storeQueue(){try{if(user)localStorage.setItem('habitlab-outbox-'+user.uid,JSON.stringify(queue));}catch{status('Локальное сохранение недоступно. Не закрывай страницу до синхронизации.');}}
function refresh(){if(course.length){week=Math.floor(state.last/7);day=state.last%7;render();}updateProfile();}
function cache(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageOK=false;}}
window.onProgressSaved=()=>{
  if(!user)return;
  const patch=diffProgress(baseline,state);baseline=copy(state);
  if(JSON.stringify(patch)===JSON.stringify(diffProgress(state,state)))return;
  if(!writing&&queue.length)queue=[mergePatches(queue.reduce(mergePatches),patch)];else queue.push(patch);storeQueue();status('Синхронизируется…');clearTimeout(timer);timer=setTimeout(flush,900);
};
async function flush(){
  if(!user||!ready||writing||!queue.length)return;
  const version=epoch,account=user,items=queue.slice(),count=items.length;writing=true;
  try{
    const result=await runTransaction(db,async tx=>{
      const ref=doc(db,'progress',account.uid),snap=await tx.get(ref);
      let next=snap.exists()?validateState(snap.data().progress):emptyProgress();
      for(const patch of items)next=applyPatch(next,patch);
      if(JSON.stringify(next).length>700000)throw Error('progress-too-large');
      tx.set(ref,{version:1,progress:next,updatedAt:serverTimestamp()});return next;
    });
    if(version!==epoch)return;
    queue.splice(0,count);storeQueue();
    let merged=result;for(const patch of queue)merged=applyPatch(merged,patch);
    state=validateState(merged);baseline=copy(state);cache();
    status(queue.length?'Синхронизируется…':'Сохранено в аккаунте');
    // Не пересоздаём редактор во время печати.
    updateProfile();
  }catch(error){if(version===epoch)status(error.message==='progress-too-large'?'Слишком много кода для облачного сохранения. Экспортируй прогресс.':'Не удалось синхронизировать. Изменения сохранены здесь; повторим при подключении.');}
  finally{if(version===epoch){writing=false;if(queue.length&&navigator.onLine)setTimeout(flush,5000);}}
}
window.addEventListener('online',flush);
window.addEventListener('offline',()=>{if(user)status('Нет сети · изменения сохраняются в этом браузере');});
const messages={
  'auth/invalid-email':'Проверь адрес email.', 'auth/invalid-credential':'Неверный email или пароль.',
  'auth/email-already-in-use':'Этот email уже зарегистрирован. Нажми «Войти».',
  'auth/weak-password':'Пароль должен содержать минимум 6 символов.',
  'auth/too-many-requests':'Слишком много попыток. Попробуй позже.',
  'auth/network-request-failed':'Нет соединения с сервисом входа.',
};
function showAuth(){
  openModal(`<h2>Твой аккаунт Habit Lab</h2><p>Войди с одинаковым email в любом браузере — задания, достижения и код будут синхронизироваться.</p><form id="authForm"><label>Email<input id="authEmail" type="email" autocomplete="username" required></label><label>Пароль<input id="authPassword" type="password" autocomplete="current-password" minlength="6" required></label><div class="actions"><button class="primary" type="submit">Войти</button><button id="registerAccount" type="button">Создать аккаунт</button><button id="resetAccount" type="button">Забыл пароль</button></div><p id="authError" role="status"></p></form><p class="muted">Гостевой прогресс можно перенести после входа. Пароль обрабатывает Firebase; Habit Lab его не сохраняет.</p>`);
  const form=document.querySelector('#authForm'),error=document.querySelector('#authError');
  async function action(kind){
    if(!document.querySelector('#authEmail').reportValidity())return;
    if(kind!=='reset'&&!form.reportValidity())return;
    const email=document.querySelector('#authEmail').value.trim(),password=document.querySelector('#authPassword').value;
    form.querySelectorAll('button').forEach(b=>b.disabled=true);error.textContent='Подключаюсь…';
    try{if(kind==='register')await createUserWithEmailAndPassword(auth,email,password);else if(kind==='reset'){await sendPasswordResetEmail(auth,email);error.textContent='Если аккаунт существует, письмо для сброса пароля отправлено.';return;}else await signInWithEmailAndPassword(auth,email,password);document.querySelector('#modal').close();}
    catch(e){error.textContent=messages[e.code]||'Не удалось войти. Попробуй ещё раз.';}
    finally{form.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  form.onsubmit=e=>{e.preventDefault();action('login');};document.querySelector('#registerAccount').onclick=()=>action('register');document.querySelector('#resetAccount').onclick=()=>action('reset');
}
document.querySelector('#accountButton').onclick=showAuth;
document.querySelector('#logoutButton').onclick=async()=>{try{await signOut(auth);}catch{status('Не удалось выйти. Повтори попытку.');}};
document.querySelector('#migrateGuest').onclick=()=>{
  if(!user||!ready)return;
  try{
    const raw=localStorage.getItem('habitlab-v1');if(!raw)return status('Нет гостевого прогресса для переноса.');
    const guest=validateState(JSON.parse(raw));
    state=validateState(applyPatch(state,diffProgress(emptyProgress(),guest)));save();refresh();flush();
    status('Переношу гостевой прогресс…');
  }catch{status('Не удалось прочитать гостевой прогресс.');}
};
onAuthStateChanged(auth,account=>{
  epoch++;unsubscribe?.();unsubscribe=null;clearTimeout(timer);writing=false;ready=false;user=account;queue=[];
  KEY=account?'habitlab-user-'+account.uid:'habitlab-v1';
  try{state=validateState(JSON.parse(localStorage.getItem(KEY)||JSON.stringify(emptyProgress())));}catch{state=emptyProgress();}
  baseline=copy(state);refresh();
  document.querySelector('#accountButton').hidden=!!account;document.querySelector('#logoutButton').hidden=!account;document.querySelector('#migrateGuest').hidden=!account;
  document.querySelector('#accountName').textContent=account?account.email:'';
  if(!account){status('Гостевой режим · прогресс в этом браузере');return;}
  try{const outbox=JSON.parse(localStorage.getItem('habitlab-outbox-'+account.uid)||'[]');if(Array.isArray(outbox))queue=outbox;}catch{}
  status('Загружаю прогресс аккаунта…');const version=epoch;
  unsubscribe=onSnapshot(doc(db,'progress',account.uid),snapshot=>{
    if(version!==epoch||snapshot.metadata.hasPendingWrites)return;
    try{
      let remote=snapshot.exists()?validateState(snapshot.data().progress):emptyProgress();
      for(const patch of queue)remote=applyPatch(remote,patch);
      const changed=JSON.stringify(remote)!==JSON.stringify(state);
      state=validateState(remote);baseline=copy(state);cache();ready=true;
      // Снимки не сбрасывают фокус и текст редактора во время ввода.
      if(changed&&document.activeElement?.id!=='answer')refresh();else updateProfile();
      status(queue.length?'Синхронизируется…':'Сохранено в аккаунте');flush();
    }catch{status('Не удалось прочитать облачный прогресс. Экспортируй локальную копию.');}
  },()=>{status('Облачное хранилище недоступно. Локальный прогресс сохранён.');});
},()=>status('Не удалось загрузить вход. Обнови страницу.'));
