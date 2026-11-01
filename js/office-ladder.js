import * as THREE from 'three';
import {wallPresetTexture} from './office-walls.js';

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

export function ladderProximity(ladder,robot){
 if(ladder?.userData?.editorKind!=='ladder'||!robot)return null;
 ladder.updateMatrixWorld(true);
 const local=ladder.worldToLocal(robot.position.clone());
 const cfg=sanitiseLadder(ladder.userData.ladder);
 if(Math.abs(local.x)>cfg.width*.5+.32||local.z<.05||local.z>.85||local.y<-.25||local.y>cfg.height+.12)return null;
 return {local,cfg};
}
export function ladderClimbStep(y,input,dt,height){
 const direction=Math.sign(Number(input)||0),delta=Math.min(.06,Math.max(0,Number(dt)||0))*1.25*direction;
 return Math.max(0,Math.min(height,Number(y)+delta));
}
// Caller is responsible for checking for an actual upper-floor surface. Never
// release a visitor into empty air at the top of an unsupported ladder.
export function stepLadderRobot(robot,objects,verticalInput,dt,{upperSurface=null}={}){
 let ride=robot?.userData?.robotLadderRide||null;
 let ladder=ride&&objects.find(o=>o.userData.editorId===ride.id&&o.userData.editorKind==='ladder');
 if(!ladder){
  delete robot.userData.robotLadderRide;
  if((robot.userData.robotLadderCooldown||0)>performance.now()||!verticalInput)return false;
  for(const candidate of objects){if(candidate.userData.editorKind!=='ladder')continue;
   const near=ladderProximity(candidate,robot);
   if(near&&(verticalInput>0||near.local.y>.3&&verticalInput<0)){
    ladder=candidate;ride={id:candidate.userData.editorId,y:Math.max(0,near.local.y)};break;
   }
  }
  if(!ladder)return false;
 }
 const cfg=sanitiseLadder(ladder.userData.ladder);
 const previous=ride.y;
 ride.y=ladderClimbStep(ride.y,verticalInput,dt,cfg.height);
 // Stick to a consistent front face and keep feet clear of the rungs.
 const target=ladder.localToWorld(new THREE.Vector3(0,ride.y,.43));
 if(ride.y>=cfg.height-.02&&verticalInput>0&&upperSurface?.(ladder,robot,target)){
  delete robot.userData.robotLadderRide;
  robot.userData.robotLadderCooldown=performance.now()+700;
  robot.userData.robotLadderDismount=true;
  robot.userData.robotMode='idle';
  return true;
 }
 robot.position.copy(target);
 robot.rotation.y=ladder.rotation.y+Math.PI;
 robot.userData.robotLadderRide=ride;
 robot.userData.robotLadderSpeed=verticalInput;
 robot.userData.robotMode=verticalInput&&!(ride.y>=cfg.height-.02&&verticalInput>0)&&!(ride.y<=0&&verticalInput<0)&&robot.userData.robotAnimator?.actions?.has('climbLadder')?'climbLadder':'idle';
 robot.userData.robotVelocity=0;robot.userData.robotLateral=0;
 return true;
}
export function releaseLadder(robot){if(!robot?.userData?.robotLadderRide)return false;delete robot.userData.robotLadderRide;robot.userData.robotLadderCooldown=performance.now()+650;robot.userData.robotLadderSpeed=0;robot.userData.robotMode='falling';robot.userData.robotFallActive=true;return true;}
