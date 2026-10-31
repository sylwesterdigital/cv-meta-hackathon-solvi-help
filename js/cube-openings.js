import * as THREE from 'three';
import {sanitisePrimitive} from './primitive-properties.js';
export function cleanOpenings(input=[]){
 if(!Array.isArray(input))return [];
 return input.slice(0,8).filter(o=>o&&['x','y','z'].includes(o.axis)&&['u','v','width','height'].every(k=>Number.isFinite(Number(o[k]))))
 .map(o=>({axis:o.axis,u:Math.max(-30,Math.min(30,+o.u)),v:Math.max(-30,Math.min(30,+o.v)),width:Math.max(.06,Math.min(30,+o.width)),height:Math.max(.06,Math.min(30,+o.height))}));
}
export function faceCoords(axis,p){return axis==='x'?[p.z,p.y]:axis==='y'?[p.x,p.z]:[p.x,p.y];}
export function surfaceAxis(normal){const abs=['x','y','z'].map(k=>Math.abs(normal[k]));return ['x','y','z'][abs.indexOf(Math.max(...abs))];}
export function rectangleFromSurface(axis,start,end){const [u,v]=faceCoords(axis,start),[u2,v2]=faceCoords(axis,end);return {axis,u:(u+u2)/2,v:(v+v2)/2,width:Math.abs(u-u2),height:Math.abs(v-v2)};}
// Space is subdivided only at opening edges; empty cells produce true through-holes.
export function cutCubeGeometry(params,input=[]){
 const p=sanitisePrimitive('cube',params),openings=cleanOpenings(input);if(!openings.length)return new THREE.BoxGeometry(p.width,p.height,p.depth,p.widthSegments,p.heightSegments,p.depthSegments);
 const sizes={x:p.width,y:p.height,z:p.depth},edges={};
 for(const a of ['x','y','z'])edges[a]=[-sizes[a]/2,sizes[a]/2];
 for(const h of openings){const [u,v]=h.axis==='x'?['z','y']:h.axis==='y'?['x','z']:['x','y'];for(const [a,center,length] of [[u,h.u,h.width],[v,h.v,h.height]])for(const e of [center-length/2,center+length/2])if(e>-sizes[a]/2+.001&&e<sizes[a]/2-.001)edges[a].push(e);}
 for(const a of ['x','y','z'])edges[a]=[...new Set(edges[a].map(v=>+v.toFixed(5)))].sort((a,b)=>a-b);
 const occupied=(ix,iy,iz)=>{
  if(ix<0||iy<0||iz<0||ix>=edges.x.length-1||iy>=edges.y.length-1||iz>=edges.z.length-1)return false;
  const at={x:(edges.x[ix]+edges.x[ix+1])/2,y:(edges.y[iy]+edges.y[iy+1])/2,z:(edges.z[iz]+edges.z[iz+1])/2};
  return !openings.some(h=>{const [u,v]=faceCoords(h.axis,at);return Math.abs(u-h.u)<h.width/2-1e-6&&Math.abs(v-h.v)<h.height/2-1e-6;});
 };
 const xyz=[],uv=[],normals=[];
 const addQuad=(p0,p1,p2,p3,axis,sign)=>{
  const n=new THREE.Vector3(axis==='x'?sign:0,axis==='y'?sign:0,axis==='z'?sign:0);
  if(new THREE.Vector3().subVectors(p1,p0).cross(new THREE.Vector3().subVectors(p2,p0)).dot(n)<0)[p1,p3]=[p3,p1];
  for(const q of [p0,p1,p2,p0,p2,p3]){xyz.push(q.x,q.y,q.z);normals.push(n.x,n.y,n.z);const [u,v]=faceCoords(axis,q);uv.push(u,v);}
 };
 for(let i=0;i<edges.x.length-1;i++)for(let j=0;j<edges.y.length-1;j++)for(let k=0;k<edges.z.length-1;k++){
  if(!occupied(i,j,k))continue;const [x0,x1]=[edges.x[i],edges.x[i+1]],[y0,y1]=[edges.y[j],edges.y[j+1]],[z0,z1]=[edges.z[k],edges.z[k+1]];
  if(!occupied(i-1,j,k))addQuad(new THREE.Vector3(x0,y0,z0),new THREE.Vector3(x0,y1,z0),new THREE.Vector3(x0,y1,z1),new THREE.Vector3(x0,y0,z1),'x',-1);
  if(!occupied(i+1,j,k))addQuad(new THREE.Vector3(x1,y0,z0),new THREE.Vector3(x1,y0,z1),new THREE.Vector3(x1,y1,z1),new THREE.Vector3(x1,y1,z0),'x',1);
  if(!occupied(i,j-1,k))addQuad(new THREE.Vector3(x0,y0,z0),new THREE.Vector3(x1,y0,z0),new THREE.Vector3(x1,y0,z1),new THREE.Vector3(x0,y0,z1),'y',-1);
  if(!occupied(i,j+1,k))addQuad(new THREE.Vector3(x0,y1,z0),new THREE.Vector3(x0,y1,z1),new THREE.Vector3(x1,y1,z1),new THREE.Vector3(x1,y1,z0),'y',1);
  if(!occupied(i,j,k-1))addQuad(new THREE.Vector3(x0,y0,z0),new THREE.Vector3(x0,y1,z0),new THREE.Vector3(x1,y1,z0),new THREE.Vector3(x1,y0,z0),'z',-1);
  if(!occupied(i,j,k+1))addQuad(new THREE.Vector3(x0,y0,z1),new THREE.Vector3(x1,y0,z1),new THREE.Vector3(x1,y1,z1),new THREE.Vector3(x0,y1,z1),'z',1);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeBoundingSphere();return g;
}
