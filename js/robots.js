import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {MotionController,computeMode} from './animations.js';

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
// A real 'Sit' GLB animation is required for seating; never pretend idle is sitting.
export function sittingClip(names=[]){
  const name=names.find(n=>/^(?:sit|sitting|sitting idle|sit idle|sit down)(?:__\d+)?$/i.test(String(n).trim()));
  return name?'clip:'+name:null;
}
export function interruptRobotMission(robot){
  if(!robot)return;
  robot.userData.robotMission=null;
  robot.userData.robotGoal=null;
  robot.userData.robotSeated=false;
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
    if(mode==='jump'&&robot.userData.jumpVel!==undefined&&!robot.userData.physicsCharacterActive){
      robot.position.y+=robot.userData.jumpVel*dt;robot.userData.jumpVel-=12.5*dt;
      if(robot.position.y<=(robot.userData.groundY??0)){robot.position.y=robot.userData.groundY??0;delete robot.userData.jumpVel;mode='idle';robot.userData.robotMode='idle';robot.userData.robotArrived=true;}
    }
    if(mode==='wave'&&performance.now()>(robot.userData.waveEnd||0)){mode='idle';robot.userData.robotMode='idle';}
    if((mode==='walk'||mode==='run')&&robot.userData.robotGoal){
      const delta=robot.userData.robotGoal.clone().sub(robot.position);delta.y=0;
      const distance=delta.length();
      if(distance<.07){
        robot.userData.robotGoal=null;mode='idle';robot.userData.robotMode='idle';robot.userData.robotArrived=true;
        const mission=robot.userData.robotMission;
        if(mission){
          const clip=mission.kind==='go_sit'?sittingClip(robot.userData.robotAvailableActions):null;
          if(clip){robot.userData.robotSeated=true;robot.userData.robotMode=clip;mode=clip;}
          robot.userData.robotMission=null;
          window.dispatchEvent(new CustomEvent('solvi:robot-task-update',{detail:{robot:robot.name,target:mission.targetName||'',
            status:mission.kind==='go_sit'?(clip?'sitting':'missing-sit-clip'):'arrived'}}));
        }
      }
      else{
        delta.normalize();const speed=mode==='run'?2.7:1.2;
        robot.position.addScaledVector(delta,Math.min(distance,speed*dt));
        const angle=Math.atan2(delta.x,delta.z);robot.rotation.y+=Math.atan2(Math.sin(angle-robot.rotation.y),Math.cos(angle-robot.rotation.y))*clamp(dt*6,0,1);
      }
    }
    const visual=robot.children.find(c=>c.userData.robotVisual);if(visual){const lean=(robot.userData.robotLateral||0)*-.075;visual.rotation.z+=(lean-visual.rotation.z)*Math.min(1,dt*5);}
    if(robot.userData.robotPlaying!==mode){robot.userData.robotAnimator?.play(mode);robot.userData.robotPlaying=mode;}
    robot.userData.robotAnimator?.update(dt);
    if(robot.userData.robotGoal||robot.userData.robotArrived){onMove(robot,Boolean(robot.userData.robotArrived));robot.userData.robotArrived=false;}
  }
}
export function setRobotDestination(robot,point,run=false){
  if(!robot||robot.userData.editorKind!=='robot')return;
  robot.userData.robotGoal=new THREE.Vector3(point.x,robot.position.y,point.z);
  robot.userData.robotMode=run?'run':'walk';
}
export async function captureRobotView(world,robot){
  if(!robot||robot.userData.editorKind!=='robot')throw Error('Select a robot in Objects first.');
  const camera=new THREE.PerspectiveCamera(72,1,.04,110);robot.add(camera);
  camera.position.set(0,1.62,0);camera.rotation.y=Math.PI; // forward-facing head view
  const rt=new THREE.WebGLRenderTarget(512,512),renderer=world.renderer,old=renderer.getRenderTarget();
  const previousXR=renderer.xr.enabled,oldVisible=robot.visible;
  const pixels=new Uint8Array(512*512*4);
  try{
    robot.visible=false;camera.updateMatrixWorld(true);world.scene.updateMatrixWorld(true);
    renderer.xr.enabled=false;renderer.setRenderTarget(rt);renderer.render(world.scene,camera);
    renderer.readRenderTargetPixels(rt,0,0,512,512,pixels);
  }finally{renderer.setRenderTarget(old);renderer.xr.enabled=previousXR;robot.visible=oldVisible;robot.remove(camera);rt.dispose();}
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d'),frame=ctx.createImageData(512,512);
  for(let y=0;y<512;y++)frame.data.set(pixels.subarray((511-y)*2048,(512-y)*2048),y*2048);
  ctx.putImageData(frame,0,0);
  return new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));
}
