// A single browser-operator delegates a human @all cleanup instruction to the
// nearest *available* authorised robot. Scene execution remains in the
// existing work-order/inventory pipeline, never in free-form model dialogue.
const normalize=s=>String(s||'').trim().toLocaleLowerCase().replace(/\s+/g,' ');
const groupPrefix=/^\s*@(?:all|everyone)\b[\s,:-]*/i;
const cleanupVerb=/\b(?:move|moved|moving|collect|collected|collecting|clear|clearing|tidy|tidying|pick\s*up|picked\s*up|dispose|disposed|put|putting|take|taken|deliver|delivered)\b/i;
export function groupBoxCleanupInstruction(text=''){
 const value=String(text||'').slice(0,1800);
 if(!groupPrefix.test(value))return null;
 if(!/\b(?:boxes|box\s+cop(?:y|ies)|box\s+copy\s*\.{0,3})\b/i.test(value)||
    !/\b(?:bin|junk|rubbish|trash)\b/i.test(value)||!cleanupVerb.test(value))return null;
 if(/\b(?:don't|do\s+not|never|stop)\s+(?:\w+\s+){0,2}(?:move|collect|put|pick|dispose)\b/i.test(value))return null;
 return value.trim();
}
export function groupBinClarification(text=''){
 const message=String(text||'').trim();
 return groupPrefix.test(message)&&/\b(?:target|destination|bin|junk)\b/i.test(message)&&
  /\b(?:called|named|is|located|by|near|at)\b/i.test(message)&&!groupBoxCleanupInstruction(message)?message:null;
}
export function sceneBinTargets(items=[]){
 return items.filter(o=>o&&o.userData?.editorId&&
   ['furniture','model','cube','cylinder'].includes(o.userData.editorKind)&&
   /\b(?:bin|junk)\b/i.test(o.name||''));
}
export function requestedBinName(text='',history=[]){
 const refs=[String(text||'')];
 // Only human user speech may name the destination. Robot speculation cannot
 // silently authorize choosing a different bin.
 for(const msg of [...history].reverse().slice(0,80)){
  if(msg?.role!=='user'||typeof msg.text!=='string')continue;
  refs.push(msg.text);
 }
 for(const ref of refs){
  const quoted=/["“']\s*(Bin\s*[-–:]\s*[^"”'\n]{2,90})\s*["”']/i.exec(ref);
  if(quoted)return quoted[1].trim();
  const named=/\b(Bin\s*[-–:]\s*(?:Big\s+Junk|Junk\s+Big|[^\n,.;!?]{3,60}))\b/i.exec(ref);
  if(named)return named[1].trim().replace(/\s+(?:by|near|at)\s+.*$/i,'').trim();
 }
 return '';
}
export function selectCleanupTarget(items=[],text='',history=[]){
 const candidates=sceneBinTargets(items),named=requestedBinName(text,history);
 const matching=named?candidates.filter(o=>normalize(o.name)===normalize(named)):candidates.filter(o=>/\bjunk\b/i.test(o.name));
 if(matching.length===1)return {target:matching[0],targetName:matching[0].name,reason:'exactly identified destination'};
 if(matching.length>1)return {target:null,targetName:named,reason:'ambiguous matching junk bins'};
 if(named)return {target:null,targetName:named,reason:'named bin not present in the loaded scene'};
 return {target:null,targetName:'',reason:'no uniquely identified junk bin; ask for the exact scene name'};
}
export function nearestAvailableCleanupWorker(robots=[],boxes=[],{busyIds=[],controlledId='',canEdit=()=>false}={}){
 const occupied=new Set(busyIds);
 const available=robots.filter(o=>o?.userData?.editorKind==='robot'&&o.userData.editorId!==controlledId&&
   !occupied.has(o.userData.editorId)&&!o.userData.robotMission&&canEdit(o));
 if(!available.length||!boxes.length)return null;
 const near=bot=>Math.min(...boxes.map(box=>{
  const dx=(Number(bot.position?.x)||0)-(Number(box.position?.x)||0);
  const dz=(Number(bot.position?.z)||0)-(Number(box.position?.z)||0);
  return dx*dx+dz*dz;
 }));
 return [...available].sort((a,b)=>near(a)-near(b)||String(a.userData.editorId).localeCompare(String(b.userData.editorId)))[0];
}
export function boxCleanupProjectGoal(targetName=''){
 return targetName?`@all move Box copies into ${targetName}`:'';
}
