// v0.2.188: bounded autonomous work orders. Pure validation so decisions from
// Meta remain *proposals* until an authorised scene tool checks them again.
export const AUTONOMY_ACTIONS=Object.freeze(['visit','deliver','build','build_house','use_preset','remove','rest','ask','inspect','idle']);
export const AUTONOMY_MODES=Object.freeze(['agent','deliver','build','house','preset','assist','rest']);
export const AUTONOMY_FURNITURE=Object.freeze(['chair','officeChair','bed','sofa','stool','table','cabinet','bottle','can']);
export const AUTONOMY_MIN_INTERVAL=180;
export function cleanAutonomyOrder(input={}){
 const mode=AUTONOMY_MODES.includes(input.mode)?input.mode:'agent';
 const finite=Number(input.interval);
 return {mode,robotId:String(input.robotId||'').slice(0,100),sourceId:String(input.sourceId||'').slice(0,100),destinationId:String(input.destinationId||'').slice(0,100),
  goal:String(input.goal||'').trim().slice(0,1800),variant:AUTONOMY_FURNITURE.includes(input.variant)?input.variant:'chair',
  interval:Number.isFinite(finite)?Math.max(AUTONOMY_MIN_INTERVAL,Math.min(3600,Math.round(finite))):300,
  vision:input.vision===true,allowChanges:input.allowChanges===true,room:String(input.room||'main').slice(0,100)};
}
export function cleanAutonomyDecision(value,objects=[],robotId='',presets=[]){
 if(!value||typeof value!=='object'||Array.isArray(value)||!AUTONOMY_ACTIONS.includes(value.action))return null;
 const byId=id=>objects.find(o=>o.id===id);
 const target=String(value.target_id||'').slice(0,100),destination=String(value.destination_id||'').slice(0,100);
 const action=value.action,variant=AUTONOMY_FURNITURE.includes(value.variant)?value.variant:'chair';
 const preset=String(value.preset_id||'').slice(0,100);
 if(action==='use_preset'&&!presets.some(p=>p.id===preset))return null;
 if(['visit','deliver','remove','ask','inspect'].includes(action)&&(!target||!byId(target)||target===robotId))return null;
 if(action==='deliver'&&(!destination||!byId(destination)||destination===target||destination===robotId))return null;
 if(action==='ask'&&byId(target)?.kind!=='robot')return null;
 if(action==='deliver'&&byId(target)?.kind==='robot')return null;
 if(action==='remove'&&['robot','light'].includes(byId(target)?.kind))return null;
 if(action==='rest'&&target&&(!byId(target)||target===robotId))return null;
 return {action,target_id:target,destination_id:destination,preset_id:preset,house:value.house&&typeof value.house==='object'&&!Array.isArray(value.house)?value.house:{},variant,
  message:String(value.message||'').trim().slice(0,240),reason:String(value.reason||'').trim().slice(0,240)};
}
export function autonomyProximity(robot,target,max=2){
 if(!robot?.position||!target?.position)return false;
 return Math.hypot(robot.position.x-target.position.x,robot.position.z-target.position.z)<=max;
}
export function autonomyResult(action,ok,detail=''){
 return {action,status:ok?'completed':'failed',detail:String(detail).slice(0,320),at:new Date().toISOString()};
}
