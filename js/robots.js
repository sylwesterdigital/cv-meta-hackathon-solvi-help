import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {MotionController,computeMode} from './animations.js';
import {pathBlocked} from './robot-pathfinding.js';
import {footfallRate} from './robot-combat.js';

const loader=new GLTFLoader();
const draco=new DRACOLoader();draco.setDecoderPath('./vendor/three/draco/');loader.setDRACOLoader(draco);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const DEFAULT_ROBOT_AVATAR='./assets/solvi-character.glb';
export const resolveAvatarPath=(name)=>typeof name==='string'&&/^[A-Za-z0-9_-]+\.glb$/.test(name)?'./assets/avatars/'+name:DEFAULT_ROBOT_AVATAR;
export async function hydrateRobot(group){
  if(group.userData.robotReady)return;
  const token=(group.userData.robotLoadToken||0)+1;group.userData.robotLoadToken=token;
  group.userData.robotLoading=true;
  try{
    const gltf=await loader.loadAsync(group.userData.avatarUrl||DEFAULT_ROBOT_AVATAR);
    if(!group.parent||group.userData.robotLoadToken!==token)return;
    const model=gltf.scene;
    const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    if(size.y>.001){const s=1.75/size.y;model.scale.setScalar(s);model.position.set(-center.x*s,-box.min.y*s,-center.z*s);}
    model.traverse(child=>{if(child.isMesh){child.castShadow=true;child.receiveShadow=true;}});
    group.children.find(c=>c.userData.robotPlaceholder)?.removeFromParent();
    // Mixamo/legacy SOLVI glTF's visible facing is -Z, whereas the editor's
    // movement heading uses +Z. Correct *the visual*, not the heading/group.
    // Other GLBs are left unchanged until their catalog has a facing entry.
    model.userData.sitBaseY=model.position.y;
    const avatarVisual=new THREE.Group();avatarVisual.userData.robotVisual=true;
    if((group.userData.avatarUrl||DEFAULT_ROBOT_AVATAR)===DEFAULT_ROBOT_AVATAR)avatarVisual.rotation.y=Math.PI;
    avatarVisual.add(model);group.add(avatarVisual);
    group.userData.robotAnimator=new MotionController(THREE,model,gltf.animations);
    group.userData.robotAvailableActions=group.userData.robotAnimator.clipNames;
    window.dispatchEvent(new CustomEvent('solvi:robot-model-ready',{detail:{id:group.userData.editorId}}));
    group.userData.robotAnimator.play('idle');
    group.userData.robotReady=true;group.userData.robotMode='idle';
  }catch(error){if(group.userData.robotLoadToken===token){console.warn('Robot asset could not load:',error);group.userData.robotError=error.message;}}
  finally{if(group.userData.robotLoadToken===token)group.userData.robotLoading=false;}
}
export function makeRobot(){
  const group=new THREE.Group();group.name='Robot';
  const placeholder=new THREE.Mesh(new THREE.CapsuleGeometry(.29,.86,4,12),new THREE.MeshStandardMaterial({color:'#77bdd2'}));
  placeholder.position.y=.85;placeholder.userData.robotPlaceholder=true;group.add(placeholder);
  group.userData.robotMode='idle';group.userData.robotGoal=null;group.userData.avatarUrl=DEFAULT_ROBOT_AVATAR;
  return group;
}
// Use an authored Sit animation when present, otherwise a visible approximate
// procedural knee/hip bend (labelled as such in the execution trace).
export function sittingClip(names=[]){
  const name=names.find(n=>/^(?:sit|sitting|sitting idle|sit idle|sit down)(?:__\d+)?$/i.test(String(n).trim()));
  return name?'clip:'+name:null;
}
export function interruptRobotMission(robot){
  if(!robot)return;
  robot.userData.robotMission=null;
  robot.userData.robotGoal=null;
  robot.userData.robotWaypoints=null;robot.userData.robotPathObstacles=null;
  robot.userData.robotRouteDestination=null;robot.userData.robotRecoveryAttempts=0;
  robot.userData.robotSeated=false;
  robot.userData.robotSitPose=null;
}
export function robotAction(robot,mode){
  if(!robot||robot.userData.editorKind!=='robot')return;
  robot.userData.robotMode=mode;interruptRobotMission(robot);
  if(mode==='walk'||mode==='run'){
    const forward=new THREE.Vector3(0,0,mode==='run'?4:2.3).applyQuaternion(robot.quaternion);
    robot.userData.robotGoal=robot.position.clone().add(forward);
  }
  robot.userData.robotAnimator?.play(mode);
  if(mode==='wave')robot.userData.waveEnd=performance.now()+1800;
  if(mode==='jump'){robot.userData.robotJumpUntil=performance.now()+1050;robot.userData.jumpVel=4.6;robot.userData.groundY=robot.position.y;}
}
export function tickRobots(items,dt,onMove=()=>{}){
  for(const robot of items){
    if(robot.userData.editorKind!=='robot')continue;
    let mode=robot.userData.robotMode||'idle';
    const turning=robot.userData.robotMission;
    if(turning?.phase==='turn'&&['turn','turn_walk'].includes(turning.kind)){
      const delta=Math.atan2(Math.sin(turning.targetYaw-robot.rotation.y),Math.cos(turning.targetYaw-robot.rotation.y));
      const step=Math.max(0,Math.min(10,Number(robot.userData.robotTurnSpeed??4)))*2.2*Math.max(0,dt);
      robot.rotation.y+=Math.sign(delta)*Math.min(Math.abs(delta),step);
      robot.userData.robotMode='idle';mode='idle';
      if(Math.abs(delta)<=step+.00001){
        robot.rotation.y=turning.targetYaw;
        if(turning.kind==='turn_walk'){
          turning.phase='walk';
          const target={x:robot.position.x+Math.sin(robot.rotation.y)*turning.distance,
            z:robot.position.z+Math.cos(robot.rotation.y)*turning.distance};
          if(onMove.navigate&&!onMove.navigate(robot,target)){mode='idle';robot.userData.robotMode='idle';}
          else{if(!onMove.navigate)setRobotDestination(robot,target);mode='walk';}
        }else{
          robot.userData.robotMission=null;
          robot.userData.robotArrived=true;
          window.dispatchEvent(new CustomEvent('solvi:robot-task-update',{detail:{robot:robot.name,
            robotId:robot.userData.editorId,taskId:turning.taskId,target:turning.targetName,status:'arrived'}}));
        }
      }
    }
    if(mode==='jump'&&robot.userData.jumpVel!==undefined&&!robot.userData.physicsCharacterActive){
      robot.position.y+=robot.userData.jumpVel*dt;robot.userData.jumpVel-=12.5*dt;
      if(robot.position.y<=(robot.userData.groundY??0)){robot.position.y=robot.userData.groundY??0;delete robot.userData.jumpVel;mode='idle';robot.userData.robotMode='idle';robot.userData.robotArrived=true;
        const mission=robot.userData.robotMission;
        if(mission?.kind==='jump'){robot.userData.robotMission=null;
          window.dispatchEvent(new CustomEvent('solvi:robot-task-update',{detail:{robot:robot.name,robotId:robot.userData.editorId,
            taskId:mission.taskId,target:mission.targetName,status:'arrived'}}));}
      }
    }
    if(mode==='wave'&&performance.now()>(robot.userData.waveEnd||0)){mode='idle';robot.userData.robotMode='idle';}
    if((mode==='walk'||mode==='run')&&robot.userData.robotGoal){
      const delta=robot.userData.robotGoal.clone().sub(robot.position);delta.y=0;
      const distance=delta.length();
      if(distance<.07){
        if(robot.userData.robotWaypoints?.length){const point=robot.userData.robotWaypoints.shift();setRobotDestination(robot,point);onMove(robot,false);continue;}
        if(onMove.retarget?.(robot)){onMove(robot,false);continue;}
        robot.userData.robotWaypoints=null;robot.userData.robotPathObstacles=null;robot.userData.robotRecoveryAttempts=0;
        robot.userData.robotGoal=null;mode='idle';robot.userData.robotMode='idle';robot.userData.robotArrived=true;
        const mission=robot.userData.robotMission;
        if(mission){
          // Count a cycle only after both the outward and return legs arrive.
          if(mission.kind==='coffee_visit'&&mission.leg===0){
            mission.leg=1;
            if(onMove.navigate?.(robot,mission.origin)!==false){robot.userData.robotArrived=false;onMove(robot,false);}continue;
          }
          if(mission.kind==='walk_forward'&&mission.repeat>1&&!mission.returnToStart&&mission.leg+1<mission.repeat){
            mission.leg++;const forward={x:robot.position.x+mission.endpoint.x-mission.origin.x,z:robot.position.z+mission.endpoint.z-mission.origin.z};
            if(onMove.navigate?.(robot,forward)!==false){robot.userData.robotArrived=false;onMove(robot,false);}continue;
          }
          if(mission.kind==='walk_forward'&&mission.returnToStart&&mission.repeat>0){
            const completed=Math.floor(mission.leg/2);
            if(mission.leg%2===0){
              mission.leg++;
              if(onMove.navigate?.(robot,mission.origin)!==false){robot.userData.robotArrived=false;onMove(robot,false);}continue;
            }else if(completed+1<mission.repeat){
              mission.leg++;
              if(onMove.navigate?.(robot,mission.endpoint)!==false){robot.userData.robotArrived=false;onMove(robot,false);}continue;
            }
          }
          if(['wander','random_action'].includes(mission.kind)&&mission.leg+1<mission.repeat){
            mission.leg++;
            const angle=robot.rotation.y+(Math.random()-.5)*Math.PI*1.8;
            const distance=1.5+Math.random()*2;
            const point={x:robot.position.x+Math.sin(angle)*distance,z:robot.position.z+Math.cos(angle)*distance};
            if(onMove.navigate?.(robot,point)!==false){robot.userData.robotArrived=false;onMove(robot,false);}continue;
          }
          if(mission.partialStop){
            const partial=mission.partialStop;
            robot.userData.robotMission=null;
            window.dispatchEvent(new CustomEvent('solvi:robot-task-update',{detail:{robot:robot.name,robotId:robot.userData.editorId,taskId:mission.taskId,target:mission.targetName,
              status:'partial',progress:partial.progress,remainingMeters:partial.remainingMeters}}));
            continue;
          }
          const clip=mission.kind==='go_sit'?sittingClip(robot.userData.robotAvailableActions):null;
          if(mission.kind==='go_sit'){
            robot.userData.robotSeated=true;
            robot.userData.robotSitPose=clip?'clip':'procedural';
            if(clip){robot.userData.robotMode=clip;mode=clip;}
          }
          robot.userData.robotMission=null;
          window.dispatchEvent(new CustomEvent('solvi:robot-task-update',{detail:{robot:robot.name,robotId:robot.userData.editorId,taskId:mission.taskId,target:mission.targetName||'',
            status:mission.kind==='go_sit'?(clip?'sitting':'procedural-sitting'):mission.kind==='coffee_visit'?'coffee-visit':'arrived'}}));
        }
      }
      else{
        delta.normalize();const speed=mode==='run'?2.7:1.2;
        const travel=Math.min(distance,speed*Math.max(0,Number(robot.userData.robotSpeed??1.8))*dt);const nx=robot.position.x+delta.x*travel,nz=robot.position.z+delta.z*travel;
        const staticBlock=robot.userData.robotPathObstacles&&pathBlocked(nx,nz,robot.userData.robotPathObstacles.filter(o=>o.kind!=='robot'),.25);
        // Occupied robot footprints are dynamic. Replan with a refreshed scene index.
        const neighbour=items.some(other=>{
          if(other===robot||other.userData.editorKind!=='robot')return false;
          const before=Math.hypot(other.position.x-robot.position.x,other.position.z-robot.position.z);
          const after=Math.hypot(other.position.x-nx,other.position.z-nz);
          // If already overlapping, moving AWAY is a safe way to resolve it.
          if(after<.66&&after<before+0.0001&&onMove.push?.(robot,other,{x:nx,z:nz},dt))return false;
          return after<.66&&after<before+0.0001;
        });
        if(staticBlock||neighbour){
          if(onMove.recover?.(robot,staticBlock?'scene obstacle':'occupied by robot')){onMove(robot,false);continue;}
          const mission=robot.userData.robotMission;robot.userData.robotGoal=null;robot.userData.robotWaypoints=null;robot.userData.robotPathObstacles=null;robot.userData.robotMission=null;robot.userData.robotMode='idle';mode='idle';
          window.dispatchEvent(new CustomEvent('solvi:robot-task-update',{detail:{robot:robot.name,robotId:robot.userData.editorId,taskId:mission?.taskId,target:mission?.targetName,status:'blocked'}}));continue;
        }
        robot.position.addScaledVector(delta,travel);
        const angle=Math.atan2(delta.x,delta.z);robot.rotation.y+=Math.atan2(Math.sin(angle-robot.rotation.y),Math.cos(angle-robot.rotation.y))*clamp(dt*6,0,1);
      }
    }
    const contact=robot.userData.robotContactAction;
    if(contact&&performance.now()<contact.until)mode=contact.clip||contact.kind;
    else if(contact){robot.userData.robotContactAction=null;if(mode==='push'||String(mode).startsWith('clip:'))mode=robot.userData.robotGoal?'walk':'idle';}
    const push=robot.userData.robotPushState;
    if(!contact&&push&&performance.now()-push.at<270&&!robot.userData.robotGoal&&!robot.userData.robotMission&&mode==='idle'){mode=push.kind;}
    const visual=robot.children.find(c=>c.userData.robotVisual);if(visual){const lean=(robot.userData.robotLateral||0)*-.075;visual.rotation.z+=(lean-visual.rotation.z)*Math.min(1,dt*5);}
    if(robot.userData.robotPlaying!==mode){robot.userData.robotAnimator?.play(mode);robot.userData.robotPlaying=mode;}
    // Footfall cadence follows measured displacement, not an in-place walk timer.
    if(push&&performance.now()-push.at<270&&mode===push.kind)robot.userData.robotAnimator?.setPlaybackSpeed(push.rate);
    else if(['walk','walkBackward','run','strafeLeft','strafeRight'].includes(mode))robot.userData.robotAnimator?.setPlaybackSpeed(footfallRate(robot.userData.robotActualSpeed,mode));
    else robot.userData.robotAnimator?.setPlaybackSpeed(1);
    robot.userData.robotAnimator?.update(dt);
    if(robot.userData.robotSeated&&robot.userData.robotSitPose==='procedural'){
      const visualModel=visual?.children[0];
      if(visualModel){visualModel.position.y+=(Math.max(-.40,(visualModel.userData.sitBaseY??visualModel.position.y)-.32)-visualModel.position.y)*Math.min(1,dt*4);
        visualModel.traverse(bone=>{if(!bone.isBone)return;const name=bone.name.toLowerCase();
          if(/(?:left|right|l_|r_).*(?:upleg|thigh|upperleg)|(?:upleg|thigh|upperleg).*(?:left|right)/.test(name))bone.rotation.x+=((bone.userData.sitBaseX??(bone.userData.sitBaseX=bone.rotation.x))+1.0-bone.rotation.x)*Math.min(1,dt*5);
          if(/(?:left|right|l_|r_).*(?:leg|calf|shin)|(?:calf|shin|lowerleg).*(?:left|right)/.test(name)&&!/upper|thigh|upleg/.test(name))bone.rotation.x+=((bone.userData.sitBaseX??(bone.userData.sitBaseX=bone.rotation.x))-.9-bone.rotation.x)*Math.min(1,dt*5);
        });
      }
    }else if(visual?.children[0]?.userData.sitBaseY!==undefined){const model=visual.children[0];model.position.y+=(model.userData.sitBaseY-model.position.y)*Math.min(1,dt*5);}
    if(robot.userData.robotGoal||robot.userData.robotMission||robot.userData.robotArrived){onMove(robot,Boolean(robot.userData.robotArrived));robot.userData.robotArrived=false;}
  }
}
export function setRobotDestination(robot,point,run=false){
  if(!robot||robot.userData.editorKind!=='robot')return;
  robot.userData.robotGoal=new THREE.Vector3(point.x,robot.position.y,point.z);
  robot.userData.robotMode=run?'run':'walk';
}
export function robotHeadCameraPose(robot,options={}){
 if(!robot||robot.userData.editorKind!=='robot')throw Error('Robot head camera requires a robot.');
 const camera=new THREE.PerspectiveCamera(72,1,.04,1500);
 robot.add(camera);camera.position.set(0,1.62,0);camera.rotation.order='YXZ';
 camera.rotation.y=Math.PI+(Number(options.yawOffset)||0);
 camera.rotation.x=THREE.MathUtils.degToRad(Math.max(-70,Math.min(70,Number(options.pitchDegrees)||0)));
 camera.updateMatrixWorld(true);
 const pose={position:camera.getWorldPosition(new THREE.Vector3()).clone(),quaternion:camera.getWorldQuaternion(new THREE.Quaternion()).clone(),fov:72,width:512,height:512};
 robot.remove(camera);return pose;
}
export async function captureRobotView(world,robot,options={}){
  if(!robot||robot.userData.editorKind!=='robot')throw Error('Select a robot in Objects first.');
  const camera=new THREE.PerspectiveCamera(72,1,.04,Math.max(1500,Number(world?.camera?.far)||1500));robot.add(camera);
  camera.position.set(0,1.62,0);camera.rotation.order='YXZ';camera.rotation.y=Math.PI+(Number(options.yawOffset)||0); // forward head view plus scan direction
  camera.rotation.x=THREE.MathUtils.degToRad(Math.max(-70,Math.min(70,Number(options.pitchDegrees)||0))); // negative tilt points downward
  const rt=new THREE.WebGLRenderTarget(512,512),renderer=world.renderer,old=renderer.getRenderTarget();
  const previousXR=renderer.xr.enabled,oldVisible=robot.visible;
  const oldSkyPosition=world.skyDome?.position.clone();
  const pixels=new Uint8Array(512*512*4);
  try{
    robot.visible=false;camera.updateMatrixWorld(true);
    // The sky dome follows the active render camera, including robot-eye offscreen views.
    if(world.skyDome?.visible)world.skyDome.position.copy(camera.getWorldPosition(new THREE.Vector3()));
    world.scene.updateMatrixWorld(true);
    if(typeof options.onPose==='function')options.onPose({position:camera.getWorldPosition(new THREE.Vector3()).clone(),quaternion:camera.getWorldQuaternion(new THREE.Quaternion()).clone(),fov:camera.fov,width:512,height:512});
    renderer.xr.enabled=false;renderer.setRenderTarget(rt);renderer.render(world.scene,camera);
    renderer.readRenderTargetPixels(rt,0,0,512,512,pixels);
  }finally{if(oldSkyPosition)world.skyDome.position.copy(oldSkyPosition);renderer.setRenderTarget(old);renderer.xr.enabled=previousXR;robot.visible=oldVisible;robot.remove(camera);rt.dispose();}
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d'),frame=ctx.createImageData(512,512);
  for(let y=0;y<512;y++)frame.data.set(pixels.subarray((511-y)*2048,(512-y)*2048),y*2048);
  ctx.putImageData(frame,0,0);
  return new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));
}

