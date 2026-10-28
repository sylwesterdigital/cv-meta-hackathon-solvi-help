import * as THREE from 'three';
import {captureRobotView,captureRobotPortrait} from './robots.js';
const $=id=>document.getElementById(id);
const fields={personality:'brainsPersonality',history:'brainsHistory',beliefs:'brainsBeliefs',triggers:'brainsTriggers',scenario:'brainsScenario'};
let activeRobot=null,frame=null,frameURL=null;
const latestFrames=new Map(),frameHistory=new Map(),taskTraces=new Map();
function rememberFrame(id,blob,label){
 const rec={blob,label,boxes:[],usage:null};latestFrames.set(id,rec);
 const history=frameHistory.get(id)||[];history.push(rec);if(history.length>10)history.shift();frameHistory.set(id,history);
 return rec;
}
export function emitBrainTrace(robotId,robotName,step,detail=''){
 const entry={at:new Date().toLocaleTimeString(),robotId,robotName,step,detail:String(detail).slice(0,1800)};
 const records=taskTraces.get(robotId)||[];records.push(entry);if(records.length>85)records.shift();taskTraces.set(robotId,records);
 window.dispatchEvent(new CustomEvent('solvi:brain-trace',{detail:entry}));return entry;
}
// Head-camera observations are pixel evidence, not 3D locations until raycasting
// validates a hit on an editor-owned object mesh.
function raycastSAMBox(pose,box,editor,robot){
 const coordinates=[[(box.x1+box.x2)/2,(box.y1+box.y2)/2],
                    [box.x1+(box.x2-box.x1)*.35,box.y1+(box.y2-box.y1)*.6],
                    [box.x1+(box.x2-box.x1)*.65,box.y1+(box.y2-box.y1)*.6]];
 const objects=editor.items.filter(o=>o!==robot&&o.userData.editorKind!=='robot'&&o.userData.editorKind!=='light'&&o.visible);
 const ray=new THREE.Raycaster();ray.far=100;
 const aspect=pose.width/pose.height,tan=Math.tan(THREE.MathUtils.degToRad(pose.fov)/2);
 for(const [x,y] of coordinates){
   const nx=x/box.width*2-1,ny=1-y/box.height*2;
   if(!Number.isFinite(nx)||!Number.isFinite(ny))continue;
   const dir=new THREE.Vector3(nx*tan*aspect,ny*tan,-1).normalize().applyQuaternion(pose.quaternion);
   ray.set(pose.position,dir);
   for(const hit of ray.intersectObjects(objects,true)){
     let owner=hit.object;while(owner&&!owner.userData.editorId)owner=owner.parent;
     if(owner&&objects.includes(owner))return {target:owner,position:hit.point.clone(),distance:hit.distance};
   }
 }
 return null;
}
const asDataURL=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
export async function runRobotVisualSearch(world,editor,robot,command,api,isCancelled=()=>false){
 const name=robot.name,id=robot.userData.editorId,phrase=command.target_phrase;
 let lastFrame=null,foundUnmapped=false,spend=0;
 const directions=[0,Math.PI/2,Math.PI,3*Math.PI/2];
 for(let index=0;index<directions.length;index++){
   if(isCancelled())return {status:'cancelled'};
   const facing=Math.round(directions[index]*180/Math.PI);
   let pose=null;
   emitBrainTrace(id,name,'CAPTURE',`View ${index+1}/4 · head yaw offset ${facing}° · 512 × 512 JPEG`);
   const image=await captureRobotView(world,robot,{yawOffset:directions[index],onPose:p=>{pose=p;}});
   if(!image)throw Error('Head-camera screenshot returned no JPEG');
   const captured=rememberFrame(id,image,`SAM · search ${index+1}/4 · ${facing}° · prompt "${phrase}"`);lastFrame=image;
   window.dispatchEvent(new CustomEvent('solvi:brain-frame',{detail:{robotId:id,blob:image,label:`View ${index+1}/4; head yaw ${facing}° · ${image.size} bytes · SAM request`}}));
   emitBrainTrace(id,name,'META REQUEST',`POST /v1/responses · model sam-3.1 · prompt "${phrase}" · image/jpeg ${image.size} bytes · store=false`);
   const started=performance.now();
   const response=await api.req('/api/ai/vision',{method:'POST',body:JSON.stringify({mode:'segment',prompt:phrase,image:await asDataURL(image)})});
   if(isCancelled())return {status:'cancelled'};
   spend+=Number(response.usage?.estimated_usd||0);
   const boxes=response.result?.boxes||[];
   captured.boxes=boxes;captured.usage=response.usage;
   window.dispatchEvent(new CustomEvent('solvi:brain-gallery',{detail:{robotId:id}}));
   emitBrainTrace(id,name,'SAM RESPONSE',`${Math.round(performance.now()-started)} ms · ${boxes.length} parsed detection(s) · response ${response.result?.id||'unknown'} · estimated US$${Number(response.usage?.estimated_usd||0).toFixed(6)} · total US$${spend.toFixed(6)}`);
   for(const box of boxes){
     const hit=pose&&raycastSAMBox(pose,box,editor,robot);
     if(hit){
       emitBrainTrace(id,name,'SPATIAL MATCH',`SAM box #${box.id} ${Math.round(box.x1)},${Math.round(box.y1)}–${Math.round(box.x2)},${Math.round(box.y2)}; raycast hit "${hit.target.name}" at (${hit.position.x.toFixed(2)},${hit.position.z.toFixed(2)}) · ${hit.distance.toFixed(2)} m`);
       window.dispatchEvent(new CustomEvent('solvi:brain-boxes',{detail:{robotId:id,boxes}}));
       return {status:'found',target:hit.target,targetId:hit.target.userData.editorId,spend};
     }
     foundUnmapped=true;
   }
   if(boxes.length)emitBrainTrace(id,name,'SPATIAL MATCH',`${boxes.length} SAM box(es), but no editor mesh intersected the box rays; refusing an ungrounded 3D target.`);
 }
 // A final language-based observation is diagnostic, never used to invent 3D geometry.
 if(lastFrame&&!isCancelled()){
   try{
     const question=`Describe visible objects and furniture in this view. Is a ${phrase} visibly present? Distinguish observed objects from guesses. Be concise.`;
     emitBrainTrace(id,name,'MUSE REQUEST',`POST /v1/responses · muse-spark-1.3 · final captured JPEG · "${question}"`);
     const result=await api.req('/api/ai/vision',{method:'POST',body:JSON.stringify({mode:'describe',prompt:question,image:await asDataURL(lastFrame)})});
     spend+=Number(result.usage?.estimated_usd||0);
     emitBrainTrace(id,name,'MUSE OBSERVATION',`${result.description||'No description returned.'} · estimated total US$${spend.toFixed(6)}. This description did not produce a verified 3D target.`);
   }catch(e){emitBrainTrace(id,name,'MUSE ERROR',e.message);}
 }
 return {status:foundUnmapped?'no-mesh':'not-found',spend};
}

