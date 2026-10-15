'use strict';
let compilerExpanded=false,compilerSession=0;
const defaultKotlinSource=`fun percent(done: Int, target: Int): Int {
    if (target <= 0) return 0
    return done*100/target
}

fun main() {
    println(percent(3, 10))
    println(percent(0, 10))
    println(percent(10, 10))
    println(percent(3, 0))
}`;
function dayWorkspace(i){const d=workshopDraft(i);return d.workspace&&typeof d.workspace==='object'?d.workspace:{active:'free',files:{}};}
function workspaceFile(i,key){return dayWorkspace(i).files?.[key]||{code:defaultKotlinSource,label:'Своя программа',origin:'template'};}
function persistWorkspace(i,workspace){const draft=workshopDraft(i);draft.workspace=workspace;writeWorkshopDraft(i,draft);}
function saveWorkspaceCode(i,key,code){const workspace=dayWorkspace(i);workspace.files=workspace.files||{};workspace.active=key;workspace.files[key]={...workspaceFile(i,key),code,origin:'learner'};persistWorkspace(i,workspace);}
function recordWorkspaceRun(i,key,entry){
 const workspace=dayWorkspace(i),file=workspace.files?.[key];if(!file)return;
 const runs=[...(file.runs||[])],index=runs.findIndex(r=>r.id===entry.id);
 if(index<0)runs.push(entry);else runs[index]=entry;
 workspace.files[key]={...file,runs,...(entry.status==='finished'?{lastRun:entry}:{})};persistWorkspace(i,workspace);
}
function currentWorkshopSource(i,stepIndex){
 const step=course[i].workshop[stepIndex],values=workshopDraft(i).labs[stepIndex]?.answers||{};
 const source=workshopExample(step,values);
 if(i===0){
  if(stepIndex===0)return 'fun main() {\n'+source.split('\n').map(l=>'    '+l).join('\n')+'\n}';
  if(stepIndex===1||stepIndex===5)return source+'\n\nfun main() {\n    println(points(0))\n    println(points(3))\n    println(points(7))\n}';
  if(stepIndex===2)return source+'\n\nfun main() {\n    println(percent(3, 10))\n    println(percent(0, 10))\n    println(percent(10, 10))\n    println(percent(3, 0))\n}';
  if(stepIndex===3)return 'fun points(days: Int): Int = days * 10\n\nfun main() {\n'+source.split('\n').map(l=>'    '+l).join('\n')+'\n}';
  if(stepIndex===4)return source+'\n\nfun main() {\n    for (days in listOf(0, 3, 5, 6, 20)) println(cappedPoints(days))\n}';
 }
 if(i===1){
  const prefix='data class Habit(val title: String, val days: Int)\n\nfun main() {\n    val habits = listOf(Habit("Читать", 3), Habit("Бегать", 0), Habit("Зарядка", 7))\n';
  const active='    val active = habits.filter { it.days > 0 }\n';
  let body=source;
  if(stepIndex===5)body=source.replace(/^val habits = .*\n/,'');
  const suffix=stepIndex===0?'    println(displayName)':stepIndex===1||stepIndex===5?'    println(active)':stepIndex===2||stepIndex===3?'    println(titles)':'    println(experienced)';
  return prefix+(stepIndex===2||stepIndex===3?active:'')+body.split('\n').map(l=>'    '+l).join('\n')+'\n'+suffix+'\n}';
 }
 return '// Kotlin/JVM: Android Views, Compose и Spring не входят в этот сервер.\n// Напиши отдельную Kotlin-программу с main() или скачай проект для IDE.\n\n'+defaultKotlinSource;
}
function loadWorkshopIntoCompiler(i,stepIndex){
 if(i>1){compilerExpanded=true;renderCompilerPanel(i);$('#compilerPanel').open=true;$('#compilerPanel').scrollIntoView({block:'start',behavior:'smooth'});return;}
 const workspace=dayWorkspace(i),key='step-'+(stepIndex+1);workspace.files=workspace.files||{};
 // Existing edited source is retained; loading a step never silently overwrites it.
 if(!workspace.files[key])workspace.files[key]={code:currentWorkshopSource(i,stepIndex),label:'Шаг '+(stepIndex+1)+': '+course[i].workshop[stepIndex].title,origin:'workshop'};
 workspace.active=key;persistWorkspace(i,workspace);compilerExpanded=true;renderCompilerPanel(i);$('#compilerPanel').open=true;$('#compilerSource').focus();$('#compilerPanel').scrollIntoView({block:'start',behavior:'smooth'});
}
function renderCompilerPanel(i){
 compilerSession++;
 document.querySelector('#compilerPanel')?.remove();
 const workspace=dayWorkspace(i),key=workspace.active||'free',file=workspaceFile(i,key),files={free:{label:'Своя программа'},...workspace.files};
 const panel=document.createElement('details');panel.id='compilerPanel';panel.className='card compilerPanel';panel.open=compilerExpanded;
 panel.innerHTML=`<summary>▶ Настоящий Kotlin: написать код и запустить</summary><p>Здесь компилятор Kotlin/JVM от JetBrains. Напиши полный файл; для запуска нужна функция <code>fun main()</code>. Пробелы вокруг <code>*</code> и <code>/</code> необязательны.</p><p class="note">По нажатию «Скомпилировать и запустить» этот файл отправляется сервису api.kotlinlang.org. Не вставляй пароли и секреты. Android Views, Android Compose и Spring-проект здесь не собираются — для них скачай проект и открой IDE.</p><label for="compilerFile">Файл этого дня</label><select id="compilerFile">${Object.entries(files).map(([id,f])=>`<option value="${esc(id)}" ${id===key?'selected':''}>${esc(f.label||id)}</option>`).join('')}</select><label for="compilerSource">Твой полный код — Main.kt</label><textarea id="compilerSource" data-workspace-editor spellcheck="false" autocapitalize="off" maxlength="32000">${esc(file.code)}</textarea><p id="compilerSaveStatus" role="status">Код сохраняется в прогрессе этого дня; после входа — в аккаунте.</p><div class="actions"><button id="runKotlin" class="primary">Скомпилировать и запустить</button><button id="stopKotlin" disabled>Перестать ждать</button><button id="downloadKotlinFile">Скачать Main.kt</button></div><h4>Консоль</h4><pre id="compilerConsole" tabindex="0" role="log" aria-label="Консоль Kotlin">${esc(file.lastRun?.consoleText||'Здесь появятся println(), ошибки компиляции и ошибки выполнения.')}</pre><p id="compilerRunStatus" role="status">${file.lastRun?'Сохранён результат прошлого запуска. Изменённую программу запусти заново.':'Программа ещё не запускалась.'}</p>`;
 $('#content').append(panel);
 panel.ontoggle=()=>{compilerExpanded=panel.open;};
 $('#compilerFile').onchange=e=>{const w=dayWorkspace(i);w.active=e.target.value;persistWorkspace(i,w);renderCompilerPanel(i);};
 $('#compilerSource').oninput=e=>{try{saveWorkspaceCode(i,key,e.target.value);$('#compilerSaveStatus').textContent=storageOK?'Сохранено на устройстве. Статус отправки в аккаунт — в блоке прогресса.':'Сохранение в браузере недоступно. Скачай Main.kt перед закрытием.';$('#compilerRunStatus').textContent='Код изменён. Предыдущий вывод относится к предыдущему запуску.';}catch(error){$('#compilerSaveStatus').textContent='Не удалось сохранить: '+error.message+' Скачай Main.kt перед закрытием.';}};
 $('#downloadKotlinFile').onclick=()=>downloadCourseFile('Main.kt',$('#compilerSource').value,'text/plain;charset=utf-8');
 let abort;
 $('#stopKotlin').onclick=()=>abort?.abort();
 $('#runKotlin').onclick=async()=>{
  const source=$('#compilerSource').value,version=compilerSession,accountKey=KEY;
  try{saveWorkspaceCode(i,key,source);}catch(error){$('#compilerSaveStatus').textContent='Облачный архив переполнен. Скачай Main.kt: '+error.message;return;}
  const runId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9),runAt=new Date().toISOString();recordWorkspaceRun(i,key,{id:runId,status:'pending',source,at:runAt});
  abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),60000);
  const runButton=$('#runKotlin'),stopButton=$('#stopKotlin'),consoleNode=$('#compilerConsole'),statusNode=$('#compilerRunStatus');
  runButton.disabled=true;stopButton.disabled=false;statusNode.textContent='Компилируется на сервере JetBrains…';consoleNode.textContent='> kotlinc Main.kt\n> ожидаем результат…';
  try{
   const result=await KotlinRunner.run(source,{signal:abort.signal});
   if(accountKey!==KEY)return;
   recordWorkspaceRun(i,key,{...result,id:runId,status:'finished',source,at:runAt});
   if(version===compilerSession){consoleNode.textContent=result.consoleText;statusNode.textContent=$('#compilerSource')?.value!==source?'Вывод относится к запущенной версии. Текущий код изменён — запусти его заново.':result.ok?'✓ Kotlin '+result.version+': программа скомпилирована и выполнена.':result.compiled?'Программа скомпилирована, но завершилась с ошибкой выполнения.':'Компилятор нашёл ошибку. Исправь строку в редакторе и запусти ещё раз.';}
  }catch(error){if(accountKey===KEY)recordWorkspaceRun(i,key,{id:runId,status:'unavailable',source,at:runAt,message:error.name==='AbortError'?'Ожидание остановлено или истекло':error.message});if(version===compilerSession&&accountKey===KEY){consoleNode.textContent=error.name==='AbortError'?'Ожидание остановлено или истекла минута. Серверная задача может завершиться отдельно.':error.message;statusNode.textContent='Запуск не завершён. Это не означает, что код неверный. Файл сохранён.';}}
  finally{clearTimeout(timeout);runButton.disabled=false;stopButton.disabled=true;}
 };
}
function addCompilerPanel(){if(course.length&&$('#content'))renderCompilerPanel(state.last);}
const renderBeforeCompiler=renderContent;
renderContent=function(){renderBeforeCompiler();addCompilerPanel();};