// Render a FRONT-facing avatar headshot, not the head-mounted camera view.
// 3D model and pose are taken from the current scene; portrait is a real JPEG.
export async function captureRobotPortrait(world,robot){
  if(!robot||robot.userData.editorKind!=='robot')throw Error('Select a robot for its 3D portrait.');
  if(!robot.userData.robotReady)throw Error('Robot avatar model is still loading; try again when visible.');
  const renderer=world.renderer,oldTarget=renderer.getRenderTarget(),oldXR=renderer.xr.enabled;
  const camera=new THREE.PerspectiveCamera(34,1,.02,70);
  robot.updateWorldMatrix(true,true);
  // SOLVI robot forward is +Z. Place camera in front and look toward the face.
  const target=robot.localToWorld(new THREE.Vector3(0,1.53,0));
  const view=robot.localToWorld(new THREE.Vector3(0,1.53,2.05));
  camera.position.copy(view);camera.lookAt(target);camera.updateMatrixWorld(true);
  const n=256,rt=new THREE.WebGLRenderTarget(n,n),pixels=new Uint8Array(n*n*4);
  // Hide furniture and other characters for a clean, unoccluded portrait.
  const hidden=world.scene.children.filter(o=>o!==robot&&!o.isLight&&o.visible);
  try{for(const obj of hidden)obj.visible=false;renderer.xr.enabled=false;renderer.setRenderTarget(rt);renderer.render(world.scene,camera);renderer.readRenderTargetPixels(rt,0,0,n,n,pixels);}
  finally{for(const obj of hidden)obj.visible=true;renderer.setRenderTarget(oldTarget);renderer.xr.enabled=oldXR;rt.dispose();}
  const canvas=document.createElement('canvas');canvas.width=canvas.height=n;
  const ctx=canvas.getContext('2d');const out=ctx.createImageData(n,n);
  for(let y=0;y<n;y++)out.data.set(pixels.subarray((n-1-y)*n*4,(n-y)*n*4),y*n*4);
  ctx.putImageData(out,0,0);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));
  if(!blob?.size)throw Error('Headshot render did not create an image.');
  return blob;
}
