// Browser-only dispatch policy. All persisted group intents are human-authored;
// the server verifies the source message and atomically claims a free robot.
// This module never mutates the world: scene tools and receipts remain authoritative.
import {nearestAvailableCleanupWorker,sceneBinTargets,selectCleanupTarget} from './robot-group-cleanup.js';

export function sceneBoxCopies(items=[]){
 return items.filter(o=>o?.userData?.editorId&&
  ['furniture','model','cube'].includes(o.userData.editorKind)&&
  /^box\s+cop(?:y|ies)(?:\s*\d+)?$/i.test(String(o.name||'').trim()));
}
export function liveCleanupObservation(items=[],bot=null){
 const boxes=sceneBoxCopies(items),bins=sceneBinTargets(items);
 const position=bot?.position;
 const nearby=position?boxes.filter(o=>Math.hypot(o.position.x-position.x,o.position.z-position.z)<12):[];
 return {observedAt:Date.now(),boxes,nearby,bins};
}
export function chooseQueuedWorker(items=[],busyIds=[],controlledId='',canEdit=()=>false,excludeId='',kind='cleanup_boxes',target=null){
 const robots=items.filter(o=>o.userData?.editorKind==='robot');
 const occupied=[...busyIds];
 const boxes=sceneBoxCopies(items).filter(o=>{
  if(!target)return !o.userData.storage;
  if(target.userData.furniture?.variant==='bin')return !(o.userData.storage?.type==='container'&&o.userData.storage.containerId===target.userData.editorId);
  return Boolean(o.userData.storage)||Math.hypot(o.position.x-target.position.x,o.position.z-target.position.z)>2.5;
 });
 if(kind==='cleanup_boxes'){
  const choices=robots.filter(o=>o.userData.editorId!==excludeId);
  return nearestAvailableCleanupWorker(choices,boxes,{busyIds:occupied,controlledId,canEdit})||
   nearestAvailableCleanupWorker(robots,boxes,{busyIds:occupied,controlledId,canEdit});
 }
 // Multiple independent bounded construction goals can be dispatched to
 // different idle workers; this never interrupts an existing project.
 return robots.filter(o=>o.userData.editorId!==controlledId&&!occupied.includes(o.userData.editorId)&&
  !o.userData.robotMission&&canEdit(o)).sort((a,b)=>String(a.userData.editorId).localeCompare(String(b.userData.editorId)))[0]||null;
}
export function resolveQueuedBin(items=[],message='',humanHistory=[]){
 const selected=selectCleanupTarget(items,message,humanHistory);
 if(!selected.target||!selected.targetName)return {...selected,ready:false};
 return {...selected,ready:true};
}
export function groupRetryDelay(attempts=1){return Math.min(120000,Math.max(8000,8000*2**Math.min(4,Math.max(0,attempts-1))));}
