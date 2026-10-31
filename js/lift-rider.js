// A rider is supported by a moving cabin in either direction.  Being reported
// airborne by a previous physics tick cannot by itself eject a cabin passenger.
// These checks are deliberately engine-agnostic for cross-client tests.
export function inLiftFootprint(point,footprint,margin=.1){
 if(!point||!footprint)return false;
 const {x,z}=point,{width,depth}=footprint;
 return [x,z,width,depth].every(Number.isFinite)&&width>.3&&depth>.3&&
  Math.abs(x)<=Math.max(.1,width/2-margin)&&Math.abs(z)<=Math.max(.1,depth/2-margin);
}
export function canCarryLiftRider(local,footprint,{attached=false,jumping=false,offset=.14}={}){
 if(jumping||!inLiftFootprint(local,footprint,attached?.02:.1))return false;
 // New riders must be standing at the cabin floor.  Known riders tolerate
 // temporary small vertical error during a remote direction change.
 const tolerance=attached?.85:.38;
 return Number.isFinite(local.y)&&Math.abs(local.y-(attached?offset:.14))<=tolerance;
}
export function supportedLiftRobot(object,editor){
 const ride=object?.userData?.liftRide;
 if(!ride||object.userData.robotJumpActive||Number.isFinite(object.userData.jumpVel)&&object.userData.jumpVel>0)return null;
 const lift=editor?.items?.find(item=>item.userData.editorId===ride.id&&item.userData.stairs?.variant==='lift');
 if(!lift)return null;
 const dims=lift.userData.liftFootprint||{width:lift.userData.stairs.width,depth:lift.userData.stairs.width*1.25};
 lift.updateMatrixWorld(true);
 const local=lift.worldToLocal(object.position.clone());
 if(!canCarryLiftRider(local,dims,{attached:true,offset:ride.offset}))return null;
 return lift;
}
