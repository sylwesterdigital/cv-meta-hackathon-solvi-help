// Face landmarks + opt-in upper-body/hand landmarks. Only numeric values go through WebSocket.
import * as THREE from 'three';
const VERSION='0.10.34';
const CDN=`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function landmarkToLocal(p){return [Number(((.5-p.x)*1.8).toFixed(3)),Number((2.1-p.y*1.6).toFixed(3)),Number(((p.z||0)*-1.2).toFixed(3))];}
export async function setupFaceTracking(world){
 const faceBtn=document.getElementById('faceButton'),poseBtn=document.getElementById('poseButton'),preview=document.getElementById('facePreview');
 let stream=null,faceTask=null,poseTask=null,handTask=null,active=false,poseEnabled=false,lastFace=0,lastPose=0,sequence=0;
 const notify=message=>{const e=document.getElementById('toast');e.textContent=message;e.hidden=false;};
 function stop(){active=false;poseEnabled=false;stream?.getTracks().forEach(t=>t.stop());stream=null;preview.srcObject=null;preview.hidden=true;
  faceBtn.textContent='Face tracking';poseBtn.textContent='Posture + hands';world.localFace={};world.localHeadRotation=[0,0,0];world.localBody={};}
 async function start(){
  if(active)return;
  faceBtn.disabled=true;faceBtn.textContent='Loading face…';
  try{
    const {FilesetResolver,FaceLandmarker}=await import(`${CDN}/+esm`);
    const resolver=await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    faceTask=await FaceLandmarker.createFromOptions(resolver,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate:'GPU'},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true,outputFacialTransformationMatrixes:true});
    stream=await navigator.mediaDevices.getUserMedia({video:{width:480,height:360},audio:false});
    preview.srcObject=stream;await preview.play();preview.hidden=false;active=true;faceBtn.textContent='Stop face';
    const run=()=>{if(!active||++sequence>100000000)return;
      const now=performance.now();if(preview.readyState>=2){
        if(now-lastFace>=120){lastFace=now;
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
              if(hand?.length===21){world.localBody[prefix+'Hand']=hand.map(landmarkToLocal);world.localBody[prefix+'Palm']=landmarkToLocal(hand[0]);world.localBody[prefix+'Index']=landmarkToLocal(hand[8]);}
            }}
          }catch(err){console.debug('Pose frame skipped',err);}
        }
      }requestAnimationFrame(run);};requestAnimationFrame(run);
  }catch(error){stop();notify('Webcam tracking unavailable: '+error.message);}
  finally{faceBtn.disabled=false;if(!active)faceBtn.textContent='Face tracking';}
 }
 faceBtn?.addEventListener('click',()=>active?stop():start());
 poseBtn?.addEventListener('click',async()=>{
  if(poseEnabled){poseEnabled=false;world.localBody={};poseBtn.textContent='Posture + hands';return;}
  if(!active)await start();if(!active)return;
  poseBtn.disabled=true;poseBtn.textContent='Loading posture…';
  try{
    const {FilesetResolver,PoseLandmarker,HandLandmarker}=await import(`${CDN}/+esm`);
    const resolver=await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    poseTask||=await PoseLandmarker.createFromOptions(resolver,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:1});
    try{handTask||=await HandLandmarker.createFromOptions(resolver,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:2});}
    catch(error){console.warn('Hand inference unavailable, keeping upper-body pose:',error);}
    poseEnabled=true;poseBtn.textContent=handTask?'Stop body + hands':'Stop upper body';
  }catch(error){notify('Pose tracking unavailable: '+error.message);poseEnabled=false;poseBtn.textContent='Posture + hands';}
  finally{poseBtn.disabled=false;}
 });
 window.addEventListener('pagehide',stop);
}
