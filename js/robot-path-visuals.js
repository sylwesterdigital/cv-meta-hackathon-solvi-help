import * as THREE from 'three';

const LAYER_NAME='Robot path debug';
const robotGroups=new Map();

function root(scene){
  let group=scene.getObjectByName(LAYER_NAME);
  if(!group){group=new THREE.Group();group.name=LAYER_NAME;scene.add(group);}return group;
}
function material(color){return new THREE.LineBasicMaterial({color,transparent:true,opacity:.95,depthWrite:false});}
function line(points,color,closed=false){
  const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p.x,p.y??.03,p.z)));
  const mesh=new THREE.Line(closed?geometry:new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p.x,p.y??.03,p.z))),material(color));
  if(closed){
    const closedPoints=[...points,points[0]].map(p=>new THREE.Vector3(p.x,p.y??.03,p.z));
    mesh.geometry.dispose();
    mesh.geometry=new THREE.BufferGeometry().setFromPoints(closedPoints);
  }
  return mesh;
}
function obstacleRect(obstacle){
  const y=.025;
  return [{x:obstacle.minX,z:obstacle.minZ,y},{x:obstacle.maxX,z:obstacle.minZ,y},{x:obstacle.maxX,z:obstacle.maxZ,y},{x:obstacle.minX,z:obstacle.maxZ,y}];
}
function circle(center,radius,color){
  const points=[];for(let i=0;i<=28;i++){const a=i/28*Math.PI*2;points.push({x:center.x+Math.cos(a)*radius,z:center.z+Math.sin(a)*radius,y:.028});}
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p.x,p.y,p.z))),material(color));
}
function sector(origin,target,radius=2.2,spread=Math.PI/3,color=0x58d2ff){
  const heading=Math.atan2(target.x-origin.x,target.z-origin.z);
  const pts=[{x:origin.x,z:origin.z,y:.026}];
  const steps=18;
  for(let i=0;i<=steps;i++){
    const a=heading-spread/2+spread*i/steps;
    pts.push({x:origin.x+Math.sin(a)*radius,z:origin.z+Math.cos(a)*radius,y:.026});
  }
  pts.push({x:origin.x,z:origin.z,y:.026});
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(p.x,p.y,p.z))),material(color));
}
function disposeGroup(group){group?.traverse?.(node=>{node.geometry?.dispose?.();node.material?.dispose?.();});group?.removeFromParent?.();}

export function updateRobotPathDebug(world,robot,{start,waypoints=[],obstacles=[],destination=null}={}){
  if(!world?.scene||!robot?.userData?.editorId)return;
  clearRobotPathDebug(world,robot.userData.editorId);
  const group=new THREE.Group();group.name='debug-'+robot.userData.editorId;
  group.userData.robotId=robot.userData.editorId;
  const pts=[start||{x:robot.position.x,z:robot.position.z},...waypoints.map(p=>({x:p.x,z:p.z})),destination||waypoints.at(-1)||{x:robot.position.x,z:robot.position.z}];
  if(pts.length>1)group.add(line(pts,0x66ff95));
  for(const obstacle of obstacles.slice(0,60))group.add(line(obstacleRect(obstacle),0xff7b6a,true));
  const dest=destination||waypoints.at(-1);if(dest){group.add(circle(dest,.34,0xffd15c));group.add(sector(pts[0],dest));}
  root(world.scene).add(group);robotGroups.set(robot.userData.editorId,group);
}

export function clearRobotPathDebug(world,robotId){
  const group=robotGroups.get(robotId)||world?.scene?.getObjectByName?.('debug-'+robotId);
  if(group)disposeGroup(group);
  robotGroups.delete(robotId);
}
