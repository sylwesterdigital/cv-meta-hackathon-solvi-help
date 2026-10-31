import * as THREE from 'three';
import {projectPath,pathAt,liftTargetHeight} from './stair-extensions.js';
import {stairSegments} from './office-stairs-math.js';
const vec=new THREE.Vector3();
function surfaceHeight(segments,along,total){
 if(!segments.length)return 0;
 const index=Math.min(segments.length-1,Math.max(0,Math.floor(along/Math.max(.001,total)*segments.length)));
 return segments[index].top;
}
// Moving structures use static collision geometry for stairs/conveyors and bounded
// surface velocity for carried bodies. The lift has a kinematic moving cabin.
export function tickStairTransport(editor,dt){
 if(!Number.isFinite(dt)||dt<=0)return;
 const step=Math.min(.05,dt),world=editor.world,phys=editor.physics;
 for(const device of editor.items){
  if(device.userData.editorKind!=='stairs')continue;
  const cfg=device.userData.stairs||{},variant=cfg.variant;
  if(!['escalator','walkway','lift'].includes(variant))continue;
  const transport=cfg.transport||{},runtime=device.userData.stairRuntime||={height:cfg.lift?.currentHeight||0,target:cfg.lift?.target||0,moving:false,lastSave:0,phase:0};
  const speed=Math.min(2.5,Math.max(.05,transport.speed||.5));
  runtime.phase=(runtime.phase+step*speed*(transport.direction===-1?-1:1))%1;
  const oldY=device.position.y;
  let carry={x:0,y:0,z:0};
  if(variant==='lift'){
   runtime.baseY??=device.position.y-runtime.height;
   if(runtime.moving){
    const target=liftTargetHeight(cfg.lift,runtime.target),diff=target-runtime.height;
    const delta=Math.sign(diff)*Math.min(Math.abs(diff),step*speed);
    if(Math.abs(diff)<=.005||Math.abs(delta)<.005){runtime.height=target;runtime.moving=false;}
    else runtime.height+=delta;
    device.position.y=runtime.baseY+runtime.height;
    if(cfg.lift)cfg.lift.currentHeight=runtime.height;
    carry.y=device.position.y-oldY;
    if(phys?.enabled){const body=phys.bodies.get(device.userData.editorId);body?.setNextKinematicTranslation({x:device.position.x,y:device.position.y,z:device.position.z});}
    if(!runtime.moving||performance.now()-runtime.lastSave>1100){runtime.lastSave=performance.now();if(editor.canEdit(device))editor.queueSave(device);}
   }
  }
  if(variant==='lift')for(const child of device.children)if(child.userData.stairShaft)child.position.y=-runtime.height;
  if(variant==='lift'&&editor.wallEditTarget===device){const status=document.getElementById('stairLiftState');if(status)status.textContent=runtime.moving?'Travelling to level '+(runtime.target+1):'Stopped · '+runtime.height.toFixed(2)+' m';}
  const segments=variant==='lift'?[]:stairSegments(cfg);
  const pts=cfg.points||[];
  // Lightweight visual motion markers: underlying collision treads remain real solids.
  for(const child of device.children){if(!child.userData.transportMarker)continue;
   const total=projectPath(pts,pts[0]?.[0]||0,pts[0]?.[1]||0)?.total||1;
   const dist=(((child.userData.transportPhase+runtime.phase)%1)+1)%1*total;
   const at=pathAt(pts,dist);if(!at)continue;
   child.position.set(at.x,surfaceHeight(segments,dist,total)+.026,at.z);
  }
  if(variant!=='lift'&&transport.enabled===false)continue;
  device.updateMatrixWorld(true);
  const inv=device.matrixWorld.clone().invert();
  const transformPoint=p=>vec.copy(p).applyMatrix4(inv).clone();
  const entryTotal=pts.length>=2?projectPath(pts,pts[0][0],pts[0][1])?.total||0:0;
  for(const item of editor.items){
   if(item===device||!phys?.owns(item)||!['robot','cube','sphere','cylinder','model'].includes(item.userData.editorKind))continue;
   if(item.userData.editorKind==='robot'&&(item.userData.robotJumpActive||item.userData.physicsAirborne))continue;
   const local=transformPoint(item.position);
   // Robots have a foot-origin; ordinary primitives have a centred pivot.
   if(item.userData.editorKind!=='robot'&&item.isMesh){
    if(!item.geometry.boundingBox)item.geometry.computeBoundingBox();
    local.y+=(item.geometry.boundingBox?.min.y||0)*Math.abs(item.scale.y);
   }
   if(variant==='lift'){
    const dim=device.userData.liftFootprint||{width:cfg.width,depth:cfg.width*1.25};
    if(Math.abs(local.x)>dim.width/2-.1||Math.abs(local.z)>dim.depth/2-.1||Math.abs(local.y-.14)>.38||Math.abs(carry.y)<.0001)continue;
    transfer(editor,item,{x:0,y:carry.y,z:0});continue;
   }
   if(!entryTotal)continue;
   const projected=projectPath(pts,local.x,local.z);
   if(!projected||projected.distance>cfg.width/2-.11)continue;
   const top=surfaceHeight(segments,projected.along,projected.total);
   // A mesh below a stair flight is NOT a rider on the treads.
   if(Math.abs(local.y-top)>.34)continue;
   const nextAlong=Math.max(0,Math.min(projected.total,projected.along+step*speed*(transport.direction===-1?-1:1)));
   const next=pathAt(pts,nextAlong);if(!next)continue;
   const nextTop=surfaceHeight(segments,nextAlong,projected.total);
   const currentWorld=device.localToWorld(new THREE.Vector3(local.x,local.y,local.z));
   const centre=pathAt(pts,projected.along);
   const destination=device.localToWorld(new THREE.Vector3(local.x+next.x-centre.x,local.y+nextTop-top,local.z+next.z-centre.z));
   const delta=destination.sub(currentWorld);
   if(delta.lengthSq()>0&&delta.length()<.22)transfer(editor,item,delta);
  }
 }
}
function transfer(editor,item,delta){
 if(delta.lengthSq()<1e-9)return;
 // Operate on the owned physics body as well as the Three object: avoid a
 // one-frame visual teleport followed by Rapier snapping the rider backwards.
 const phys=editor.physics,body=phys.bodies.get(item.userData.editorId);
 item.position.add(delta);
 if(body){const p=body.translation(),next={x:p.x+delta.x,y:p.y+delta.y,z:p.z+delta.z};
  if(item.userData.editorKind==='robot')body.setNextKinematicTranslation(next);
  else body.setTranslation(next,true);
 }
 const now=performance.now();if(now-(item.userData.lastTransportSave||0)>950){item.userData.lastTransportSave=now;editor.queueSave(item);}
}
export function startLift(device,target){
 const config=device?.userData?.stairs;
 if(config?.variant!=='lift')return false;
 const runtime=device.userData.stairRuntime||={height:config.lift.currentHeight||0,target:config.lift.target||0,moving:false};
 runtime.baseY??=device.position.y-runtime.height;
 runtime.target=Math.max(0,Math.min(config.lift.levels-1,Math.round(Number(target)||0)));config.lift.target=runtime.target;
 runtime.moving=Math.abs(runtime.height-liftTargetHeight(config.lift,runtime.target))>.005;
 device.userData.stairRuntime=runtime;return runtime.moving;
}
