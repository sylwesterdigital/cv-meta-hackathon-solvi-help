import * as THREE from 'three';
import {wallPresetTexture} from './office-walls.js';
import {climbSurfaceProximity} from './climbable-surfaces.js';

const clamp=(v,def,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):def;
export function sanitiseLadder(raw={}){
 const width=clamp(raw.width,1,.45,4),height=clamp(raw.height,3,1,40);
 const rungMode=raw.rungMode==='count'?'count':'spacing';
 const rungSpacing=clamp(raw.rungSpacing,.3,.15,.6);
 const rungs=Math.round(clamp(raw.rungs,Math.max(3,Math.floor((height-.3)/rungSpacing)),3,240));
 const color=typeof raw.color==='string'&&/^#[0-9a-f]{6}$/i.test(raw.color)?raw.color:'#a5b9c8';
 const texture=['none','metal','concrete','bricks','plaster'].includes(raw.texture)?raw.texture:'metal';
 return {width,height,rungMode,rungSpacing,rungs,color,texture};
}
export function ladderRungHeights(cfg){
 const data=sanitiseLadder(cfg),heights=[];
 if(data.rungMode==='count'){
  const gap=(data.height-.3)/data.rungs;
  for(let i=1;i<=data.rungs;i++)heights.push(.15+gap*i);
 }else{
  for(let y=.2+data.rungSpacing;y<data.height-.03&&heights.length<320;y+=data.rungSpacing)heights.push(+y.toFixed(4));
 }
 return heights;
}
function material(cfg){
 const mat=new THREE.MeshStandardMaterial({color:cfg.color,roughness:cfg.texture==='metal'?.32:.8,metalness:cfg.texture==='metal'?.65:.05});
 if(cfg.texture!=='none')mat.map=wallPresetTexture(cfg.texture==='metal'?'concrete':cfg.texture);
 return mat;
}
function disposeChildren(group){
 for(const c of [...group.children]){group.remove(c);c.geometry?.dispose?.();if(Array.isArray(c.material))c.material.forEach(m=>m.dispose?.());else c.material?.dispose?.();}
}
export function rebuildLadder(group,raw){
 const cfg=sanitiseLadder(raw),meshes=[],mat=material(cfg);
 const bar=(x,y,w,h,d)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,0);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.ladderBar=true;meshes.push(mesh);};
 const railSize=.075;
 bar(-cfg.width/2, cfg.height/2,railSize,cfg.height,railSize);
 bar(cfg.width/2,cfg.height/2,railSize,cfg.height,railSize);
 for(const y of ladderRungHeights(cfg))bar(0,y,cfg.width,.055,.075);
 disposeChildren(group);
 for(const mesh of meshes)group.add(mesh);
 group.userData.ladder=cfg;
 group.userData.editorKind='ladder';
 return cfg;
}
export function makeLadder(raw={}){const group=new THREE.Group();group.name='Ladder';rebuildLadder(group,raw);return group;}

