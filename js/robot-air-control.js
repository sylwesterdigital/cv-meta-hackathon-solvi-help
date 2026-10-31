// Airborne motion is ballistic and locked at take-off, not steered each frame.
export function launchAirPlan({yaw=0,velocity=0,lateral=0}={}){
 const forward=Number(velocity)||0,side=Number(lateral)||0,a=Number(yaw)||0;
 return {yaw:a,vx:Math.sin(a)*forward+Math.cos(a)*side,vz:Math.cos(a)*forward-Math.sin(a)*side};
}
export function airStep(state,plan,dt){
 const t=Math.max(0,Math.min(.065,Number(dt)||0));
 return {...state,x:state.x+plan.vx*t,z:state.z+plan.vz*t,yaw:plan.yaw,steer:0,lateral:0};
}
export function autoRunAfterHold(heldMs,{walking=false,airborne=false,shift=false,delay=2000}={}){
 return Boolean(shift||(walking&&!airborne&&Number(heldMs)>=delay));
}
