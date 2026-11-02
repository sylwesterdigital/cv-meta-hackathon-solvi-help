// Shared, side-effect-free projectile-hit classification. Rapier supplies the
// contact; the point's relative height selects an authored animation, if any.
export function throwHitRegion(bounds,point){
 if(!bounds||!point||![bounds.min?.y,bounds.max?.y,point.y].every(Number.isFinite))return 'body';
 const height=bounds.max.y-bounds.min.y;
 return height>.1&&point.y>bounds.min.y+height*.72?'head':'body';
}
export function finiteImpactPoint(point){
 return Boolean(point&&[point.x,point.y,point.z].every(Number.isFinite));
}
