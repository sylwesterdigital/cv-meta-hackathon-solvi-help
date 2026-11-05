// v0.2.191 · Documented, bounded, deterministic robot construction interface.
// The Meta model proposes data; the editor remains the sole privileged executor.
export const ROBOT_TOOL_API_VERSION='1';
export const ROBOT_TOOL_DESCRIPTIONS=Object.freeze({
 visit:'Navigate to an existing scene ID using the current A* robot movement system.',
 deliver:'Pick up an existing Pickable scene ID, navigate to a destination ID and drop it.',
 build:'Create one supported furniture or basic prop item (including can and bottle) using the human editor generator.',
 build_house:'Build one bounded 3–8m room shell with an actual door opening, windows and roof; optionally furnish it.',
 use_preset:'Place one existing, account-owned Furniture or Architecture preset; preset_id must be in available_presets.',
 remove:'Remove a robot-created item from this browser work session, subject to ownership/permission checks.',
 rest:'Navigate to a real seat or create a chair when allowed; sit and stand using the existing animation/physics tools.',
 ask:'Visit another robot and speak using the existing bounded conversation channel.',
 inspect:'Inspect an existing scene object with SAM visual search and mesh-raycast verification.',
 idle:'Do nothing when the objective is finished or no safe action is available.'
});
const bound=(value,fallback,min,max)=>{
 const number=Number(value);return Number.isFinite(number)&&value!==null&&value!==''?Math.max(min,Math.min(max,number)):fallback;
};
export function houseBlueprint(input={}){
 const width=+bound(input.width,5,3,8).toFixed(2),depth=+bound(input.depth,4,3,8).toFixed(2);
 const height=+bound(input.height,2.8,2.3,4).toFixed(2);
 return {width,depth,height,roof:['flat','shed','pyramid'].includes(input.roof)?input.roof:'pyramid',
  furnish:input.furnish!==false,color:/^#[\da-f]{6}$/i.test(input.color||'')?input.color:'#d0d4c9'};
}
export function houseWallSettings(input={}){
 const p=houseBlueprint(input);
 return {closed:true,smooth:false,points:[[0,0],[p.width,0],[p.width,p.depth],[0,p.depth]],
  height:p.height,width:.19,color:p.color,texture:'bricks',
  doors:{enabled:true,segments:[0],width:1.15,height:2.12},
  windows:{enabled:true,minWidth:3,minHeight:2.3,widthRatio:.38,heightRatio:.39},
  ceiling:{enabled:false},roof:{enabled:true,style:p.roof,color:'#46505c',texture:'concrete',overhang:.28,rise:.9}};
}
export function houseGoal(goal=''){
 // No autonomous construction based on an unrelated casual conversational phrase.
 return /\b(build|construct|make|prepare|create|set up|furnish)\b/i.test(goal)&&/\b(house|home|cabin|small room|hospital|clinic)\b/i.test(goal);
}
export function operatorFailure(error){
 const reason=String(error?.message||error||'Unknown error');
 if(/cooldown|429|three minutes/i.test(reason))return {code:'rate-limited',reason,remedy:'Wait for the next allowed Meta decision; do not retry immediately.'};
 if(/Meta .*failed|HTTP 5|model.*unavailable|502/i.test(reason))return {code:'model-unavailable',reason,remedy:'Use an authorised deterministic construction step if the goal explicitly requests a house, or retry Meta later.'};
 if(/authori[sz]|permission|may not|not allowed|enabled|read-only/i.test(reason))return {code:'permission',reason,remedy:'Check robot ownership, scene edit permission and the Allow scene changes setting.'};
 if(/location|blocked|obstacle|no clear|route|distance/i.test(reason))return {code:'location',reason,remedy:'Find an open site, inspect obstacles and retry from a clear location.'};
 if(/preset/i.test(reason))return {code:'preset',reason,remedy:'Refresh account presets and choose an available Furniture/Architecture preset.'};
 return {code:'tool-error',reason,remedy:'Check the Brain decision log and use another available action; do not report completion.'};
}
export function publicPresetIndex(presets=[]){
 return presets.filter(p=>p&&['furniture','wall'].includes(p.kind)&&typeof p.id==='string')
  .slice(0,35).map(p=>({id:p.id,name:String(p.name||'').slice(0,90),kind:p.kind,category:p.category,
    variant:p.kind==='furniture'?String(p.payload?.furniture?.variant||'').slice(0,36):'room'}));
}
