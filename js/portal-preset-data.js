// A portal preset is ONE linked pair, never a single stale portal with a dangling ID.
// Pure data helpers: save relative placement and regenerate both links on insertion.
const numeric3=value=>Array.isArray(value)&&value.length===3&&value.every(n=>typeof n==='number'&&Number.isFinite(n));
const scale3=value=>numeric3(value)&&value.every(n=>n>=.001&&n<=1000);
const safeName=value=>typeof value==='string'&&value.length>0&&value.length<=100;
const pairPart=(value,role,partner)=>value?.kind==='portal'&&safeName(value.name)&&numeric3(value.position)&&numeric3(value.rotation)&&scale3(value.scale)&&value.portal?.role===role&&value.portal.partner===partner&&['auto','button'].includes(value.portal.mode)&&['square','rounded','triangle','field','orb'].includes(value.portal.shape)&&['rainbow','mystery','glow','pulse'].includes(value.portal.effect);
export function validPortalPairPreset(data){
 if(!data||data.kind!=='portalPair'||!pairPart(data.entry,'entry','preset_exit')||!pairPart(data.exit,'exit','preset_entry'))return false;
 if(data.entry.position.some(n=>n!==0)||data.exit.position.some(n=>Math.abs(n)>1000))return false;
 return true;
}
export function portalPairPreset(first,second){
 if(!first||!second||first.kind!=='portal'||second.kind!=='portal')return null;
 const entry=first.portal?.role==='entry'?first:second,exit=entry===first?second:first;
 if(entry.portal?.role!=='entry'||exit.portal?.role!=='exit'||entry.portal?.partner!==exit.id||exit.portal?.partner!==entry.id||!numeric3(entry.position)||!numeric3(exit.position)||!numeric3(entry.rotation)||!numeric3(exit.rotation)||!scale3(entry.scale)||!scale3(exit.scale))return null;
 const capture=(item,role,partner,position)=>({kind:'portal',name:String(item.name||`Portal ${role}`).slice(0,100),position,rotation:[...item.rotation],scale:[...item.scale],portal:{...structuredClone(item.portal),role,partner}});
 const data={kind:'portalPair',entry:capture(entry,'entry','preset_exit',[0,0,0]),exit:capture(exit,'exit','preset_entry',exit.position.map((n,i)=>n-entry.position[i]))};
 return validPortalPairPreset(data)?data:null;
}
export function portalPairEntries(preset,entryPosition,owner,createId){
 if(!validPortalPairPreset(preset)||!numeric3(entryPosition)||typeof createId!=='function')return null;
 const entryId=createId(),exitId=createId();if(typeof entryId!=='string'||typeof exitId!=='string'||entryId===exitId)return null;
 return [
  {...structuredClone(preset.entry),id:entryId,owner,position:[...entryPosition],portal:{...structuredClone(preset.entry.portal),role:'entry',partner:exitId}},
  {...structuredClone(preset.exit),id:exitId,owner,position:preset.exit.position.map((v,i)=>v+entryPosition[i]),portal:{...structuredClone(preset.exit.portal),role:'exit',partner:entryId}}
 ];
}
