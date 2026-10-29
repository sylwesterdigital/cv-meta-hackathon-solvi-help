// Local-only visibility controls for individual robot diagnostics.
export const ROBOT_DEBUG_ALL_KEY='solvi-brain-debug';
export const ROBOT_DEBUG_SELECTION_KEY='solvi-brain-debug-robots';
export function readDebugSelection(storage){
 try{const list=JSON.parse(storage.getItem(ROBOT_DEBUG_SELECTION_KEY)||'[]');return new Set(Array.isArray(list)?list.filter(x=>typeof x==='string'):[]);}catch{return new Set();}
}
export function robotDebugVisible(robotId,storage){
 return storage.getItem(ROBOT_DEBUG_ALL_KEY)==='1'||(!!robotId&&readDebugSelection(storage).has(robotId));
}
export function setRobotDebug(robotId,enabled,storage){
 if(!robotId)return;
 const set=readDebugSelection(storage);if(enabled)set.add(robotId);else set.delete(robotId);
 storage.setItem(ROBOT_DEBUG_SELECTION_KEY,JSON.stringify([...set]));
}
