import * as THREE from 'three';
import {SceneEditor} from './editor.js';
import {captureRobotView} from './robots.js';
import {initRobotBrains,runRobotVisualSearch,emitBrainTrace} from './robot-brains.js';
import {readPreferences,updatePreferences,applyPreferences,themePalette,THEME_PRESETS,uiScalePercent,safeFontName,exportRoomTranscript,shouldGroupMessages} from './preferences.js';
import {playCue,primeAudio} from './audio-cues.js';

const $=id=>document.getElementById(id);
const random=()=>crypto.randomUUID();
const tab=sessionStorage.getItem('solvi-tab')||random();sessionStorage.setItem('solvi-tab',tab);
// Detect duplicated tabs that copied sessionStorage; server still enforces token rotation.
const pageNonce=random();let tabChannel=null;
function establishTabChannel(uid){
  tabChannel?.close();if(!('BroadcastChannel' in window))return;
  tabChannel=new BroadcastChannel('solvi-active-'+uid);
  tabChannel.onmessage=e=>{const m=e.data;if(m.page===pageNonce)return;
    if(m.type==='HELLO'&&auth)tabChannel.postMessage({type:'ACTIVE',page:pageNonce});
    if(m.type==='ACTIVE'&&auth)needSignIn('This profile is active in another window.');
  };
  tabChannel.postMessage({type:'HELLO',page:pageNonce});
}
let recordStream=null,recorder=null,recKind=null,recTimer=null;
let pending=[],me=null,auth=null,online=false,modelIds=[],adminToken=null;
let cachedMessages=[],chatSignature='',lastBubbleEntry=null;const runningRobotTasks=new Map();const localBrainTrace=[];const initialRoomLoads=new Set();
let activeRoom=sessionStorage.getItem('solvi-room')||'main';window.solviRoom=activeRoom;window.solviRoomPolicy={objects:'open',robots:'open',physics:0};let sessionPrompt=false;
const toast=text=>{const t=$('toast');t.textContent=text;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,5200);};
const show=(id,yes=true)=>{$(id).hidden=!yes;};
const stored=()=>{try{return JSON.parse(localStorage.getItem('solvi-profile')||'null');}catch{return null;}};
const saveLocal=(o)=>localStorage.setItem('solvi-profile',JSON.stringify(o));
function needSignIn(message='Session expired. Sign in to continue.'){
  if(sessionPrompt)return;
  sessionPrompt=true;
  const previous=stored();
  if(previous){delete previous.token;saveLocal(previous);}
  auth=null;me=null;adminToken=null;
  window.dispatchEvent(new Event('solvi:session-lost'));
  fillProfile(previous);
  $('profileBackdrop').classList.remove('profile-drawer-mode');$('profileStatus').textContent=message+' Enter your name and press Save / Sign in to reconnect.';
  show('profileBackdrop',true);
  $('profileName').focus();
  $('chatStatus').textContent='Sign-in required before sending messages.';
  $('backendLabel').textContent='Session expired · sign in';
  toast(message);
}
const api={
 online:false,
 auth:()=>auth?{token:auth.token,tab,profile:me}:null,
 async req(url,options={}){
  const headers={...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(options.headers||{})};
  if(auth?.token)headers.Authorization='Bearer '+auth.token;
  headers['X-Solvi-Tab']=tab;
  if(['/api/models','/api/chat','/api/robots/react','/api/robots/scenario','/api/ai/vision','/api/ai/analyze-logs'].includes(url.split('?')[0])){
    const key=sessionStorage.getItem('solvi-meta-session-key');if(key)headers['X-Solvi-Model-Key']=key;
  }
  const res=await fetch(url,{...options,headers,cache:'no-store'});
  const data=await res.json().catch(()=>({error:'Invalid server response'}));
  if(!res.ok){if([401,409].includes(res.status)&&auth)needSignIn(data.error||'Session expired or active in another window.');
    if(res.status===403&&url.includes('/api/admin/stats')){adminToken=null;show('adminBackdrop',true);$('adminStats').textContent='Admin session expired. Enter the administrator password again.';}
    throw Error(data.error||`${res.status} ${res.statusText}`);}
  return data;
 },
 async mediaBlobInfo(id){if(!auth)throw Error('Sign in to view media');const res=await fetch(`/api/media/${encodeURIComponent(id)}`,{headers:{Authorization:'Bearer '+auth.token,'X-Solvi-Tab':tab}});if([401,409].includes(res.status))needSignIn('Media session expired');if(!res.ok)throw Error('Media unavailable');const blob=await res.blob();return {url:URL.createObjectURL(blob),mime:blob.type};},
 async mediaBlob(id){return (await this.mediaBlobInfo(id)).url;}
};
window.solviAPI=api;
function profileFields(){return {name:$('profileName').value.trim(),email:$('profileEmail').value.trim(),bio:$('profileBio').value.trim(),links:$('profileLinks').value.trim()};}
function fillProfile(o){$('profileName').value=o?.name||'';$('profileEmail').value=o?.email||'';$('profileBio').value=o?.bio||'';$('profileLinks').value=o?.links||'';$('profileIdentity').textContent=o?.id||'New profile';}
async function checkBackend(){try{const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),2500);const res=await fetch('/api/health',{cache:'no-store',signal:controller.signal});clearTimeout(timeout);
 const data=await res.json();online=!!data.backend;api.online=online;$('backendLabel').textContent=online?`Backend connected · AI ${data.ai?'configured':'key missing'}`:'Local demo · backend not enabled';}
 catch{online=false;api.online=false;$('backendLabel').textContent='Local demo · backend not enabled';}}
