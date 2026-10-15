/* JetBrains Kotlin Playground protocol; never executes submitted code in this page. */
(function(root){
'use strict';
const BASE='https://api.kotlinlang.org';
let cachedVersion;
async function compilerVersion(fetcher,signal){
 if(cachedVersion)return cachedVersion;
 const response=await fetcher(BASE+'/versions',{signal});if(!response.ok)throw Error('Сервис версий компилятора недоступен: HTTP '+response.status);
 const versions=await response.json(),stable=versions.find(v=>v.latestStable&&!v.obsolete);
 if(!stable||!/^\d+\.\d+\.\d+$/.test(stable.version))throw Error('Не удалось определить стабильную версию Kotlin.');
 cachedVersion=stable.version;return cachedVersion;
}
function outputText(text){
 // Remove only the protocol's stream delimiters. User output stays text, never HTML.
 return String(text||'').replace(/<\/?(?:outStream|errStream|inStream)>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
}
function formatResult(data,version){
 const diagnostics=Object.entries(data.errors||{}).flatMap(([file,errors])=>(Array.isArray(errors)?errors:[]).map(e=>({file,severity:e.severity||'INFO',message:String(e.message||''),line:Number.isInteger(e.interval?.start?.line)?e.interval.start.line+1:null,column:Number.isInteger(e.interval?.start?.ch)?e.interval.start.ch+1:null})));
 const hasErrors=diagnostics.some(e=>e.severity==='ERROR'),exception=data.exception;
 const exceptionText=exception?String(exception.message||exception.fullName||exception.className||JSON.stringify(exception)):'';
 const stdout=outputText(data.text);
 const diagnosticText=diagnostics.map(e=>`${e.severity} ${e.file}${e.line?':'+e.line:''}${e.column?':'+e.column:''}: ${e.message}`).join('\n');
 const ok=!hasErrors&&!exception;
 const consoleText=[diagnosticText,stdout,exceptionText?('Ошибка выполнения: '+exceptionText):'',ok&&!stdout?'Программа завершилась без вывода. Добавь println(...) в main(), чтобы увидеть результат.':''].filter(Boolean).join('\n');
 return {ok,compiled:!hasErrors,version,diagnostics,stdout,consoleText};
}
async function run(code,{fetcher=fetch,signal}={}){
 if(!code.trim())throw Error('Редактор пуст. Напиши программу с fun main().');
 if(code.length>32000)throw Error('Для онлайн-запуска доступно до 32 000 символов. Скачай большой файл и запусти в IDE.');
 const version=await compilerVersion(fetcher,signal);
 const response=await fetcher(BASE+'/api/'+version+'/compiler/run',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({args:'',files:[{name:'Main.kt',text:code,publicId:''}],confType:'java'}),signal});
 if(!response.ok)throw Error(response.status===429?'Сервис перегружен. Подожди и повтори запуск.':'Компилятор ответил HTTP '+response.status+'. Код сохранён; попробуй позже.');
 const data=await response.json();if(!data||typeof data!=='object'||!Object.hasOwn(data,'errors'))throw Error('Неожиданный ответ сервиса компиляции.');
 return formatResult(data,version);
}
const api={run,formatResult,outputText};root.KotlinRunner=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
