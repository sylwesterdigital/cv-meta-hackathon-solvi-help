import * as THREE from 'three';
import {captureRobotView,captureRobotPortrait,robotHeadCameraPose} from './robots.js';
import {observationPlan,scanSummary} from './robot-observation.js';
import {stitchRobotPanorama,panoramaMode} from './robot-panorama.js';
import {observationTarget,matchesObservationTarget,pickTargetViews} from './target-view-filter.js';
const $=id=>document.getElementById(id);
const fields={personality:'brainsPersonality',history:'brainsHistory',beliefs:'brainsBeliefs',triggers:'brainsTriggers',scenario:'brainsScenario'};
let activeRobot=null,frame=null,frameURL=null;
const latestFrames=new Map(),frameHistory=new Map(),taskTraces=new Map();
export function robotTraceEntries(id){return (taskTraces.get(id)||[]).map(e=>({...e}));}
export function robotTraceText(id){return robotTraceEntries(id).map(e=>`[${e.at}] ${e.step}: ${e.detail}`).join('\n\n');}
export function robotTraceExport(id,name='Robot'){return JSON.stringify({schema:'solvi-robot-diagnostics-v1',version:'0.2.69',robot:{id,name},exportedAt:new Date().toISOString(),scope:'this browser tab only; last 1500 events per robot',events:robotTraceEntries(id)},null,2);}
function rememberFrame(id,blob,label){
 const rec={blob,label,boxes:[],usage:null};latestFrames.set(id,rec);
 const history=frameHistory.get(id)||[];history.push(rec);if(history.length>10)history.shift();frameHistory.set(id,history);
 return rec;
}
export function rememberRobotObservationFrame(robotId,blob,label){
 rememberFrame(robotId,blob,label);
 window.dispatchEvent(new CustomEvent('solvi:brain-frame',{detail:{robotId,blob,label}}));
 window.dispatchEvent(new CustomEvent('solvi:brain-gallery',{detail:{robotId}}));
}
export function emitBrainTrace(robotId,robotName,step,detail=''){
 const entry={at:new Date().toLocaleTimeString(),robotId,robotName,step,detail:typeof detail==='string'?detail.slice(0,22000):JSON.stringify(detail,null,2).slice(0,22000)};
 const records=taskTraces.get(robotId)||[];records.push(entry);if(records.length>1500)records.shift();taskTraces.set(robotId,records);
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
 let foundUnmapped=false,spend=0;
 const directions=observationPlan('look around').map(view=>({yaw:view.yaw*Math.PI/180,pitch:view.pitch}));
 for(let index=0;index<directions.length;index++){
   if(isCancelled())return {status:'cancelled'};
   const facing=Math.round(directions[index].yaw*180/Math.PI);
   let pose=null;
   emitBrainTrace(id,name,'CAPTURE',`View ${index+1}/${directions.length} · head yaw ${facing}°, pitch ${directions[index].pitch}° · 512 × 512 JPEG`);
   const image=await captureRobotView(world,robot,{yawOffset:directions[index].yaw,pitchDegrees:directions[index].pitch,onPose:p=>{pose=p;}});
   if(!image)throw Error('Head-camera screenshot returned no JPEG');
   // Keep negative images out of the gallery; only a SAM candidate is evidence worth reviewing.
   emitBrainTrace(id,name,'META REQUEST',`POST /v1/responses · model sam-3.1 · prompt "${phrase}" · image/jpeg ${image.size} bytes · store=false`);
   const started=performance.now();
   const response=await api.req('/api/ai/vision',{method:'POST',body:JSON.stringify({mode:'segment',prompt:phrase,image:await asDataURL(image)})});
   if(isCancelled())return {status:'cancelled'};
   spend+=Number(response.usage?.estimated_usd||0);
   const boxes=response.result?.boxes||[];
   if(boxes.length){
     const captured=rememberFrame(id,image,`SAM · candidate ${index+1}/${directions.length} · ${facing}° · prompt "${phrase}"`);
     captured.boxes=boxes;captured.usage=response.usage;
     window.dispatchEvent(new CustomEvent('solvi:brain-frame',{detail:{robotId:id,blob:image,label:`SAM candidate at head yaw ${facing}°`}}));
     window.dispatchEvent(new CustomEvent('solvi:brain-gallery',{detail:{robotId:id}}));
   }
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
 // Negative viewpoints were filtered with SAM. Do not pay Muse to describe
 // the final empty frame, and do not create a false visual finding.
 emitBrainTrace(id,name,'TARGET FILTER',`No verified scene match for ${phrase}; negative JPEGs discarded, not sent to Muse.`);
 return {status:foundUnmapped?'no-mesh':'not-found',spend};
}

const cleanBrain=brain=>Object.fromEntries(Object.keys(fields).map(k=>[k,String(brain?.[k]||'')]));
const dollars=usage=>'US$'+Number(usage?.estimated_usd||0).toFixed(6)+' estimated';
function showFrame(blob,label='Robot head camera · local JPEG',boxes=[]){
  frame=blob;if(frameURL)URL.revokeObjectURL(frameURL);frameURL=URL.createObjectURL(blob);
  $('brainsEyeImage').onload=()=>{const image=$('brainsEyeImage'),canvas=$('brainsEyeOverlay');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;clearBoxes();if(boxes.length)showBoxes(boxes);};
  $('brainsEyeStage').classList.toggle('panorama',label.startsWith('Stitched '));
  const preview=$('brainsEyeImage');preview.src=frameURL;preview.hidden=false;$('brainsEyeStage').hidden=false;$('brainsEyePlaceholder').hidden=true;
  $('brainsEyeLarge').src=frameURL;$('brainsLightboxCaption').textContent=label+' · '+blob.size+' JPEG bytes';
  $('expandBrainsEye').disabled=false;
  $('brainsEyeMeta').textContent=label+` · ${blob.size} JPEG bytes. This is the exact frame selected for this operation. Check chat Brain trace to confirm a Meta request was actually sent.`;
}
function renderTaskTrace(){
 const id=activeRobot?.userData.editorId;
 $('brainsTaskTrace').textContent=id&&robotTraceEntries(id).length?robotTraceText(id):'No task run in this browser yet.';
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
 $('brainsCopyLog').onclick=async()=>{if(!activeRobot)return;const button=$('brainsCopyLog');try{await navigator.clipboard.writeText(robotTraceText(activeRobot.userData.editorId)||'No events');button.textContent='Copied';setTimeout(()=>button.textContent='Copy full log',1600);}catch(error){toast('Clipboard unavailable: '+error.message);}};
 $('brainsDownloadLog').onclick=()=>{if(!activeRobot)return;const id=activeRobot.userData.editorId;const content=robotTraceExport(id,activeRobot.name);const blob=new Blob([content],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='solvi-'+activeRobot.name.toLowerCase().replace(/[^a-z0-9_-]/g,'-')+'-inference-log.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
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
     const button=document.createElement('button');button.type='button';button.className='brains-frame-card'+(rec.label.startsWith('Stitched ')?' panorama-frame-card':'');
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
   $('brainsGender').value=['female','male','nonbinary'].includes(robot.userData.robotBrain?.gender)?robot.userData.robotBrain.gender:'unspecified';
   $('brainsGender').disabled=!window.solviEditor.canEdit(robot);
   $('brainsInitiative').checked=Boolean(robot.userData.robotBrain?.initiative);
   $('brainsInitiativeVision').checked=robot.userData.robotBrain?.initiativeVision!==false;
   $('brainsInitiative').disabled=!window.solviEditor.canEdit(robot);$('brainsInitiativeVision').disabled=!window.solviEditor.canEdit(robot);
   $('saveRobotBrains').disabled=!window.solviEditor.canEdit(robot);$('saveRobotChatPortrait').disabled=!window.solviEditor.canEdit(robot);
   $('brainsVisionResult').textContent='Capture eyes, then Describe scene with Muse Spark or Find object with SAM 3.1.';
   const previous=latestFrames.get(robot.userData.editorId);
   if(previous)showFrame(previous.blob,previous.label,previous.boxes);
   renderFrameGallery();$('brainsIdentityDetails').open=false;renderTaskTrace();
   $('brainsTraceDetails').open=true;panel.hidden=false;refreshMemory();
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
   activeRobot.userData.robotBrain={...activeRobot.userData.robotBrain,...Object.fromEntries(Object.entries(fields).map(([k,id])=>[k,$(id).value.trim()])),gender:$('brainsGender').value,initiative:$('brainsInitiative').checked,initiativeVision:$('brainsInitiativeVision').checked};
   window.solviEditor.recordEdit(before,window.solviEditor.snapshot(activeRobot));
   window.solviEditor.queueSave(activeRobot);
   toast(activeRobot.name+' identity saved');
 };
 // Voice is configured in Properties for the currently selected robot (not the Brains window).
 const selectedVoiceRobot=()=>window.solviEditor?.robot();
 const editableVoiceRobot=()=>{const robot=selectedVoiceRobot();return robot&&window.solviEditor.canEdit(robot)?robot:null;};
 const voiceIds=['brainsVoiceProvider','brainsVoiceId','brainsElevenVoiceList','loadElevenVoices','brainsVoiceLang','brainsVoiceName','brainsVoiceGender','brainsVoiceRate','brainsVoicePitch','testRobotVoice','saveRobotVoice'];
 let elevenVoiceCache=[],elevenCacheKey='';
 function populateDeviceVoices(selected=''){
   const list=$('brainsVoiceName'),language=$('brainsVoiceLang').value;
   const all=window.speechSynthesis?.getVoices?.()||[];
   const matches=all.filter(v=>language==='auto'||v.lang.toLowerCase().startsWith(language.toLowerCase()));
   list.replaceChildren(new Option(`Automatic voice · ${language==='auto'?'match spoken language':language.toUpperCase()}`,''));
   for(const voice of matches)list.add(new Option(`${voice.name} · ${voice.lang}${voice.localService?' · installed':' · service'}`,voice.name));
   if(selected && !matches.some(v=>v.name===selected))list.add(new Option('Saved voice (not available in this language) · '+selected,selected));
   list.value=selected||'';
   if(!matches.length && language!=='auto')$('robotVoiceStatus').textContent=`No ${language} device voice installed. Ubuntu voice or ElevenLabs may still be available.`;
 }
 function filterElevenVoices(){
   const language=$('brainsVoiceLang').value,list=$('brainsElevenVoiceList'),saved=$('brainsVoiceId').value.trim();
   list.replaceChildren(new Option('Select voice from account',''));
   for(const voice of elevenVoiceCache){
     const supported=voice.languages||[];
     if(language!=='auto' && supported.length && !supported.some(l=>l===language||l.startsWith(language+'-')))continue;
     const hint=supported.join(', ')||'language not verified';
     list.add(new Option(`${voice.name} · ${hint}${voice.accent?' · '+voice.accent:''}`,voice.id));
   }
   if(saved&&!Array.from(list.options).some(o=>o.value===saved))list.add(new Option('Saved voice (language unverified) · '+saved,saved));
   list.value=saved||'';
 }
 function updateVoiceVisibility(){
   const provider=$('brainsVoiceProvider').value;
   $('robotLocalVoicesRow').hidden=provider!=='local';
   $('robotCloudVoicesRow').hidden=provider!=='elevenlabs';
   $('robotVoiceIdRow').hidden=provider!=='elevenlabs';
   $('loadElevenVoices').hidden=provider!=='elevenlabs';
   $('robotVoiceSummary').textContent=provider==='elevenlabs'?'ElevenLabs':provider==='mute'?'Silent':'System / local';
 }
 function syncVoiceInspector(robot=selectedVoiceRobot()){
   const brain=robot?.userData?.robotBrain||{},canEdit=!!robot&&window.solviEditor.canEdit(robot);
   for(const [field,id,fallback] of [['voiceProvider','brainsVoiceProvider','local'],['voiceId','brainsVoiceId',''],['voiceLang','brainsVoiceLang','auto'],['voiceRate','brainsVoiceRate','1'],['voicePitch','brainsVoicePitch','1']])$(id).value=String(brain[field]??fallback);
   $('brainsVoiceGender').value=['female','male','neutral'].includes(brain.voiceGender)?brain.voiceGender:'auto';
   populateDeviceVoices(brain.voiceName||'');
   const list=$('brainsElevenVoiceList');list.replaceChildren(new Option('Browse account voices',''));
   if(brain.voiceId)list.add(new Option('Saved voice · '+brain.voiceId,brain.voiceId));
   list.value=brain.voiceId||'';
   for(const id of voiceIds)$(id).disabled=!canEdit;
   $('robotVoiceStatus').textContent=robot?`Voice settings for ${robot.name}. Select a voice and Save voice.`:'';
   updateVoiceVisibility();
 }
 window.addEventListener('solvi:properties-robot-selected',()=>syncVoiceInspector());
 $('brainsVoiceProvider').addEventListener('change',updateVoiceVisibility);
 $('brainsVoiceLang').addEventListener('change',()=>{populateDeviceVoices();filterElevenVoices();});
 window.speechSynthesis?.addEventListener?.('voiceschanged',()=>{if(selectedVoiceRobot())populateDeviceVoices($('brainsVoiceName').value);});
 $('brainsElevenVoiceList').onchange=()=>{if($('brainsElevenVoiceList').value)$('brainsVoiceId').value=$('brainsElevenVoiceList').value;};
 $('loadElevenVoices').onclick=async()=>{
   const robot=editableVoiceRobot();if(!robot)return;
   const button=$('loadElevenVoices'),status=$('robotVoiceStatus');button.disabled=true;
   status.textContent='Loading ElevenLabs account voices…';
   const robotId=robot.userData.editorId;
   try{
     const auth=api.auth?.();
     const headers={'X-Solvi-Tab':auth?.tab||sessionStorage.getItem('solvi-tab')||''};
     if(auth?.token)headers.Authorization='Bearer '+auth.token;
     const key=sessionStorage.getItem('solvi-elevenlabs-key');if(key)headers['X-Solvi-Voice-Key']=key;
     if(elevenCacheKey!==key){elevenVoiceCache=[];elevenCacheKey=key||'';}
     const response=await fetch('/api/robots/voices',{headers,cache:'no-store'});
     const data=await response.json();if(!response.ok)throw Error(data.error||`ElevenLabs HTTP ${response.status}`);
     if(selectedVoiceRobot()?.userData.editorId!==robotId)return; // Selection changed while loading.
     elevenVoiceCache=data.voices||[];filterElevenVoices();
     status.textContent=`${elevenVoiceCache.length} account voices loaded. Choose one, Test voice, then Save voice.`;
   }catch(error){if(selectedVoiceRobot()?.userData.editorId===robotId)status.textContent='Voice list failed: '+error.message;}
   finally{button.disabled=!editableVoiceRobot();}
 };
 window.addEventListener('solvi:robot-voice-status',event=>{
   if(selectedVoiceRobot()?.userData.editorId!==event.detail?.robotId)return;
   $('robotVoiceStatus').textContent=event.detail.message;
 });
 $('testRobotVoice').onclick=()=>{
   const robot=editableVoiceRobot();if(!robot)return;
   $('robotVoiceStatus').textContent='Preparing voice sample…';
   window.dispatchEvent(new CustomEvent('solvi:test-robot-voice',{detail:{robotId:robot.userData.editorId,name:robot.name,config:{voiceProvider:$('brainsVoiceProvider').value,voiceId:$('brainsVoiceId').value,voiceLang:$('brainsVoiceLang').value,voiceName:$('brainsVoiceName').value,voiceRate:$('brainsVoiceRate').value,voicePitch:$('brainsVoicePitch').value,voiceGender:$('brainsVoiceGender').value}}}));
 };
 $('saveRobotVoice').onclick=()=>{
   const robot=editableVoiceRobot();if(!robot){toast('Robot is read-only');return;}
   const before=window.solviEditor.snapshot(robot);
   robot.userData.robotBrain={...(robot.userData.robotBrain||{}),voiceProvider:$('brainsVoiceProvider').value,voiceId:$('brainsVoiceId').value.trim(),voiceName:$('brainsVoiceName').value,voiceGender:$('brainsVoiceGender').value,voiceLang:$('brainsVoiceLang').value,voiceRate:String(Math.max(.6,Math.min(1.6,Number($('brainsVoiceRate').value)||1))),voicePitch:String(Math.max(.5,Math.min(1.7,Number($('brainsVoicePitch').value)||1)))};
   window.solviEditor.recordEdit(before,window.solviEditor.snapshot(robot));window.solviEditor.queueSave(robot);
   $('robotVoiceStatus').textContent=robot.name+' voice saved to room scene.';
   toast(robot.name+' voice saved');
 };
 syncVoiceInspector();
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
 async function sweepRobotEyes(degrees=360){
   if(!activeRobot)return;
   const button=$(degrees===180?'captureBrainsHemisphere':'captureBrainsPanorama');button.disabled=true;
   const directions=observationPlan(degrees===180?'180 degrees':'look around');
   const question=$('brainsVisionQuestion').value.trim();
   const target=observationTarget(question);
   emitBrainTrace(activeRobot.userData.editorId,activeRobot.name,`${degrees} SCAN`,scanSummary(directions));
   try{
     const frames=[];
     const candidates=target?(window.solviEditor?.items||[]).filter(o=>o!==activeRobot&&o.visible&&o.userData.editorKind!=='robot'&&o.userData.editorKind!=='light'&&matchesObservationTarget(o.name,target))
       .map(o=>{const sphere=new THREE.Box3().setFromObject(o).getBoundingSphere(new THREE.Sphere());return {position:sphere.center,radius:sphere.radius};}):[];
     const poses=candidates.length?directions.map(view=>robotHeadCameraPose(activeRobot,{yawOffset:view.yaw*Math.PI/180,pitchDegrees:view.pitch})):[];
     const shortlist=candidates.length?pickTargetViews(directions,poses,candidates,3):[];
     const indexed=shortlist.length>0;
     const planned=indexed?shortlist.map(item=>item.view):directions;
     for(const view of planned){
       const image=await captureRobotView(world,activeRobot,{yawOffset:view.yaw*Math.PI/180,pitchDegrees:view.pitch});
       if(!image?.size)throw Error('Camera failed at '+view.label);
       if(target&&!indexed&&api.online&&api.auth()){
         const detected=await api.req('/api/ai/vision',{method:'POST',body:JSON.stringify({mode:'segment',prompt:target.phrase,image:await asDataURL(image)})});
         if(!(detected.result?.boxes||[]).length)continue;
       }
       rememberFrame(activeRobot.userData.editorId,image,`${degrees}° · `+view.label);
       frames.push({blob:image,label:view.label,yaw:view.yaw,pitch:view.pitch});
       if(target&&frames.length>=3)break;
     }
     let panorama=null;
     if(!target&&panoramaMode(frames)===degrees){
       panorama=await stitchRobotPanorama(frames);
       const label=`Stitched ${degrees}° horizontal panorama · ${frames.length} real head-camera frames`;
       rememberFrame(activeRobot.userData.editorId,panorama,label);
       emitBrainTrace(activeRobot.userData.editorId,activeRobot.name,'PANORAMA',`${degrees}° cylindrical mosaic; ${frames.length} original JPEG views retained for Muse.`);
     }
     renderFrameGallery();const last=latestFrames.get(activeRobot.userData.editorId);
     if(frames.length)showFrame(last.blob,last.label);
     if(target&&!frames.length){$('brainsVisionResult').textContent=`No camera view verified ${target.phrase}; ${directions.length} headings checked. No Muse description requested.`;return;}
     if(!api.online||!api.auth()){
       $('brainsVisionResult').textContent=`${frames.length} camera frames saved locally. Log in for Muse assessment.`;return;
     }
     const robotId=activeRobot.userData.editorId;
     const mediaIds=[];
     for(const [i,record] of frames.entries()){
       const body=new FormData();body.append('file',new File([record.blob],`robot-scan-${degrees}-${i}.jpg`,{type:'image/jpeg'}));
       const uploaded=await api.req('/api/media',{method:'POST',body});
       if(!uploaded.media?.id)throw Error('Scan frame upload did not return a media ID');
       mediaIds.push(uploaded.media.id);
     }
     emitBrainTrace(robotId,activeRobot.name,'MUSE SCAN',`${degrees}° · ${mediaIds.length} actual JPEGs uploaded · one model request`);
     let panoramaMediaId='';
     if(panorama){const body=new FormData();body.append('file',new File([panorama],`robot-panorama-${degrees}.jpg`,{type:'image/jpeg'}));
       const uploaded=await api.req('/api/media',{method:'POST',body});panoramaMediaId=uploaded.media?.id||'';}
     const result=await api.req('/api/robots/vision-reply',{method:'POST',body:JSON.stringify({room:window.solviRoom||'main',robot_id:robotId,media_ids:mediaIds,panorama_media_id:panoramaMediaId,views:frames.map(v=>v.label),manual:true,question:question||'Describe the objects and furniture you can actually see.',target_phrase:target?.phrase||''})});
     $('brainsVisionResult').textContent=result.answer?.text||'No visual description was returned.';
     emitBrainTrace(robotId,activeRobot.name,'MUSE SCAN RESULT',`${result.answer?.text||'(empty)'} · ${result.usage?.estimated_usd||0} estimated USD`);
   }catch(error){$('brainsVisionResult').textContent=`${degrees}° scan failed: `+error.message;}
   finally{button.disabled=false;}
 }
 $('captureBrainsPanorama').onclick=()=>sweepRobotEyes(360);
 $('captureBrainsHemisphere').onclick=()=>sweepRobotEyes(180);
 window.addEventListener('solvi:robot-eyes-action',event=>{
   const {robotId,scan}=event.detail||{};
   const chosen=window.solviEditor?.robot();
   if(!chosen||chosen.userData.editorId!==robotId)return;
   open();
   if(scan==='front')$('captureBrainsEye').click();
   else if(scan==='180'||scan==='360')sweepRobotEyes(Number(scan));
 });
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
