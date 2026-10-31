import * as THREE from 'three';
import {projectPath,pathAt,liftTargetHeight} from './stair-extensions.js';
import {stairSegments} from './office-stairs-math.js';
import {moveTransportRider} from './transport-rider.js';
import {updateLiftPanel} from './office-stairs.js';
import {liftChime} from './lift-chimes.js';
import {liftHeightAt,liftMotionFinished,motionSnapshot,liftBaseY,safeLiftMotion} from './lift-sync.js';
import {canCarryLiftRider} from './lift-rider.js';
import {conveyorSupport,xrCabinSupport,conveyorPhase} from './transport-support.js';
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
 // Expire last frame's tread support unless real contact is rediscovered.
 for(const actor of editor.items)if(actor.userData.editorKind==='robot')delete actor.userData.conveyorRide;
 for(const device of editor.items){
  if(device.userData.editorKind!=='stairs')continue;
  const cfg=device.userData.stairs||{},variant=cfg.variant;
  if(!['escalator','walkway','lift'].includes(variant))continue;
  const transport=cfg.transport||{},runtime=device.userData.stairRuntime||={height:cfg.lift?.currentHeight||0,target:cfg.lift?.target||0,moving:false,lastSave:0,phase:0};
  if(variant==='lift'&&!runtime.motion){
   const plan=safeLiftMotion(cfg.lift?.motion);
   if(plan){runtime.motion=plan;runtime.target=plan.target;runtime.commanded=true;runtime.moving=plan.active;runtime.baseY=liftBaseY(device.position.y,cfg.lift.currentHeight);}
  }
  const speed=Math.min(2.5,Math.max(.05,transport.speed||.5));
  runtime.phase=conveyorPhase(speed,transport.direction);
  // Classify passengers against the OLD cabin pose, before changing its height.
  // This prevents remote commands and direction reversals from leaving riders behind.
  device.updateMatrixWorld(true);
  const before=device.matrixWorld.clone().invert();
  const oldY=device.position.y;
  let carry={x:0,y:0,z:0};
  if(variant==='lift'){
   runtime.baseY??=device.position.y-runtime.height;
   if(runtime.moving){
    const wasMoving=runtime.moving;
    const motion=safeLiftMotion(cfg.lift?.motion);
    if(motion&&(!runtime.motion||motion.startedAt>runtime.motion.startedAt)){runtime.motion=motion;runtime.target=motion.target;runtime.moving=motion.active;runtime.commanded=true;}
    if(runtime.motion?.active){
     runtime.height=liftHeightAt(runtime.motion,cfg.lift.levelHeight,cfg.lift.levels);
     if(liftMotionFinished(runtime.motion,cfg.lift.levelHeight,cfg.lift.levels)){runtime.height=liftTargetHeight(cfg.lift,runtime.target);runtime.moving=false;}
    }else runtime.moving=false;
    device.position.y=runtime.baseY+runtime.height;
    if(cfg.lift)cfg.lift.currentHeight=runtime.height;
    carry.y=device.position.y-oldY;
    if(wasMoving&&!runtime.moving){
     liftChime('arrival');
     if(runtime.authority&&editor.canEdit(device)){
      cfg.lift.motion=motionSnapshot(runtime.height,runtime.target,speed,Date.now(),false);runtime.motion=cfg.lift.motion;
      editor.queueSave(device);window.solviRoomSocket?.send({type:'lift-motion',id:device.userData.editorId,...cfg.lift.motion});
     }
    }
    if(phys?.enabled){const body=phys.bodies.get(device.userData.editorId);if(body){const next={x:device.position.x,y:device.position.y,z:device.position.z};body.setTranslation(next,true);body.setNextKinematicTranslation(next);}}
   }
  }
  if(variant==='lift'&&Math.abs(carry.y)>.000001&&world?.renderer?.xr?.isPresenting){
   // XR viewers are not editor objects or Rapier bodies. Advance the tracking
   // reference with the cabin, otherwise the cabin rises without the headset.
   const headset=world.renderer.xr.getCamera();
   const headLocal=headset?headset.getWorldPosition(new THREE.Vector3()).applyMatrix4(before):null;
   const footprint=device.userData.liftFootprint||{width:cfg.width,depth:cfg.width*1.25};
   if(xrCabinSupport(headLocal,footprint,cfg.lift.cabinHeight))world.shiftXRViewer({x:0,y:carry.y,z:0});
  }
  if(variant==='lift')for(const child of device.children)if(child.userData.stairShaft)child.position.y=-runtime.height;
  if(variant==='lift')updateLiftPanel(device);
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
   if(item===device||(!phys?.owns(item)&&!(variant==='lift'&&item.userData.editorKind==='robot'))||!['robot','cube','sphere','cylinder','model'].includes(item.userData.editorKind))continue;
   if(item.userData.editorKind==='robot'&&item.userData.robotJumpActive){if(item.userData.liftRide?.id===device.userData.editorId)delete item.userData.liftRide;continue;}
   // A previous grounded/airborne flag can be stale on a moving surface.
   // Decide support from actual tread proximity instead of excluding owners.
   if(variant!=='lift'&&item.userData.robotJumpActive)continue;
   const local=transformPoint(item.position);
   // Robots have a foot-origin; ordinary primitives have a centred pivot.
   if(item.userData.editorKind!=='robot'&&item.isMesh){
    if(!item.geometry.boundingBox)item.geometry.computeBoundingBox();
    local.y+=(item.geometry.boundingBox?.min.y||0)*Math.abs(item.scale.y);
   }
   if(variant==='lift'){
    const dim=device.userData.liftFootprint||{width:cfg.width,depth:cfg.width*1.25};
    const attached=item.userData.editorKind==='robot'&&item.userData.liftRide?.id===device.userData.editorId;
    // The lift has already moved by carry.y.  Use the PREVIOUS pose to
    // discover passengers; otherwise descending floors appear to leave the
    // capsule suspended and the gravity controller marks it airborne.
    const oldLocal=vec.copy(item.position).applyMatrix4(before).clone();
    if(!canCarryLiftRider(oldLocal,dim,{attached,jumping:!!item.userData.robotJumpActive,offset:item.userData.liftRide?.offset})){
     if(attached)delete item.userData.liftRide;
     continue;
    }
    if(item.userData.editorKind==='robot'){
     item.userData.liftRide={id:device.userData.editorId,offset:attached?item.userData.liftRide.offset:oldLocal.y};
     // A cabin is support, not a free-fall animation.  Only a deliberate
     // jump or exiting the footprint can make the robot airborne again.
     item.userData.physicsAirborne=false;
     item.userData.robotFallActive=false;
     delete item.userData.liftRemoteTargetY;
    }
    if(Math.abs(carry.y)>.000001)transfer(editor,item,{x:0,y:carry.y,z:0},'lift');
    continue;
   }
   if(!entryTotal)continue;
   const projected=projectPath(pts,local.x,local.z);
   if(!projected||projected.distance>cfg.width/2-.11)continue;
   const top=surfaceHeight(segments,projected.along,projected.total);
   // A mesh below a stair flight is NOT a rider on the treads.
   if(!conveyorSupport(local,top,cfg.width,{jumping:!!item.userData.robotJumpActive}))continue;
   if(item.userData.editorKind==='robot'){
    item.userData.conveyorRide={id:device.userData.editorId};
    item.userData.physicsAirborne=false;item.userData.robotFallActive=false;
   }
   const nextAlong=Math.max(0,Math.min(projected.total,projected.along+step*speed*(transport.direction===-1?-1:1)));
   const next=pathAt(pts,nextAlong);if(!next)continue;
   const nextTop=surfaceHeight(segments,nextAlong,projected.total);
   const currentWorld=device.localToWorld(new THREE.Vector3(local.x,local.y,local.z));
   const centre=pathAt(pts,projected.along);
   // Keep the foot (or primitive bottom) on the surface as it advances.
   // This also corrects small stale ground offsets after remote scene updates.
   const destination=device.localToWorld(new THREE.Vector3(local.x+next.x-centre.x,nextTop,local.z+next.z-centre.z));
   const delta=destination.sub(currentWorld);
   if(delta.lengthSq()>0&&delta.length()<.22)transfer(editor,item,delta,'conveyor');
  }
 }
}
function transfer(editor,item,delta,mode='lift'){
 const phys=editor.physics,body=phys?.bodies?.get(item.userData.editorId);
 // A throttled tab can resume after more than one physics tick. Split a large
 // cabin displacement into safe body translations, instead of losing the rider.
 const n=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.y,delta.z)/.2));
 let moved=false;for(let i=0;i<n;i++)moved=moveTransportRider(item,body,{x:delta.x/n,y:delta.y/n,z:delta.z/n})||moved;
 if(!moved||!phys?.owns(item))return;
 const now=performance.now();
 if(item.userData.editorKind==='robot'&&now-(item.userData.lastTransportPacket||0)>130){
  item.userData.lastTransportPacket=now;window.solviRoomSocket?.send({type:'robot-motion',id:item.userData.editorId,position:item.position.toArray(),rotation:item.rotation.toArray(),mode});
 }
 if(now-(item.userData.lastTransportSave||0)>1800){item.userData.lastTransportSave=now;editor.queueSave(item);}
}
export function startLift(device,target){
 const config=device?.userData?.stairs;
 if(config?.variant!=='lift')return false;
 const runtime=device.userData.stairRuntime||={height:config.lift.currentHeight||0,target:config.lift.target||0,moving:false};
 runtime.baseY??=device.position.y-runtime.height;
 runtime.target=Math.max(0,Math.min(config.lift.levels-1,Math.round(Number(target)||0)));runtime.commanded=true;config.lift.target=runtime.target;
 runtime.moving=Math.abs(runtime.height-liftTargetHeight(config.lift,runtime.target))>.005;
 const motion=motionSnapshot(runtime.height,runtime.target,config.transport?.speed||.5,Date.now(),runtime.moving);
 config.lift.motion=motion;runtime.motion=motion;runtime.commanded=true;runtime.authority=true;
 device.userData.stairRuntime=runtime;
 if(runtime.moving)liftChime('start');
 updateLiftPanel(device);
 return runtime.moving;
}

export function stopLift(device){
 const cfg=device?.userData?.stairs;if(cfg?.variant!=='lift')return false;
 const runtime=device.userData.stairRuntime;if(!runtime)return false;
 runtime.moving=false;runtime.authority=true;
 cfg.lift.currentHeight=runtime.height;cfg.lift.motion=motionSnapshot(runtime.height,runtime.target,cfg.transport?.speed||.5,Date.now(),false);runtime.motion=cfg.lift.motion;
 updateLiftPanel(device);return true;
}
