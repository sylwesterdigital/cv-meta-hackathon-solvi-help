import * as THREE from 'three';
import {SceneEditor} from './editor.js';

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
    if(m.type==='ACTIVE'&&auth){auth=null;show('profileBackdrop',true);$('profileStatus').textContent='Another window is using this profile. Save / Sign in to take over.';}
  };
  tabChannel.postMessage({type:'HELLO',page:pageNonce});
}
let recordStream=null,recorder=null,recKind=null,recTimer=null;
let pending=[],me=null,auth=null,online=false,modelIds=[],adminToken=null;
const toast=text=>{const t=$('toast');t.textContent=text;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,5200);};
const show=(id,yes=true)=>{$(id).hidden=!yes;};
const stored=()=>{try{return JSON.parse(localStorage.getItem('solvi-profile')||'null');}catch{return null;}};
const saveLocal=(o)=>localStorage.setItem('solvi-profile',JSON.stringify(o));
const api={
 online:false,
 auth:()=>auth?{token:auth.token,tab,profile:me}:null,
 async req(url,options={}){
  const headers={...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(options.headers||{})};
  if(auth?.token)headers.Authorization='Bearer '+auth.token;
  headers['X-Solvi-Tab']=tab;
  const res=await fetch(url,{...options,headers,cache:'no-store'});
  const data=await res.json().catch(()=>({error:'Invalid server response'}));
  if(!res.ok)throw Error(data.error||`${res.status} ${res.statusText}`);
  return data;
 },
 async mediaBlobInfo(id){const res=await fetch(`/api/media/${encodeURIComponent(id)}`,{headers:{Authorization:'Bearer '+auth.token,'X-Solvi-Tab':tab}});if(!res.ok)throw Error('Media unavailable');const blob=await res.blob();return {url:URL.createObjectURL(blob),mime:blob.type};},
 async mediaBlob(id){return (await this.mediaBlobInfo(id)).url;}
};
window.solviAPI=api;
function profileFields(){return {name:$('profileName').value.trim(),email:$('profileEmail').value.trim(),bio:$('profileBio').value.trim(),links:$('profileLinks').value.trim()};}
function fillProfile(o){$('profileName').value=o?.name||'';$('profileEmail').value=o?.email||'';$('profileBio').value=o?.bio||'';$('profileLinks').value=o?.links||'';$('profileIdentity').textContent=o?.id||'New profile';}
async function checkBackend(){try{const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),2500);const res=await fetch('/api/health',{cache:'no-store',signal:controller.signal});clearTimeout(timeout);
 const data=await res.json();online=!!data.backend;api.online=online;$('backendLabel').textContent=online?`Backend connected · AI ${data.ai?'configured':'key missing'}`:'Local demo · backend not enabled';}
 catch{online=false;api.online=false;$('backendLabel').textContent='Local demo · backend not enabled';}}
async function begin(){const p=stored();fillProfile(p);await checkBackend();
 if(!p?.name){show('profileBackdrop',true);$('profileName').focus();return;}
 if(!online){me=p;show('profileBackdrop',false);identity();window.dispatchEvent(new CustomEvent('solvi:scene-ready'));return;}
 if(p.token){auth={token:p.token};try{const out=await api.req('/api/me');me=out.user;identity();await afterLogin();return;}catch(e){toast(e.message);}}
 show('profileBackdrop',true);$('profileStatus').textContent='Reconnect or take over this profile to continue.';
}
function identity(){const text=me?.name||'Guest';$('profileButton').textContent=text.length>15?text.slice(0,14)+'…':text;
 $('profileIdentity').textContent=me?.id||'Local demo profile';$('composerName').textContent=text;}
