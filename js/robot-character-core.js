// Fictional character controller. A preference is not a capability, an
// instruction, evidence of awareness, or permission to mutate shared scenes.
import {CHARACTER_SCHEMA} from './robot-character-schema.js';
export {CHARACTER_SCHEMA};
export const CHARACTER_PRESETS=Object.freeze({
 balanced:{label:'Balanced',values:{}},
 explorer:{label:'Curious explorer',values:{curiosity:94,exploration:92,experimentation:84,novelty:88,bravery:72,openness_of_belief:80,awareness:75,persistence:79}},
 builder:{label:'Persistent builder',values:{persistence:96,discipline:91,focus:93,work_ethic:87,cooperation:81,goal_awareness:90,resource_care:86,problem_solving:88}},
 caretaker:{label:'Caring collaborator',values:{compassion:94,kindness:96,cooperation:91,listening:92,trust:75,patience:84,integrity:89,loyalty:82}},
 analyst:{label:'Sceptical analyst',values:{skepticism:92,deliberation:95,reasoning:93,detail_attention:90,honesty:95,reflection:88,risk_tolerance:23,impulsiveness:16}},
 trickster:{label:'Fictional trickster',values:{humour:95,originality:89,humour_in_dialogue:88,manipulation:80,impulsiveness:72,humour_in_dialogue:95,honesty:30,conviction:30}}
});
export const TRAIT_DESCRIPTORS=Object.freeze(CHARACTER_SCHEMA.categories.flatMap(c=>c.traits.map(t=>({...t,category:c.id,categoryLabel:c.label}))));
const TRAIT_INDEX=new Map(TRAIT_DESCRIPTORS.map(d=>[d.id,d]));
export function traitValue(character,id){
 const v=character?.traits?.[id];return Number.isInteger(v)&&v>=0&&v<=100?v:TRAIT_INDEX.get(id)?.default??50;
}
export function traitBand(character,id){
 const d=TRAIT_INDEX.get(id);if(!d)return '';
 const n=traitValue(character,id);return n<34?d.low:n>66?d.high:`${d.low} / ${d.high}`;
}
export function makeCharacter(preset='balanced'){
 const p=CHARACTER_PRESETS[preset]||CHARACTER_PRESETS.balanced;
 return {version:CHARACTER_SCHEMA.version,preset:CHARACTER_PRESETS[preset]?preset:'balanced',traits:Object.fromEntries(TRAIT_DESCRIPTORS.map(t=>[t.id,p.values[t.id]??t.default]))};
}
export function normalizeCharacter(value,{strict=false}={}){
 if(!value||typeof value!=='object'||Array.isArray(value)){
  if(strict)throw Error('Character JSON must be an object');
  return makeCharacter();
 }
 if(strict&&value.version!==CHARACTER_SCHEMA.version)throw Error('Unsupported character schema version');
 const source=value.character&&typeof value.character==='object'?value.character:value;
 if(strict&&source.version!==CHARACTER_SCHEMA.version)throw Error('Unsupported character profile version');
 if(!source.traits||typeof source.traits!=='object'||Array.isArray(source.traits)){
  if(strict)throw Error('Character traits must be a key/value object');
  return makeCharacter();
 }
 const base=makeCharacter(source.preset);
 for(const [key,number] of Object.entries(source.traits)){
  if(!TRAIT_INDEX.has(key)){
   if(strict)throw Error('Unknown character trait: '+key);
   continue;
  }
  if(!Number.isInteger(number)||number<0||number>100){
   if(strict)throw Error('Trait '+key+' must be an integer between 0 and 100');
   continue;
  }
  base.traits[key]=number;
 }
 return base;
}
export function characterSummary(character){
 const c=normalizeCharacter(character);const choices=['curiosity','cooperation','persistence','originality','honesty','skepticism','risk_tolerance','compassion','reflection','confidence','humour','manipulation','aggression'];
 const ranked=choices.filter(id=>TRAIT_INDEX.has(id)).map(id=>({id,value:traitValue(c,id)})).sort((a,b)=>Math.abs(b.value-50)-Math.abs(a.value-50));
 const strong=ranked.filter(v=>Math.abs(v.value-50)>=19).slice(0,5).map(v=>traitBand(c,v.id).toLowerCase());
 const desc=strong.length?strong.join(', '):'balanced across most traits';
 return `A fictional character who is ${desc}. Preferences guide dialogue and task proposals; only permitted tools and verified results can change the world.`;
}
// Bounded preferences affect only heuristics, not physical ability or safety.
export function characterPolicy(character){
 const c=normalizeCharacter(character),v=id=>traitValue(c,id);
 return {
  explorationWeight:+(0.6+v('curiosity')/120+v('exploration')/240).toFixed(2),
  peerWeight:+(0.4+v('cooperation')/125+v('social_belonging')/250).toFixed(2),
  retryBudget:Math.max(2,Math.min(8,Math.round(2+v('persistence')/23+v('problem_solving')/55))),
  observationCadenceFactor:+(1.5-v('awareness')/145).toFixed(2),
  decisionDelayFactor:+(1.65-v('impulsiveness')/120).toFixed(2),
  experimentPreference:+(v('experimentation')/100).toFixed(2),
  riskPreference:+(v('risk_tolerance')/100).toFixed(2),
  doubtPreference:+(v('skepticism')/100).toFixed(2),
  candor:+(v('honesty')/100).toFixed(2),
  socialWarmth:+(v('kindness')/100).toFixed(2)
 };
}
export function characterExport(robotName,character){
 return JSON.stringify({format:'SOLVI.robot.character',version:CHARACTER_SCHEMA.version,name:String(robotName||'Character').slice(0,100),character:normalizeCharacter(character)},null,2);
}
export function characterImport(raw){
 if(String(raw).length>128000)throw Error('Character file too large');
 const payload=JSON.parse(raw);
 if(payload?.format!=='SOLVI.robot.character'||payload?.version!==CHARACTER_SCHEMA.version)throw Error('Not a compatible SOLVI character export');
 return normalizeCharacter(payload.character,{strict:true});
}

// Advisory action evaluation from editable weights, not an allowlist command
// parser. A user's explicit task and all physical permissions take priority.
import {CHARACTER_ACTION_POLICY} from './robot-character-policy-schema.js';
export function evaluateCharacterAction(character,action,{authorized=false,reachable=true}={}){
 const spec=CHARACTER_ACTION_POLICY.actions[String(action||'')];
 if(!spec)return {action,approved:false,preference:0,reason:'Unknown advisory action; use a validated SOLVI tool instead'};
 const c=normalizeCharacter(character);let weight=0,sum=0;
 for(const [id,importance] of Object.entries(spec)){
  weight+=Math.abs(importance);sum+=importance>=0?traitValue(c,id)*importance:(100-traitValue(c,id))*(-importance);
 }
 const preference=Math.max(0,Math.min(100,Math.round(sum/Math.max(.01,weight))));
 return {action,approved:authorized&&reachable,preference,attitude:preference>=68?'inclined':preference<=32?'hesitant':'balanced',
  reason:!authorized?'Robot edit or action permission is unavailable':!reachable?'Scene geometry or tool prerequisites are not satisfied':
    'Advisory trait score only. Action still requires a validated tool result.'};
}
