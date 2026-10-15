'use strict';
function downloadCourseFile(name,content,type='text/plain;charset=utf-8'){
 const blob=content instanceof Blob?content:new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function courseFinishStatus(){const days=course.filter((_,i)=>completed(i)).length,steps=course.reduce((n,l,i)=>n+workshopCount(i),0),total=course.reduce((n,l)=>n+l.workshop.length,0);return {days,steps,total,ready:course.length===21&&days===21&&steps===total};}
function courseCertificateHTML(){
 const status=courseFinishStatus();if(!status.ready)return null;
 return `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Сертификат Habit Lab</title><style>body{font:20px/1.6 system-ui;text-align:center;padding:60px;color:#252039}article{border:4px solid #8c71ff;padding:50px}h1{font-size:42px;color:#7154bd}small{display:block;margin-top:24px;font-size:14px}</style><article><p>HABIT LAB</p><h1>Маршрут завершён</h1><h2>${esc(state.name||'Участник курса')}</h2><p>Kotlin и Android · Java · Spring Boot</p><p>${status.steps} шагов мастерской · 21 проверка понимания · 21 самостоятельная практика</p><p>${score()} XP · ${new Date().toLocaleDateString('ru-RU')}</p><small>Игровой сертификат участника. Не является документом об образовании. Практика подтверждена участником; проект не проверял преподаватель.</small></article></html>`;
}
function recordQuizAttempt(i,answers,ok){const draft=workshopDraft(i);draft.quizAttempts=draft.quizAttempts||[];draft.quizAttempts.push({answers:[...answers],ok,at:new Date().toISOString()});writeWorkshopDraft(i,draft);}
function buildCourseArchiveFiles(kit){
 const files={},manifest={format:'habitlab-project-1',exportedAt:new Date().toISOString(),student:state.name||'',completion:courseFinishStatus(),lessons:[],consoleProjects:[],androidProjects:[]};
 const prefix='HabitLab-My-Course/';
 const add=(path,value)=>{files[prefix+path]=value;};
 add('progress.json',JSON.stringify(state,null,2));
 const modules=[],compilerVersions=[];
 for(let i=0;i<course.length;i++){
  const lesson=course[i],draft=workshopDraft(i),dir='lessons/day-'+String(i+1).padStart(2,'0')+'/';
  const entry={day:i+1,title:lesson.title,completed:completed(i),workshopSteps:workshopCount(i),savedPrograms:[]};
  add(dir+'README.md',`# День ${i+1}: ${lesson.title}\n\n${lesson.goal}\n\nОтветы и исходники — твои записи.\nreference-example.txt — пример курса, не твой ответ.\nСобранные фрагменты не всегда являются отдельными программами.\n`);
  add(dir+'reference-example.txt',lesson.code);
  add(dir+'my-answers.json',JSON.stringify({workshop:draft.labs,quizSelections:state.checks[i]||[],quizAttempts:draft.quizAttempts||[],practiceConfirmed:state.practice.includes(i)},null,2));
  if(state.codeSnapshots[i])add(dir+'my-accepted-answer.txt',state.codeSnapshots[i]);
  for(let n=0;n<lesson.workshop.length;n++){
   const record=draft.labs[n];if(!record)continue;
   const stem=dir+'steps/step-'+String(n+1).padStart(2,'0');
   add(stem+'-current.txt',workshopExample(lesson.workshop[n],record.answers||{}));
   const accepted=record.accepted||(workshopPassed(lesson.workshop[n],record)?record.answers:null);
   if(accepted)add(stem+'-accepted.txt',workshopExample(lesson.workshop[n],accepted));
   if(record.attempts?.length)add(stem+'-attempts.json',JSON.stringify(record.attempts,null,2));
  }
  for(const [key,file] of Object.entries(draft.workspace?.files||{})){
   if(typeof file.code!=='string')continue;
   const safeKey=key.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,50),module='day'+String(i+1).padStart(2,'0')+'-'+safeKey;
   if(/^\d+\.\d+\.\d+$/.test(file.lastRun?.version||''))compilerVersions.push(file.lastRun.version);
   modules.push(module);entry.savedPrograms.push(module);manifest.consoleProjects.push(module);
   add('kotlin-project/'+module+'/src/main/kotlin/Main.kt',file.code);
   const pkg=/^\s*package\s+([\w.]+)/m.exec(file.code)?.[1];
   add('kotlin-project/'+module+'/build.gradle.kts',`plugins { kotlin("jvm"); application }\nkotlin { jvmToolchain(17) }\napplication { mainClass.set("${pkg?pkg+'.':''}MainKt") }\n`);
   if(file.runs?.length)add(dir+'console/'+safeKey+'-run-history.json',JSON.stringify(file.runs,null,2));
   if(file.lastRun){add(dir+'console/'+safeKey+'-last-run.json',JSON.stringify(file.lastRun,null,2));add(dir+'console/'+safeKey+'-output.txt',file.lastRun.consoleText||'');add(dir+'console/'+safeKey+'-executed-source.kt',file.lastRun.source||'');}
  }
  if(kit&&i<7&&solutionForAndroid(i)){
   for(const [path,value] of Object.entries(buildAndroidFiles(kit,i,solutionForAndroid(i))))add('android-projects/'+path,value);
   manifest.androidProjects.push('HabitLab-Day-'+(i+1));
  }
  manifest.lessons.push(entry);
 }
 if(modules.length){
  add('kotlin-project/settings.gradle.kts','pluginManagement { repositories { gradlePluginPortal(); mavenCentral() } }\ndependencyResolutionManagement { repositories { mavenCentral() } }\nrootProject.name = "MyHabitLabCode"\n'+modules.map(m=>'include(":'+m+'")').join('\n')+'\n');
  const compilerVersion=compilerVersions.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).at(-1)||'2.3.10';manifest.kotlinVersion=compilerVersion;
  add('kotlin-project/build.gradle.kts','plugins { kotlin("jvm") version "'+compilerVersion+'" apply false }\n');
  if(kit){for(const name of ['gradlew','gradlew.bat','gradle/wrapper/gradle-wrapper.properties','gradle/wrapper/gradle-wrapper.jar'])if(kit.files[name])add('kotlin-project/'+name,kit.files[name]);}
  add('kotlin-project/README.md','# Твои Kotlin-программы\n\nОткрой эту папку в IntelliJ IDEA. Нужен JDK 17 и интернет для первого Gradle Sync.\nКаждый сохранённый файл — отдельный модуль, чтобы main и классы разных упражнений не конфликтовали.\n\nЗапуск первого файла:\n```sh\nchmod +x gradlew\n./gradlew :'+modules[0]+':run\n```\n\nКод сохранён точно как в редакторе. Если последняя версия содержала ошибку или не имела main(), её нужно исправить. При явном @file:JvmName измени application.mainClass в build.gradle.kts.\n');
 }
 const certificate=courseCertificateHTML();if(certificate)add('certificate.html',certificate);
 add('manifest.json',JSON.stringify(manifest,null,2));
 add('README.md',`# Мой курс Habit Lab\n\nЭкспорт: ${manifest.exportedAt}\n\n- progress.json: резервная копия для импорта на сайт.\n- lessons/: твои ответы, попытки, собранные фрагменты и вывод консоли.\n- kotlin-project/: ${modules.length} сохранённых программ из редактора в отдельных Gradle-модулях.\n- android-projects/: ${manifest.androidProjects.length} Android-проектов с твоими принятыми итоговыми ответами и готовой обвязкой.\n${certificate?'- certificate.html: сертификат, открыть в браузере и напечатать в PDF.':'- Сертификат пока не выдан: нужно завершить все шаги, проверки и практику.'}\n\n## Что важно\nСайт сохраняет введённый на нём код. Изменения, сделанные только в Android Studio или IntelliJ, сайт автоматически не видит.\nAndroid-обвязка и Gradle-файлы — шаблоны курса; MY_SOLUTION.txt — твой принятый ответ.\nЭти материалы не превращают отдельные ответы Java/Spring в автоматически собранный production-бэкенд. Фрагменты этих недель сохранены в lessons/ для переноса в проект.\nОбычный Kotlin запускается онлайн через JetBrains. Android и Spring с зависимостями собираются в IDE.\nАрхив сохраняет и незавершённые/ошибочные варианты; успешный прошлый запуск не гарантирует, что последняя отредактированная версия собирается.\n`);
 return files;
}
async function downloadCourseArchive(){
 const button=$('#downloadCourseArchive');if(button)button.disabled=true;
 try{if(course.length!==21)throw Error('Дождись загрузки уроков.');let kit;const response=await fetch('android-kit.json');if(!response.ok)throw Error('Не загрузились файлы проектов. Попробуй скачать ещё раз.');kit=await response.json();const files=buildCourseArchiveFiles(kit);downloadCourseFile('HabitLab-My-Course.zip',zipBytes(files));$('#storageMessage').textContent='Архив скачан: код, ответы, проекты и прогресс.';}
 catch(error){$('#storageMessage').textContent='Не удалось собрать архив: '+error.message;}
 finally{if(button)button.disabled=false;}
}
$('#downloadCourseArchive').onclick=downloadCourseArchive;