async function afterLogin(){show('profileBackdrop',false);identity();establishTabChannel(me.id);window.dispatchEvent(new CustomEvent('solvi:authenticated'));
 try{const data=await api.req('/api/models');modelIds=data.models||[];const select=$('modelSelect');select.replaceChildren();
  if(!modelIds.length){select.add(new Option(data.note||'Meta API unavailable',''));select.disabled=true;}else{
   for(const id of modelIds)select.add(new Option(id,id));
   select.value=modelIds.includes('muse-spark-1.3')?'muse-spark-1.3':modelIds[0];select.disabled=false;
  }}catch(e){$('modelSelect').replaceChildren(new Option('Model catalog unavailable',''));toast(e.message);}
 try{const data=await api.req('/api/messages');$('chatFeed').replaceChildren();for(const row of data.messages||[])await bubble(row);}catch(e){toast(e.message);}
 window.dispatchEvent(new CustomEvent('solvi:scene-ready'));
}
async function submitProfile(){const fields=profileFields();if(!fields.name){$('profileStatus').textContent='Name is required';return;}
 if(!online){me={...fields,id:me?.id||random(),avatar:me?.avatar||''};saveLocal(me);show('profileBackdrop',false);identity();return;}
 try{const previous=stored();if(!auth || !me){
  const data=await api.req('/api/onboard',{method:'POST',body:JSON.stringify({...fields,id:previous?.id||undefined,recovery:previous?.recovery||undefined,tab})});
  auth={token:data.token};me=data.user;saveLocal({...me,token:data.token,recovery:data.recovery||previous?.recovery});
  await afterLogin();
 }else{
  const data=await api.req('/api/profile',{method:'PUT',body:JSON.stringify({...fields,avatar:me.avatar||''})});
  me=data.user;saveLocal({...stored(),...me});show('profileBackdrop',false);identity();
 }}catch(e){$('profileStatus').textContent=e.message;}
}
function safeTime(t){const d=new Date(t||Date.now());return isNaN(+d)?'':d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});}
async function bubble(entry){
 const feed=$('chatFeed');const wrap=document.createElement('article');const role=entry.role==='assistant'?'assistant':'user';wrap.className='chat-row '+role;
 const pic=document.createElement('span');pic.className='chat-avatar';pic.textContent=role==='assistant'?'AI':(entry.speaker||me?.name||'?').slice(0,2).toUpperCase();
 const panel=document.createElement('div');panel.className='chat-bubble';const meta=document.createElement('div');meta.className='chat-meta';
 const name=document.createElement('strong');name.textContent=entry.role==='assistant'?(entry.model||'Meta Model API'):(entry.speaker||me?.name||'Guest');
 const date=document.createElement('time');date.textContent=safeTime(entry.created);meta.append(name,date);
 const content=document.createElement('div');content.className='chat-body';content.textContent=entry.text||'';panel.append(meta,content);
 let mids=[];try{mids=typeof entry.media==='string'?JSON.parse(entry.media):entry.media||[];}catch{}
 for(const id of mids){const slot=document.createElement('div');slot.className='chat-attachment';slot.textContent='Attachment';panel.append(slot);
  if(online&&auth){api.mediaBlobInfo(id).then(({url,mime})=>{const el=document.createElement(mime.startsWith('video/')?'video':mime.startsWith('audio/')?'audio':'img');el.src=url;if(el.tagName==='IMG'){el.alt='Image attachment';el.loading='lazy';}else{el.controls=true;el.preload='metadata';}el.onerror=()=>{slot.textContent='Media attachment';URL.revokeObjectURL(url);};slot.replaceChildren(el);}).catch(()=>{slot.textContent='Attachment';});}}
 if(entry.avatar&&online&&auth){api.mediaBlob(entry.avatar).then(url=>{pic.textContent='';const img=document.createElement('img');img.src=url;img.alt='';img.className='chat-profile-image';pic.append(img);}).catch(()=>{});}wrap.append(pic,panel);feed.append(wrap);feed.scrollTop=feed.scrollHeight;
}
async function uploadFile(file){if(!online||!auth)throw Error('Enable the Flask backend to store media');if(file.size>11_000_000)throw Error('File must be under 11 MB');
 const body=new FormData();body.append('file',file,file.name);const response=await api.req('/api/media',{method:'POST',body});return response.media;}
function updatePending(){const p=$('pendingMedia');p.replaceChildren();for(const m of pending){const badge=document.createElement('button');badge.textContent=`${m.name} ×`;badge.title='Remove attachment';badge.onclick=()=>{pending=pending.filter(x=>x!==m);updatePending();};p.append(badge);}}
async function attach(file){if(!file)return;try{const media=await uploadFile(file);pending.push(media);pending=pending.slice(-3);updatePending();toast('Attachment ready');}catch(e){toast(e.message);}}
async function send(){const text=$('chatInput').value.trim();if(!text&&!pending.length)return;if(!me){show('profileBackdrop',true);return;}
 const ids=pending.map(x=>x.id);$('chatInput').value='';pending=[];updatePending();
 if(!online){await bubble({role:'user',text,speaker:me.name,created:new Date().toISOString()});toast('Local demo only. AI requires backend and MODEL_API_KEY.');return;}
 if(!$('modelSelect').value){toast('No AI model available: configure MODEL_API_KEY');return;}
 $('sendChat').disabled=true;$('chatStatus').textContent='Model processing…';
 try{const response=await api.req('/api/chat',{method:'POST',body:JSON.stringify({text,model:$('modelSelect').value,media:ids})});
  await bubble(response.message);await bubble(response.answer);$('chatStatus').textContent=`${response.answer.model} · ${response.latency_ms} ms`;
 }catch(e){$('chatStatus').textContent=e.message;toast(e.message);$('chatInput').value=text;}
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
async function cameraAvatar(){try{const stream=await navigator.mediaDevices.getUserMedia({video:true});const video=document.createElement('video');video.srcObject=stream;video.muted=true;await video.play();await new Promise(r=>setTimeout(r,400));
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;canvas.getContext('2d').drawImage(video,0,0,256,256);stream.getTracks().forEach(t=>t.stop());const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.85));
 const media=await uploadFile(new File([blob],'avatar.jpg',{type:'image/jpeg'}));
 if(me){const data=await api.req('/api/profile',{method:'PUT',body:JSON.stringify({...profileFields(),avatar:media.id})});me=data.user;saveLocal({...stored(),...me});}
 $('profileStatus').textContent='Profile photo saved.';
 }catch(e){$('profileStatus').textContent=e.message;}}
