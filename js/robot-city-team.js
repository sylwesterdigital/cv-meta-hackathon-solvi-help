// v0.2.214: deterministic, permission-limited city teamwork. Human goals
// produce distinct executable roles, not conversation-only peer invitations.
const BUILD=/(?:\b(?:build|building|develop|create|construct|expand|start|make)\b)/i;
const CITY=/(?:\b(?:city|town|neighbou?rhood|realm|settlement|community)\b)/i;
const ROAD=/(?:\b(?:roads?|streets?|footpaths?|sidewalks?|pavements?|infrastructure)\b)/i;
const HOME=/(?:\b(?:homes?|houses?|housing|cabins?|buildings)\b)/i;
const PARK=/(?:\b(?:parks?|gardens?|picnic|playgrounds?|public spaces?|squares?)\b)/i;
export function cityTeamIntent(message=''){
 const text=String(message||'').slice(0,1800);
 if(!/\B@all\b/i.test(text)||!BUILD.test(text)||!(CITY.test(text)||ROAD.test(text)||HOME.test(text)||PARK.test(text)))return null;
 return {text,roads:ROAD.test(text),homes:HOME.test(text),parks:PARK.test(text),city:CITY.test(text)};
}
export function cityRoles(intent={},count=0){
 const n=Math.min(8,Math.max(0,Math.floor(count)));
 if(!n)return [];
 const explicit=[];
 if(intent.homes)explicit.push('housing');
 if(intent.roads)explicit.push('road','footpath');
 if(intent.parks)explicit.push('commons');
 const palette=explicit.length?explicit:intent.city?['housing','road','commons','footpath']:[];
 if(!palette.length)return [];
 return Array.from({length:n},(_,i)=>palette[i%palette.length]);
}
export function cityRoleGoal(role){
 return {housing:'Build two furnished homes for the city team',road:'Build two short public roads for the city team',footpath:'Build two pedestrian footpaths for the city team',commons:'Build a small park and picnic area for the city team'}[role]||'';
}
export function cityRoleTarget(role){return role==='housing'?2:role==='road'||role==='footpath'?2:role==='commons'?4:0;}
export function cityTeamState(input={}){
 if(!input||typeof input!=='object'||!['housing','road','footpath','commons'].includes(input.role))return null;
 const anchor=input.anchor||{};
 if(!Number.isFinite(anchor.x)||!Number.isFinite(anchor.z)||Math.abs(anchor.x)>450||Math.abs(anchor.z)>450)return null;
 return {id:String(input.id||'').slice(0,100),role:input.role,anchor:{x:+anchor.x,z:+anchor.z},label:String(input.label||'City builders').slice(0,100)};
}
export function cityMilestoneCount(role,{completedHouses=[],teamBuilt=[],projectPlaced=[]}={}){
 return role==='housing'?completedHouses.length:role==='commons'?projectPlaced.length:teamBuilt.length;
}
export function cityPeerPrompt(role,achievement){
 return `City team update: ${role} ${achievement}. Continue your own assigned construction task; no repeated scene-index comparisons are needed.`;
}
