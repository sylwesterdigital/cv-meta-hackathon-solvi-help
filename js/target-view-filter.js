// Target-aware selection for robot head-camera scans. Geometry is a cheap
// conservative prefilter; it is not image recognition or proof of visibility.
const FAMILY={chair:/\b(chairs?(?:[0-9a-z_-]+)?|armchairs?|stools?|seats?)\b/i,sofa:/\b(sofas?|couches?|loveseats?)\b/i,
 bed:/\bbeds?\b/i,table:/\btables?\b/i,desk:/\bdesks?\b/i,
 lamp:/\blamps?\b/i,cabinet:/\b(cabinets?|cupboards?|vanities?|drawers?)\b/i,
 television:/\b(televisions?|tvs?|monitors?)\b/i};
const COLORS=/\b(red|pink|blue|green|yellow|black|white|brown|purple|orange|grey|gray)\b/gi;
export function observationTarget(message=''){
 const text=String(message);
 const family=Object.keys(FAMILY).filter(key=>FAMILY[key].test(text));
 if(!family.length)return null;
 const colors=Array.from(new Set((text.match(COLORS)||[]).map(x=>x.toLowerCase())));
 return {families:family,colors,phrase:[...colors,...family].join(' ')};
}
export function matchesObservationTarget(name,target){
 if(!target)return false;
 const str=String(name||'');
 const nouns=target.families.some(k=>FAMILY[k].test(str));
 if(!nouns)return false;
 if(!target.colors.length)return true;
 return target.colors.some(c=>new RegExp('\\b'+c+'\\b','i').test(str));
}
// View coordinates are Three.js camera coordinates: looking down negative Z.
export function frameTargetScore(pose,target){
 if(!pose||!target)return -1;
 const p=pose.position,q=pose.quaternion;const v={x:target.position.x-p.x,y:target.position.y-p.y,z:target.position.z-p.z};
 if(![v.x,v.y,v.z,q.x,q.y,q.z,q.w].every(Number.isFinite))return -1;
 const x=-q.x,y=-q.y,z=-q.z,w=q.w;
 const tx=2*(y*v.z-z*v.y),ty=2*(z*v.x-x*v.z),tz=2*(x*v.y-y*v.x);
 const dx=v.x+w*tx+(y*tz-z*ty),dy=v.y+w*ty+(z*tx-x*tz),dz=v.z+w*tz+(x*ty-y*tx);
 const radius=Math.max(.1,Math.min(4,Number(target.radius)||.5));
 if(dz>=radius)return -1;
 const d=Math.max(.05,-dz),tan=Math.tan((Number(pose.fov)||72)*Math.PI/360);
 const margin=radius/d,asp=(Number(pose.width)||512)/(Number(pose.height)||512);
 if(Math.abs(dx/d)>tan*asp+margin||Math.abs(dy/d)>tan+margin)return -1;
 return 1/(1+Math.abs(dx/d)+Math.abs(dy/d))+.12/(1+Math.hypot(v.x,v.z));
}
export function pickTargetViews(plan,poses,candidates,max=3){
 const records=plan.map((view,index)=>({view,index,score:Math.max(-1,...candidates.map(c=>frameTargetScore(poses[index],c)))}))
  .filter(x=>x.score>=0).sort((a,b)=>b.score-a.score);
 // Keep the sharpest centered viewpoints rather than eight near-duplicates.
 return records.slice(0,Math.max(1,max)).sort((a,b)=>a.index-b.index);
}
