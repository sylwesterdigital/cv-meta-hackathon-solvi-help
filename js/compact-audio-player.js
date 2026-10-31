// Compact, keyboard-accessible playback of authenticated chat audio.
// Safari can play an authenticated short-lived HLS VOD URL; other browsers
// retain the authenticated blob as their reliable fallback.
export function compactAudioPlayer({url,id,label}){
 const root=document.createElement('div');root.className='chat-audio-compact';
 const audio=document.createElement('audio');audio.preload='metadata';audio.src=url;
 const play=document.createElement('button');play.type='button';play.className='chat-audio-play';play.textContent='▶';play.setAttribute('aria-label','Play '+label);
 const progress=document.createElement('input');progress.type='range';progress.min='0';progress.max='1000';progress.value='0';progress.setAttribute('aria-label','Audio playback position');
 const time=document.createElement('time');time.textContent='0:00';
 const mute=document.createElement('button');mute.type='button';mute.textContent='◖))';mute.setAttribute('aria-label','Mute audio');
 const fmt=seconds=>{if(!Number.isFinite(seconds))return '0:00';const s=Math.floor(seconds);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
 const refresh=()=>{const duration=audio.duration;time.textContent=fmt(audio.currentTime)+(Number.isFinite(duration)?' / '+fmt(duration):'');progress.value=Number.isFinite(duration)&&duration>0?String(Math.round(audio.currentTime/duration*1000)):'0';play.textContent=audio.paused?'▶':'❚❚';};
 play.onclick=()=>{if(audio.paused)audio.play().catch(()=>{play.title='Audio cannot be played';});else audio.pause();};
 mute.onclick=()=>{audio.muted=!audio.muted;mute.textContent=audio.muted?'×':'◖))';mute.setAttribute('aria-label',audio.muted?'Unmute audio':'Mute audio');};
 progress.oninput=()=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=audio.duration*Number(progress.value)/1000;};
 for(const event of ['loadedmetadata','timeupdate','durationchange','ended','pause','play'])audio.addEventListener(event,refresh);
 root.append(play,progress,time,mute,audio);
 // No long-lived bearer token in a URL: backend mints a short-lived,
 // media-specific HLS playback ticket after regular session verification.
 if(id&&audio.canPlayType('application/vnd.apple.mpegurl')&&window.solviAPI?.req){
  window.solviAPI.req('/api/media/'+encodeURIComponent(id)+'/hls-access').then(reply=>{
   if(!root.isConnected||!audio.paused)return;
   if(reply.url){audio.src=reply.url;audio.load();}
  }).catch(()=>{});
 }
 return root;
}
