// Smart displays and media frames share a saved multi-channel UI and browser-side HLS playback.
// No arbitrary URL proxy: each remote media host must permit CORS to https://solvi.help.
import * as THREE from 'three';
const states=new WeakMap();
let hlsPromise;
export const SMART_DEFAULTS=Object.freeze({smartAudio:true,smartMuted:false,smartLoop:false,smartAutoPlay:false,smartStartChannel:-1,smartPreserveAspect:true});
export function cleanSmartOptions(value={}){
 const v=value||{};return {
  smartAudio:v.smartAudio!==false,smartMuted:v.smartMuted===true,
  smartLoop:v.smartLoop===true,smartAutoPlay:v.smartAutoPlay===true,
  smartStartChannel:Number.isInteger(v.smartStartChannel)&&v.smartStartChannel>=-1&&v.smartStartChannel<12?v.smartStartChannel:-1,
  smartPreserveAspect:v.smartPreserveAspect!==false
 };
}
export function safeChannelUrl(raw){
 try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&/\.(?:m3u8|mp4|webm)$/i.test(u.pathname)&&raw.length<=1500;}catch{return false;}
}
export function safeIPTVPlaylistURL(raw){
 try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&/\.m3u$/i.test(u.pathname)&&raw.length<=1500;}catch{return false;}
}
export function cleanChannels(value){
 if(!Array.isArray(value))return [];
 return value.slice(0,12).filter(x=>x&&typeof x==='object').map(x=>({title:String(x.title||'Channel').slice(0,65),url:String(x.url||'').trim()})).filter(x=>safeChannelUrl(x.url));
}
export function parseChannel(text){const url=String(text||'').trim();if(!safeChannelUrl(url))return null;return {url,title:new URL(url).hostname.slice(0,55)};}
export function parseIPTVPlaylist(text,max=4000){
 const lines=String(text||'').split(/\r?\n/),items=[];let meta=null;
 for(const line of lines){const row=line.trim();if(row.startsWith('#EXTINF:')){
  const match=row.match(/tvg-name="([^"]{1,90})"/i);const group=row.match(/group-title="([^"]{1,80})"/i);
  meta={title:(match?.[1]||row.split(',').slice(1).join(',')||'IPTV channel').slice(0,65),group:(group?.[1]||'Other').slice(0,80)};
 }else if(row&&!row.startsWith('#')){if(meta&&safeChannelUrl(row))items.push({...meta,url:row});meta=null;if(items.length>=max)break;}}
 return items;
}
export async function fetchIPTVPlaylist(url,{signal}={}){
 if(!safeIPTVPlaylistURL(url))throw new Error('Use an HTTPS IPTV playlist ending in .m3u');
 const res=await fetch(url,{mode:'cors',credentials:'omit',signal});if(!res.ok)throw new Error('IPTV playlist HTTP '+res.status);
 const limit=12*1024*1024,declared=Number(res.headers.get('content-length'));if(declared>limit)throw new Error('Playlist too large; choose a smaller category or country playlist');
 let text='';if(res.body?.getReader){const reader=res.body.getReader(),decoder=new TextDecoder();let bytes=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>limit){await reader.cancel();throw new Error('IPTV playlist too large; use a country/category list');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}
 }else{text=await res.text();if(text.length>limit)throw new Error('IPTV playlist too large');}
 const entries=parseIPTVPlaylist(text);if(!entries.length)throw new Error('No browser-compatible HTTPS HLS/MP4/WebM channels found');return entries;
}
export async function hlsLibrary(){
 if(globalThis.Hls?.isSupported?.())return globalThis.Hls;
 if(!hlsPromise)hlsPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.async=true;script.src='./vendor/hls/hls.min.js';
  script.onload=()=>globalThis.Hls?.isSupported?.()?resolve(globalThis.Hls):reject(Error('HLS not supported'));
  script.onerror=()=>reject(Error('HLS.js could not load'));document.head.append(script);
 }).catch(e=>{hlsPromise=null;throw e;});return hlsPromise;
}
function screenMaterial(s){return Array.isArray(s.screen?.material)?s.screen.material[4]:s.screen?.material;}
function showMaterial(s,map){const mat=screenMaterial(s);if(mat){mat.map=map;mat.color?.set('#ffffff');mat.needsUpdate=true;}}
function drawingRatio(s){s.screen.geometry?.computeBoundingBox?.();const box=s.screen.geometry?.boundingBox;
 return Math.max(.25,Math.min(5,(box?.max.x-box?.min.x||16)/(box?.max.y-box?.min.y||9)));}
