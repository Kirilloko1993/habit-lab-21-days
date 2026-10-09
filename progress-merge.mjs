export const emptyProgress = () => ({solved:[],practice:[],drafts:{},checks:{},codeSnapshots:{},last:0,name:''});
const maps=['drafts','checks','codeSnapshots'];
export function diffProgress(before,after){
  const patch={solved:after.solved.filter(x=>!before.solved.includes(x)),practice:after.practice.filter(x=>!before.practice.includes(x))};
  for(const key of maps){patch[key]={};for(const [id,value] of Object.entries(after[key]))if(JSON.stringify(value)!==JSON.stringify(before[key][id]))patch[key][id]=value;}
  for(const key of ['last','name'])if(before[key]!==after[key])patch[key]=after[key];
  return patch;
}
export function applyPatch(base,patch){
  const result=structuredClone(base);
  for(const key of ['solved','practice'])result[key]=[...new Set([...result[key],...(patch[key]||[])])];
  for(const key of maps)result[key]={...result[key],...patch[key]};
  for(const key of ['last','name'])if(Object.hasOwn(patch,key))result[key]=patch[key];
  return result;
}
export function mergePatches(first,next){
  const result={};
  for(const key of ['solved','practice'])result[key]=[...new Set([...(first[key]||[]),...(next[key]||[])])];
  for(const key of maps)result[key]={...first[key],...next[key]};
  for(const key of ['last','name']){if(Object.hasOwn(next,key))result[key]=next[key];else if(Object.hasOwn(first,key))result[key]=first[key];}
  return result;
}
