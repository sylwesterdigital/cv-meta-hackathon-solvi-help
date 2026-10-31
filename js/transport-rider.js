// Position-based transport must accept both THREE.Vector3 and plain {x,y,z}
// (the lift computes a simple object each frame). No Three.js dependency so
// movement can be unit tested without a WebGL renderer.
export function transportDisplacement(delta){
 if(!delta||!['x','y','z'].every(k=>typeof delta[k]==='number'&&Number.isFinite(delta[k])))return null;
 const {x,y,z}=delta;
 if(x*x+y*y+z*z<1e-9||Math.hypot(x,y,z)>.25)return null;
 return {x,y,z};
}
export function moveTransportRider(item,body,delta){
 const d=transportDisplacement(delta);if(!d||!item?.position)return false;
 item.position.x+=d.x;item.position.y+=d.y;item.position.z+=d.z;
 if(body){
  const p=body.translation(),next={x:p.x+d.x,y:p.y+d.y,z:p.z+d.z};
  // The robot controller starts its NEXT frame from body.translation().
  // Updating only the next kinematic target allows it to overwrite the lift.
  // Advance the body itself and its target together; ordinary dynamic objects
  // are translated once and then continue under Rapier gravity.
  body.setTranslation(next,true);
  if(item.userData?.editorKind==='robot')body.setNextKinematicTranslation(next);
 }
 return true;
}
