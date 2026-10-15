'use strict';
const workshopSelection = {};
function workshopDraft(i){return WorkshopEngine.readDraft(state.drafts[i]);}
function writeWorkshopDraft(i,draft){state.drafts[i]=WorkshopEngine.writeDraft(draft);save();}
function legacyAnswer(i){return workshopDraft(i).code;}
function saveLegacyAnswer(i,value){const draft=workshopDraft(i);draft.code=value;writeWorkshopDraft(i,draft);}
function workshopPassed(step,record){return !!record?.passed&&WorkshopEngine.checkStep(step,record.answers||{}).ok;}
function workshopCount(i){return course[i].workshop.filter((s,n)=>workshopPassed(s,workshopDraft(i).labs[n])).length;}
function workshopExample(step,values){return step.starter.replace(/\{\{(\w+)\}\}/g,(_,id)=>values[id]?.trim()||'______');}
function workshopSource(step){
  let html='',last=0;const pattern=/\{\{(\w+)\}\}/g;let match;
  while((match=pattern.exec(step.starter))){
    html+=esc(step.starter.slice(last,match.index));
    const n=step.slots.findIndex(s=>s.id===match[1]);
    const target=n===0?'answer':'workshop-'+match[1];
    html+=`<button type="button" class="codeBlank" data-blank-target="${esc(target)}" aria-label="Пропуск ${n+1}. Перейти к полю ответа" aria-controls="${esc(target)}">______<sup>${n+1}</sup></button>`;
    last=pattern.lastIndex;
  }
  return html+esc(step.starter.slice(last));
}
function workshopBlankLocation(step,slot){
  const token='{{'+slot.id+'}}',position=step.starter.indexOf(token),before=step.starter.slice(0,position);
  const line=before.split('\n').length;
  return 'Строка '+line+' в готовом коде. Напиши только часть вместо подчёркивания.';
}
function workshopExplanation(slot){
  if(slot.kind==='expression')return 'Ты пишешь выражение — кусочек кода, который даёт число или true/false. Не добавляй fun, return или println: они уже находятся снаружи пропуска.';
  const a=slot.answers[0];
  if(a==='var'||a==='val')return 'Здесь нужно только ключевое слово. var разрешает присваивать новое значение, val запрещает новое присваивание.';
  if(a==='?.'||a==='?:')return 'Здесь нужны только символы оператора. Не добавляй кавычки: это часть кода, а не текст для экрана.';
  if(a.includes('->'))return 'Структура лямбды: { имя -> действие }. Имя слева — текущий элемент, справа — работа с ним.';
  if(a.startsWith('fun ')||a.startsWith('@Composable'))return 'Это объявление функции: fun имя(параметр: Тип): ТипРезультата { действия }. При вызове функцию заново не объявляют.';
  if(a.includes('('))return 'Скобки () обозначают вызов функции или метода. Точка перед именем обращается к конкретному объекту. Впиши только недостающий фрагмент.';
  if(a.includes('.'))return 'Точка соединяет объект с его свойством или функцией. Свойство читают без (), функцию вызывают со скобками ().';
  if(a.startsWith('@'))return '@ начинает аннотацию — метку для библиотеки или фреймворка. В этом пропуске нужна полная аннотация.';
  return 'Впиши только фрагмент для выделенного места. Остальной код уже готов; переписывать весь пример не нужно. Регистр букв в коде важен.';
}
function workshopFeedback(slot,value){
  if(!value.trim())return 'Пропуск ещё пустой. Начни с подсказки «Как это написать». ';
  if(/\b(done|days|target)\s*\(/.test(value))return 'done, days и target в этом фрагменте — числа, а не функции. После числа не нужны (). Используй арифметику: +, *, /.';
  if(/\bprintln\s*\(/.test(value)&&slot.kind==='expression')return 'println печатает в консоль. Здесь нужно само значение, которое вернёт уже написанный return. Убери println и оставь вычисление.';
  if(/\breturn\b/.test(value)&&slot.kind==='expression')return 'return уже написан в готовом коде. В пропуске нужно только выражение после него.';
  if(/\bfun\b/.test(value)&&slot.kind==='expression')return 'Функция уже объявлена. Допиши только её вычисление, не ещё одну функцию.';
  if(value.includes('??'))return 'В Kotlin запасное значение записывают через ?:, а не ??.';
  if(slot.id==='keyword'&&value.trim()==='val')return 'Ниже счётчик меняется через +=. Для нового присваивания нужен var; val подходит для неизменяемой ссылки.';
  return slot.hint;
}
function renderWorkshop(i){
  const steps=course[i].workshop,draft=workshopDraft(i);
  const first=steps.findIndex((s,n)=>!workshopPassed(s,draft.labs[n]));
  let active=workshopSelection[i];if(!Number.isInteger(active)||active<0||active>=steps.length)active=first<0?steps.length-1:first;
  // Нельзя случайно перескочить через ещё не разобранные задания.
  if(first>=0&&active>first)active=first;
  workshopSelection[i]=active;
  const step=steps[active],record=draft.labs[active]||{},answers=record.answers||{},passed=workshopPassed(step,record),count=workshopCount(i);
  const c=$('#content');
  c.innerHTML=`<article class="workshop card"><div class="workshopHeader"><span class="tag">МАСТЕРСКАЯ · ${active+1}/${steps.length}</span><span class="chip">${count} / ${steps.length} разобрано</span></div><p class="muted">Готовый код → один небольшой шаг → обратная связь → новое требование.</p>${state.solved.includes(i+'-code')&&count<steps.length?'<p class="note">Твои прежние XP и пройденные дни сохранены. Новая мастерская начинается отдельно — можно переучить тему без потери прогресса.</p>':''}<nav class="workshopSteps" aria-label="Шаги мастерской">${steps.map((s,n)=>`<button data-workshop-step="${n}" ${first>=0&&n>first?'disabled':''} aria-current="${n===active?'step':'false'}" class="${n===active?'active':''} ${workshopPassed(s,draft.labs[n])?'complete':''}"><span>${workshopPassed(s,draft.labs[n])?'✓':n+1}</span>${esc(s.title)}</button>`).join('')}</nav><span class="eyebrow">${esc(step.kind)}</span><h3>${esc(step.title)}</h3><p class="workshopBrief">${esc(step.brief)}</p><div class="workshopGuide"><strong>Как работать с этим заданием</strong><ol><li>В коде подчёркнуто место, где чего-то не хватает: <code>______</code>.</li><li>Напиши недостающий код в поле с таким же номером. Можно нажать на подчёркивание, чтобы перейти к этому полю.</li><li>Нажми «Проверить шаг». Если ошибся — прочитай разбор и попробуй снова.</li></ol></div><div class="workshopGrid"><section><div class="codeHeader"><span>Готовый фрагмент · допиши пропуск</span></div><pre class="workshopSource"><code>${workshopSource(step)}</code></pre><form id="workshopForm">${step.slots.map((slot,n)=>`<div class="workshopSlot"><label for="${n===0?'answer':'workshop-'+slot.id}"><b class="blankNumber">${n+1}</b> Ответ для пропуска №${n+1}</label><p class="blankLocation">${esc(workshopBlankLocation(step,slot))}</p><textarea id="${n===0?'answer':'workshop-'+slot.id}" data-workshop-editor data-slot="${esc(slot.id)}" spellcheck="false" autocapitalize="off" rows="${slot.id==='final'?4:2}" placeholder="Твой код вместо ______">${esc(answers[slot.id]||'')}</textarea><details class="syntaxHelp"><summary>Нужна помощь? Объяснить запись</summary><p>${esc(workshopExplanation(slot))}</p></details></div>`).join('')}<div class="actions"><button class="primary" type="submit">Проверить шаг</button><button id="workshopHint" type="button">Подсказка без готового ответа</button></div></form><div id="workshopFeedback" aria-live="polite">${passed?'<div class="feedback success">Этот шаг уже пройден. Можно повторить или идти дальше.</div>':''}</div><details class="workshopSolution"><summary>Застрял? Разобрать готовый вариант</summary>${step.slots.map(s=>`<p><b>${esc(s.label)}</b></p><pre><code>${esc(s.answers[0])}</code></pre><p>${esc(s.explain)}</p>`).join('')}<p class="muted">Просмотр не засчитывает шаг. Впиши решение сам и нажми проверку.</p></details></section><aside class="workshopResult"><span class="eyebrow">ТВОЙ СОБРАННЫЙ КОД</span><pre><code id="workshopAssembled">${esc(workshopExample(step,answers))}</code></pre><p class="muted">Это сборка текста фрагмента, не запущенное Android-приложение.</p><div id="workshopOutcome" class="${passed?'outcomeReady':''}"><strong>${passed?'Что получилось':'Что проверим после ответа'}</strong><p>${esc(step.result)}</p></div><details><summary>Словарь символов прямо здесь</summary><dl><dt>val / var</dt><dd>val — без нового присваивания, var — значение можно менять.</dd><dt>: Тип</dt><dd>Тип переменной, параметра или результата функции. После имени класса : обозначает наследование или реализацию интерфейса.</dd><dt>объект.имя</dt><dd>Обращение к свойству объекта.</dd><dt>имя(...)</dt><dd>Вызов функции с аргументами.</dd><dt>= / ==</dt><dd>= присваивает; == сравнивает значения.</dd><dt>{ x -> действие }</dt><dd>Лямбда: функция без имени с параметром x.</dd><dt>?. / ?:</dt><dd>Безопасное обращение / значение на случай null.</dd></dl></details></aside></div><p class="note">Выражения проверяются на контрольных примерах в учебной модели целочисленного Kotlin. Аннотации, методы и цельные фрагменты сверяются с допустимыми вариантами. Это проверка упражнения. Полную Kotlin/JVM-программу можно скомпилировать в редакторе ниже; Android, Java и Spring с зависимостями запускай в IDE. Синтаксически корректный вариант вне поддержанного подмножества может потребовать образец.</p><div class="actions"><button id="workshopNext" ${!passed?'disabled':''} class="primary">${active===steps.length-1?'Завершить мастерскую → проверить понимание':'Следующий маленький шаг →'}</button><button id="workshopTheory">Открыть объяснение темы</button>${i<2?'<button id="compileWorkshop">Открыть мой фрагмент в компиляторе</button>':''}</div></article>`;
  c.querySelectorAll('[data-workshop-step]').forEach(b=>b.onclick=()=>{workshopSelection[i]=Number(b.dataset.workshopStep);render();});
  c.querySelectorAll('[data-blank-target]').forEach(button=>button.onclick=()=>{const field=document.getElementById(button.dataset.blankTarget);field.focus();field.scrollIntoView({block:'center',behavior:'smooth'});});
  const fields=()=>Object.fromEntries(Array.from(c.querySelectorAll('[data-workshop-editor]')).map(el=>[el.dataset.slot,el.value]));
  c.querySelectorAll('[data-workshop-editor]').forEach(el=>el.oninput=()=>{
    const current=workshopDraft(i),old=current.labs[active]||{};
    current.labs[active]={...old,accepted:old.accepted||(old.passed?old.answers:null),answers:fields(),passed:false};writeWorkshopDraft(i,current);
    $('#workshopAssembled').textContent=workshopExample(step,fields());$('#workshopNext').disabled=true;
    $('#workshopFeedback').textContent='Изменения сохранены. Проверь новую версию.';
  });
  $('#workshopHint').onclick=()=>{feedback('#workshopFeedback',step.slots.map(s=>`<p><b>${esc(s.label)}:</b> ${esc(s.hint)}</p>`).join(''));};
  $('#workshopForm').onsubmit=e=>{
    e.preventDefault();const values=fields(),checked=WorkshopEngine.checkStep(step,values),current=workshopDraft(i);
    const previous=current.labs[active]||{};current.labs[active]={...previous,answers:values,passed:checked.ok,accepted:checked.ok?{...values}:(previous.accepted||(previous.passed?previous.answers:null)),attempts:[...(previous.attempts||[]),{answers:{...values},ok:checked.ok,at:new Date().toISOString()}]};
    if(checked.ok&&active===steps.length-1){current.code=values.final;state.codeSnapshots[i]=values.final;}
    writeWorkshopDraft(i,current);
    if(checked.ok&&steps.every((s,n)=>workshopPassed(s,current.labs[n])))award('code');
    if(checked.ok){
      feedback('#workshopFeedback',`<b>Получилось. ${esc(step.result)}</b>${step.slots.map(s=>`<p>${esc(s.explain)}</p>`).join('')}${checked.results.map(r=>workshopCases(r)).join('')}`,'success');
      $('#workshopNext').disabled=false;$('#workshopOutcome').classList.add('outcomeReady');
      const btn=c.querySelector('[data-workshop-step="'+active+'"]');if(btn){btn.classList.add('complete');btn.querySelector('span').textContent='✓';}
      const next=c.querySelector('[data-workshop-step="'+(active+1)+'"]');if(next)next.disabled=false;
      c.querySelector('.workshopHeader .chip').textContent=workshopCount(i)+' / '+steps.length+' разобрано';
    }else{
      feedback('#workshopFeedback',checked.results.filter(r=>!r.ok).map(r=>`<p><b>${esc(r.slot.label)}:</b> ${esc(r.message)} ${esc(workshopFeedback(r.slot,values[r.slot.id]||''))}</p>${workshopCases(r)}`).join(''),'error');
      $('#workshopNext').disabled=true;
    }
  };
  $('#workshopNext').onclick=()=>{if(!workshopPassed(step,workshopDraft(i).labs[active]))return;if(active<steps.length-1){workshopSelection[i]=active+1;render();$('#content').scrollIntoView({block:'start',behavior:'smooth'});}else setTab('quiz');};
  if($('#compileWorkshop'))$('#compileWorkshop').onclick=()=>loadWorkshopIntoCompiler(i,active);
  $('#workshopTheory').onclick=()=>setTab('learn');
}
function workshopCases(result){if(!result.cases.length)return '';return `<div class="workshopCases"><p><b>Контрольные примеры учебной модели</b></p><table><thead><tr><th>Пример</th><th>Ожидаем</th><th>Получили</th></tr></thead><tbody>${result.cases.map(c=>`<tr class="${c.ok?'caseOK':'caseFail'}"><td>${c.ok?'✓':'✕'} ${esc(c.label)}</td><td>${esc(c.expected)}</td><td>${esc(c.error||c.actual)}</td></tr>`).join('')}</tbody></table></div>`;}
// Keep the regular lesson renderers and the Android bridge intact.
const renderBeforeWorkshop=renderContent;
renderContent=function(){if(tab==='code'&&course[state.last]?.workshop){renderWorkshop(state.last);if(typeof addAndroidBridge==='function')addAndroidBridge();return;}renderBeforeWorkshop();};
