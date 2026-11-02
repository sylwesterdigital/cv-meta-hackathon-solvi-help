// Shared local, browser-side media gallery for procedural displays and video frames.
// No server-side fetching or proxying of arbitrary URLs. HLS requires stream CORS.
import * as THREE from 'three';
const states=new WeakMap();
let hlsPromise;
export function cleanChannels(value){
 if(!Array.isArray(value))return [];
 return value.slice(0,12).filter(x=>x&&typeof x==='object').map(x=>({title:String(x.title||'Channel').slice(0,65),url:String(x.url||'').trim()})).filter(x=>safeChannelUrl(x.url));
}
export function safeChannelUrl(raw){
 try{const u=new URL(raw);return u.protocol==='https:'&&u.username===''&&u.password===''&&/\.(?:m3u8|mp4|webm)(?:$|[?#])/i.test(u.pathname+u.search+u.hash)&&raw.length<=1500;}catch{return false;}
}
export function parseChannel(text){const url=String(text||'').trim();if(!safeChannelUrl(url))return null;const u=new URL(url);return {url,title:u.hostname.slice(0,55)};}
async function hlsLibrary(){
 if(globalThis.Hls?.isSupported?.())return globalThis.Hls;
 if(!hlsPromise)hlsPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.async=true;script.src='./vendor/hls/hls.min.js';
  script.onload=()=>globalThis.Hls?.isSupported?.()?resolve(globalThis.Hls):reject(Error('HLS not supported'));
  script.onerror=()=>reject(Error('HLS.js could not load'));document.head.append(script);
 }).catch(e=>{hlsPromise=null;throw e;});
 return hlsPromise;
}
function disposeSource(s){s.hls?.destroy();s.hls=null;if(s.video){s.video.pause();s.video.removeAttribute('src');s.video.load();s.video=null;}s.videoTexture?.dispose();s.videoTexture=null;}
function drawMenu(s){
 const c=document.createElement('canvas');c.width=768;c.height=432;
 const ctx=c.getContext('2d');ctx.fillStyle='#0b1421';ctx.fillRect(0,0,768,432);
 ctx.fillStyle='#eff5ff';ctx.font='bold 33px system-ui';ctx.fillText('SOLVI · Media',38,59);
 ctx.font='18px system-ui';ctx.fillStyle='#a3b5cb';const list=s.channels.slice(0,12);ctx.fillText(list.length?'Choose a channel':'Add an HTTPS video / HLS URL in Properties',38,91);
 for(let i=0;i<list.length;i++){
  const col=i%3,row=Math.floor(i/3),x=24+col*247,y=115+row*75;
  ctx.fillStyle='#203549';ctx.beginPath();ctx.roundRect(x,y,233,63,11);ctx.fill();
  ctx.fillStyle='#88d1f4';ctx.font='bold 19px system-ui';ctx.fillText(String(i+1).padStart(2,'0'),x+13,y+35);
  ctx.fillStyle='#fff';ctx.font='17px system-ui';const label=list[i].title||'Channel';ctx.fillText(label.length>17?label.slice(0,16)+'…':label,x+49,y+35);
 }
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
function showMaterial(s,map){const mat=Array.isArray(s.screen?.material)?s.screen.material[4]:s.screen?.material;if(mat){mat.map=map;mat.color?.set('#ffffff');mat.needsUpdate=true;}}
export function disposeSmartScreen(root){const s=states.get(root);if(!s)return;states.delete(root);disposeSource(s);const material=Array.isArray(s.screen.material)?s.screen.material[4]:s.screen.material;if(material&&(material.map===s.menuTexture||material.map===oldVideoTexture)){material.map=null;material.needsUpdate=true;}s.menuTexture.dispose();if(s.backMesh){s.backMesh.removeFromParent();s.backMesh.geometry.dispose();s.backMesh.material.map?.dispose();s.backMesh.material.dispose();}}
export function syncSmartScreen(root,screen,channels,showEmpty=false){
 const list=cleanChannels(channels);const signature=JSON.stringify(list),prior=states.get(root);
 if(prior?.screen===screen&&prior.signature===signature)return Boolean(prior);
 disposeSmartScreen(root);if(!screen||(!list.length&&!showEmpty))return false;
 const s={root,screen,channels:list,signature,mode:'menu',hls:null,video:null,videoTexture:null,menuTexture:null,backMesh:null};states.set(root,s);
 s.menuTexture=drawMenu(s);showMaterial(s,s.menuTexture);
 // Back button is a small persistent overlay on the actual screen plane.
 const backGeo=new THREE.PlaneGeometry(.19,.11);const canvas=document.createElement('canvas');canvas.width=160;canvas.height=88;const ctx=canvas.getContext('2d');ctx.fillStyle='#172c43';ctx.fillRect(0,0,160,88);ctx.fillStyle='#ffffff';ctx.font='bold 46px system-ui';ctx.fillText('‹',17,62);ctx.font='21px system-ui';ctx.fillText('Menu',63,54);const backMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),side:THREE.DoubleSide,transparent:true,opacity:.95});
 const back=new THREE.Mesh(backGeo,backMat);back.name='smartScreenBack';back.userData.smartScreenBack=true;
 // Can be clicked in-world even when video uses the rest of the screen.
 screen.geometry?.computeBoundingBox?.();const b=screen.geometry?.boundingBox;back.position.set((b?.min.x||-.5)+.12,(b?.max.y||.5)-.07,(b?.max.z||0)+.015);back.visible=false;screen.add(back);s.backMesh=back;
 return true;
}
export async function openSmartChannel(root,index){
 const s=states.get(root);if(!s||!Number.isInteger(index)||index<0||index>=s.channels.length)return false;
 disposeSource(s);s.mode='loading';const channel=s.channels[index],v=document.createElement('video');
 v.crossOrigin='anonymous';v.playsInline=true;v.muted=true;v.loop=!channel.url.includes('.m3u8');v.preload='auto';s.video=v;
 s.backMesh.visible=true;
 try{
  if(/\.m3u8(?:$|[?#])/i.test(channel.url)){
   if(v.canPlayType('application/vnd.apple.mpegurl'))v.src=channel.url;
   else {const Hls=await hlsLibrary();if(states.get(root)!==s||s.video!==v)return false;s.hls=new Hls({enableWorker:true});s.hls.loadSource(channel.url);s.hls.attachMedia(v);}
  }else v.src=channel.url;
  if(states.get(root)!==s||s.video!==v)return false;
  s.videoTexture=new THREE.VideoTexture(v);s.videoTexture.colorSpace=THREE.SRGBColorSpace;
  showMaterial(s,s.videoTexture);s.mode='video';
  v.addEventListener('error',()=>{if(states.get(root)===s)console.warn('Smart screen playback failed (codec or CORS)',channel.url,v.error);});
  await v.play();return true;
 }catch(e){console.warn('Smart screen stream unavailable (check CORS and browser codecs):',channel.url,e);if(states.get(root)===s)backToSmartMenu(root);return false;}
}
export function backToSmartMenu(root){const s=states.get(root);if(!s)return false;disposeSource(s);s.mode='menu';s.backMesh.visible=false;showMaterial(s,s.menuTexture);return true;}
export function smartScreenClick(root,hit){const s=states.get(root);if(!s)return false;
 if(hit?.object?.userData?.smartScreenBack){backToSmartMenu(root);return true;}
 if(s.mode==='video'){// Small top-left hotspot always returns to gallery.
  const uv=hit?.uv;if(uv&&uv.x<.22&&uv.y>.77)backToSmartMenu(root);else if(s.video){s.video.paused?s.video.play().catch(()=>{}):s.video.pause();}return true;
 }
 if(s.mode!=='menu'||!hit?.uv)return true;
 const x=hit.uv.x*768,y=(1-hit.uv.y)*432;
 if(x<24||y<115)return true;
 const col=Math.floor((x-24)/247),row=Math.floor((y-115)/75),index=row*3+col;
 if(col>=0&&col<3&&row>=0&&row<4&&index<s.channels.length&&x-(24+col*247)<233&&y-(115+row*75)<63)void openSmartChannel(root,index);
 return true;
}
