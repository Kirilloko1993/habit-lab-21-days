/* Small expression evaluator for the explicitly supported training subset.
   It does not execute JS, compile Kotlin, or send learner code to a third party. */
(function(root){
'use strict';
function parse(source){
  if(source.length>1200)throw Error('Слишком длинное выражение: допиши только пропуск.');
  const tokens=[];let pos=0;
  while(pos<source.length){
    const m=/^\s+|^(?:\d+|[A-Za-z_][A-Za-z_0-9]*(?:\.[A-Za-z_][A-Za-z_0-9]*)*|>=|<=|==|!=|&&|\|\||[()+\-*/%!,<>])/.exec(source.slice(pos));
    if(!m)throw Error('Здесь проверяем целочисленное выражение: числа, имена, + − * / %, сравнения, &&, || и if/else.');
    pos+=m[0].length;if(m[0].trim())tokens.push(m[0]);if(tokens.length>300)throw Error('Упрости выражение.');
  }
  let cursor=0,depth=0;
  const peek=()=>tokens[cursor],take=()=>tokens[cursor++];
  function need(s){if(take()!==s)throw Error('Ожидается «'+s+'». Проверь скобки и синтаксис.');}
  function primary(){
    if(++depth>60)throw Error('Слишком много вложенных скобок.');
    let node;const token=take();
    if(token==='if'){
      need('(');const condition=expression();need(')');const yes=expression();need('else');const no=expression();node={type:'if',condition,yes,no};
    }else if(token==='('){node=expression();need(')');}
    else if(token==='!'||token==='-'||token==='+')node={type:'unary',op:token,value:primary()};
    else if(token==='true'||token==='false')node={type:'literal',value:token==='true'};
    else if(token&&/^\d+$/.test(token)){const value=Number(token);if(!Number.isSafeInteger(value))throw Error('Слишком большое число.');node={type:'literal',value};}
    else if(token&&/^[A-Za-z_]/.test(token)&&token!=='else'){
      if(peek()==='('){take();const args=[];if(peek()!==')'){args.push(expression());while(peek()===','){take();args.push(expression());}}need(')');node={type:'call',name:token,args};}
      else node={type:'name',name:token};
    }else throw Error('Не хватает значения. После оператора нужны число, параметр или выражение.');
    depth--;return node;
  }
  const levels=[['||'],['&&'],['==','!='],['>','>=','<','<='],['+','-'],['*','/','%']];
  function binary(level){if(level===levels.length)return primary();let left=binary(level+1);while(levels[level].includes(peek())){const op=take();left={type:'binary',op,left,right:binary(level+1)};}return left;}
  function expression(){return binary(0);}
  const result=expression();if(cursor!==tokens.length)throw Error('Лишний фрагмент «'+peek()+'». Введи только код для пропуска.');return result;
}
function execute(node,env){
  const number=x=>{if(typeof x!=='number'||!Number.isSafeInteger(x))throw Error('Здесь ожидается целое число Int.');return x;};
  const bool=x=>{if(typeof x!=='boolean')throw Error('В условии нужен Boolean: сравни числа через >, >= или ==.');return x;};
  if(node.type==='literal')return node.value;
  if(node.type==='name'){if(!Object.hasOwn(env,node.name))throw Error('Нет переменной «'+node.name+'». Используй имена из готового кода.');return env[node.name];}
  if(node.type==='if')return execute(bool(execute(node.condition,env))?node.yes:node.no,env);
  if(node.type==='unary'){const v=execute(node.value,env);return node.op==='!'?!bool(v):node.op==='-'?-number(v):number(v);}
  if(node.type==='call'){
    const args=node.args.map(n=>number(execute(n,env)));
    if(node.name==='minOf'&&args.length>=2)return Math.min(...args);
    if(node.name==='maxOf'&&args.length>=2)return Math.max(...args);
    throw Error('Для этого упражнения доступны minOf, maxOf или обычный if.');
  }
  const a=execute(node.left,env);
  if(node.op==='&&')return bool(a)&&bool(execute(node.right,env));
  if(node.op==='||')return bool(a)||bool(execute(node.right,env));
  const b=execute(node.right,env);
  if(node.op==='==')return a===b;
  if(node.op==='!=')return a!==b;
  number(a);number(b);
  switch(node.op){case '+':return number(a+b);case '-':return number(a-b);case '*':return number(a*b);case '/':if(b===0)throw Error('Деление на ноль.');return Math.trunc(a/b);case '%':if(b===0)throw Error('Остаток от деления на ноль.');return a%b;case '>':return a>b;case '>=':return a>=b;case '<':return a<b;case '<=':return a<=b;}
  throw Error('Неподдерживаемая операция.');
}
const canonical=value=>String(value).trim().match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\S/g)?.join('').replace(/;+$/,'')||'';
function checkSlot(slot,value){
  if(!String(value).trim())return {ok:false,message:'Заполни этот пропуск.',cases:[]};
  if(slot.kind==='expression'){
    try{const ast=parse(value),cases=slot.tests.map(test=>{try{const actual=execute(ast,test.env);return {...test,actual,ok:actual===test.expected};}catch(error){return {...test,ok:false,error:error.message};}});return {ok:cases.every(c=>c.ok),message:cases.every(c=>c.ok)?'Контрольные примеры совпали.':'Есть несовпадение. Сравни вход и результат в таблице.',cases};}
    catch(error){return {ok:false,message:error.message,cases:[]};}
  }
  return {ok:slot.answers.some(a=>canonical(a)===canonical(value)),message:'Проверка учебного фрагмента по допустимым вариантам.',cases:[]};
}
function checkStep(step,values){const results=step.slots.map(s=>({slot:s,...checkSlot(s,values[s.id]||'')}));return {ok:results.every(r=>r.ok),results};}
function readDraft(raw){
  if(typeof raw!=='string')return {code:'',labs:{}};
  if(raw.startsWith('HABITLAB_WORKSHOP_V2\n')){try{const data=JSON.parse(raw.slice(21));if(data&&typeof data==='object'&&data.labs&&typeof data.labs==='object')return {...data,code:typeof data.code==='string'?data.code:'',labs:data.labs};}catch{}}
  return {code:raw,labs:{}};
}
function writeDraft(data){return 'HABITLAB_WORKSHOP_V2\n'+JSON.stringify(data);}
const api={parse,execute,checkSlot,checkStep,readDraft,writeDraft};root.WorkshopEngine=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