async function robotView(world){
 const camera=new THREE.PerspectiveCamera(70,1,.05,80);world.actor.add(camera);camera.position.set(0,1.55,-.18);
 const rt=new THREE.WebGLRenderTarget(512,512);const old=world.renderer.getRenderTarget();world.scene.updateMatrixWorld(true);
 world.renderer.setRenderTarget(rt);world.renderer.render(world.scene,camera);
 const arr=new Uint8Array(512*512*4);world.renderer.readRenderTargetPixels(rt,0,0,512,512,arr);
 world.renderer.setRenderTarget(old);world.actor.remove(camera);rt.dispose();
 const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');const pixels=ctx.createImageData(512,512);
 for(let y=0;y<512;y++)pixels.data.set(arr.subarray((511-y)*512*4,(512-y)*512*4),y*512*4);
 ctx.putImageData(pixels,0,0);return new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.84));
}
function exportProfile(){if(!me)return;const p=stored()||me;const data={format:'solvi-profile-v1',id:p.id,name:p.name,email:p.email,bio:p.bio,links:p.links,recovery:p.recovery||null};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='solvi-profile-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
 $('profileStatus').textContent='Backup contains your recovery key. Keep it private.';
}
async function importProfile(file){try{const data=JSON.parse(await file.text());if(data.format!=='solvi-profile-v1'||!data.name)throw Error('Invalid SOLVI profile file');
  me=null;auth=null;saveLocal(data);fillProfile(data);$('profileStatus').textContent='Profile loaded. Select Save / Sign in to claim this session.';
  show('profileBackdrop',true);
 }catch(e){$('profileStatus').textContent=e.message;}}
async function adminLogin(){try{const data=await api.req('/api/admin/login',{method:'POST',body:JSON.stringify({password:$('adminPassword').value})});adminToken=data.token;$('adminPassword').value='';await stats();}
 catch(e){$('adminStats').textContent=e.message;}}
async function stats(){if(!adminToken)return;try{const data=await api.req('/api/admin/stats',{headers:{'X-Solvi-Admin':adminToken}});$('adminStats').textContent=JSON.stringify(data,null,2);}catch(e){$('adminStats').textContent=e.message;}}
function bindUI(world){
 const editor=new SceneEditor(world,toast);window.addEventListener('solvi:scene-ready',()=>editor.load());
 window.addEventListener('solvi:scene-changed',()=>toast('Scene updated by another user — select Objects → Load to refresh'));
 window.addEventListener('solvi:chat-updated',async()=>{if(!online||!auth)return;try{const data=await api.req('/api/messages');$('chatFeed').replaceChildren();for(const row of data.messages||[])await bubble(row);}catch{}});
 $('chatButton').onclick=()=>show('chatPanel',$('chatPanel').hidden);$('closeChat').onclick=()=>show('chatPanel',false);
 $('profileButton').onclick=()=>{fillProfile(me||stored());show('profileBackdrop',true);};
 $('closeProfile').onclick=()=>{if(me)show('profileBackdrop',false);else toast('Enter a name to start');};
 $('saveProfile').onclick=submitProfile;$('exportProfile').onclick=exportProfile;
 $('importProfile').onchange=e=>importProfile(e.target.files[0]);
 $('avatarUpload').onchange=async e=>{try{const m=await uploadFile(e.target.files[0]);$('profileStatus').textContent='Uploaded '+m.name;
 if(me){const data=await api.req('/api/profile',{method:'PUT',body:JSON.stringify({...profileFields(),avatar:m.id})});me=data.user;saveLocal({...stored(),...me});}}catch(e){toast(e.message);}};
 $('takeAvatarPhoto').onclick=cameraAvatar;$('recordIntro').onclick=()=>startRecording(true,true);
 $('sendChat').onclick=send;$('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
 $('chatFile').onchange=e=>attach(e.target.files[0]);$('recordAudio').onclick=()=>startRecording(false);
 $('recordVideo').onclick=()=>startRecording(true);
 $('robotVision').onclick=async()=>{try{const img=await robotView(world);await attach(new File([img],`robot-vision-${Date.now()}.jpg`,{type:'image/jpeg'}));show('chatPanel',true);$('chatInput').value='What does the robot see? Describe the surrounding objects and their positions.';}catch(e){toast(e.message);}};
 $('adminButton').onclick=()=>show('adminBackdrop',true);$('closeAdmin').onclick=()=>show('adminBackdrop',false);
 $('adminLogin').onclick=adminLogin;$('adminRefresh').onclick=stats;
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){show('addMenu',false);show('adminBackdrop',false);if(me)show('profileBackdrop',false);}});
 begin();
}
export function initStudio(world){bindUI(world);}
