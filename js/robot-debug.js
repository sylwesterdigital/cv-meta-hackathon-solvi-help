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
// Distinct from chat diagnostic tracing. Per-robot path settings are independent.
export const ROBOT_PATH_ALL_KEY='solvi-path-debug-all';
export const ROBOT_PATH_SELECTION_KEY='solvi-path-debug-robots';
export function readPathSelection(storage){
 try{const names=JSON.parse(storage.getItem(ROBOT_PATH_SELECTION_KEY)||'[]');return new Set(Array.isArray(names)?names.filter(v=>typeof v==='string'):[]);}catch{return new Set();}
}
export function robotPathVisible(robotId,storage){return storage.getItem(ROBOT_PATH_ALL_KEY)==='1'||!!robotId&&readPathSelection(storage).has(robotId);}
export function setRobotPath(robotId,enabled,storage){if(!robotId)return;const list=readPathSelection(storage);if(enabled)list.add(robotId);else list.delete(robotId);storage.setItem(ROBOT_PATH_SELECTION_KEY,JSON.stringify([...list]));}
