// Shared compact custom controls for authenticated chat audio/video.
// HLS tickets are requested only when the user starts playback. Native HLS
// requires no dependency; Chromium uses a lazy Hls.js loader when available.
let hlsLibraryPromise;
function getHlsLibrary(){
 if(globalThis.Hls?.isSupported?.())return Promise.resolve(globalThis.Hls);
 if(hlsLibraryPromise)return hlsLibraryPromise;
 hlsLibraryPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.async=true;
  script.src='./vendor/hls/hls.min.js';
  script.onload=()=>globalThis.Hls?.isSupported?.()?resolve(globalThis.Hls):reject(Error('HLS unavailable'));
  script.onerror=()=>reject(Error('HLS library unavailable'));
  document.head.append(script);
 }).catch(error=>{hlsLibraryPromise=null;throw error;});
 return hlsLibraryPromise;
}
export function playerClock(seconds){
 if(!Number.isFinite(seconds)||seconds<0)return '0:00';
 const s=Math.floor(seconds);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}
function mediaIcon(name){
 const icon=document.createElement('img');icon.className='solvi-player-icon';icon.src='./assets/icons/'+name+'.svg';icon.alt='';icon.setAttribute('aria-hidden','true');return icon;
}
// Decode a frame from the authenticated video blob, never from an anonymous URL.
// The poster stays visible before Play and is derived locally without storing media publicly.
export function makeVideoPoster(url,timeout=6000){
 return new Promise(resolve=>{
  if(!url){resolve('');return;}
  const probe=document.createElement('video');probe.muted=true;probe.playsInline=true;probe.preload='auto';
  let ended=false;const finish=poster=>{if(ended)return;ended=true;clearTimeout(timer);probe.removeAttribute('src');probe.load();resolve(poster||'');};
  const capture=()=>{try{if(!probe.videoWidth||!probe.videoHeight)return finish('');const canvas=document.createElement('canvas');const width=Math.min(probe.videoWidth,480);canvas.width=width;canvas.height=Math.max(1,Math.round(width*probe.videoHeight/probe.videoWidth));canvas.getContext('2d').drawImage(probe,0,0,canvas.width,canvas.height);finish(canvas.toDataURL('image/jpeg',.78));}catch{finish('');}};
  const timer=setTimeout(()=>finish(''),timeout);
  probe.onloadeddata=()=>{if(Number.isFinite(probe.duration)&&probe.duration>.3){try{probe.currentTime=Math.min(.35,probe.duration/3);return;}catch{}}capture();};
  probe.onseeked=capture;probe.onerror=()=>finish('');probe.src=url;probe.load();
 });
}
export function compactMediaPlayer({url,id,label='',kind='audio',stream=true}){
 const video=kind==='video';const root=document.createElement('div');root.className='chat-player chat-player-'+kind;
 const media=document.createElement(kind);media.preload=video&&url?'metadata':'none';media.playsInline=true;media.controls=false;
 media.setAttribute('aria-label',video?'Video message':'Audio message');
 // The authenticated blob remains a fallback for unsupported/offline HLS clients.
 if(video){media.poster='';media.setAttribute('disablepictureinpicture','');if(url)void makeVideoPoster(url).then(poster=>{if(root.isConnected&&poster)media.poster=poster;});}
 if(url)media.src=url;
 const controls=document.createElement('div');controls.className='chat-player-controls';
 const play=document.createElement('button');play.type='button';play.className='chat-player-play';play.append(mediaIcon('play'));play.title='Play';play.setAttribute('aria-label','Play '+kind);
 const progress=document.createElement('input');progress.type='range';progress.min='0';progress.max='1000';progress.step='1';progress.value='0';progress.className='chat-player-progress';progress.setAttribute('aria-label','Seek '+kind);
 const time=document.createElement('time');time.textContent='0:00';time.className='chat-player-time';
 const mute=document.createElement('button');mute.type='button';mute.className='chat-player-mute';mute.append(mediaIcon('volume'));mute.title='Mute';mute.setAttribute('aria-label','Mute '+kind);
 const status=document.createElement('span');status.className='chat-player-status';status.setAttribute('role','status');status.hidden=true;
 controls.append(play,progress,time,mute);
 if(video){const full=document.createElement('button');full.type='button';full.append(mediaIcon('fullscreen'));full.title='Fullscreen';full.setAttribute('aria-label','Fullscreen video');full.onclick=()=>{media.requestFullscreen?.().catch?.(()=>{});};controls.append(full);}
 root.append(media,controls,status);
 let hls=null,initialized=false,disposed=false,fallbackUrl='';
 const fallback=async()=>{
  if(disposed)return;
  hls?.destroy?.();hls=null;
  try{
   const direct=url?{url}:await globalThis.solviAPI?.mediaBlobInfo?.(id);
   if(disposed){if(!url&&direct?.url)URL.revokeObjectURL(direct.url);return;}
   if(!direct?.url)throw Error('No direct media available');
   fallbackUrl=!url?direct.url:'';
   media.src=direct.url;media.load();
   status.textContent='Direct playback';status.hidden=false;
  }catch{status.textContent='Playback unavailable';status.hidden=false;}
 };
 async function prepare(){
  if(initialized)return;
  if(url||!id||!stream||!globalThis.solviAPI?.req){initialized=true;return;}
  initialized=true;
  try{
   const result=await globalThis.solviAPI.req('/api/media/'+encodeURIComponent(id)+'/hls-access');
   if(disposed||!root.isConnected)return;
   if(!result?.url)throw Error('HLS unavailable');
   if(media.canPlayType('application/vnd.apple.mpegurl')){media.src=result.url;media.load();}
   else{
    const Hls=await getHlsLibrary();if(disposed||!root.isConnected)return;
    hls=new Hls({enableWorker:true,maxBufferLength:20,maxMaxBufferLength:30});
    hls.loadSource(result.url);hls.attachMedia(media);
    await new Promise((resolve,reject)=>{
     let timer;
     const cleanup=()=>{clearTimeout(timer);hls?.off?.(Hls.Events.MANIFEST_PARSED,ok);hls?.off?.(Hls.Events.ERROR,fail);};
     const ok=()=>{cleanup();resolve();};
     const fail=(_event,data)=>{if(data?.fatal){cleanup();reject(Error('HLS stream error'));}};
     hls.on(Hls.Events.MANIFEST_PARSED,ok);hls.on(Hls.Events.ERROR,fail);
     timer=setTimeout(()=>{cleanup();reject(Error('HLS stream timed out'));},9000);
    });
   }
  }catch{await fallback();}
 }
 const refresh=()=>{const duration=media.duration;
  play.replaceChildren(mediaIcon(media.paused?'play':'pause'));play.title=media.paused?'Play':'Pause';play.setAttribute('aria-label',(media.paused?'Play ':'Pause ')+kind);
  time.textContent=playerClock(media.currentTime)+(Number.isFinite(duration)?' / '+playerClock(duration):'');
  if(!progress.matches(':active'))progress.value=Number.isFinite(duration)&&duration>0?String(Math.round(media.currentTime/duration*1000)):'0';
 };
 play.onclick=async()=>{
  if(!media.paused){media.pause();return;}
  if(!initialized){play.disabled=true;status.textContent='Preparing stream…';status.hidden=false;await prepare();play.disabled=false;if(disposed)return;status.hidden=true;}
  media.play().catch(error=>{console.warn('SOLVI media playback',error);status.textContent=error?.name==='NotSupportedError'?'Video codec unsupported in this browser':'Video could not play. Check the recording or connection.';status.hidden=false;});
 };
 if(video)media.onclick=()=>play.click();
 mute.onclick=()=>{media.muted=!media.muted;mute.replaceChildren(mediaIcon(media.muted?'volume-off':'volume'));mute.setAttribute('aria-label',media.muted?'Unmute':'Mute');};
 progress.oninput=()=>{if(Number.isFinite(media.duration)&&media.duration>0)media.currentTime=media.duration*Number(progress.value)/1000;};
 media.addEventListener('error',()=>{if(disposed)return;status.textContent='Media decoding failed — download to inspect';status.hidden=false;console.warn('SOLVI playback error',media.error);});
 for(const event of ['loadedmetadata','durationchange','timeupdate','ended','pause','play'])media.addEventListener(event,refresh);
 root.dispose=()=>{disposed=true;media.pause();hls?.destroy?.();hls=null;media.removeAttribute('src');media.load();if(fallbackUrl)URL.revokeObjectURL(fallbackUrl);};
 return root;
}