function disposeSource(s){const old=s.video;s.video=null;s.hls?.destroy();s.hls=null;if(old){old.pause();old.removeAttribute('src');old.load();}s.videoTexture?.dispose();s.videoTexture=null;s.frameCanvas=null;}
function drawMenu(s){const c=document.createElement('canvas');c.width=768;c.height=432;const ctx=c.getContext('2d');ctx.fillStyle='#0b1421';ctx.fillRect(0,0,768,432);
 ctx.fillStyle='#eff5ff';ctx.font='bold 33px system-ui';ctx.fillText('SOLVI · Media',38,59);
 ctx.font='18px system-ui';ctx.fillStyle='#a3b5cb';const list=s.channels.slice(0,12);ctx.fillText(list.length?'Choose a channel':'Add an HTTPS media URL in Properties',38,91);
 for(let i=0;i<list.length;i++){const col=i%3,row=Math.floor(i/3),x=24+col*247,y=115+row*75;ctx.fillStyle='#203549';ctx.beginPath();ctx.roundRect(x,y,233,63,11);ctx.fill();
  ctx.fillStyle='#88d1f4';ctx.font='bold 19px system-ui';ctx.fillText(String(i+1).padStart(2,'0'),x+13,y+35);
  ctx.fillStyle='#fff';ctx.font='17px system-ui';const label=list[i].title||'Channel';ctx.fillText(label.length>17?label.slice(0,16)+'…':label,x+49,y+35);}
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;}
function buttonPlane(s,kind){const canvas=document.createElement('canvas');canvas.width=160;canvas.height=88;const ctx=canvas.getContext('2d');
 const texture=new THREE.CanvasTexture(canvas),material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,transparent:true,opacity:.95,depthTest:true});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.19,.11),material);mesh.name=kind==='back'?'smartScreenBack':'smartScreenAudio';mesh.userData[kind==='back'?'smartScreenBack':'smartScreenAudio']=true;
 s.screen.geometry?.computeBoundingBox?.();const b=s.screen.geometry?.boundingBox;
 mesh.position.set(kind==='back'?(b?.min.x||-.5)+.12:(b?.max.x||.5)-.12,(b?.max.y||.5)-.07,(b?.max.z||0)+.015);
 s.screen.add(mesh);s.buttons.push(mesh);return {mesh,ctx,texture};}
function renderButton(btn,s,kind){const {ctx,texture}=btn;ctx.clearRect(0,0,160,88);ctx.fillStyle='#172c43';ctx.fillRect(0,0,160,88);ctx.fillStyle='#fff';
 if(kind==='back'){ctx.font='bold 44px system-ui';ctx.fillText('‹',15,61);ctx.font='21px system-ui';ctx.fillText('Menu',62,55);}
 else {const muted=s.video?.muted||!s.options.smartAudio;
  // Small vector speaker icon, consistent with the media toolbar rather than text glyphs.
  ctx.beginPath();ctx.moveTo(14,36);ctx.lineTo(31,36);ctx.lineTo(48,20);ctx.lineTo(48,70);ctx.lineTo(31,53);ctx.lineTo(14,53);ctx.closePath();ctx.fill();
  ctx.lineWidth=5;ctx.lineCap='round';ctx.strokeStyle='#fff';
  if(muted){ctx.beginPath();ctx.moveTo(57,33);ctx.lineTo(78,55);ctx.moveTo(78,33);ctx.lineTo(57,55);ctx.stroke();}
  else{ctx.beginPath();ctx.arc(46,44,18,-.75,.75);ctx.stroke();ctx.beginPath();ctx.arc(46,44,29,-.75,.75);ctx.stroke();}
  ctx.font='19px system-ui';ctx.fillText(muted?'Muted':'Sound',91,54);}
 texture.needsUpdate=true;}
