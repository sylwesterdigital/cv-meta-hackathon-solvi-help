// Camera-centre ray / floor intersection; avoid fixed forward distances and
// near-horizon projections that put new scene objects off screen.
export function groundIntersection(origin,direction,orbitTarget=null,groundY=0){
 const fallback=orbitTarget&&Number.isFinite(orbitTarget.x)&&Number.isFinite(orbitTarget.z)
  ?{x:orbitTarget.x,y:groundY,z:orbitTarget.z}
  :{x:origin.x+direction.x*4,y:groundY,z:origin.z+direction.z*4};
 if(!Number.isFinite(direction.y)||direction.y>=-0.0001)return fallback;
 const distance=(groundY-origin.y)/direction.y;
 if(!Number.isFinite(distance)||distance<=0||distance>500)return fallback;
 const x=origin.x+direction.x*distance,z=origin.z+direction.z*distance;
 return Number.isFinite(x)&&Number.isFinite(z)?{x,y:groundY,z}:fallback;
}
