import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,sendPasswordResetEmail} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {getFirestore,doc,onSnapshot,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';
import {emptyProgress,diffProgress,applyPatch,mergePatches,mergeProgressCopies} from './progress-merge.mjs?v=persistence-v2';
const auth=getAuth(initializeApp(firebaseConfig)),db=getFirestore();
let user=null,unsubscribe=null,epoch=0,queue=[],baseline=emptyProgress(),timer=null,writing=false,ready=false,explicitLogout=false;
const copy=x=>structuredClone(x), status=text=>{document.querySelector('#syncStatus').textContent=text;};
function storeQueue(){try{if(user)localStorage.setItem('habitlab-outbox-'+user.uid,JSON.stringify(queue));}catch{status('Локальное сохранение недоступно. Не закрывай страницу до синхронизации.');}}
function refresh(){if(course.length){week=Math.floor(state.last/7);day=state.last%7;render();}updateProfile();}
function cache(){try{backupLocalProgress(KEY,localStorage.getItem(KEY));localStorage.setItem(KEY,JSON.stringify(state));}catch{storageOK=false;}}
window.onProgressSaved=()=>{
  if(!user)return;
  const patch=diffProgress(baseline,state);baseline=copy(state);
  if(JSON.stringify(patch)===JSON.stringify(diffProgress(state,state)))return;
  if(!writing&&queue.length)queue=[mergePatches(queue.reduce(mergePatches),patch)];else queue.push(patch);storeQueue();status('Синхронизируется…');clearTimeout(timer);timer=setTimeout(flush,900);
};
async function flush(){
  if(!user||!ready||writing||!queue.length)return;
  const version=epoch,account=user,items=queue.slice(),count=items.length;let tooLarge=false;writing=true;
  try{
    const result=await runTransaction(db,async tx=>{
      const ref=doc(db,'progress',account.uid),snap=await tx.get(ref);
      let next=snap.exists()?validateState(snap.data().progress):emptyProgress();
      for(const patch of items)next=applyPatch(next,patch);
      if(new TextEncoder().encode(JSON.stringify(next)).length>800000)throw Error('progress-too-large');
      tx.set(ref,{version:1,progress:next,updatedAt:serverTimestamp()});return next;
    });
    if(version!==epoch)return;
    try{localStorage.setItem('habitlab-confirmed-'+account.uid,JSON.stringify(result));}catch{}
    queue.splice(0,count);storeQueue();
    let merged=result;for(const patch of queue)merged=applyPatch(merged,patch);
    merged.last=state.last;
    state=validateState(merged);baseline=copy(state);cache();
    status(queue.length?'Синхронизируется…':'Сохранено в аккаунте');
    // Не пересоздаём редактор во время печати.
    updateProfile();
  }catch(error){tooLarge=error.message==='progress-too-large';if(version===epoch)status(error.message==='progress-too-large'?'Слишком много кода для облачного сохранения. Экспортируй прогресс.':'Не удалось синхронизировать. Изменения сохранены здесь; повторим при подключении.');}
  finally{if(version===epoch){writing=false;if(queue.length&&navigator.onLine&&!tooLarge)setTimeout(flush,5000);}}
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
document.querySelector('#logoutButton').onclick=async()=>{try{explicitLogout=true;await signOut(auth);if(!auth.currentUser)handleAuthState(null);}catch{explicitLogout=false;status('Не удалось выйти. Повтори попытку.');}};
document.querySelector('#migrateGuest').onclick=()=>{
  if(!user||!ready)return;
  try{
    const raw=localStorage.getItem('habitlab-v1');if(!raw)return status('Нет гостевого прогресса для переноса.');
    const guest=validateState(JSON.parse(raw));
    state=validateState(applyPatch(state,diffProgress(emptyProgress(),guest)));save();refresh();flush();
    status('Переношу гостевой прогресс…');
  }catch{status('Не удалось прочитать гостевой прогресс.');}
};
function handleAuthState(account){
  epoch++;if(typeof compilerSession!=='undefined')compilerSession++;unsubscribe?.();unsubscribe=null;clearTimeout(timer);writing=false;ready=false;user=account;queue=[];
  const oldKey=KEY;backupLocalProgress(oldKey,JSON.stringify(state));
  const target=account?'habitlab-user-'+account.uid:(!explicitLogout&&oldKey.startsWith('habitlab-user-')?oldKey:'habitlab-v1');
  KEY=target;
  if(target!==oldKey){try{state=validateState(JSON.parse(localStorage.getItem(KEY)||JSON.stringify(emptyProgress())));}catch{state=emptyProgress();}}
  try{const recovery=localStorage.getItem(KEY+':recovery');if(recovery)state=validateState(mergeProgressCopies(validateState(JSON.parse(recovery)),state));}catch{}
  try{localStorage.setItem('habitlab-active-profile',KEY);localStorage.setItem(KEY,JSON.stringify(state));}catch{}
  explicitLogout=false;
  baseline=copy(state);refresh();
  document.querySelector('#accountButton').hidden=!!account;document.querySelector('#logoutButton').hidden=!account;document.querySelector('#migrateGuest').hidden=!account;
  document.querySelector('#accountName').textContent=account?account.email:'';
  if(!account){status(KEY.startsWith('habitlab-user-')?'Открыта локальная копия аккаунта. Войди снова, чтобы отправить её в облако.':'Гостевой режим · прогресс в этом браузере');return;}
  try{const outbox=JSON.parse(localStorage.getItem('habitlab-outbox-'+account.uid)||'[]');if(Array.isArray(outbox))queue=outbox;}catch{}
  // Reconstruct unsent edits from the durable local copy even if the page closed before Auth loaded.
  try{const confirmed=validateState(JSON.parse(localStorage.getItem('habitlab-confirmed-'+account.uid)||JSON.stringify(emptyProgress())));queue.push(diffProgress(confirmed,state));storeQueue();}catch{}
  status('Загружаю прогресс аккаунта…');const version=epoch;
  unsubscribe=onSnapshot(doc(db,'progress',account.uid),snapshot=>{
    if(version!==epoch||snapshot.metadata.hasPendingWrites)return;
    try{
      let server=snapshot.exists()?validateState(snapshot.data().progress):emptyProgress();
      try{localStorage.setItem('habitlab-confirmed-'+account.uid,JSON.stringify(server));}catch{}
      let remote=validateState(mergeProgressCopies(state,server));
      for(const patch of queue)remote=applyPatch(remote,patch);
      if(ready)remote.last=state.last;
      const changed=JSON.stringify(remote)!==JSON.stringify(state);
      state=validateState(remote);baseline=copy(state);cache();ready=true;
      // Снимки не сбрасывают фокус и текст редактора во время ввода.
      if(changed&&!document.activeElement?.matches('#answer, [data-workshop-editor], [data-workspace-editor]'))refresh();else {updateProfile();renderStatus();}
      status(queue.length?'Синхронизируется…':'Сохранено в аккаунте');flush();
    }catch{status('Не удалось прочитать облачный прогресс. Экспортируй локальную копию.');}
  },()=>{status('Облачное хранилище недоступно. Локальный прогресс сохранён.');});
}
onAuthStateChanged(auth,handleAuthState,()=>status('Не удалось проверить вход. Локальные данные сохранены; попробуй войти снова.'));
window.addEventListener('pagehide',()=>{cache();storeQueue();});
