import * as THREE from 'three';
import {SceneEditor} from './editor.js';
import {captureRobotView} from './robots.js';
import {readPreferences,updatePreferences,applyPreferences,themePalette,THEME_PRESETS,exportRoomTranscript,shouldGroupMessages} from './preferences.js';
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
let cachedMessages=[],chatSignature='',lastBubbleEntry=null;const initialRoomLoads=new Set();
let activeRoom=sessionStorage.getItem('solvi-room')||'main';window.solviRoom=activeRoom;let sessionPrompt=false;
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
 if(!p?.name){$('profileBackdrop').classList.remove('profile-drawer-mode');show('profileBackdrop',true);$('profileName').focus();return;}
 if(!online){me=p;show('profileBackdrop',false);show('chatPanel',true);identity();window.dispatchEvent(new CustomEvent('solvi:scene-ready'));return;}
 if(p.token){auth={token:p.token};try{const out=await api.req('/api/me');me=out.user;identity();await afterLogin();return;}catch(e){toast(e.message);}}
 $('profileBackdrop').classList.remove('profile-drawer-mode');show('profileBackdrop',true);$('profileStatus').textContent='Reconnect or take over this profile to continue.';
}
function identity(){const text=me?.name||'Guest';$('profileButton').textContent=text.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'?';$('profileButton').title='Profile · '+text;
 $('profileIdentity').textContent=me?.id||'Local demo profile';$('composerName').textContent=text;}
async function afterLogin(){sessionPrompt=false;show('profileBackdrop',false);show('chatPanel',true);identity();establishTabChannel(me.id);window.dispatchEvent(new CustomEvent('solvi:authenticated'));
 try{const data=await api.req('/api/models');modelIds=data.models||[];const select=$('modelSelect');select.replaceChildren();
  select.add(new Option('World chat · people',''));
  for(const id of modelIds)select.add(new Option('AI · '+id,id));
  select.value=modelIds.includes('muse-spark-1.3')?'muse-spark-1.3':'';select.disabled=false;
  if(!modelIds.length)$('chatStatus').textContent=data.note||'Human chat available. AI key not configured.';}catch(e){$('modelSelect').replaceChildren(new Option('Model catalog unavailable',''));toast(e.message);}
 await configureRooms();await loadMessages();
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
 const group=wrap&&shouldGroupMessages(previous,entry,readPreferences().group)&&wrap.classList.contains(mine?'mine':'theirs');
 if(!group){
  wrap=document.createElement('article');wrap.className='chat-row '+(mine?'mine':'theirs');
  wrap.dataset.messageId=entry.id||'';
  wrap.addEventListener('wheel',event=>{event.preventDefault();feed.scrollTop+=event.deltaY;},{passive:false});
  const pic=document.createElement('span');pic.className='chat-avatar';pic.textContent=role==='assistant'?'AI':(entry.speaker||me?.name||'?').slice(0,2).toUpperCase();
  panel=document.createElement('div');panel.className='chat-bubble';const meta=document.createElement('div');meta.className='chat-meta';
  const name=document.createElement('strong');name.textContent=role==='assistant'?(entry.model||'Meta Model API'):(entry.speaker||me?.name||'Guest');
  const date=document.createElement('time');date.textContent=safeTime(entry.created);meta.append(name,date);panel.append(meta);
  if(entry.avatar&&online&&auth){api.mediaBlob(entry.avatar).then(url=>{pic.textContent='';const img=document.createElement('img');img.src=url;img.alt='';img.className='chat-profile-image';pic.append(img);}).catch(()=>{});}
  wrap.append(pic,panel);feed.append(wrap);
 }else{panel.querySelector('time').textContent=safeTime(entry.created);}
 const content=document.createElement('div');content.className='chat-body chat-message-item';content.dataset.messageId=entry.id||'';content.textContent=entry.text||'';panel.append(content);
 let mids=[];try{mids=typeof entry.media==='string'?JSON.parse(entry.media):entry.media||[];}catch{}
 for(const id of mids){const slot=document.createElement('div');slot.className='chat-attachment';slot.textContent='Attachment';panel.append(slot);
  if(online&&auth){api.mediaBlobInfo(id).then(({url,mime})=>{const el=document.createElement(mime.startsWith('video/')?'video':mime.startsWith('audio/')?'audio':'img');el.src=url;if(el.tagName==='IMG'){el.alt='Image attachment';el.loading='lazy';}else{el.controls=true;el.preload='metadata';}el.onerror=()=>{slot.textContent='Media attachment';URL.revokeObjectURL(url);};slot.replaceChildren(el);}).catch(()=>{});}}
 lastBubbleEntry=entry;feed.scrollTop=feed.scrollHeight;
}
async function uploadFile(file){if(!online||!auth)throw Error('Enable the Flask backend to store media');if(file.size>11_000_000)throw Error('File must be under 11 MB');
 const body=new FormData();body.append('file',file,file.name);const response=await api.req('/api/media',{method:'POST',body});return response.media;}