async function begin(){const p=stored();fillProfile(p);await checkBackend();
 if(!p?.name){$('profileLogout').hidden=true;$('profileBackdrop').classList.remove('profile-drawer-mode');show('profileBackdrop',true);$('profileName').focus();return;}
 if(!online){me=p;show('profileBackdrop',false);show('chatPanel',true);identity();window.dispatchEvent(new CustomEvent('solvi:scene-ready'));return;}
 if(p.token){auth={token:p.token};try{const out=await api.req('/api/me');me=out.user;identity();await afterLogin();return;}catch(e){toast(e.message);}}
 $('profileBackdrop').classList.remove('profile-drawer-mode');show('profileBackdrop',true);$('profileStatus').textContent='Reconnect or take over this profile to continue.';
}
function identity(){const text=me?.name||'Guest';$('profilePanelTitle').textContent=text;$('profilePanelNote').textContent='Profile';$('profileButton').textContent=text.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'?';$('profilePhotoBadge').textContent=$('profileButton').textContent;$('profileButton').title='Profile · '+text;
 if(me?.avatar?.startsWith('data:image/')){for(const id of ['profilePhotoBadge','profileButton']){const el=$(id);el.replaceChildren();const img=document.createElement('img');img.src=me.avatar;img.alt='';el.append(img);}}
 if(me?.avatar&&online&&auth){api.mediaBlob(me.avatar).then(url=>{if(!me||!document.getElementById('profilePhotoBadge'))return;for(const id of ['profilePhotoBadge','profileButton']){const el=$(id);el.replaceChildren();const img=document.createElement('img');img.src=url;img.alt='';img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:50%';el.append(img);}}).catch(()=>{});}
 if(me?.intro&&online&&auth){api.mediaBlob(me.intro).then(url=>{if(me?.intro){$('introPreview').src=url;$('introPreview').hidden=false;}}).catch(()=>{});}
 $('profileLogout').hidden=!me;$('profileIdentity').textContent=me?.id||'Local demo profile';$('composerName').textContent=text;}
async function afterLogin(){sessionPrompt=false;show('profileBackdrop',false);show('chatPanel',true);identity();establishTabChannel(me.id);window.dispatchEvent(new CustomEvent('solvi:authenticated'));
 try{const data=await api.req('/api/models');modelIds=data.models||[];const select=$('modelSelect');select.replaceChildren();
  select.add(new Option('World chat · people',''));
  for(const id of modelIds)select.add(new Option('AI · '+id,id));
  select.value='' // Default to human world chat so @robot mentions can trigger character replies;select.disabled=false;
  if(!modelIds.length)$('chatStatus').textContent=data.note||'Human chat available. AI key not configured.';}catch(e){$('modelSelect').replaceChildren(new Option('Model catalog unavailable',''));toast(e.message);}
 await configureRooms();await loadWorldSettings();await loadMessages();
 window.dispatchEvent(new CustomEvent('solvi:scene-ready'));
}
async function submitProfile(){const fields=profileFields();if(!fields.name){$('profileStatus').textContent='Name is required';return;}
 if(!online){sessionPrompt=false;me={...fields,id:me?.id||random(),avatar:me?.avatar||''};saveLocal(me);show('profileBackdrop',false);show('chatPanel',true);identity();return;}
 try{const previous=stored();if(!auth || !me){
  const data=await api.req('/api/onboard',{method:'POST',body:JSON.stringify({...fields,id:previous?.recovery?previous.id:undefined,recovery:previous?.recovery||undefined,tab})});
  auth={token:data.token};me=data.user;saveLocal({...me,token:data.token,recovery:data.recovery||previous?.recovery});
  await afterLogin();
 }else{
  const data=await api.req('/api/profile',{method:'PUT',body:JSON.stringify({...fields,avatar:me.avatar||''})});
  me=data.user;saveLocal({...stored(),...me});show('profileBackdrop',false);identity();
 }}catch(e){$('profileStatus').textContent=e.message;}
}
function safeTime(t){const d=new Date(t||Date.now());return isNaN(+d)?'':d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});}
async function bubble(entry){
 const feed=$('chatFeed');const role=entry.role==='assistant'?'assistant':'user';
 const mine=role==='user'&&(entry.user_id===me?.id||(!entry.user_id&&entry.speaker===me?.name));
 const previous=lastBubbleEntry;
 let wrap=feed.lastElementChild, panel=wrap?.querySelector('.chat-bubble');
 const group=!entry.isBrainTrace&&!previous?.isBrainTrace&&wrap&&shouldGroupMessages(previous,entry,readPreferences().group)&&wrap.classList.contains(mine?'mine':'theirs');
 if(!group){
  wrap=document.createElement('article');wrap.className='chat-row '+(mine?'mine':'theirs');
  wrap.dataset.messageId=entry.id||'';
  wrap.addEventListener('wheel',event=>{event.preventDefault();feed.scrollTop+=event.deltaY;},{passive:false});
  const pic=document.createElement('span');pic.className='chat-avatar';pic.textContent=role==='assistant'?'AI':(entry.speaker||me?.name||'?').slice(0,2).toUpperCase();
  panel=document.createElement('div');panel.className='chat-bubble';const meta=document.createElement('div');meta.className='chat-meta';
  const name=document.createElement('strong');name.textContent=role==='assistant'?(entry.speaker||entry.model||'Meta Model API'):(entry.speaker||me?.name||'Guest');
  const date=document.createElement('time');date.textContent=safeTime(entry.created);meta.append(name,date);panel.append(meta);
  if(entry.avatar&&online&&auth){api.mediaBlob(entry.avatar).then(url=>{pic.textContent='';const img=document.createElement('img');img.src=url;img.alt='';img.className='chat-profile-image';pic.append(img);}).catch(()=>{});}
  if(entry.isBrainTrace)wrap.classList.add('brain-trace');
  wrap.append(pic,panel);feed.append(wrap);
 }else{panel.querySelector('time').textContent=safeTime(entry.created);}
 const content=document.createElement('div');content.className='chat-body chat-message-item';content.dataset.messageId=entry.id||'';content.textContent=entry.text||'';panel.append(content);
 let mids=[];try{mids=typeof entry.media==='string'?JSON.parse(entry.media):entry.media||[];}catch{}
 for(const id of mids){const slot=document.createElement('div');slot.className='chat-attachment';slot.textContent='Attachment';panel.append(slot);
  if(online&&auth){api.mediaBlobInfo(id).then(({url,mime})=>{const el=document.createElement(mime.startsWith('video/')?'video':mime.startsWith('audio/')?'audio':'img');el.src=url;if(el.tagName==='IMG'){el.alt='Image attachment';el.loading='lazy';}else{el.controls=true;el.preload='metadata';}el.onerror=()=>{slot.textContent='Media attachment';URL.revokeObjectURL(url);};slot.replaceChildren(el);if(el.tagName==='IMG')el.addEventListener('load',scrollChatToLatest,{once:true});scrollChatToLatest();}).catch(()=>{});}}
 lastBubbleEntry=entry;scrollChatToLatest();
}
async function uploadFile(file){if(!online||!auth)throw Error('Enable the Flask backend to store media');if(file.size>11_000_000)throw Error('File must be under 11 MB');
 const body=new FormData();body.append('file',file,file.name);const response=await api.req('/api/media',{method:'POST',body});return response.media;}
function scrollChatToLatest(){const feed=$('chatFeed');if(!feed)return;requestAnimationFrame(()=>{feed.scrollTop=feed.scrollHeight;requestAnimationFrame(()=>{if(feed.scrollHeight-feed.scrollTop-feed.clientHeight>2)feed.scrollTop=feed.scrollHeight;});});}
function updatePending(){const p=$('pendingMedia');p.replaceChildren();for(const m of pending){const badge=document.createElement('button');badge.textContent=`${m.name} ×`;badge.title='Remove attachment';badge.onclick=()=>{pending=pending.filter(x=>x!==m);updatePending();};p.append(badge);}}
async function attach(file){if(!file)return false;try{const media=await uploadFile(file);pending.push(media);pending=pending.slice(-3);updatePending();toast('Attachment ready');return true;}catch(e){toast(e.message);return false;}}
async function reportRobotTask(command,status){
 if(!command?.id||status==='cancelled')return;
 try{const result=await api.req('/api/robots/task-result',{method:'POST',body:JSON.stringify({room:command.room,task_id:command.id,status})});
  if(result.answer)await bubble(result.answer);
 }catch(e){emitBrainTrace(command.robot_id,'Robot','TASK REPORT FAILED',e.message);$('chatStatus').textContent='Task report error: '+e.message;}
}
async function reactToRobotMessage(message){
 if(!message?.id||!message.text||!online||!auth)return;
 // Do not flood chat with a router diagnostic for messages no robot addresses.
 const response=await api.req('/api/robots/react',{method:'POST',body:JSON.stringify({room:activeRoom,text:message.text,message_id:message.id})});
 const traceRobot=response.command?.robot_id||response.robot_id||'chat';
 if(response.triggered)for(const item of response.trace||[])emitBrainTrace(traceRobot,response.answer?.speaker||response.robot_name||'Robot',item.step.toUpperCase(),`${item.result} [${item.source}]`);
 if(response.answer)await bubble(response.answer);
 if(response.command){
   const command=response.command,editor=window.solviEditor;
   const robot=editor?.items?.find(o=>o.userData.editorId===command.robot_id&&o.userData.editorKind==='robot');
   const previous=runningRobotTasks.get(command.robot_id);if(previous)previous.cancelled=true;
   const run={cancelled:false,command};runningRobotTasks.set(command.robot_id,run);
   if(command.kind==='vision_search'){
     if(!robot||!editor.canEdit(robot)){emitBrainTrace(command.robot_id,robot?.name||'Robot','FAILED','Robot is missing or read-only');await reportRobotTask(command,'failed');return;}
     $('chatStatus').textContent=`${robot.name}: searching through head-camera frames…`;
     // Start the model calls after the chat response; do not freeze the composer.
     (async()=>{
       try{
         const result=await runRobotVisualSearch(editor.world,editor,robot,command,api,()=>run.cancelled||window.solviRoom!==command.room);
         if(result.status==='cancelled')return;
         if(result.status==='found'){
           const action={...command,kind:command.sit?'go_sit':'go_to',target_id:result.targetId,target_name:result.target.name};
           const accepted=editor.receiveRobotCommand(action);
           emitBrainTrace(command.robot_id,robot.name,'ACTION',accepted?`Found ${result.target.name}; navigation started (estimated vision cost US$${(result.spend||0).toFixed(6)})`:'3D target discovered but navigation was rejected');
           if(!accepted)await reportRobotTask(command,'failed');
         }else{
           emitBrainTrace(command.robot_id,robot.name,'SEARCH FINISHED',`${result.status}; no verified 3D destination; estimated US$${(result.spend||0).toFixed(6)}`);
           await reportRobotTask(command,result.status);
         }
       }catch(error){emitBrainTrace(command.robot_id,robot.name,'SEARCH ERROR',error.message);await reportRobotTask(command,'vision-unavailable');}
     })();
   }else{
     const accepted=editor?.receiveRobotCommand(command);
     emitBrainTrace(command.robot_id,robot?.name||'Robot','ACTION',accepted?`Scene command ${command.kind} accepted; movement now running`:'Failed to start movement; robot, target or permission mismatch');
     $('chatStatus').textContent=accepted?`${robot.name} executing ${command.kind}`:'Robot action could not start. Check scene sync and permissions.';
     if(!accepted)await reportRobotTask(command,'failed');
     if(accepted&&command.kind==='stop')await reportRobotTask(command,'stopped');
   }
 }else if(response.triggered){
   $('chatStatus').textContent=response.answer?`${response.answer.speaker} replied · ~US$${Number(response.usage?.estimated_usd||0).toFixed(5)}`:(response.note||'Robot observed the message');
 }
}
async function send(){const text=$('chatInput').value.trim();if(!text&&!pending.length)return;if(!me){show('profileBackdrop',true);return;}
 if(online&&!auth){needSignIn('Sign in before sending messages.');return;}
 const ids=pending.map(x=>x.id);
 if(!online){await bubble({role:'user',text,speaker:me.name,user_id:me.id,created:new Date().toISOString()});toast('Local demo only. AI requires backend and MODEL_API_KEY.');return;}
 const useAI=!!$('modelSelect').value;
 $('sendChat').disabled=true;$('chatStatus').textContent='Model processing…';
 try{const response=await api.req(useAI?'/api/chat':'/api/message',{method:'POST',body:JSON.stringify({room:activeRoom,text,model:$('modelSelect').value,media:ids})});
  $('chatInput').value='';pending=[];updatePending();playCue('sent');await bubble(response.message);if(response.answer)await bubble(response.answer);
  $('chatStatus').textContent=response.answer?`${response.answer.model} · ${response.latency_ms} ms`:'Delivered to world chat';
  if(response.usage?.totals)$('metaUsageStatus').textContent=`Recorded ${response.usage.totals.requests} requests · ~US$${Number(response.usage.totals.usd).toFixed(4)} estimated`;
  if(response.message?.id && text){
    try{await reactToRobotMessage(response.message);}
    catch(error){$('chatStatus').textContent='Message delivered; robot reaction failed: '+error.message;}
  }
 }catch(e){playCue('error');$('chatStatus').textContent=e.message;toast(e.message);$('chatInput').value=text;}
 finally{$('sendChat').disabled=false;}
}
async function startRecording(video,forIntro=false){if(recorder?.state==='recording'){recorder.stop();return;}
 if(!online){toast('Recording upload needs the backend');return;}
 try{recordStream=await navigator.mediaDevices.getUserMedia({video, audio:true});
  const mime=['video/webm;codecs=vp9,opus','video/webm','audio/webm;codecs=opus','audio/webm'].find(m=>MediaRecorder.isTypeSupported(m) && (video?m.startsWith('video'):m.startsWith('audio')))||'';
  const chunks=[];recorder=new MediaRecorder(recordStream,mime?{mimeType:mime}:{});recKind=forIntro?'intro':video?'video':'audio';
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=async()=>{
   clearTimeout(recTimer);recordStream?.getTracks().forEach(t=>t.stop());recordStream=null;
   const type=recorder.mimeType.split(';')[0]||(video?'video/webm':'audio/webm');const file=new File([new Blob(chunks,{type})],`${recKind}-${Date.now()}.${video?'webm':'webm'}`,{type});
   try{const m=await uploadFile(file);if(recKind==='intro'){
      const out=await api.req('/api/profile/intro',{method:'POST',body:JSON.stringify({id:m.id})});$('profileStatus').textContent='Intro video saved; 12 fps, 1.5-second GIF';const img=$('introPreview');img.src=await api.mediaBlob(out.media.id);img.hidden=false;
    }else{pending.push(m);updatePending();toast('Recording attached');}}
   catch(e){toast(e.message);}finally{recorder=null;}
  };
  recorder.start(250);toast(video?'Recording video · max 15s':'Recording audio · max 15s');recTimer=setTimeout(()=>recorder?.state==='recording'&&recorder.stop(),15000);
 }catch(e){toast(e.message);}
}
// Profile photo and intro GIF deliberately use the same visible, video-only webcam.
// A user explicitly sees and controls the captured frame; permission failures are surfaced.
let profileCameraStream=null,profileCameraRecorder=null,profileCameraTimer=null,profilePhotoArmed=false;
const profilePreview=()=>document.getElementById('profileCameraPreview');
function closeProfileCamera(){
 clearInterval(profileCameraTimer);profileCameraTimer=null;
 if(profileCameraRecorder?.state==='recording')profileCameraRecorder.stop();
 profileCameraStream?.getTracks().forEach(track=>track.stop());profileCameraStream=null;
 const video=profilePreview();video.pause();video.srcObject=null;video.hidden=true;
 $('profileCameraControls').hidden=true;profilePhotoArmed=false;
 $('takeAvatarPhoto').textContent='Camera photo';
 if(profileCameraRecorder?.state!=='recording')$('recordIntro').textContent='Record 15s GIF';
}
async function openProfileCamera(){
 if(profileCameraStream?.active&&profilePreview().readyState>=2)return profilePreview();
 if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera unavailable. Use HTTPS and allow camera access.');
 const preview=profilePreview();
 const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
 profileCameraStream=stream;preview.srcObject=stream;preview.muted=true;preview.playsInline=true;
 preview.hidden=false;$('profileCameraControls').hidden=false;
 try{await preview.play();
   if(preview.videoWidth<1||preview.videoHeight<1)await new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>reject(Error('Webcam did not produce a frame')),6000);
     preview.addEventListener('loadeddata',()=>{clearTimeout(timer);resolve();},{once:true});
   });
   if(preview.videoWidth<1||preview.videoHeight<1)throw Error('Webcam frame unavailable');
   $('profileCameraHint').textContent='Live camera · ready';return preview;
 }catch(error){closeProfileCamera();throw error;}
}
async function cameraAvatar(){
 try{
  if(!profilePhotoArmed){await openProfileCamera();profilePhotoArmed=true;$('takeAvatarPhoto').textContent='Take photo';$('profileCameraHint').textContent='Adjust camera, then Take photo';return;}
  const video=await openProfileCamera();const canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;
  const ctx=canvas.getContext('2d');const side=Math.min(video.videoWidth,video.videoHeight);
  ctx.drawImage(video,(video.videoWidth-side)/2,(video.videoHeight-side)/2,side,side,0,0,320,320);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));if(!blob?.size)throw Error('Unable to capture camera image');
  let avatar='';
  if(online&&auth){const media=await uploadFile(new File([blob],'profile-camera.jpg',{type:'image/jpeg'}));avatar=media.id;
   const data=await api.req('/api/profile',{method:'PUT',body:JSON.stringify({...profileFields(),avatar})});
   me=data.user;saveLocal({...stored(),...me});
  }else{
   avatar=canvas.toDataURL('image/jpeg',.75);if(me){me.avatar=avatar;saveLocal(me);}
  }
  const image=$('profilePhotoBadge');image.replaceChildren();const img=document.createElement('img');img.src=online&&auth?URL.createObjectURL(blob):avatar;img.alt='Profile photo';image.append(img);
  if(me)identity();$('profileStatus').textContent='Camera photo saved';closeProfileCamera();
 }catch(error){$('profileStatus').textContent='Photo failed: '+error.message;}
}
async function recordIntroGif(){
 if(profileCameraRecorder?.state==='recording'){profileCameraRecorder.stop();return;}
 if(!online||!auth){$('profileStatus').textContent='Sign in to the backend to save a GIF';return;}
 try{
  const video=await openProfileCamera();
  if(typeof MediaRecorder==='undefined')throw Error('This browser does not support video recording');
  const mime=['video/webm;codecs=vp8','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
  if(!mime)throw Error('This browser cannot record WebM or MP4');
  const chunks=[],recording=new MediaRecorder(profileCameraStream,{mimeType:mime,videoBitsPerSecond:850000});
  profileCameraRecorder=recording;const began=Date.now();
  recording.addEventListener('dataavailable',e=>{if(e.data.size)chunks.push(e.data);});
  recording.addEventListener('stop',async()=>{
   clearInterval(profileCameraTimer);profileCameraTimer=null;$('recordIntro').disabled=true;
   $('recordIntro').textContent='Saving GIF…';
   try{
    const type=recording.mimeType.split(';')[0];const blob=new Blob(chunks,{type});
    if(!blob.size)throw Error('Camera recorded no frames');
    const media=await uploadFile(new File([blob],`intro-${Date.now()}.${type==='video/mp4'?'mp4':'webm'}`,{type}));
    const result=await api.req('/api/profile/intro',{method:'POST',body:JSON.stringify({id:media.id})});
    const image=$('introPreview');image.src=await api.mediaBlob(result.media.id);image.hidden=false;if(me){me.intro=result.media.id;saveLocal({...stored(),...me});}
    $('profileStatus').textContent=`GIF saved (${Math.min(15,(Date.now()-began)/1000).toFixed(1)} seconds captured)`;
   }catch(error){$('profileStatus').textContent='GIF failed: '+error.message;}
   finally{profileCameraRecorder=null;$('recordIntro').disabled=false;closeProfileCamera();}
  },{once:true});
  recording.start(500);$('profileStatus').textContent='Recording video from your webcam (no microphone).';
  const update=()=>{const remain=Math.max(0,Math.ceil((15000-(Date.now()-began))/1000));$('recordIntro').textContent=`Stop · ${remain}s`;if(remain===0&&recording.state==='recording')recording.stop();};
  update();profileCameraTimer=setInterval(update,200);
 }catch(error){$('profileStatus').textContent='GIF failed: '+error.message;closeProfileCamera();}
}
async function logoutProfile(){
 if(!confirm('Log out and clear this device’s SOLVI session?'))return;
 const oldAuth=auth;
 try{if(online&&oldAuth)await api.req('/api/logout',{method:'POST',body:'{}'});}
 catch(error){$('profileStatus').textContent='Server logout failed: '+error.message;return;}
 closeProfileCamera();tabChannel?.close();tabChannel=null;
 window.dispatchEvent(new Event('solvi:session-lost'));
 auth=null;me=null;adminToken=null;sessionPrompt=false;
 localStorage.removeItem('solvi-profile');sessionStorage.removeItem('solvi-tab');sessionStorage.removeItem('solvi-room');
 sessionStorage.removeItem('solvi-meta-session-key');sessionStorage.removeItem('solvi-brain-debug');
 // Reload clears existing room messages, object lists, media blobs and peer states.
 window.location.reload();
}
async function robotView(world){
 const robot=window.solviEditor?.robot();
 if(!robot)throw Error('Select a robot in Objects first, then choose Robot view.');
 return captureRobotView(world,robot);
}
function exportProfile(){if(!me)return;const p=stored()||me;const data={format:'solvi-profile-v1',id:p.id,name:p.name,email:p.email,bio:p.bio,links:p.links,recovery:p.recovery||null};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='solvi-profile-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
 $('profileStatus').textContent='Backup contains your recovery key. Keep it private.';
}
async function importProfile(file){try{const data=JSON.parse(await file.text());if(data.format!=='solvi-profile-v1'||!data.name)throw Error('Invalid SOLVI profile file');
  me=null;auth=null;saveLocal(data);fillProfile(data);$('profileLogout').hidden=true;$('profileStatus').textContent='Profile loaded. Select Save / Sign in to claim this session.';
  show('profileBackdrop',true);
 }catch(e){$('profileStatus').textContent=e.message;}}
async function adminLogin(){try{const data=await api.req('/api/admin/login',{method:'POST',body:JSON.stringify({password:$('adminPassword').value})});adminToken=data.token;$('adminPassword').value='';await stats();}
 catch(e){$('adminStats').textContent=e.message;}}
async function stats(){if(!adminToken)return;try{const data=await api.req('/api/admin/stats',{headers:{'X-Solvi-Admin':adminToken}});$('adminStats').textContent=JSON.stringify(data,null,2);}catch(e){$('adminStats').textContent=e.message;}}
async function loadMessages(){
 if(!online||!auth)return;
 try{
   const room=activeRoom;const data=await api.req('/api/messages?room='+encodeURIComponent(room));
   if(room!==activeRoom)return;
   const messages=data.messages||[];
   const nextSignature=room+':'+messages.map(m=>m.id+':'+m.text).join('|')+':'+readPreferences().group;
   if(nextSignature===chatSignature)return;
   const oldIds=new Set(cachedMessages.map(m=>m.id));
   const hasLoaded=initialRoomLoads.has(room);
   const newcomers=hasLoaded?messages.filter(m=>!oldIds.has(m.id)&&m.user_id!==me?.id):[];
   cachedMessages=messages;chatSignature=nextSignature;
   const feed=$('chatFeed');feed.replaceChildren();lastBubbleEntry=null;
   for(const entry of messages)await bubble(entry);
   if($('verboseRobotDebug')?.checked)for(const entry of localBrainTrace.filter(x=>x.room===room).slice(-100))await bubble(entry);
   scrollChatToLatest();
   initialRoomLoads.add(room);
   if(newcomers.length)playCue('incoming');
   for(const entry of newcomers)if(entry.role==='user')window.dispatchEvent(new CustomEvent('solvi:peer-message',{detail:{userId:entry.user_id,text:entry.text}}));
 }catch(e){toast(e.message);}
}
function exportMessages(format='json'){
 if(!me){show('profileBackdrop',true);return;}
 const extension=format==='md'?'md':'json';
 const text=exportRoomTranscript(cachedMessages,activeRoom,format);
 const blob=new Blob([text],{type:format==='md'?'text/markdown':'application/json'});
 const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;
 anchor.download=`solvi-${activeRoom}-chat-${new Date().toISOString().slice(0,16).replace(':','-')}.${extension}`;
 anchor.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function configureRooms(){
 const select=$('roomSelect');if(!select)return;
 let rooms=[{id:'main',title:'Main realm'}];
 if(online&&auth){try{rooms=(await api.req('/api/rooms')).rooms||rooms;}catch(e){toast(e.message);}}
 if(!rooms.some(room=>room.id===activeRoom))activeRoom='main';window.solviRoom=activeRoom;
 select.replaceChildren(...rooms.map(room=>new Option(room.title,room.id)));select.value=activeRoom;
 $('roomChatTitle').textContent=select.selectedOptions[0]?.textContent+' · messages';
 select.onchange=()=>{
   activeRoom=select.value;window.solviRoom=activeRoom;sessionStorage.setItem('solvi-room',activeRoom);loadWorldSettings();
   $('roomChatTitle').textContent=select.selectedOptions[0]?.textContent+' · messages';
   chatSignature='';cachedMessages=[];lastBubbleEntry=null;$('chatFeed').replaceChildren();playCue('leave');
   window.dispatchEvent(new CustomEvent('solvi:room-changed',{detail:{room:activeRoom}}));
 };
}
async function loadWorldSettings(){
  const requestedRoom=activeRoom;window.solviRoomPolicy={objects:'open',robots:'open',physics:0};
  if(online&&auth){try{const data=await api.req('/api/room/settings?room='+encodeURIComponent(requestedRoom));if(requestedRoom!==activeRoom)return;window.solviRoomPolicy=data.policy;}catch(error){toast(error.message);}}
  for(const [id,key] of [['worldObjectsPolicy','objects'],['worldRobotsPolicy','robots']])$(id).value=window.solviRoomPolicy[key]||'open';
  $('worldPhysicsEnabled').value=String(window.solviRoomPolicy.physics||0);
  window.solviEditor?.physics.setEnabled(Boolean(window.solviRoomPolicy.physics)).catch(e=>toast('Physics unavailable: '+e.message));
  window.solviEditor?.refreshList();
}
function setupWorldSettings(){
  $('worldSettingsButton').onclick=()=>{loadWorldSettings();$('worldSettingsDrawer').hidden=false;};
  $('closeWorldSettings').onclick=()=>$('worldSettingsDrawer').hidden=true;
  $('worldSettingsDrawer').onpointerdown=e=>{if(e.target===$('worldSettingsDrawer'))$('worldSettingsDrawer').hidden=true;};
  $('saveWorldSettings').onclick=async()=>{
    const data={room:activeRoom,objects:$('worldObjectsPolicy').value,robots:$('worldRobotsPolicy').value,physics:Number($('worldPhysicsEnabled').value)};
    try{if(online&&auth){const response=await api.req('/api/room/settings',{method:'PUT',body:JSON.stringify(data)});window.solviRoomPolicy=response.policy;}
      else window.solviRoomPolicy={objects:data.objects,robots:data.robots,physics:data.physics};
      $('worldSettingsStatus').textContent='World settings saved.';await window.solviEditor?.physics.setEnabled(Boolean(window.solviRoomPolicy.physics));window.solviEditor?.refreshList();
    }catch(e){$('worldSettingsStatus').textContent=e.message;}
  };
  window.addEventListener('solvi:world-policy',e=>{window.solviRoomPolicy=e.detail.policy;
    $('worldPhysicsEnabled').value=String(e.detail.policy.physics||0);window.solviEditor?.physics.setEnabled(Boolean(e.detail.policy.physics)).catch(err=>toast('Physics unavailable: '+err.message));
    for(const [id,key] of [['worldObjectsPolicy','objects'],['worldRobotsPolicy','robots']])$(id).value=e.detail.policy[key]||'open';
    window.solviEditor?.refreshList();});
}

function configureDragging(){
 const panelIds=['scenePanel','propertiesPanel','addMenu','chatPanel','editorToolbox','robotBrainsPanel','diagnosticsPanel'];
 const save=(id,panel)=>{
   const rect=panel.getBoundingClientRect();
   const data={left:rect.left,top:rect.top,minimized:panel.classList.contains('minimized'),windowed:panel.classList.contains('windowed')};
   if(id==='chatPanel'){data.width=panel.offsetWidth;data.height=panel.offsetHeight;}
   localStorage.setItem('solvi-window-'+id,JSON.stringify(data));
 };
 window.solviSaveWindow=save;
 for(const id of panelIds){
  const panel=$(id),handle=panel?.querySelector('.drag-handle');if(!panel||!handle)continue;
  try{const stored=JSON.parse(localStorage.getItem('solvi-window-'+id)||'null');if(stored){
    if(stored.minimized!==undefined&&id!=='scenePanel'&&id!=='editorToolbox')panel.classList.toggle('minimized',stored.minimized);
    if(id==='chatPanel'&&stored.windowed){panel.classList.add('windowed');panel.style.setProperty('--chat-width',stored.width+'px');panel.style.setProperty('--chat-height',stored.height+'px');$('chatModeButton').textContent='Overlay chat';}
    if(id!=='chatPanel'||stored.windowed){
      const x=Math.max(4,Math.min(innerWidth-100,Number(stored.left)||0)),y=Math.max(45,Math.min(innerHeight-60,Number(stored.top)||70));
      if(id==='chatPanel'){panel.style.setProperty('--chat-left',x+'px');panel.style.setProperty('--chat-top',y+'px');}
      else{panel.style.left=x+'px';panel.style.top=y+'px';panel.style.right='auto';panel.style.bottom='auto';}
    }
  }}catch{}
  let delta=null;
  handle.addEventListener('pointerdown',event=>{
    if(event.target.closest('button,input,select'))return;
    if(id==='chatPanel'&&!panel.classList.contains('windowed'))return;
    const rect=panel.getBoundingClientRect();delta={x:event.clientX-rect.left,y:event.clientY-rect.top};
    if(id==='scenePanel'||id==='propertiesPanel')panel.style.bottom='auto';
    handle.setPointerCapture(event.pointerId);event.preventDefault();
  });
  handle.addEventListener('pointermove',event=>{if(!delta)return;
    const x=Math.max(4,Math.min(innerWidth-95,event.clientX-delta.x));
    const y=Math.max(45,Math.min(innerHeight-55,event.clientY-delta.y));
    if(id==='chatPanel'){panel.style.setProperty('--chat-left',x+'px');panel.style.setProperty('--chat-top',y+'px');}
    else{panel.style.left=x+'px';panel.style.top=y+'px';panel.style.right='auto';panel.style.bottom='auto';}
  });
  const release=()=>{if(delta)save(id,panel);delta=null;};handle.addEventListener('pointerup',release);handle.addEventListener('pointercancel',release);
  panel.addEventListener('click',event=>{if(event.target.closest('#toolboxMinimize,#minimizeScenePanel,#closeScenePanel,#closeProperties'))requestAnimationFrame(()=>save(id,panel));});
 }
}
function setupNewRoom(){
 $('createRoom').onclick=()=>{show('roomBackdrop',true);$('roomTitle').focus();};
 $('closeRoom').onclick=()=>show('roomBackdrop',false);
 $('roomTitle').addEventListener('input',()=>{if(!$('roomSlug').dataset.touched)$('roomSlug').value=$('roomTitle').value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');});
 $('roomSlug').addEventListener('input',()=>{$('roomSlug').dataset.touched='1';});
 $('saveRoom').onclick=async()=>{
  if(!online||!auth){$('roomError').textContent='Backend required';return;}
  try{const room=(await api.req('/api/rooms',{method:'POST',body:JSON.stringify({id:$('roomSlug').value,title:$('roomTitle').value})})).room;
    show('roomBackdrop',false);await configureRooms();$('roomSelect').value=room.id;$('roomSelect').dispatchEvent(new Event('change'));
  }catch(e){$('roomError').textContent=e.message;}
 };
}
function setupSettings(){
 const current=readPreferences();applyPreferences(current);
 const settings=$('settingsDrawer');
 function paint(p){
  $('accentColor').value=p.accent;$('interfaceTheme').value=p.theme||'midnight';$('bubbleOpacity').value=p.opacity;
  $('uiScale').value=uiScalePercent(p.uiScale);$('uiScaleNumber').value=uiScalePercent(p.uiScale);$('uiScaleOutput').textContent=uiScalePercent(p.uiScale)+'%';
  $('uiFontTheme').value=['system','sans','rounded','serif','mono','installed'].includes(p.fontTheme)?p.fontTheme:'system';
  $('uiCustomFont').value=p.customFont||'';$('uiCustomFontLabel').hidden=p.fontTheme!=='installed';
  const mode=p.labelMode==='auto'?(matchMedia('(max-width:750px)').matches?'icon':'both'):p.labelMode;
  const opt=settings.querySelector(`input[name=buttonLabels][value="${mode}"]`);if(opt)opt.checked=true;
  for(const btn of $('themePresetGallery').querySelectorAll('button')){const active=btn.dataset.theme===p.theme;btn.setAttribute('aria-pressed',String(active));btn.classList.toggle('active',active);}
  for(const btn of $('themeSwatches').querySelectorAll('button'))btn.setAttribute('aria-pressed',String(btn.dataset.color===p.accent));
  for(const [id,key] of [['bubbleBackgrounds','backgrounds'],['bubbleBorders','borders'],['groupMessages','group'],['soundEffects','sounds'],['flipHead','flipHead']])$(id).checked=!!p[key];
 }
 paint(current);
 $('settingsButton').onclick=()=>{settings.hidden=false;show('profileBackdrop',false);};
 $('closeSettings').onclick=()=>{settings.hidden=true;};
 settings.addEventListener('pointerdown',e=>{if(e.target===settings)settings.hidden=true;});
 const apply=(patch)=>{const prefs=updatePreferences(patch);paint(prefs);if('group' in patch){chatSignature='';loadMessages();}};
 for(const control of settings.querySelectorAll('input[name=buttonLabels]'))control.onchange=e=>{if(e.target.checked)apply({labelMode:e.target.value});};
 // Stage size edits inside the unscaled settings drawer. Applying is explicit so the slider never moves under the pointer.
 const stageScale=value=>{const number=uiScalePercent(value);$('uiScale').value=number;$('uiScaleNumber').value=number;$('uiScaleOutput').textContent=number+'%';};
 $('uiScale').oninput=e=>stageScale(e.target.value);
 $('uiScaleNumber').oninput=e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=50&&n<=200)stageScale(n);};
 $('applyUiScale').onclick=()=>apply({uiScale:uiScalePercent($('uiScaleNumber').value)});
 $('uiScaleNumber').addEventListener('keydown',e=>{if(e.key==='Enter'){$('applyUiScale').click();e.preventDefault();}});
 $('useSystemFont').onclick=()=>apply({fontTheme:'system',customFont:''});
 $('browseLocalFonts').onclick=async()=>{const status=$('fontBrowseStatus'),list=$('localFontList');if(typeof window.queryLocalFonts!=='function'){status.textContent='Font listing is unsupported here. Select Installed font and enter its family name.';$('uiFontTheme').value='installed';$('uiFontTheme').dispatchEvent(new Event('change'));return;}
 try{const fonts=await window.queryLocalFonts();const unique=[...new Set(fonts.map(f=>safeFontName(f.family)).filter(Boolean))].sort();list.replaceChildren(new Option('Select a font…',''));for(const name of unique)list.add(new Option(name,name));list.hidden=false;status.textContent=unique.length+' installed font families available.';}catch{status.textContent='Font permission unavailable. Enter an installed font name manually.';}};
 $('localFontList').onchange=e=>{if(e.target.value)apply({fontTheme:'installed',customFont:safeFontName(e.target.value)});};
 $('uiFontTheme').onchange=e=>apply({fontTheme:e.target.value});
 $('uiCustomFont').onchange=e=>{const name=safeFontName(e.target.value);if(e.target.value.trim()&&!name){e.target.setCustomValidity('Use a font family name with letters, numbers, spaces, periods, underscores or hyphens.');e.target.reportValidity();return;}e.target.setCustomValidity('');apply({customFont:name});};
 $('resetUiPreferences').onclick=()=>{apply({labelMode:'auto',uiScale:100,fontTheme:'system',customFont:''});};
 const themeNames={midnight:'Midnight',light:'Light',dark:'Dark',ocean:'Ocean',forest:'Forest',dusk:'Dusk',contrastDark:'High contrast · dark',contrastLight:'High contrast · light'};
 for(const [key,theme] of Object.entries(THEME_PRESETS)){const btn=document.createElement('button');btn.type='button';btn.className='theme-preset';btn.dataset.theme=key;btn.setAttribute('aria-label',`Choose ${themeNames[key]} colour theme`);btn.setAttribute('aria-pressed',String(key===current.theme));
  const strip=document.createElement('span');strip.className='theme-preview-strip';strip.setAttribute('aria-hidden','true');for(const color of [theme.background,theme.panel,theme.accent]){const colorSpan=document.createElement('span');colorSpan.style.backgroundColor=color;strip.append(colorSpan);}
  const label=document.createElement('span');label.textContent=themeNames[key];btn.append(strip,label);btn.onclick=()=>apply({theme:key,accent:theme.accent});$('themePresetGallery').append(btn);}
 $('accentColor').oninput=e=>apply({accent:e.target.value});
 $('interfaceTheme').onchange=e=>{const key=e.target.value;const theme=THEME_PRESETS[key];apply({theme:key,accent:theme.accent});};
 $('bubbleOpacity').oninput=e=>apply({opacity:Number(e.target.value)});
 for(const [id,key] of [['bubbleBackgrounds','backgrounds'],['bubbleBorders','borders'],['groupMessages','group'],['soundEffects','sounds'],['flipHead','flipHead']])$(id).onchange=e=>apply({[key]:e.target.checked});
 const colors=['#79cde5','#e7b073','#a5db91','#d9a0d7','#a0b5f5','#f3a1a1'];
 function swatches(){const grid=$('themeSwatches');grid.replaceChildren();for(const color of colors){const b=document.createElement('button');b.className='theme-swatch';b.type='button';b.dataset.color=color;b.title='Use accent '+color;b.setAttribute('aria-label','Use accent '+color);b.setAttribute('aria-pressed',String(readPreferences().accent===color));b.style.setProperty('--swatch-color',color);b.onclick=()=>apply({accent:color});grid.append(b);}}
 swatches();$('generateTheme').onclick=()=>{const color=themePalette(Math.floor(Math.random()*10000));colors[colors.length-1]=color;swatches();apply({accent:color});};
 $('metaBudget').value=localStorage.getItem('solvi-ai-budget-usd')||'5';
 $('metaBudget').onchange=event=>{const budget=Math.max(0,Number(event.target.value)||0);localStorage.setItem('solvi-ai-budget-usd',String(budget));$('refreshMetaUsage').click();};
 $('metaKeyStorage').value='session';
 $('metaApiKey').placeholder=sessionStorage.getItem('solvi-meta-session-key')?'Session key configured (hidden)':'Optional session Meta API key';
 $('saveMetaKey').onclick=async()=>{
   const key=$('metaApiKey').value.trim();if(!key){$('metaKeyStatus').textContent='Enter a key to apply it.';return;}
   if($('metaKeyStorage').value==='session'){
     sessionStorage.setItem('solvi-meta-session-key',key);$('metaApiKey').value='';$('metaKeyStatus').textContent='Key held in sessionStorage for this tab only. Vulnerable to malicious scripts; do not use a privileged key.';
   }else{
     try{const response=await api.req('/api/ai/config',{method:'POST',headers:{'X-Solvi-Admin':adminToken||''},body:JSON.stringify({key})});
       $('metaApiKey').value='';$('metaKeyStatus').textContent=response.notice;
     }catch(e){$('metaKeyStatus').textContent=e.message;return;}
   }
   if(online&&auth){const result=await api.req('/api/models');modelIds=result.models||[];const select=$('modelSelect');select.replaceChildren(new Option('World chat · people',''),...modelIds.map(id=>new Option('AI · '+id,id)));}
 };
 $('clearMetaKey').onclick=()=>{sessionStorage.removeItem('solvi-meta-session-key');$('metaApiKey').value='';$('metaKeyStatus').textContent='Browser session key cleared. Server-side key, if present, is unchanged.';};
 $('refreshMetaUsage').onclick=async()=>{
   if(!online||!auth){$('metaUsageStatus').textContent='Sign in to view server-recorded AI usage';return;}
   try{const u=(await api.req('/api/ai/usage')).usage.totals;const budget=Math.max(0,Number($('metaBudget').value)||0);
     $('metaUsageStatus').textContent=`${u.requests} requests · ${u.input_tokens} input / ${u.output_tokens} output tokens · ${u.images} SAM images · estimated US$${Number(u.usd).toFixed(5)}. Budget left ~US$${Math.max(0,budget-Number(u.usd)).toFixed(4)} (not Meta account balance).`;
   }catch(error){$('metaUsageStatus').textContent=error.message;}
 };
 $('diagnosticsButton').onclick=()=>{$('diagnosticsPanel').hidden=false;$('refreshDiagnostics').click();};
 $('closeDiagnostics').onclick=()=>{$('diagnosticsPanel').hidden=true;};
 $('refreshDiagnostics').onclick=async()=>{try{
   const data=await api.req('/api/ai/logs',{headers:{'X-Solvi-Admin':adminToken||''}});
   $('diagnosticsOutput').textContent=data.scope+'\n'+JSON.stringify(data.logs,null,2);
 }catch(e){$('diagnosticsOutput').textContent=e.message+'\nUnlock the Admin dashboard in Settings, then retry.';}};
 $('analyzeDiagnostics').onclick=async()=>{
   if(!adminToken){$('diagnosticsOutput').textContent='Unlock Admin dashboard first.';return;}
   if(!window.confirm('Send the sanitized backend event metadata to the Meta Model API for analysis? This incurs API charges.'))return;
   $('diagnosticsOutput').textContent='Requesting Meta diagnostic analysis…';
   try{const response=await api.req('/api/ai/analyze-logs',{method:'POST',headers:{'X-Solvi-Admin':adminToken},body:JSON.stringify({confirm:true})});
     $('diagnosticsOutput').textContent=(response.analysis||'No analysis text returned')+'\n\nEstimated cost: US$'+Number(response.usage?.estimated_usd||0).toFixed(6);
   }catch(e){$('diagnosticsOutput').textContent=e.message;}
 };
 $('exportChatSettings').onclick=()=>exportMessages('md');$('exportChatSettingsJson').onclick=()=>exportMessages('json');$('openAdminSettings').onclick=()=>{settings.hidden=true;show('adminBackdrop',true);};
}
function setupChatPresentation(){
  const feed=$('chatFeed'),panel=$('chatPanel'),composer=panel.querySelector('.chat-composer');
  const messages=$('messagesToggleButton');
  messages.addEventListener('click',()=>{
    const hidden=document.body.classList.toggle('chat-muted');
    messages.setAttribute('aria-pressed',String(!hidden));
    messages.textContent=hidden?'Show chat':'Hide chat';
  });
  $('chatModeButton').addEventListener('click',()=>{
    const floating=panel.classList.toggle('windowed');
    $('chatModeButton').textContent=floating?'Overlay chat':'Float chat';
    if(!floating){panel.style.removeProperty('--chat-left');panel.style.removeProperty('--chat-top');}
    else{panel.style.setProperty('--chat-left',Math.max(4,window.innerWidth-Math.min(390,window.innerWidth-10)-14)+'px');panel.style.setProperty('--chat-top',window.innerWidth<=750?'100px':'72px');}
    $('floatChatButton').textContent='Overlay';
    scrollChatToLatest();window.solviSaveWindow?.('chatPanel',panel);
  });
  $('floatChatButton').onclick=()=>$('chatModeButton').click();
  const grip=$('chatResizeGrip');let start=null;
  grip.addEventListener('pointerdown',event=>{
    if(!panel.classList.contains('windowed'))return;
    start={x:event.clientX,y:event.clientY,w:panel.offsetWidth,h:panel.offsetHeight};
    grip.setPointerCapture(event.pointerId);event.preventDefault();
  });
  grip.addEventListener('pointermove',event=>{
    if(!start)return;
    const w=Math.min(innerWidth-12,Math.max(290,start.w+event.clientX-start.x));
    const h=Math.min(innerHeight-90,Math.max(200,start.h+event.clientY-start.y));
    panel.style.setProperty('--chat-width',w+'px');panel.style.setProperty('--chat-height',h+'px');
  });
  for(const name of ['pointerup','pointercancel'])grip.addEventListener(name,()=>{if(start)window.solviSaveWindow?.('chatPanel',panel);start=null;});

  // Standalone composer: drag its header when undocked, minimize the body, or dock it.
  const move=$('composerMove'),float=$('composerFloat'),minimize=$('composerMinimize');
  let moving=null;
  float.onclick=()=>{const undocked=composer.classList.toggle('composer-floating');
   composer.classList.remove('composer-minimized');minimize.setAttribute('aria-label','Minimize composer');
   float.setAttribute('aria-label',undocked?'Dock composer':'Undock composer');
   if(undocked){composer.style.left=Math.max(6,Math.round((innerWidth-composer.offsetWidth)/2))+'px';composer.style.top=Math.max(65,innerHeight-composer.offsetHeight-20)+'px';}
   else{composer.style.removeProperty('left');composer.style.removeProperty('top');}scrollChatToLatest();};
  minimize.onclick=()=>{const collapsed=composer.classList.toggle('composer-minimized');minimize.setAttribute('aria-label',collapsed?'Restore composer':'Minimize composer');minimize.dataset.uiIcon=collapsed?'opened':'minified';minimize.style.setProperty('--ui-button-icon',`url("./assets/ui-icons/${collapsed?'opened':'minified'}.svg")`);scrollChatToLatest();};
  move.addEventListener('pointerdown',e=>{
   if(e.button!==0)return;
   const rect=composer.getBoundingClientRect();
   if(!composer.classList.contains('composer-floating')){
     composer.classList.add('composer-floating');composer.style.left=rect.left+'px';composer.style.top=rect.top+'px';
     float.setAttribute('aria-label','Dock composer');
   }
   moving={x:e.clientX,y:e.clientY,left:parseFloat(composer.style.left)||rect.left,top:parseFloat(composer.style.top)||rect.top};
   move.setPointerCapture(e.pointerId);e.preventDefault();
  });
  move.addEventListener('pointermove',e=>{
   if(!moving)return;
   composer.style.left=Math.max(4,Math.min(innerWidth-composer.offsetWidth-4,moving.left+e.clientX-moving.x))+'px';
   composer.style.top=Math.max(52,Math.min(innerHeight-composer.offsetHeight-4,moving.top+e.clientY-moving.y))+'px';
  });
  for(const event of ['pointerup','pointercancel'])move.addEventListener(event,()=>{if(moving){localStorage.setItem('solvi-composer-pos',JSON.stringify({left:composer.style.left,top:composer.style.top}));}moving=null;});
  try{const loc=JSON.parse(localStorage.getItem('solvi-composer-pos')||'null');if(loc&&loc.left&&loc.top){composer.classList.add('composer-floating');composer.style.left=Math.max(4,Math.min(innerWidth-100,parseFloat(loc.left)))+'px';composer.style.top=Math.max(52,Math.min(innerHeight-70,parseFloat(loc.top)))+'px';float.setAttribute('aria-label','Dock composer');}}catch{}
  const attachments=$('attachmentMenu'),toggle=$('attachmentButton');
  const closeAttach=()=>{attachments.hidden=true;toggle.setAttribute('aria-expanded','false');};
  toggle.onclick=()=>{attachments.hidden=!attachments.hidden;toggle.setAttribute('aria-expanded',String(!attachments.hidden));};
  $('attachMediaOption').onclick=()=>{closeAttach();$('chatFile').click();};
  $('attachAudioOption').onclick=()=>{closeAttach();$('recordAudio').click();};
  $('attachVideoOption').onclick=()=>{closeAttach();$('recordVideo').click();};
  $('attachRobotOption').onclick=()=>{closeAttach();$('robotVision').click();};
  document.addEventListener('pointerdown',event=>{if(!attachments.hidden&&!attachments.contains(event.target)&&!toggle.contains(event.target))closeAttach();});
  const mobileTools=$('composerToolsButton');mobileTools.onclick=()=>toggle.click();
  const watchSize=new ResizeObserver(()=>scrollChatToLatest());watchSize.observe(composer);watchSize.observe(feed);
  // Compact navigation remains horizontally scrollable on small screens; no redundant More button.
  // Multiline by default: Enter sends, Shift+Enter inserts a newline.
  const input=$('chatInput');
  const resize=()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,118)+'px';};
  input.addEventListener('input',resize);resize();
}
function bindUI(world){
 const editor=new SceneEditor(world,toast);window.addEventListener('solvi:scene-ready',()=>editor.load());
 window.addEventListener('solvi:room-changed',async()=>{await loadMessages();editor.revision=0;editor.apply([]);await editor.load();});
 window.addEventListener('solvi:scene-changed',e=>editor.acceptRemoteRevision(e.detail));
 window.addEventListener('solvi:robot-task-update',e=>{
   const d=e.detail||{};
   $('chatStatus').textContent=`${d.robot} · ${d.status} · ${d.target}`;
   emitBrainTrace(d.robotId,d.robot,'MOVEMENT COMPLETE',`${d.status} at ${d.target}`);
   if(d.taskId){const run=runningRobotTasks.get(d.robotId);if(run&&!run.cancelled&&run.command.id===d.taskId){runningRobotTasks.delete(d.robotId);reportRobotTask(run.command,d.status);}}
 });
 window.addEventListener('solvi:brain-trace',e=>{
   if(!$('verboseRobotDebug')?.checked)return;
   const d=e.detail||{};
   const entry={id:random(),room:activeRoom,role:'assistant',speaker:(d.robotName||'Robot')+' · brain trace',model:'local-debug',
     text:`[${d.at}] ${d.step}\n${d.detail}`,created:new Date().toISOString(),isBrainTrace:true};
   localBrainTrace.push(entry);if(localBrainTrace.length>100)localBrainTrace.shift();bubble(entry);
 });
 window.addEventListener('solvi:show-brain-chat',()=>{
   $('verboseRobotDebug').checked=true;sessionStorage.setItem('solvi-brain-debug','1');
   show('chatPanel',true);document.body.classList.remove('chat-muted');$('messagesToggleButton').setAttribute('aria-pressed','true');chatSignature='';loadMessages();
   const panel=$('chatPanel');if(innerWidth<=1100){$('robotBrainsPanel').hidden=true;document.body.classList.remove('solvi-brain-chat-side-by-side');}
   if(innerWidth>1100){
     document.body.classList.add('solvi-brain-chat-side-by-side');
     panel.classList.add('windowed');panel.style.setProperty('--chat-width','420px');panel.style.setProperty('--chat-height','min(79vh,780px)');
     panel.style.setProperty('--chat-left',Math.max(6,innerWidth-432)+'px');panel.style.setProperty('--chat-top','92px');
   }
 });
 window.addEventListener('solvi:chat-updated',loadMessages);
 $('chatButton').onclick=()=>{show('chatPanel',$('chatPanel').hidden);document.body.classList.remove('chat-muted');$('messagesToggleButton').setAttribute('aria-pressed','true');};$('closeChat').onclick=()=>show('chatPanel',false);
 $('profileButton').onclick=()=>{fillProfile(me||stored());$('profileBackdrop').classList.toggle('profile-drawer-mode',!!me);$('profilePanelTitle').textContent=me?.name||'Sign in';$('profilePanelNote').textContent=me?'Profile & media':'Create profile';show('profileBackdrop',true);$('settingsDrawer').hidden=true;};
 $('closeProfile').onclick=()=>{closeProfileCamera();if(me&&auth)show('profileBackdrop',false);else{$('profileStatus').textContent='Sign in to continue.';$('profileName').focus();}};
 $('saveProfile').onclick=submitProfile;$('exportProfile').onclick=exportProfile;
 $('importProfile').onchange=e=>importProfile(e.target.files[0]);
 window.addEventListener('pagehide',closeProfileCamera);
 $('profilePhotoBadge').onclick=()=>$('avatarUpload').click();
 $('avatarUpload').onchange=async e=>{try{const m=await uploadFile(e.target.files[0]);$('profileStatus').textContent='Uploaded '+m.name;
 if(me){const data=await api.req('/api/profile',{method:'PUT',body:JSON.stringify({...profileFields(),avatar:m.id})});me=data.user;saveLocal({...stored(),...me});identity();}}catch(e){toast(e.message);}};
 $('takeAvatarPhoto').onclick=cameraAvatar;$('recordIntro').onclick=recordIntroGif;$('profileCameraCancel').onclick=closeProfileCamera;$('profileLogout').onclick=logoutProfile;
 window.solviPublishCaption=async text=>{
   if(!text?.trim())return;
   if(!me)throw Error('Sign in to publish CC captions to the room.');
   const caption='CC: '+text.trim().slice(0,500);
   if(!online||!auth){if(online&&!auth){needSignIn('Sign in to send captions.');return;}await bubble({role:'user',text:caption,speaker:me.name,user_id:me.id,created:new Date().toISOString()});return;}
   try{const response=await api.req('/api/message',{method:'POST',body:JSON.stringify({room:activeRoom,text:caption,media:[]})});await bubble(response.message);try{await reactToRobotMessage(response.message);}catch(error){$('chatStatus').textContent='Caption published; robot reaction failed: '+error.message;}}
   catch(error){toast('Captions not sent: '+error.message);throw error;}
 };
 $('sendChat').onclick=send;$('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
 $('chatFile').onchange=e=>attach(e.target.files[0]);$('recordAudio').onclick=()=>startRecording(false);
 $('recordVideo').onclick=()=>startRecording(true);
 $('robotVision').onclick=async()=>{try{
   const robot=window.solviEditor?.selected;if(robot?.userData.editorKind!=='robot')throw Error('Select a robot before capturing its eyes.');
   const img=await robotView(world);const media=await uploadFile(new File([img],`robot-eye-${Date.now()}.jpg`,{type:'image/jpeg'}));
   const reply=await api.req('/api/robots/eyes',{method:'POST',body:JSON.stringify({room:activeRoom,robot_id:robot.userData.editorId,media_id:media.id})});
   show('chatPanel',true);await bubble(reply.answer);$('chatStatus').textContent=robot.name+' · eye image shared'+(reply.usage?' · ~US$'+Number(reply.usage.estimated_usd||0).toFixed(5):'');
   emitBrainTrace(robot.userData.editorId,robot.name,'EYE FRAME SHARED',`512×512 JPEG attached as ${robot.name}'s own reply; ${reply.model||'local'}; usage ${reply.usage?.estimated_usd||0}`);
   scrollChatToLatest();
  }catch(e){toast(e.message);}};
 $('closeAdmin').onclick=()=>show('adminBackdrop',false);
 $('adminLogin').onclick=adminLogin;$('adminRefresh').onclick=stats;
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){show('addMenu',false);show('adminBackdrop',false);if(me)show('profileBackdrop',false);}});
 window.addEventListener('solvi:auth-required',event=>needSignIn(event.detail?.reason||'Session expired.'));
 window.addEventListener('solvi:presence-change',event=>{if(event.detail.id!==me?.id)playCue(event.detail.action==='left'?'leave':'join');});
 document.addEventListener('pointerdown',primeAudio,{once:true});
 $('verboseRobotDebug').checked=sessionStorage.getItem('solvi-brain-debug')!=='0';$('verboseRobotDebug').onchange=()=>{sessionStorage.setItem('solvi-brain-debug',$('verboseRobotDebug').checked?'1':'0');chatSignature='';loadMessages();};
 setupChatPresentation();setupSettings();setupWorldSettings();setupNewRoom();configureRooms();configureDragging();initRobotBrains(world,api,()=>activeRoom,toast);begin();
 // Opt-in robot social initiatives: the server enforces a six-minute per-robot
 // cooldown even with multiple connected clients. They are never executable moves.
 let initiativeBusy=false;
 const tryInitiative=async()=>{
   if(initiativeBusy||document.visibilityState!=='visible'||!online||!auth||!me)return;
   const editor=window.solviEditor;
   const robot=editor?.items?.find(o=>o.userData.editorKind==='robot'&&o.userData.robotBrain?.initiative&&editor.canEdit(o));
   if(!robot)return;
   initiativeBusy=true;
   try{const outcome=await api.req('/api/robots/initiative',{method:'POST',body:JSON.stringify({room:activeRoom,robot_id:robot.userData.editorId})});
     if(outcome.answer){await bubble(outcome.answer);emitBrainTrace(robot.userData.editorId,robot.name,'INITIATIVE',`Muse Spark proactive question · estimated US$${Number(outcome.usage?.estimated_usd||0).toFixed(6)} · no movement executed`);}
   }catch(e){console.info('Robot initiative unavailable:',e.message);}
   finally{initiativeBusy=false;}
 };
 setTimeout(tryInitiative,45000);setInterval(tryInitiative,180000);
 setInterval(async()=>{if(online&&auth){try{await api.req('/api/me');}catch{ /* expiry handler opens sign-in */ }}},45000);
}
export function initStudio(world){bindUI(world);}

// Local model cap: a personal import preference, bounded by the server's 20 MiB hard limit.
const modelLimitPicker=document.getElementById('sceneModelMaxSize');
if(modelLimitPicker){const storedLimit=localStorage.getItem('solvi-model-upload-limit')||'5';modelLimitPicker.value=[...modelLimitPicker.options].some(o=>o.value===storedLimit)?storedLimit:'5';modelLimitPicker.onchange=()=>localStorage.setItem('solvi-model-upload-limit',modelLimitPicker.value);}