// Climbing is activated by the Ladder object kind and the Up/Down input,
// before the capsule can become stuck on its physical rungs. A ladder can
// be approached from either face, including after the character controller
// has stopped horizontal motion against a rung.
export function ladderProximity(ladder,robot){
 if(ladder?.userData?.editorKind!=='ladder'||!robot?.position)return null;
 ladder.updateMatrixWorld(true);
 const local=ladder.worldToLocal(robot.position.clone());
 const cfg=sanitiseLadder(ladder.userData.ladder);
 // Work in local metres so moved, rotated and scaled ladders keep a usable
 // entry zone. Keep acquisition close to the bars, not a room-sized trigger.
 const side=local.z<0?-1:1;
 const distance=Math.abs(local.z);
 const withinWidth=Math.abs(local.x)<=cfg.width*.5+.35;
 const withinHeight=local.y>=-.4&&local.y<=cfg.height+.18;
 const withinReach=distance<=1.10;
 if(!withinWidth||!withinHeight||!withinReach)return null;
 // At normal approach distance, face the ladder rather than snapping a
 // passer-by travelling along it. At capsule contact (<=.6 m) also accept
 // a sideways character whose movement is already blocked by the bars.
 const relativeYaw=(Number(robot.rotation?.y)||0)-(Number(ladder.rotation?.y)||0);
 const facingToward=side===1?-Math.cos(relativeYaw):Math.cos(relativeYaw);
 if(distance>.60&&facingToward<.25)return null;
 return {local,cfg,side};
}
export function ladderClimbStep(y,input,dt,height){
 const direction=Math.sign(Number(input)||0),delta=Math.min(.06,Math.max(0,Number(dt)||0))*1.25*direction;
 return Math.max(0,Math.min(height,Number(y)+delta));
}
// Caller is responsible for checking for an actual upper-floor surface. Never
// release a visitor into empty air at the top of an unsupported ladder.
export function stepLadderRobot(robot,objects,verticalInput,dt,{upperSurface=null}={}){
 let ride=robot?.userData?.robotLadderRide||null;
 let ladder=ride&&objects.find(o=>o.userData.editorId===ride.id&&(ride.kind==='surface'?o.userData.climbable:o.userData.editorKind==='ladder'));
 if(!ladder){
  delete robot.userData.robotLadderRide;
  if((robot.userData.robotLadderCooldown||0)>performance.now()||!verticalInput)return false;
  for(const candidate of objects){if(candidate.userData.editorKind!=='ladder')continue;
   const near=ladderProximity(candidate,robot);
   if(near&&(verticalInput>0||near.local.y>.3&&verticalInput<0)){
    ladder=candidate;ride={id:candidate.userData.editorId,y:Math.max(0,near.local.y),side:near.side,
     x:Math.max(-Math.max(0,near.cfg.width/2-.37),Math.min(Math.max(0,near.cfg.width/2-.37),near.local.x))};break;
   }
  }
  if(!ladder){
   // Other objects are climbable only when opted in by their editor. A
   // forward raycast must touch an actual near-vertical surface mesh.
   for(const candidate of objects){
    const mount=climbSurfaceProximity(candidate,robot);
    if(!mount||!(verticalInput>0||verticalInput<0&&mount.y>mount.bottomY+.3))continue;
    ladder=candidate;ride=mount;break;
   }
  }
  if(!ladder)return false;
 }
 const surface=ride.kind==='surface';
 const cfg=surface?null:sanitiseLadder(ladder.userData.ladder);
 const side=ride.side===-1?-1:1;
 const maxY=surface?ride.topY:cfg.height;
 const minY=surface?ride.bottomY:0;
 ride.y=ladderClimbStep(ride.y-minY,verticalInput,dt,maxY-minY)+minY;
 // Stay offset from the real contact surface, or the ladder rungs.
 const target=ladder.localToWorld(new THREE.Vector3(Number(ride.x)||0,ride.y,surface?Number(ride.z)||0:.44*side));
 if(ride.y>=maxY-.02&&verticalInput>0&&upperSurface?.(ladder,robot,target)){
  delete robot.userData.robotLadderRide;
  robot.userData.robotLadderCooldown=performance.now()+700;
  robot.userData.robotLadderDismount=true;
  robot.userData.robotMode='idle';
  return true;
 }
 robot.position.copy(target);
 robot.rotation.y=surface?ride.yaw:ladder.rotation.y+(side===1?Math.PI:0);
 robot.userData.robotLadderRide=ride;
 robot.userData.robotLadderSpeed=verticalInput;
 robot.userData.robotMode=verticalInput&&!(ride.y>=maxY-.02&&verticalInput>0)&&!(ride.y<=minY&&verticalInput<0)&&robot.userData.robotAnimator?.actions?.has('climbLadder')?'climbLadder':'idle';
 robot.userData.robotVelocity=0;robot.userData.robotLateral=0;
 return true;
}
export function releaseLadder(robot){if(!robot?.userData?.robotLadderRide)return false;delete robot.userData.robotLadderRide;robot.userData.robotLadderCooldown=performance.now()+650;robot.userData.robotLadderSpeed=0;robot.userData.robotMode='falling';robot.userData.robotFallActive=true;return true;}