const cleanBrain=brain=>Object.fromEntries(Object.keys(fields).map(k=>[k,String(brain?.[k]||'')]));
const dollars=usage=>'US$'+Number(usage?.estimated_usd||0).toFixed(6)+' estimated';
function showFrame(blob,label='Robot head camera · local JPEG',boxes=[]){
  frame=blob;if(frameURL)URL.revokeObjectURL(frameURL);frameURL=URL.createObjectURL(blob);
  $('brainsEyeImage').onload=()=>{const image=$('brainsEyeImage'),canvas=$('brainsEyeOverlay');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;clearBoxes();if(boxes.length)showBoxes(boxes);};
  const preview=$('brainsEyeImage');preview.src=frameURL;preview.hidden=false;$('brainsEyeStage').hidden=false;$('brainsEyePlaceholder').hidden=true;
  $('brainsEyeLarge').src=frameURL;$('brainsLightboxCaption').textContent=label+' · '+blob.size+' JPEG bytes';
  $('expandBrainsEye').disabled=false;
  $('brainsEyeMeta').textContent=label+` · ${blob.size} JPEG bytes. This is the exact frame selected for this operation. Check chat Brain trace to confirm a Meta request was actually sent.`;
}
function renderTaskTrace(){
 const rows=taskTraces.get(activeRobot?.userData.editorId)||[];
 $('brainsTaskTrace').textContent=rows.length?rows.map(e=>`[${e.at}] ${e.step}: ${e.detail}`).join('\n\n'):'No task run in this browser yet.';
 $('brainsTaskTrace').scrollTop=$('brainsTaskTrace').scrollHeight;
}
function clearBoxes(){const canvas=$('brainsEyeOverlay');canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);}
function showBoxes(boxes){
 const canvas=$('brainsEyeOverlay'),image=$('brainsEyeImage');
 canvas.width=image.naturalWidth||512;canvas.height=image.naturalHeight||512;
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.lineWidth=3;ctx.strokeStyle='#6effb3';ctx.fillStyle='#6effb3';ctx.font='bold 17px sans-serif';
 for(const box of boxes||[]){
  const scaleX=canvas.width/box.width,scaleY=canvas.height/box.height;
  const x=box.x1*scaleX,y=box.y1*scaleY,w=(box.x2-box.x1)*scaleX,h=(box.y2-box.y1)*scaleY;
  if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)continue;
  ctx.strokeRect(x,y,w,h);ctx.fillText('Object '+box.id,Math.max(3,x),Math.max(19,y-5));
 }
}
export function initRobotBrains(world,api,getRoom,toast){
 const panel=$('robotBrainsPanel');
 $('closeRobotBrains').onclick=()=>{panel.hidden=true;$('brainsEyeLightbox').hidden=true;document.body.classList.remove('solvi-brain-chat-side-by-side');};
 $('expandBrainsEye').onclick=()=>{if(!frame)return;$('brainsEyeLarge').src=$('brainsEyeImage').src;$('brainsEyeLightbox').hidden=false;};
 $('closeBrainsEyeLightbox').onclick=()=>$('brainsEyeLightbox').hidden=true;
 $('brainsEyeLightbox').addEventListener('click',e=>{if(e.target===$('brainsEyeLightbox'))$('brainsEyeLightbox').hidden=true;});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')$('brainsEyeLightbox').hidden=true;});
 $('showBrainChat').onclick=()=>window.dispatchEvent(new CustomEvent('solvi:show-brain-chat'));
 async function refreshMemory(){
   if(!api.online||!api.auth()||!activeRobot)return;
   try{const data=await api.req('/api/robots/memory?room='+encodeURIComponent(getRoom())+'&id='+encodeURIComponent(activeRobot.userData.editorId));
     $('brainsMemory').textContent=data.memories?.map(m=>`${m.created}: ${m.event}`).join('\n')||'No recorded experiences yet. Use @'+activeRobot.name.split(' ')[0]+' in world chat.';
   }catch(e){$('brainsMemory').textContent=e.message;}
 }
 let galleryUrls=[];
 function renderFrameGallery(){
   for(const url of galleryUrls)URL.revokeObjectURL(url);galleryUrls=[];
   const gallery=$('brainsEyeGallery');gallery.replaceChildren();
   if(!activeRobot)return;
   const history=frameHistory.get(activeRobot.userData.editorId)||[];
   for(const rec of history){
     const button=document.createElement('button');button.type='button';button.className='brains-frame-card';
     const image=document.createElement('img');image.alt='Robot-eye camera frame';const url=URL.createObjectURL(rec.blob);galleryUrls.push(url);image.src=url;
     const summary=document.createElement('span');summary.textContent=rec.label+` · ${rec.blob.size} B`+(rec.usage?` · ~US$${Number(rec.usage.estimated_usd||0).toFixed(6)}`:'');
     button.append(image,summary);button.onclick=()=>showFrame(rec.blob,rec.label,rec.boxes);
     gallery.append(button);
   }
 }
 function open(){
   const robot=window.solviEditor?.robot();if(!robot){toast('Select a robot in Objects first.');return;}
   activeRobot=robot;frame=null;
   if(frameURL)URL.revokeObjectURL(frameURL);frameURL=null;
   $('brainsEyeStage').hidden=true;$('brainsEyeImage').hidden=true;$('brainsEyeImage').removeAttribute('src');$('brainsEyeLarge').removeAttribute('src');$('brainsEyePlaceholder').hidden=false;$('expandBrainsEye').disabled=true;clearBoxes();
   $('brainsHeading').textContent=robot.name+' · Brains';$('brainsEyeTitle').textContent=robot.name+' · eye-camera observation';$('brainsLightboxTitle').textContent=robot.name+' · 512 × 512 eye capture';
   const brain=cleanBrain(robot.userData.robotBrain);
   for(const [key,id] of Object.entries(fields)){$(id).value=brain[key];$(id).disabled=!window.solviEditor.canEdit(robot);}
   $('brainsInitiative').checked=Boolean(robot.userData.robotBrain?.initiative);
   $('brainsInitiative').disabled=!window.solviEditor.canEdit(robot);
   $('saveRobotBrains').disabled=!window.solviEditor.canEdit(robot);$('saveRobotChatPortrait').disabled=!window.solviEditor.canEdit(robot);
   $('brainsVisionResult').textContent='Capture eyes, then Describe scene with Muse Spark or Find object with SAM 3.1.';
   const previous=latestFrames.get(robot.userData.editorId);
   if(previous)showFrame(previous.blob,previous.label,previous.boxes);
   renderFrameGallery();$('brainsIdentityDetails').open=false;renderTaskTrace();
   panel.hidden=false;refreshMemory();
 }
 window.addEventListener('solvi:open-brains',open);
 window.addEventListener('solvi:brain-trace',event=>{
   if(activeRobot?.userData.editorId===event.detail?.robotId){renderTaskTrace();refreshMemory();}
 });
 window.addEventListener('solvi:brain-frame',event=>{
   const d=event.detail;if(activeRobot?.userData.editorId===d.robotId){showFrame(d.blob,d.label);renderFrameGallery();}
 });
 window.addEventListener('solvi:brain-gallery',event=>{
   if(activeRobot?.userData.editorId===event.detail.robotId)renderFrameGallery();
 });
 window.addEventListener('solvi:brain-boxes',event=>{
   if(activeRobot?.userData.editorId===event.detail?.robotId)showBoxes(event.detail.boxes);
 });
 $('saveRobotBrains').onclick=()=>{
   if(!activeRobot||!window.solviEditor.canEdit(activeRobot)){toast('Robot is read-only');return;}
   const before=window.solviEditor.snapshot(activeRobot);
   activeRobot.userData.robotBrain={...activeRobot.userData.robotBrain,...Object.fromEntries(Object.entries(fields).map(([k,id])=>[k,$(id).value.trim()])),initiative:$('brainsInitiative').checked};
   window.solviEditor.recordEdit(before,window.solviEditor.snapshot(activeRobot));
   window.solviEditor.queueSave(activeRobot);
   toast(activeRobot.name+' identity saved');
 };
 $('saveRobotChatPortrait').onclick=async()=>{
   if(!activeRobot||!window.solviEditor.canEdit(activeRobot))return toast('Select a robot you can edit.');
   const btn=$('saveRobotChatPortrait');btn.disabled=true;
   try{
     const blob=await captureRobotPortrait(world,activeRobot);
     const form=new FormData();form.append('file',new File([blob],`robot-portrait-${Date.now()}.jpg`,{type:'image/jpeg'}));
     const uploaded=await api.req('/api/media',{method:'POST',body:form});
     const before=window.solviEditor.snapshot(activeRobot);
     activeRobot.userData.robotBrain={...(activeRobot.userData.robotBrain||{}),portrait:uploaded.media.id};
     window.solviEditor.recordEdit(before,window.solviEditor.snapshot(activeRobot));
     window.solviEditor.queueSave(activeRobot);
     toast(activeRobot.name+' chat portrait saved.');
     emitBrainTrace(activeRobot.userData.editorId,activeRobot.name,'PORTRAIT','Front-facing 3D headshot saved to shared room scene.');
   }catch(error){toast('Chat portrait failed: '+error.message);}
   finally{btn.disabled=false;}
 };
 $('suggestBrainsScenario').onclick=async()=>{
   if(!activeRobot||!window.solviEditor.canEdit(activeRobot)){toast('Robot is read-only');return;}
   $('brainsScenarioResult').textContent='Calling Muse Spark 1.3 with the SAVED identity, the last 5 memories and object catalogue. No image or robot movement is sent. This costs tokens…';
   emitBrainTrace(activeRobot.userData.editorId,activeRobot.name,'SCENARIO REQUEST','Muse Spark 1.3 · text-only · saved identity + memories + scene object names; proposal only');
   try{const data=await api.req('/api/robots/scenario',{method:'POST',body:JSON.stringify({room:getRoom(),id:activeRobot.userData.editorId})});
     $('brainsScenario').value=data.scenario||'';
     $('brainsScenarioResult').textContent=`Meta response ${data.response_id||'unknown'}\n${data.scenario||'(empty response)'}\n\n${dollars(data.usage)} · ${data.usage?.input_tokens||0} input / ${data.usage?.output_tokens||0} output tokens.\nEditable only — press Save identity. No movement was executed.`;
     emitBrainTrace(activeRobot.userData.editorId,activeRobot.name,'SCENARIO RESPONSE',`${data.scenario||'(empty)'} · ${dollars(data.usage)} · not executed`);
   }catch(e){$('brainsScenarioResult').textContent='Scenario error: '+e.message;emitBrainTrace(activeRobot.userData.editorId,activeRobot.name,'SCENARIO ERROR',e.message);}
 };
 $('captureBrainsEye').onclick=async()=>{
   if(!activeRobot){toast('No robot selected');return;}
   $('brainsVisionResult').textContent='Capturing head camera…';
   try{const blob=await captureRobotView(world,activeRobot);if(!blob)throw Error('Head camera returned no image');
     rememberFrame(activeRobot.userData.editorId,blob,'Manual head-camera capture · not sent');
     showFrame(blob,'Manually captured head camera · no API call yet');renderFrameGallery();
     emitBrainTrace(activeRobot.userData.editorId,activeRobot.name,'EYE CAPTURE',`512 × 512 JPEG (${blob.size} bytes) captured in browser. Image visible in Brains, no Meta request sent. Press Describe or Find object to submit.`);
     $('brainsVisionResult').textContent='JPEG screenshot captured locally. No AI request sent yet. Choose one action to send the frame and visible prompt to Meta.';
   }catch(error){$('brainsVisionResult').textContent=error.message;emitBrainTrace(activeRobot?.userData.editorId,activeRobot?.name||'Robot','CAPTURE FAILED',error.message);}
 };
 async function inspect(mode){
   if(!frame){$('brainsVisionResult').textContent='Capture eyes first.';return;}
   if(!api.online||!api.auth()){$('brainsVisionResult').textContent='Online login required for Meta vision';return;}
   const prompt=mode==='segment'?$('brainsPrompt').value.trim():$('brainsVisionQuestion').value.trim();
   if(!prompt){$('brainsVisionResult').textContent='Enter a prompt first.';return;}
   const model=mode==='segment'?'SAM 3.1':'Muse Spark 1.3';
   const robotId=activeRobot?.userData.editorId,robotName=activeRobot?.name;
   emitBrainTrace(robotId,robotName,'META REQUEST',`${model} · ${prompt} · head JPEG ${frame.size} bytes · store=false`);
   const imageElement=$('brainsEyeImage');
   $('brainsVisionResult').textContent=`Sending ${imageElement.naturalWidth||512} × ${imageElement.naturalHeight||512} JPEG to ${model}.\nPrompt: ${prompt}\nAwaiting model response…`;
   $('analyzeBrainsEye').disabled=true;$('describeBrainsEye').disabled=true;
   try{
     const image=await asDataURL(frame);
     const response=await api.req('/api/ai/vision',{method:'POST',body:JSON.stringify({image,prompt,mode})});
     const record=latestFrames.get(robotId);if(record&&record.blob===frame){record.usage=response.usage;record.label=`${model} · prompt "${prompt}"`;record.boxes=mode==='segment'?(response.result?.boxes||[]):[];renderFrameGallery();}
     emitBrainTrace(robotId,robotName,'META RESPONSE',`${response.result?.id||'n/a'} · ${mode==='segment'?(response.result?.match_count||0)+' matches':(response.description||'No description').slice(0,900)} · ${dollars(response.usage)}`);
     const requestSummary=`Model: ${response.request?.model||model}\nPrompt: ${response.request?.prompt||prompt}\nImage: ${imageElement.naturalWidth||512} × ${imageElement.naturalHeight||512} JPEG (${response.request?.image?.bytes||frame.size} bytes)\nStorage: Meta store=false\nUsage: ${dollars(response.usage)}${response.usage?.input_tokens!=null?' · input '+response.usage.input_tokens+' tokens · output '+response.usage.output_tokens+' tokens':''}`;
     if(mode==='describe'){
       clearBoxes();
       $('brainsVisionResult').textContent=requestSummary+'\n\nSCENE ANALYSIS\n'+(response.description||'Muse Spark returned no text. Try a shorter question.');
     }else{
       const count=response.result?.match_count||0;
       showBoxes(response.result?.boxes||[]);
       const explanation=response.result?.no_matches?'No objects matched this noun phrase. Try robot, chair, cube, person, or another concrete object visible in the screenshot.':response.result?.parse_warning?'SAM returned data but the box format was not recognised. The raw mask stream is not displayed.':`${count} object(s) found. Bounding boxes are drawn on the screenshot; detailed pixel masks are not yet displayed.`;
       $('brainsVisionResult').textContent=requestSummary+'\n\nSEGMENTATION\n'+explanation+'\n'+(response.result?.boxes||[]).map(b=>`#${b.id}: (${Math.round(b.x1)}, ${Math.round(b.y1)}) – (${Math.round(b.x2)}, ${Math.round(b.y2)})${b.confidence==null?'':' · score '+b.confidence}`).join('\n');
     }
   }catch(error){$('brainsVisionResult').textContent=model+' request failed: '+error.message;emitBrainTrace(robotId,robotName,'META ERROR',error.message);}
   finally{$('analyzeBrainsEye').disabled=false;$('describeBrainsEye').disabled=false;}
 }
 $('analyzeBrainsEye').onclick=()=>inspect('segment');
 $('describeBrainsEye').onclick=()=>inspect('describe');
 window.addEventListener('solvi:room-changed',()=>{panel.hidden=true;$('brainsEyeLightbox').hidden=true;document.body.classList.remove('solvi-brain-chat-side-by-side');activeRobot=null;frame=null;});
}
