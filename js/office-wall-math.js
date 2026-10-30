const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const presets=['plaster','concrete','bricks','glass'];
export function sanitiseWall(raw={}){
 const original=Array.isArray(raw.points)?raw.points:[];
 const sampled=original.length>80?Array.from({length:80},(_,i)=>original[Math.round(i*(original.length-1)/79)]):original;
 const points=sampled.filter(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(Number(n))&&Math.abs(Number(n))<=500)).map(p=>[+Number(p[0]).toFixed(3),+Number(p[1]).toFixed(3)]);
 const unique=[];for(const p of points)if(!unique.length||Math.hypot(unique.at(-1)[0]-p[0],unique.at(-1)[1]-p[1])>.05)unique.push(p);
 const num=(name,f,a,b)=>Number.isFinite(Number(raw[name]))?clamp(Number(raw[name]),a,b):f;
 const texture=presets.includes(raw.texture)?raw.texture:'plaster';
 const color=typeof raw.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(raw.color)?raw.color:'#c6d1dc';
 return {points:unique,width:num('width',.16,.05,1.5),height:num('height',2.8,.3,10),texture,color,opacity:num('opacity',texture==='glass'?.4:1,.08,1),smooth:raw.smooth!==false};
}
export function simplifyWallPoints(points,tolerance=.13){
 if(points.length<3)return points.slice();const sqTol=tolerance*tolerance;
 const distanceSq=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;if(l<1e-8)return (p[0]-a[0])**2+(p[1]-a[1])**2;const t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l,0,1);return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;};
 const result=new Set([0,points.length-1]);const recur=(a,b)=>{let index=-1,max=sqTol;for(let i=a+1;i<b;i++){const d=distanceSq(points[i],points[a],points[b]);if(d>max){max=d;index=i;}}if(index>=0){result.add(index);recur(a,index);recur(index,b);}};recur(0,points.length-1);return [...result].sort((a,b)=>a-b).map(i=>points[i]);
}
export function wallSegments(settings){const s=sanitiseWall(settings),segments=[];for(let i=1;i<s.points.length;i++){const a=s.points[i-1],b=s.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.05)continue;segments.push({x:(a[0]+b[0])/2,z:(a[1]+b[1])/2,length,yaw:Math.atan2(-dz,dx)});}return segments;}
export function wallWorldToLocal(points){const origin=points[0]||{x:0,z:0};return {origin,points:points.map(p=>[+(p.x-origin.x).toFixed(3),+(p.z-origin.z).toFixed(3)])};}
