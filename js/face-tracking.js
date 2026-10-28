// Face landmarks + opt-in upper-body/hand landmarks. Only numeric values go through WebSocket.
import * as THREE from 'three';
import {classifyHandGesture,showGestureInWorld} from './hand-gestures.js';
const VERSION='0.10.34';
const CDN=`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function landmarkToLocal(p){return [Number(((.5-p.x)*1.8).toFixed(3)),Number((2.1-p.y*1.6).toFixed(3)),Number(((p.z||0)*-1.2).toFixed(3))];}
export async function setupFaceTracking(world){
 const faceBtn=document.getElementById('faceButton'),poseBtn=document.getElementById('poseButton'),preview=document.getElementById('facePreview'),webcamBtn=document.getElementById('webcamButton'),panel=document.getElementById('webcamPanel'),faceToggle=document.getElementById('facePreviewToggle'),poseToggle=document.getElementById('posePreviewToggle'),wavesToggle=document.getElementById('wavesPreviewToggle');
 let stream=null,faceTask=null,poseTask=null,handTask=null,active=false,faceEnabled=false,poseEnabled=false,lastFace=0,lastPose=0,sequence=0,lastGesture=0,previousGesture=null;
 const status=document.getElementById('webcamStatus');
 function buttonStates(){faceToggle.setAttribute('aria-pressed',String(faceEnabled));poseToggle.setAttribute('aria-pressed',String(poseEnabled));faceToggle.textContent=faceEnabled?'Face on':'Face off';poseToggle.textContent=poseEnabled?'Hands on':'Hands off';webcamBtn.setAttribute('aria-pressed',String(active));webcamBtn.setAttribute('aria-label',active?'Close webcam':'Open webcam');webcamBtn.title=active?'Stop webcam and close preview':'Open webcam and tracking';status.textContent=active?'Local webcam · '+(faceEnabled?'Face ':'')+(poseEnabled?'Hands ':''):'Camera off';}
 const notify=message=>{const e=document.getElementById('toast');e.textContent=message;e.hidden=false;};
 function stop(){active=false;faceEnabled=false;poseEnabled=false;sequence++;stream?.getTracks().forEach(t=>t.stop());stream=null;preview.srcObject=null;preview.hidden=true;panel.hidden=true;
  faceBtn.textContent='Face tracking';poseBtn.textContent='Posture + hands';world.localFace={};world.localHeadRotation=[0,0,0];world.localBody={};buttonStates();}
 async function ensureCamera(){if(active)return true;
  try{stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480},audio:false});preview.srcObject=stream;panel.hidden=false;preview.hidden=false;await preview.play();active=true;buttonStates();runFrames();return true;}
  catch(error){stop();notify('Webcam unavailable: '+error.message);return false;}}
 async function enableFace(){if(faceEnabled){faceEnabled=false;world.localFace={};world.localHeadRotation=[0,0,0];buttonStates();return;}
  if(!await ensureCamera())return;faceBtn.disabled=true;
  try{const {FilesetResolver,FaceLandmarker}=await import(`${CDN}/+esm`);const resolver=await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
   faceTask||=await FaceLandmarker.createFromOptions(resolver,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true,outputFacialTransformationMatrixes:true});
   if(active){faceEnabled=true;buttonStates();}}
  catch(error){notify('Face tracking unavailable: '+error.message);}finally{faceBtn.disabled=false;}}
 function runFrames(){const mySequence=++sequence;
    const run=()=>{if(!active||sequence!==mySequence)return;
      const now=performance.now();if(preview.readyState>=2){
        if(faceEnabled&&faceTask&&now-lastFace>=120){lastFace=now;
          try{
            const r=faceTask.detectForVideo(preview,now),face={};
            for(const c of r.faceBlendshapes?.[0]?.categories||[])face[c.categoryName]=Number(c.score.toFixed(3));
            world.localFace=face;
            const matrix=r.facialTransformationMatrixes?.[0]?.data;
            if(matrix?.length===16){const mat=new THREE.Matrix4().fromArray(matrix),q=new THREE.Quaternion().setFromRotationMatrix(mat),e=new THREE.Euler().setFromQuaternion(q,'YXZ');
              world.localHeadRotation=[clamp(-e.x,-.8,.8),clamp(-e.y,-1.1,1.1),clamp(e.z,-.65,.65)].map(x=>+x.toFixed(3));}
          }catch(err){console.debug('Face frame skipped',err);}
        }
        if(poseEnabled&&now-lastPose>=220){lastPose=now;
          try{
            const result=poseTask?.detectForVideo(preview,now);const points=result?.landmarks?.[0];
            if(points){const pairs={leftShoulder:11,rightShoulder:12,leftElbow:13,rightElbow:14,leftWrist:15,rightWrist:16,leftIndex:19,rightIndex:20};
              const body={};for(const [name,index] of Object.entries(pairs)){const p=points[index];if(p&&(p.visibility??1)>.32)body[name]=landmarkToLocal(p);}world.localBody=body;}
            if(handTask){const h=handTask.detectForVideo(preview,now);for(let i=0;i<(h.landmarks||[]).length;i++){
              const isLeft=h.handedness?.[i]?.[0]?.categoryName==='Left';const prefix=isLeft?'left':'right';
              const hand=h.landmarks[i];
              if(hand?.length===21){world.localBody[prefix+'Hand']=hand.map(landmarkToLocal);world.localBody[prefix+'Palm']=landmarkToLocal(hand[0]);world.localBody[prefix+'Index']=landmarkToLocal(hand[8]);const gesture=classifyHandGesture(hand);if(gesture&&gesture!==previousGesture&&now-lastGesture>3500){lastGesture=now;previousGesture=gesture;showGestureInWorld(THREE,world,gesture);window.dispatchEvent(new CustomEvent('solvi:gesture',{detail:{gesture,hand:prefix}}));}else if(!gesture)previousGesture=null;}
            }}
          }catch(err){console.debug('Pose frame skipped',err);}
        }
      }requestAnimationFrame(run);};requestAnimationFrame(run);
 }
 webcamBtn.onclick=async()=>{if(active)stop();else await ensureCamera();};
 document.getElementById('closeWebcam').onclick=stop;
 faceBtn.onclick=enableFace;faceToggle.onclick=()=>faceBtn.click();
 poseBtn?.addEventListener('click',async()=>{
  if(poseEnabled){poseEnabled=false;world.localBody={};poseBtn.textContent='Posture + hands';buttonStates();return;}
  if(!await ensureCamera())return;
  poseBtn.disabled=true;poseBtn.textContent='Loading posture…';
  try{
    const {FilesetResolver,PoseLandmarker,HandLandmarker}=await import(`${CDN}/+esm`);
    const resolver=await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    poseTask||=await PoseLandmarker.createFromOptions(resolver,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:1});
    try{handTask||=await HandLandmarker.createFromOptions(resolver,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:2});}
    catch(error){console.warn('Hand inference unavailable, keeping upper-body pose:',error);}
    if(active){poseEnabled=true;poseBtn.textContent=handTask?'Stop body + hands':'Stop upper body';buttonStates();}
  }catch(error){notify('Pose tracking unavailable: '+error.message);poseEnabled=false;poseBtn.textContent='Posture + hands';}
  finally{poseBtn.disabled=false;buttonStates();}
 });
 poseToggle.onclick=()=>poseBtn.click();
 wavesToggle.onclick=()=>document.getElementById('voiceWavesButton').click();
 window.addEventListener('solvi:voice-waves',e=>{wavesToggle.setAttribute('aria-pressed',String(e.detail.active));wavesToggle.textContent=e.detail.active?'Waves on':'Waves off';});
 window.addEventListener('pagehide',stop);
}
