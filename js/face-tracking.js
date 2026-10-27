// MediaPipe Face Landmarker runs on-device after explicit webcam permission.
const VERSION='0.10.34';
const CDN=`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
export async function setupFaceTracking(world){
 const button=document.getElementById('faceButton'), preview=document.getElementById('facePreview');
 let stream=null,landmarker=null,active=false,last=0;
 function stop(){active=false;stream?.getTracks().forEach(t=>t.stop());stream=null;preview.srcObject=null;preview.hidden=true;button.textContent='Face tracking';world.localFace={};}
 button?.addEventListener('click',async()=>{
  if(active){stop();return;}button.disabled=true;button.textContent='Loading face…';
  try{
   // No imagery leaves this browser. Only numeric face coefficients are sent to room peers.
   const {FilesetResolver,FaceLandmarker}=await import(`${CDN}/+esm`);
   const files=await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
   landmarker=await FaceLandmarker.createFromOptions(files,{
    baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate:'GPU'},
    runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true
   });
   stream=await navigator.mediaDevices.getUserMedia({video:{width:320,height:240},audio:false});
   preview.srcObject=stream;await preview.play();preview.hidden=false;active=true;button.textContent='Stop face';
   const tick=()=>{if(!active)return;
    const now=performance.now();if(now-last>=110&&preview.readyState>=2){last=now;
      try{const result=landmarker.detectForVideo(preview,now);const cats=result.faceBlendshapes?.[0]?.categories||[];
       const face={};for(const c of cats){face[c.categoryName]=Number(c.score.toFixed(3));}
       world.localFace=face;
      }catch(e){console.warn('Face inference frame skipped:',e);}
    }
    requestAnimationFrame(tick);
   };requestAnimationFrame(tick);
  }catch(e){stop();const el=document.getElementById('toast');el.textContent='Face tracking unavailable: '+e.message;el.hidden=false;}
  finally{button.disabled=false;if(!active)button.textContent='Face tracking';}
 });
 window.addEventListener('pagehide',stop);
}
