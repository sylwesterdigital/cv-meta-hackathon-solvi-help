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
export function compactMediaPlayer({url,id,label='',kind='audio',stream=true}){
 const video=kind==='video';const root=document.createElement('div');root.className='chat-player chat-player-'+kind;
 const media=document.createElement(kind);media.preload='none';media.playsInline=true;media.controls=false;
 media.setAttribute('aria-label',video?'Video message':'Audio message');
 // The authenticated blob remains a fallback for unsupported/offline HLS clients.
 if(video){media.poster='';media.setAttribute('disablepictureinpicture','');}
 if(url)media.src=url;
 const controls=document.createElement('div');controls.className='chat-player-controls';
 const play=document.createElement('button');play.type='button';play.className='chat-player-play';play.textContent='▶';play.title='Play';play.setAttribute('aria-label','Play '+kind);
 const progress=document.createElement('input');progress.type='range';progress.min='0';progress.max='1000';progress.step='1';progress.value='0';progress.className='chat-player-progress';progress.setAttribute('aria-label','Seek '+kind);
 const time=document.createElement('time');time.textContent='0:00';time.className='chat-player-time';
 const mute=document.createElement('button');mute.type='button';mute.className='chat-player-mute';mute.textContent='◖))';mute.title='Mute';mute.setAttribute('aria-label','Mute '+kind);
 const status=document.createElement('span');status.className='chat-player-status';status.setAttribute('role','status');status.hidden=true;
 controls.append(play,progress,time,mute);
 if(video){const full=document.createElement('button');full.type='button';full.textContent='⛶';full.title='Fullscreen';full.setAttribute('aria-label','Fullscreen video');full.onclick=()=>{media.requestFullscreen?.().catch?.(()=>{});};controls.append(full);}
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
  if(!id||!stream||!globalThis.solviAPI?.req){initialized=true;return;}
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
  play.textContent=media.paused?'▶':'❚❚';play.title=media.paused?'Play':'Pause';play.setAttribute('aria-label',(media.paused?'Play ':'Pause ')+kind);
  time.textContent=playerClock(media.currentTime)+(Number.isFinite(duration)?' / '+playerClock(duration):'');
  if(!progress.matches(':active'))progress.value=Number.isFinite(duration)&&duration>0?String(Math.round(media.currentTime/duration*1000)):'0';
 };
 play.onclick=async()=>{
  if(!media.paused){media.pause();return;}
  if(!initialized){play.disabled=true;status.textContent='Preparing stream…';status.hidden=false;await prepare();play.disabled=false;if(disposed)return;status.hidden=true;}
  media.play().catch(()=>{status.textContent='Press Play again to start playback';status.hidden=false;});
 };
 if(video)media.onclick=()=>play.click();
 mute.onclick=()=>{media.muted=!media.muted;mute.textContent=media.muted?'×':'◖))';mute.setAttribute('aria-label',media.muted?'Unmute':'Mute');};
 progress.oninput=()=>{if(Number.isFinite(media.duration)&&media.duration>0)media.currentTime=media.duration*Number(progress.value)/1000;};
 for(const event of ['loadedmetadata','durationchange','timeupdate','ended','pause','play'])media.addEventListener(event,refresh);
 root.dispose=()=>{disposed=true;media.pause();hls?.destroy?.();hls=null;media.removeAttribute('src');media.load();if(fallbackUrl)URL.revokeObjectURL(fallbackUrl);};
 return root;
}