function updatePending(){const p=$('pendingMedia');p.replaceChildren();for(const m of pending){const badge=document.createElement('button');badge.textContent=`${m.name} ×`;badge.title='Remove attachment';badge.onclick=()=>{pending=pending.filter(x=>x!==m);updatePending();};p.append(badge);}}
async function attach(file){if(!file)return;try{const media=await uploadFile(file);pending.push(media);pending=pending.slice(-3);updatePending();toast('Attachment ready');}catch(e){toast(e.message);}}
async function send(){const text=$('chatInput').value.trim();if(!text&&!pending.length)return;if(!me){show('profileBackdrop',true);return;}
 if(online&&!auth){needSignIn('Sign in before sending messages.');return;}
 const ids=pending.map(x=>x.id);
 if(!online){await bubble({role:'user',text,speaker:me.name,user_id:me.id,created:new Date().toISOString()});toast('Local demo only. AI requires backend and MODEL_API_KEY.');return;}
 const useAI=!!$('modelSelect').value;
 $('sendChat').disabled=true;$('chatStatus').textContent='Model processing…';
 try{const response=await api.req(useAI?'/api/chat':'/api/message',{method:'POST',body:JSON.stringify({room:activeRoom,text,model:$('modelSelect').value,media:ids})});
  $('chatInput').value='';pending=[];updatePending();playCue('sent');await bubble(response.message);if(response.answer)await bubble(response.answer);$('chatStatus').textContent=response.answer?`${response.answer.model} · ${response.latency_ms} ms`:'Delivered to world chat';
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
async function cameraAvatar(){try{const stream=await navigator.mediaDevices.getUserMedia({video:true});const video=document.createElement('video');video.srcObject=stream;video.muted=true;await video.play();await new Promise(r=>setTimeout(r,400));
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;canvas.getContext('2d').drawImage(video,0,0,256,256);stream.getTracks().forEach(t=>t.stop());const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.85));
 const media=await uploadFile(new File([blob],'avatar.jpg',{type:'image/jpeg'}));
 if(me){const data=await api.req('/api/profile',{method:'PUT',body:JSON.stringify({...profileFields(),avatar:media.id})});me=data.user;saveLocal({...stored(),...me});}
 $('profileStatus').textContent='Profile photo saved.';
 }catch(e){$('profileStatus').textContent=e.message;}}
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
  me=null;auth=null;saveLocal(data);fillProfile(data);$('profileStatus').textContent='Profile loaded. Select Save / Sign in to claim this session.';
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
   feed.scrollTop=feed.scrollHeight;
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
   activeRoom=select.value;window.solviRoom=activeRoom;sessionStorage.setItem('solvi-room',activeRoom);
   $('roomChatTitle').textContent=select.selectedOptions[0]?.textContent+' · messages';
   chatSignature='';cachedMessages=[];lastBubbleEntry=null;$('chatFeed').replaceChildren();playCue('leave');
   window.dispatchEvent(new CustomEvent('solvi:room-changed',{detail:{room:activeRoom}}));
 };
}
function configureDragging(){
 for(const id of ['scenePanel','propertiesPanel','addMenu','chatPanel']){
  const panel=$(id),handle=panel?.querySelector('.drag-handle');if(!panel||!handle)continue;
  let delta=null;
  handle.addEventListener('pointerdown',event=>{
    if(event.target.closest('button,input'))return;
    const rect=panel.getBoundingClientRect();delta={x:event.clientX-rect.left,y:event.clientY-rect.top};
    handle.setPointerCapture(event.pointerId);event.preventDefault();
  });
  handle.addEventListener('pointermove',event=>{if(!delta)return;
    if(id==='chatPanel'&&!panel.classList.contains('windowed'))return;
    const x=Math.max(4,Math.min(innerWidth-panel.offsetWidth-4,event.clientX-delta.x));
    const y=Math.max(55,Math.min(innerHeight-90,event.clientY-delta.y));
    if(id==='chatPanel'){panel.style.setProperty('--chat-left',x+'px');panel.style.setProperty('--chat-top',y+'px');}
    else{panel.style.left=x+'px';panel.style.top=y+'px';panel.style.right='auto';panel.style.bottom='auto';}
  });
  const release=()=>delta=null;handle.addEventListener('pointerup',release);handle.addEventListener('pointercancel',release);
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
  for(const [id,key] of [['bubbleBackgrounds','backgrounds'],['bubbleBorders','borders'],['groupMessages','group'],['soundEffects','sounds'],['flipHead','flipHead']])$(id).checked=!!p[key];
 }
 paint(current);
 $('settingsButton').onclick=()=>{settings.hidden=false;show('profileBackdrop',false);};
 $('closeSettings').onclick=()=>{settings.hidden=true;};
 settings.addEventListener('pointerdown',e=>{if(e.target===settings)settings.hidden=true;});
 const apply=(patch)=>{const prefs=updatePreferences(patch);paint(prefs);if('group' in patch){chatSignature='';loadMessages();}};
 $('accentColor').oninput=e=>apply({accent:e.target.value});
 $('interfaceTheme').onchange=e=>{const key=e.target.value;const theme=THEME_PRESETS[key];apply({theme:key,accent:theme.accent});};
 $('bubbleOpacity').oninput=e=>apply({opacity:Number(e.target.value)});
 for(const [id,key] of [['bubbleBackgrounds','backgrounds'],['bubbleBorders','borders'],['groupMessages','group'],['soundEffects','sounds'],['flipHead','flipHead']])$(id).onchange=e=>apply({[key]:e.target.checked});
 const colors=['#79cde5','#e7b073','#a5db91','#d9a0d7','#a0b5f5','#f3a1a1'];
 function swatches(){const grid=$('themeSwatches');grid.replaceChildren();for(const color of colors){const b=document.createElement('button');b.className='theme-swatch';b.title='Apply '+color;b.style.background=color;b.onclick=()=>apply({accent:color});grid.append(b);}}
 swatches();$('generateTheme').onclick=()=>{const color=themePalette(Math.floor(Math.random()*10000));colors[colors.length-1]=color;swatches();apply({accent:color});};
 $('exportChatButton').onclick=()=>exportMessages('json');$('exportChatSettings').onclick=()=>exportMessages('md');
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
    feed.scrollTop=feed.scrollHeight;
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
  for(const name of ['pointerup','pointercancel'])grip.addEventListener(name,()=>start=null);

  const mobileTools=$('composerToolsButton');
  mobileTools.onclick=()=>{
    const expanded=composer.classList.toggle('tools-open');
    mobileTools.setAttribute('aria-expanded',String(expanded));
  };
  const mobileNav=$('mobileMenuButton'),nav=$('toolNav');
  mobileNav.onclick=()=>{
    const expanded=nav.classList.toggle('nav-expanded');mobileNav.setAttribute('aria-expanded',String(expanded));
  };
  // Multiline by default: Enter sends, Shift+Enter inserts a newline.
  const input=$('chatInput');
  const resize=()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,118)+'px';};
  input.addEventListener('input',resize);resize();
}
function bindUI(world){
 const editor=new SceneEditor(world,toast);window.addEventListener('solvi:scene-ready',()=>editor.load());
 window.addEventListener('solvi:room-changed',async()=>{await loadMessages();editor.revision=0;editor.apply([]);await editor.load();});
 window.addEventListener('solvi:scene-changed',e=>editor.acceptRemoteRevision(e.detail));
 window.addEventListener('solvi:chat-updated',loadMessages);
 $('chatButton').onclick=()=>{show('chatPanel',$('chatPanel').hidden);document.body.classList.remove('chat-muted');$('messagesToggleButton').setAttribute('aria-pressed','true');};$('closeChat').onclick=()=>show('chatPanel',false);
 $('profileButton').onclick=()=>{fillProfile(me||stored());$('profileBackdrop').classList.toggle('profile-drawer-mode',!!me);$('profilePanelTitle').textContent=me?'Your profile':'Sign in';show('profileBackdrop',true);$('settingsDrawer').hidden=true;};
 $('closeProfile').onclick=()=>{if(me&&auth)show('profileBackdrop',false);else{$('profileStatus').textContent='Sign in to continue.';$('profileName').focus();}};
 $('saveProfile').onclick=submitProfile;$('exportProfile').onclick=exportProfile;
 $('importProfile').onchange=e=>importProfile(e.target.files[0]);
 $('avatarUpload').onchange=async e=>{try{const m=await uploadFile(e.target.files[0]);$('profileStatus').textContent='Uploaded '+m.name;
 if(me){const data=await api.req('/api/profile',{method:'PUT',body:JSON.stringify({...profileFields(),avatar:m.id})});me=data.user;saveLocal({...stored(),...me});}}catch(e){toast(e.message);}};
 $('takeAvatarPhoto').onclick=cameraAvatar;$('recordIntro').onclick=()=>startRecording(true,true);
 window.solviPublishCaption=async text=>{
   if(!me||!text?.trim())return;
   const caption='CC: '+text.trim().slice(0,500);
   if(!online||!auth){if(online&&!auth){needSignIn('Sign in to send captions.');return;}await bubble({role:'user',text:caption,speaker:me.name,user_id:me.id,created:new Date().toISOString()});return;}
   try{const response=await api.req('/api/message',{method:'POST',body:JSON.stringify({room:activeRoom,text:caption,media:[]})});await bubble(response.message);}
   catch(error){toast('Captions not sent: '+error.message);throw error;}
 };
 $('sendChat').onclick=send;$('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
 $('chatFile').onchange=e=>attach(e.target.files[0]);$('recordAudio').onclick=()=>startRecording(false);
 $('recordVideo').onclick=()=>startRecording(true);
 $('robotVision').onclick=async()=>{try{const img=await robotView(world);await attach(new File([img],`robot-vision-${Date.now()}.jpg`,{type:'image/jpeg'}));show('chatPanel',true);$('chatInput').value='What does the robot see? Describe the surrounding objects and their positions.';}catch(e){toast(e.message);}};
 $('adminButton').onclick=()=>show('adminBackdrop',true);$('closeAdmin').onclick=()=>show('adminBackdrop',false);
 $('adminLogin').onclick=adminLogin;$('adminRefresh').onclick=stats;
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){show('addMenu',false);show('adminBackdrop',false);if(me)show('profileBackdrop',false);}});
 window.addEventListener('solvi:auth-required',event=>needSignIn(event.detail?.reason||'Session expired.'));
 window.addEventListener('solvi:presence-change',event=>{if(event.detail.id!==me?.id)playCue(event.detail.action==='left'?'leave':'join');});
 document.addEventListener('pointerdown',primeAudio,{once:true});
 setupChatPresentation();setupSettings();setupNewRoom();configureRooms();configureDragging();begin();
 setInterval(async()=>{if(online&&auth){try{await api.req('/api/me');}catch{ /* expiry handler opens sign-in */ }}},45000);
}
export function initStudio(world){bindUI(world);}