function updateButton(s){if(s.audioButton)renderButton(s.audioButton,s,'audio');}
export function disposeSmartScreen(root){const s=states.get(root);if(!s)return;states.delete(root);disposeSource(s);const mat=screenMaterial(s);if(mat){mat.map=null;mat.needsUpdate=true;}s.menuTexture.dispose();for(const btn of s.buttons){btn.removeFromParent();btn.geometry.dispose();btn.material.map?.dispose();btn.material.dispose();}}
export function syncSmartScreen(root,screen,channels,showEmpty=false,options={}){
 const list=cleanChannels(channels),cfg=cleanSmartOptions(options),signature=JSON.stringify([list,cfg]),prior=states.get(root);
 if(prior?.screen===screen&&prior.signature===signature)return true;
 disposeSmartScreen(root);if(!screen||(!list.length&&!showEmpty))return false;
 const s={root,screen,channels:list,options:cfg,signature,mode:'menu',hls:null,video:null,videoTexture:null,frameCanvas:null,menuTexture:null,buttons:[]};states.set(root,s);
 s.menuTexture=drawMenu(s);showMaterial(s,s.menuTexture);
 s.backButton=buttonPlane(s,'back');renderButton(s.backButton,s,'back');s.backButton.mesh.visible=false;
 s.audioButton=buttonPlane(s,'audio');updateButton(s);s.audioButton.mesh.visible=false;
 if(cfg.smartAutoPlay&&cfg.smartStartChannel>=0&&cfg.smartStartChannel<list.length)void openSmartChannel(root,cfg.smartStartChannel,true);
 return true;
}
function createVideoTexture(s,v){if(!s.options.smartPreserveAspect){const tex=new THREE.VideoTexture(v);tex.colorSpace=THREE.SRGBColorSpace;return tex;}
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=Math.round(768/drawingRatio(s));const ctx=canvas.getContext('2d');
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;s.frameCanvas=canvas;
 const draw=()=>{if(states.get(s.root)!==s||s.video!==v||!s.frameCanvas)return;
  if(v.readyState>=2&&v.videoWidth&&v.videoHeight){const w=canvas.width,h=canvas.height,ratio=Math.min(w/v.videoWidth,h/v.videoHeight),dw=v.videoWidth*ratio,dh=v.videoHeight*ratio;ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);ctx.drawImage(v,(w-dw)/2,(h-dh)/2,dw,dh);texture.needsUpdate=true;}
  if('requestVideoFrameCallback' in v)v.requestVideoFrameCallback(draw);else requestAnimationFrame(draw);
 };v.addEventListener('loadeddata',draw,{once:true});return texture;
}
export async function openSmartChannel(root,index,automatic=false){
 const s=states.get(root);if(!s||!Number.isInteger(index)||index<0||index>=s.channels.length)return false;
 disposeSource(s);s.mode='loading';const channel=s.channels[index],v=document.createElement('video');
 v.crossOrigin='anonymous';v.playsInline=true;v.muted=automatic||s.options.smartMuted||!s.options.smartAudio;
 v.loop=s.options.smartLoop;v.preload='auto';s.video=v;s.currentChannel=index;
 s.backButton.mesh.visible=true;s.audioButton.mesh.visible=true;updateButton(s);
 v.addEventListener('ended',()=>{if(states.get(root)===s&&!s.options.smartLoop)backToSmartMenu(root);});
 v.addEventListener('error',()=>{if(states.get(root)===s)console.warn('Smart screen playback error (CORS/codec/source)',channel.url,v.error);});
 try{
  if(/\.m3u8(?:$|[?#])/i.test(channel.url)){
   if(v.canPlayType('application/vnd.apple.mpegurl'))v.src=channel.url;
   else{const Hls=await hlsLibrary();if(states.get(root)!==s||s.video!==v)return false;s.hls=new Hls({enableWorker:true});s.hls.loadSource(channel.url);s.hls.attachMedia(v);}
  }else v.src=channel.url;
  if(states.get(root)!==s||s.video!==v)return false;
  s.videoTexture=createVideoTexture(s,v);showMaterial(s,s.videoTexture);s.mode='video';
  await v.play();return true;
 }catch(e){console.warn('Smart screen playback failed; check user activation, CORS and codecs',channel.url,e);
  if(states.get(root)===s){backToSmartMenu(root);}return false;}
}
export function backToSmartMenu(root){const s=states.get(root);if(!s)return false;disposeSource(s);s.mode='menu';s.currentChannel=-1;s.backButton.mesh.visible=false;s.audioButton.mesh.visible=false;showMaterial(s,s.menuTexture);return true;}
export function toggleSmartScreenAudio(root){const s=states.get(root);if(!s?.video)return false;
 if(!s.options.smartAudio){s.video.muted=true;updateButton(s);return false;}
 s.video.muted=!s.video.muted;updateButton(s);if(s.video.paused)s.video.play().catch(()=>{});return true;
}
export function smartScreenClick(root,hit){const s=states.get(root);if(!s)return false;
 if(hit?.object?.userData?.smartScreenBack){backToSmartMenu(root);return true;}
 if(hit?.object?.userData?.smartScreenAudio){toggleSmartScreenAudio(root);return true;}
 if(s.mode==='video'){const uv=hit?.uv;if(uv&&uv.x<.22&&uv.y>.77)backToSmartMenu(root);
  else if(uv&&uv.x>.78&&uv.y>.77)toggleSmartScreenAudio(root);
  else if(s.video){s.video.paused?s.video.play().catch(()=>{}):s.video.pause();}return true;}
 if(s.mode!=='menu'||!hit?.uv)return true;
 const x=hit.uv.x*768,y=(1-hit.uv.y)*432;if(x<24||y<115)return true;
 const col=Math.floor((x-24)/247),row=Math.floor((y-115)/75),index=row*3+col;
 if(col>=0&&col<3&&row>=0&&row<4&&index<s.channels.length&&x-(24+col*247)<233&&y-(115+row*75)<63)void openSmartChannel(root,index);
 return true;
}
