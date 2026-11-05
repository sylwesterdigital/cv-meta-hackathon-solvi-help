// Count actual simulated movement time, not wall clock (inactive tabs pause).
// Repeatedly running a walk animation without moving is NOT progress.
export function checkRobotWalkingProgress(previous,position,goal,dt){
 if(![position?.x,position?.z,goal?.x,goal?.z].every(Number.isFinite))return {sample:null,stuck:false};
 const distance=Math.hypot(goal.x-position.x,goal.z-position.z);
 if(distance<.32)return {sample:null,stuck:false};
 const step=Math.min(.12,Math.max(0,Number(dt)||0));
 if(!previous||!Number.isFinite(previous.x)||!Number.isFinite(previous.z))return {sample:{x:position.x,z:position.z,activeSeconds:0},stuck:false};
 const travelled=Math.hypot(position.x-previous.x,position.z-previous.z);
 if(travelled>.23)return {sample:{x:position.x,z:position.z,activeSeconds:0},stuck:false};
 const activeSeconds=previous.activeSeconds+step;
 return {sample:{...previous,activeSeconds},stuck:activeSeconds>=2.1};
}
