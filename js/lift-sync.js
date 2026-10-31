// Deterministic shared lift timeline. Geometry is never regenerated during travel.
// A server-validated motion command is one event; clients sample the same plan.
export function safeLiftMotion(m){
 if(!m||typeof m!=='object')return null;
 const {fromHeight,target,startedAt,speed,active}=m;
 if(![fromHeight,target,startedAt,speed].every(x=>typeof x==='number'&&Number.isFinite(x)))return null;
 if(fromHeight<0||fromHeight>96||!Number.isInteger(target)||target<0||target>11||startedAt<1700000000000||startedAt>4102444800000||speed<.05||speed>2.5||typeof active!=='boolean')return null;
 return {fromHeight,target,startedAt,speed,active};
}
export function liftHeightAt(m,levelHeight,levels,now=Date.now()){
 const motion=safeLiftMotion(m);if(!motion)return null;
 const max=Math.max(0,(Math.max(2,Math.min(12,levels))-1)*levelHeight);
 const start=Math.max(0,Math.min(max,motion.fromHeight));
 if(!motion.active)return start;
 const destination=Math.max(0,Math.min(max,motion.target*levelHeight));
 const elapsed=Math.max(0,(now-motion.startedAt)/1000);
 return start+Math.sign(destination-start)*Math.min(Math.abs(destination-start),elapsed*motion.speed);
}
export function liftMotionFinished(m,levelHeight,levels,now=Date.now()){
 const motion=safeLiftMotion(m);if(!motion||!motion.active)return true;
 return Math.abs(liftHeightAt(motion,levelHeight,levels,now)-motion.target*levelHeight)<.005;
}
export function motionSnapshot(height,target,speed,now=Date.now(),active=true){
 return {fromHeight:Math.max(0,Math.min(96,height)),target,startedAt:now,speed:Math.max(.05,Math.min(2.5,speed)),active};
}
// Position and readout must always be derived from the same cabin height.
export function liftBaseY(positionY,checkpointHeight){return positionY-(Number(checkpointHeight)||0);}

// Older releases could persist floor status independently of the cabin pose.
// When the saved cabin is near its original base but the readout says it rose,
// treat the pose as a base-position checkpoint; otherwise preserve the offset.
export function legacyLiftBaseY(positionY,currentHeight){
 const height=Number(currentHeight)||0;
 if(height>.5&&Math.abs(positionY)<height*.5)return positionY;
 return liftBaseY(positionY,height);
}
