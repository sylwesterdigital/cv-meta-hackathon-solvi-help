import * as THREE from 'three';
export const CURVE_DEFAULT={points:[[-.8,0,-.6],[-.3,.55,0],[.4,.15,.3],[.8,.7,.1]],offset:0,extrude:.1,bevel:.025,bevelResolution:4,resolution:48};
const bound=(v,lo,hi,def)=>Number.isFinite(Number(v))?Math.min(hi,Math.max(lo,Number(v))):def;
export function cleanCurve(value={}){
 const points=(Array.isArray(value.points)?value.points:CURVE_DEFAULT.points).filter(p=>Array.isArray(p)&&p.length===3&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<=500)).slice(0,120);
 return {points:points.length>=2?points.map(p=>p.map(Number)):CURVE_DEFAULT.points.map(p=>[...p]),offset:bound(value.offset,-3,3,0),extrude:bound(value.extrude,.01,5,.1),bevel:bound(value.bevel,0,1,.025),bevelResolution:Math.round(bound(value.bevelResolution,1,12,4)),resolution:Math.round(bound(value.resolution,8,250,48))};
}
// Sweep a rounded-square bevel profile along a 3D Catmull-Rom curve.
export function buildCurveGeometry(input){
 const p=cleanCurve(input),curve=new THREE.CatmullRomCurve3(p.points.map(v=>new THREE.Vector3(...v)),false,'centripetal');
 const count=Math.min(500,Math.max(p.resolution,p.points.length*5));
 const frame=curve.computeFrenetFrames(count,false),vertices=[],uv=[],indices=[];
 const half=p.extrude/2,r=Math.min(p.bevel,half),corners=[[half-r,half-r],[-half+r,half-r],[-half+r,-half+r],[half-r,-half+r]];
 const profile=[];for(let c=0;c<4;c++){const [cx,cy]=corners[c];const start=c*Math.PI/2;for(let j=0;j<=p.bevelResolution;j++){const a=start+(j/p.bevelResolution)*Math.PI/2;profile.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}}
 const width=profile.length;
 for(let i=0;i<=count;i++){
  const center=curve.getPointAt(i/count).addScaledVector(frame.normals[i],p.offset);
  for(let j=0;j<width;j++){const [a,b]=profile[j];const v=center.clone().addScaledVector(frame.normals[i],a).addScaledVector(frame.binormals[i],b);vertices.push(...v.toArray());uv.push(i/count,j/width);}
 }
 for(let i=0;i<count;i++)for(let j=0;j<width;j++){const a=i*width+j,b=i*width+(j+1)%width,c=(i+1)*width+j,d=(i+1)*width+(j+1)%width;indices.push(a,c,b,b,c,d);}
 const first=vertices.length/3,begin=curve.getPointAt(0).addScaledVector(frame.normals[0],p.offset);vertices.push(...begin.toArray());uv.push(0,.5);
 const last=vertices.length/3,end=curve.getPointAt(1).addScaledVector(frame.normals[count],p.offset);vertices.push(...end.toArray());uv.push(1,.5);
 for(let j=0;j<width;j++){indices.push(first,(j+1)%width,j);indices.push(last,count*width+j,count*width+(j+1)%width);}
 const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geom.setIndex(indices);geom.computeVertexNormals();return geom;
}
