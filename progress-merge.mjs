export const emptyProgress = () => ({solved:[],practice:[],drafts:{},checks:{},codeSnapshots:{},last:0,name:''});
const maps=['drafts','checks','codeSnapshots'];
export function diffProgress(before,after){
  const patch={solved:after.solved.filter(x=>!before.solved.includes(x)),practice:after.practice.filter(x=>!before.practice.includes(x))};
  for(const key of maps){patch[key]={};for(const [id,value] of Object.entries(after[key]))if(JSON.stringify(value)!==JSON.stringify(before[key][id]))patch[key][id]=value;}
  patch.draftDeltas={};for(const [id,value] of Object.entries(after.drafts)){const next=unpack(value),old=unpack(before.drafts[id]);if(next&&value!==before.drafts[id])patch.draftDeltas[id]=objectDelta(old||{},next);}
  for(const key of ['last','name'])if(before[key]!==after[key])patch[key]=after[key];
  return patch;
}
export function applyPatch(base,patch){
  const result=structuredClone(base);
  for(const key of ['solved','practice'])result[key]=[...new Set([...result[key],...(patch[key]||[])])];
  for(const key of maps)result[key]={...result[key],...patch[key]};
  for(const [id,value] of Object.entries(patch.drafts||{})){if(!patch.draftDeltas?.[id]&&unpack(value))result.drafts[id]=PREFIX+JSON.stringify(mergeObject(unpack(base.drafts[id])||{},unpack(value)));}
  for(const [id,delta] of Object.entries(patch.draftDeltas||{})){const old=unpack(base.drafts[id])||{code:base.drafts[id]||'',labs:{}};result.drafts[id]=PREFIX+JSON.stringify(mergeObject(old,delta));}
  for(const key of ['last','name'])if(Object.hasOwn(patch,key))result[key]=patch[key];
  return result;
}
export function mergePatches(first,next){
  const result={};
  for(const key of ['solved','practice'])result[key]=[...new Set([...(first[key]||[]),...(next[key]||[])])];
  for(const key of maps)result[key]={...first[key],...next[key]};
  result.draftDeltas={...first.draftDeltas};for(const [id,delta] of Object.entries(next.draftDeltas||{}))result.draftDeltas[id]=mergeObject(result.draftDeltas[id]||{},delta);
  for(const key of ['last','name']){if(Object.hasOwn(next,key))result[key]=next[key];else if(Object.hasOwn(first,key))result[key]=first[key];}
  return result;
}

const PREFIX='HABITLAB_WORKSHOP_V2\n';
const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function unpack(value){if(typeof value!=='string'||!value.startsWith(PREFIX))return null;try{const v=JSON.parse(value.slice(PREFIX.length));return isObject(v)&&isObject(v.labs)?v:null;}catch{return null;}}
function objectDelta(before,after){const delta={};for(const [key,value] of Object.entries(after)){if(['__proto__','constructor','prototype'].includes(key))continue;if(JSON.stringify(before?.[key])===JSON.stringify(value))continue;delta[key]=isObject(value)?objectDelta(isObject(before?.[key])?before[key]:{},value):value;}return delta;}
function mergeObject(base,delta){const result={...base};for(const [key,value] of Object.entries(delta)){if(['__proto__','constructor','prototype'].includes(key))continue;if(['attempts','runs','quizAttempts'].includes(key)&&Array.isArray(value)){const unique=new Map([...(Array.isArray(result[key])?result[key]:[]),...value].map(v=>[v?.id||JSON.stringify(v),v]));result[key]=[...unique.values()];}else result[key]=isObject(value)?mergeObject(isObject(result[key])?result[key]:{},value):value;}return result;}
export function mergeProgressCopies(older,newer){return applyPatch(older,diffProgress(emptyProgress(),newer));}
