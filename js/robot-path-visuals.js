import * as THREE from 'three';

// This overlay is made from the real navigation planner's obstacle rectangles,
// waypoints and the robot's measured scene positions. It is not an AI sketch.
const LAYER_NAME='Robot path debug';
const robotGroups=new Map();
const tracks=new Map();
const cleanupTimers=new Map();
const DEBUG_TRAIL_MS=15000;

function root(scene){
 let layer=scene.getObjectByName(LAYER_NAME);
 if(!layer){layer=new THREE.Group();layer.name=LAYER_NAME;scene.add(layer);}return layer;
}
function ribbon(points,color,width=.08,{closed=false,y=.075,opacity=.92}={}){
 const chain=closed?[...points,points[0]]:points;
 const vertices=[];
 for(let i=1;i<chain.length;i++){
  const a=chain[i-1],b=chain[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
  if(length<.0001)continue;
  const ux=-dz/length*width/2,uz=dx/length*width/2;
  vertices.push(a.x+ux,y,a.z+uz,a.x-ux,y,a.z-uz,b.x+ux,y,b.z+uz,
    a.x-ux,y,a.z-uz,b.x-ux,y,b.z-uz,b.x+ux,y,b.z+uz);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false});
 const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=70;mesh.frustumCulled=false;
 return mesh;
}
function rect(o){return [{x:o.minX,z:o.minZ},{x:o.maxX,z:o.minZ},{x:o.maxX,z:o.maxZ},{x:o.minX,z:o.maxZ}];}
function ring(center,radius,color){
 const pts=[];for(let i=0;i<28;i++){const a=i/28*Math.PI*2;pts.push({x:center.x+Math.cos(a)*radius,z:center.z+Math.sin(a)*radius});}
 return ribbon(pts,color,.062,{closed:true,y:.095});
}
function sector(start,end){
 const angle=Math.atan2(end.x-start.x,end.z-start.z),radius=1.8;
 const pts=[{x:start.x,z:start.z}];
 for(let i=0;i<=16;i++){const theta=angle-Math.PI/6+i*Math.PI/48;pts.push({x:start.x+Math.sin(theta)*radius,z:start.z+Math.cos(theta)*radius});}
 pts.push({x:start.x,z:start.z});return ribbon(pts,0x58d2ff,.032,{y:.065,opacity:.8});
}
function disposeObject(node){node?.traverse?.(part=>{part.geometry?.dispose?.();part.material?.dispose?.();});node?.removeFromParent?.();}

export function updateRobotPathDebug(world,robot,{start,waypoints=[],obstacles=[],destination=null,blocked=false}={}){
 if(!world?.scene||!robot?.userData?.editorId)return;
 const id=robot.userData.editorId;clearRobotPathDebug(world,id);
 const group=new THREE.Group();group.name='debug-'+id;group.userData.robotId=id;
 const origin=start||{x:robot.position.x,z:robot.position.z},dest=destination||waypoints.at(-1);
 const points=[origin,...waypoints];
 if(dest&&(!points.length||Math.hypot(points.at(-1).x-dest.x,points.at(-1).z-dest.z)>.01))points.push(dest);
 if(points.length>1)group.add(ribbon(points,blocked?0xff5353:0x66ff95,.11));
 for(const obstacle of obstacles.slice(0,80))group.add(ribbon(rect(obstacle),0xff746c,.048,{closed:true,y:.085,opacity:.75}));
 if(dest){group.add(ring(dest,.4,blocked?0xff5353:0xffc45d));if(!blocked)group.add(sector(origin,dest));}
 const realTrail=new THREE.Group();realTrail.name='actual-travelled-trail';group.add(realTrail);
 root(world.scene).add(group);robotGroups.set(id,group);
 tracks.set(id,{points:[{x:robot.position.x,z:robot.position.z}],trail:realTrail,lastPaint:0});
}

export function trackRobotPathDebug(world,robot){
 const id=robot?.userData?.editorId,record=tracks.get(id);
 if(!record||!robot?.userData?.robotMission||robot.userData.robotDebugRoute?.blocked)return;
 const latest={x:robot.position.x,z:robot.position.z},last=record.points.at(-1);
 if(!last||Math.hypot(latest.x-last.x,latest.z-last.z)<.13)return;
 record.points.push(latest);if(record.points.length>900)record.points.shift();
 const now=performance.now();if(now-record.lastPaint<220)return;
 record.lastPaint=now;for(const node of [...record.trail.children])disposeObject(node);
 // Cyan is measured movement; green is the originally computed A* trajectory.
 record.trail.add(ribbon(record.points,0x4fd6ff,.085,{y:.11}));
}
export function clearRobotPathDebug(world,id){
 const timer=cleanupTimers.get(id);if(timer)clearTimeout(timer);cleanupTimers.delete(id);
 const group=robotGroups.get(id)||world?.scene?.getObjectByName?.('debug-'+id);
 disposeObject(group);robotGroups.delete(id);tracks.delete(id);
}
export function finishRobotPathDebug(world,id){
 if(!robotGroups.has(id))return;
 const prior=cleanupTimers.get(id);if(prior)clearTimeout(prior);
 cleanupTimers.set(id,setTimeout(()=>clearRobotPathDebug(world,id),DEBUG_TRAIL_MS));
}
export function clearAllRobotPathDebug(world){for(const id of [...robotGroups.keys()])clearRobotPathDebug(world,id);}
