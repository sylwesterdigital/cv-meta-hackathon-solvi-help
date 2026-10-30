// Compact combat controls and deterministic avatar action matching.
// Forces are intentionally bounded; no scene geometry is embedded in a packet.
export const COMBAT_ACTIONS=Object.freeze(['push','punch','kick','throw']);
const DEFAULTS=Object.freeze({push:{key:'',force:5},punch:{key:'KeyP',force:7},kick:{key:'KeyK',force:10},throw:{key:'KeyT',force:6}});
const KNOWN_KEYS=/^(?:Key[A-Z]|Digit[0-9])$/;
export function combatSettings(raw={}){
 const out={};
 for(const action of COMBAT_ACTIONS){
  const item=raw?.[action]||{},fallback=DEFAULTS[action];
  const key=item.key===''?'':KNOWN_KEYS.test(String(item.key||''))?String(item.key):fallback.key;
  const force=Number(item.force);
  out[action]={key,force:Number.isFinite(force)?Math.max(.5,Math.min(20,force)):fallback.force};
 }
 return out;
}
export function combatForKey(code,settings){
 const controls=combatSettings(settings);
 return COMBAT_ACTIONS.find(name=>controls[name].key===code&&code!=='')||null;
}
export function combatClip(names=[],kind,previous=''){
 const pattern={push:/\bpush(?:ing)?\b/i,punch:/\b(?:punch|hook|jab|uppercut|cross)\b/i,kick:/\b(?:kick|kicking|roundhouse|frontkick|sidekick)\b/i,throw:/\b(?:throw|toss|hurl)\b/i}[kind];
 if(!pattern)return null;
 const pool=names.filter(n=>pattern.test(String(n).split('__')[0].replace(/[_-]/g,' ')));
 if(!pool.length)return null;
 const pos=pool.indexOf(previous);
 return pool[(pos+1)%pool.length];
}
export function combatDirection(yaw,kind){
 const f={x:Math.sin(yaw),z:Math.cos(yaw)},multiplier=kind==='kick'?1.3:1;
 return {x:f.x*multiplier,z:f.z*multiplier};
}
export function combatReach(kind){return kind==='kick'?1.35:kind==='throw'?1.4:1.05;}
export function impactImpulse(direction,force,kind){
 const safe=Math.max(.5,Math.min(20,Number(force)||5));
 return {x:direction.x*safe,y:kind==='throw'?safe*.65:kind==='kick'?safe*.17:safe*.05,z:direction.z*safe};
}
export function footfallRate(speed,kind){
 const target=kind==='run'?2.9:kind==='walkBackward'?1.15:1.25;
 return Math.max(.90,Math.min(2.3,(Number.isFinite(speed)?speed:target)/target));
}

// Clip phases are normalized, not wall-clock delays from the key-down event.
// The limb should reach contact around the middle of the authored action.
export function combatTimeline(kind,clipSeconds=0){
 const target={punch:.58,kick:.78,throw:1.02,push:.76}[kind]||.7;
 const source=Number.isFinite(clipSeconds)&&clipSeconds>.05?clipSeconds:target;
 const trimStart=.055,trimEnd=.075;
 const rate=Math.max(.85,Math.min(6.5,source*(1-trimStart-trimEnd)/target));
 const duration=(source*(1-trimStart-trimEnd))/rate;
 return {duration:Math.max(.16,duration),rate,trimStart,trimEnd,impactPhase:{punch:.52,kick:.59,throw:.62,push:.52}[kind]||.55};
}
export function combatPhase(elapsed,duration){return Math.min(1,Math.max(0,(Number(elapsed)||0)/Math.max(.001,duration)));}
