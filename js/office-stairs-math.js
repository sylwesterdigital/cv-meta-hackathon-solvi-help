import {cleanStairExtras} from './stair-extensions.js';
// A horizontal polyline defines the flight. Each generated tread is placed on
// its measured distance along the route, not its array index.
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function sanitiseStairs(raw={}){
 const pts=Array.isArray(raw.points)?raw.points:[];
 const points=pts.slice(0,80).filter(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=500)).map(p=>p.map(n=>+n.toFixed(3)));
 const filtered=[];for(const p of points)if(!filtered.length||Math.hypot(p[0]-filtered.at(-1)[0],p[1]-filtered.at(-1)[1])>.05)filtered.push(p);
 const num=(key,def,min,max)=>Number.isFinite(Number(raw[key]))?clamp(Number(raw[key]),min,max):def;
 return {points:filtered,width:num('width',1.1,.4,4),height:num('height',2.8,.2,10),steps:Math.round(num('steps',16,1,80)),stepMode:raw.stepMode==='fixed'?'fixed':'count',treadMm:Math.round(num('treadMm',350,35,800)),riserMm:Math.round(num('riserMm',170,60,280)),floating:raw.floating===true,color:/^#[a-f0-9]{6}$/i.test(raw.color||'')?raw.color:'#c6d1dc',opacity:num('opacity',1,.08,1),...cleanStairExtras(raw)};
}
export function stairSegments(raw={}){
 const s=sanitiseStairs(raw),lengths=[];let total=0;
 for(let j=1;j<s.points.length;j++){
  const a=s.points[j-1],b=s.points[j],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<.05)continue;
  lengths.push({a,b,l,start:total});total+=l;
 }
 if(total<.1)return [];
 const count=s.stepMode==='fixed'?Math.max(1,Math.min(80,Math.floor(10/(s.riserMm/1000)),Math.floor(total/(s.treadMm/1000)))):s.steps;
 const tread=s.stepMode==='fixed'?s.treadMm/1000:total/count;
 const rise=s.variant==='walkway'?0:(s.stepMode==='fixed'?s.riserMm/1000:s.height/count);
 const result=[];
 for(let i=0;i<count;i++){
  const mid=(i+.5)*tread;let seg=lengths.at(-1);
  for(const candidate of lengths){if(mid<=candidate.start+candidate.l){seg=candidate;break;}}
  const t=clamp((mid-seg.start)/seg.l,0,1),dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1];
  const stepHeight=s.variant==='walkway'?.14:(s.floating?rise:(i+1)*rise);
  result.push({x:seg.a[0]+dx*t,z:seg.a[1]+dz*t,y:s.variant==='walkway'?.07:(s.floating?i*rise+rise/2:stepHeight/2),depth:tread,height:stepHeight,width:s.width,yaw:Math.atan2(-dz,dx),number:i+1,top:s.variant==='walkway'?.14:(i+1)*rise});
 }
 return result;
}
