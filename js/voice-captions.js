// SOLVI opt-in CC. Browser STT stays on the browser's selected recognition service.
// Server STT sends 4s encoded audio segments ONLY while explicitly enabled.
export const supportedLanguage = value => ['auto','pl-PL','en-GB','en-US'].includes(value)?value:'auto';
export const selectedLocale = (setting,browserLang='en-GB') => supportedLanguage(setting)==='auto'?(browserLang||'en-GB'):setting;
export function setupVoiceCaptions(world){
 const button=document.getElementById('captionsButton'),status=document.getElementById('captionStatus');
 const preview=document.getElementById('captionPreview'),phase=document.getElementById('captionPhase'),draft=document.getElementById('captionDraft'),settingsStatus=document.getElementById('ccSettingsStatus');
 const waves=document.getElementById('voiceWavesButton'),engine=document.getElementById('ccEngine'),language=document.getElementById('ccLanguage'),autoSend=document.getElementById('ccAutoSend'),engineStatus=document.getElementById('ccEngineStatus');
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 let enabled=false,rec=null,epoch=0,mic=null,media=null,loop=null,pendingPromise=Promise.resolve(),pendingSegments=0,ctx=null,analyser=null,src=null,frame=0;let retries=0,heardAt=0,switchedToWhisper=false;
 // Keep the button's visible label in sync without replacing its accessible SVG wrapper.
 function setCCLabel(text){
  const label=button.querySelector?.('.ui-button-label');
  if(label)label.textContent=text;
  else button.textContent=text;
 }
 const localStore=(key,element,allowed)=>{const value=localStorage.getItem('solvi-'+key);if(allowed.includes(value))element.value=value;element.addEventListener('change',()=>{localStorage.setItem('solvi-'+key,element.value);if(enabled){stop();start().catch(e=>failed(e.message));}});};
 localStore('cc-engine',engine,['browser','server']);localStore('cc-language',language,['auto','pl-PL','en-GB','en-US']);
 const autoSetting=localStorage.getItem('solvi-cc-send');if(autoSetting!==null)autoSend.checked=autoSetting==='true';autoSend.addEventListener('change',()=>localStorage.setItem('solvi-cc-send',String(autoSend.checked)));
 function show(state,label,text=''){preview.hidden=!state;preview.dataset.state=state||'off';phase.textContent=label;draft.textContent=text;status.textContent=label+(text?' · '+text.slice(-100):'');
   if(settingsStatus)settingsStatus.textContent=label+(text?' · '+text.slice(-90):'');button.dataset.ccState=state||'off';
   button.setAttribute('aria-label',enabled?'Turn off live captions. '+label:'Turn on live captions. '+label);
   button.setAttribute('aria-pressed',String(enabled));button.title=enabled?'CC on · click to stop microphone transcription':'CC off · click to start microphone transcription';}

 function failed(msg){show('error','CC error',msg);setTimeout(()=>{if(!enabled)preview.hidden=true;},6000);}
 async function publish(text){text=String(text||'').trim();if(!text)return;
  if(!autoSend.checked){const input=document.getElementById('chatInput');input.value+=(input.value.trim()?' ':'')+'CC: '+text;input.dispatchEvent(new Event('input'));show('listening','Listening · transcript added to input');return;}
  if(typeof window.solviPublishCaption!=='function')throw Error('Room caption publisher is unavailable. Open chat and reconnect.');
  show('sending','Publishing CC transcript…',text);await window.solviPublishCaption(text);if(enabled)show('listening','CC sent to room · listening…',text);}
 function finishMic(){if(rec){rec.onend=null;try{rec.abort();}catch{}rec=null;}if(loop)clearTimeout(loop);loop=null;if(media&&media.state!=='inactive'){try{media.stop();}catch{}}media=null;mic?.getTracks().forEach(t=>t.stop());mic=null;}
 function stop(){enabled=false;++epoch;retries=0;switchedToWhisper=false;if(rec){rec.onend=null;try{rec.stop();}catch{}}rec=null;finishMic();setCCLabel('CC off');button.setAttribute('aria-pressed','false');show('off','CC off');preview.hidden=true;}
 async function browserStart(id){
  if(!Recognition)throw Error('Browser speech recognition is unavailable. Try Ubuntu Whisper.');
  rec=new Recognition();rec.lang=selectedLocale(language.value,navigator.language);rec.continuous=true;rec.interimResults=true;
  rec.onresult=event=>{if(!enabled||id!==epoch)return;let interim='';for(let i=event.resultIndex;i<event.results.length;i++){
    const result=event.results[i],text=result[0]?.transcript?.trim();if(!text)continue;
    if(result.isFinal){heardAt=Date.now();retries=0;publish(text).catch(e=>failed(e.message));}else{heardAt=Date.now();retries=0;interim+=text+' ';}
   }if(interim)show('listening','Hearing words…',interim.trim());};
  rec.onerror=e=>{if(id!==epoch||!enabled)return;
   if(['not-allowed','service-not-allowed','audio-capture'].includes(e.error)){stop();failed('Microphone permission or capture unavailable: '+e.error);return;}
   if(e.error!=='no-speech')failed('Browser speech recognition: '+e.error);
  };
  async function fallback(){if(!enabled||id!==epoch)return;
   rec.onend=null;try{rec.abort();}catch{}rec=null;
   if(window.solviAPI?.online&&window.solviAPI?.auth()&&window.MediaRecorder){
    switchedToWhisper=true;show('transcribing','Switching to Ubuntu Whisper…');
    try{await serverStart(id);return;}catch(e){stop();failed('Whisper fallback failed: '+e.message);return;}
   }
   stop();failed('Browser speech recognition stopped repeatedly without text. Select Ubuntu Whisper in Settings, or check browser microphone and speech permissions.');
  }
  rec.onend=()=>{if(!enabled||id!==epoch)return;
   // Browser speech services sometimes terminate immediately. Never enter an infinite restart loop.
   retries+=1;
   if(retries>4){fallback();return;}
   show('listening',`Listening (${rec.lang}) · recovering ${retries}/4`);
   loop=setTimeout(()=>{if(!enabled||id!==epoch||!rec)return;
    try{rec.start();show('listening',`Listening (${rec.lang})…`);}catch(e){fallback();}
   },Math.min(4500,650*2**(retries-1)));
  };
  retries=0;rec.start();show('listening',`Listening (${rec.lang})…`);
 }
 function mediaMime(){return ['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t))||'';}
 async function serverStart(id){
  if(!window.solviAPI?.online||!window.solviAPI?.auth())throw Error('Sign in to use Ubuntu Whisper.');
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Audio recording unsupported in this browser');
  mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
  if(!enabled||id!==epoch){finishMic();return;}
  const type=mediaMime();if(!type)throw Error('No supported audio recording codec');
  const cycle=()=>{if(!enabled||id!==epoch)return;
   const parts=[];media=new MediaRecorder(mic,{mimeType:type,audioBitsPerSecond:32000});
   media.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};
   media.onstop=()=>{const blob=new Blob(parts,{type});if(blob.size>=1000&&enabled&&id===epoch){
    if(pendingSegments>=3){failed('Speech recognition queue is full. Check Ubuntu Whisper connection.');}else{pendingSegments++;pendingPromise=pendingPromise.catch(()=>{}).then(async()=>{
     if(!enabled||id!==epoch)return;
     show('transcribing','Whisper transcribing…');const form=new FormData();form.append('audio',blob,'speech.'+(type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':'webm'));form.append('language',language.value==='auto'?'auto':language.value.slice(0,2));
     const result=await window.solviAPI.req('/api/stt',{method:'POST',body:form});if(result.text)await publish(result.text);else if(enabled)show('listening','Listening · no speech detected');
    }).catch(e=>failed(e.message)).finally(()=>{pendingSegments--;});}}
    if(enabled&&id===epoch)cycle();};
   media.onerror=e=>{failed(e.error?.message||'Recording error');stop();};
   media.start();show('listening',`Listening · Ubuntu Whisper (${language.value})…`);
   loop=setTimeout(()=>{if(media?.state==='recording')media.stop();},4000);
  };cycle();
 }
 async function start(){if(enabled)return;enabled=true;retries=0;heardAt=0;switchedToWhisper=false;const id=++epoch;setCCLabel('CC on');button.setAttribute('aria-pressed','true');
  try{if(engine.value==='server')await serverStart(id);else if(!Recognition&&window.solviAPI?.online&&window.solviAPI?.auth())await serverStart(id);else await browserStart(id);}catch(e){stop();failed(e.message);}}
 button?.addEventListener('click',()=>{if(enabled)stop();else start();});
 async function voiceLevels(){
  if(ctx){cancelAnimationFrame(frame);src?.disconnect();analyser?.disconnect();await ctx.close().catch(()=>{});ctx=null;finishVoice();window.dispatchEvent(new CustomEvent('solvi:voice-waves',{detail:{active:false}}));return;}
  try{voiceStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});ctx=new AudioContext();src=ctx.createMediaStreamSource(voiceStream);analyser=ctx.createAnalyser();analyser.fftSize=512;src.connect(analyser);
  const wave=new Uint8Array(analyser.fftSize),fft=new Uint8Array(analyser.frequencyBinCount),hz=ctx.sampleRate/analyser.fftSize;let last=0;
  function tick(now){if(!ctx)return;if(now-last>80){last=now;analyser.getByteTimeDomainData(wave);let rms=0;for(const x of wave)rms+=((x-128)/128)**2;world.localVoiceLevel=Math.min(1,Math.max(0,(Math.sqrt(rms/wave.length)-.02)*12));
   analyser.getByteFrequencyData(fft);world.localVoiceBands=[[90,360],[360,1600],[1600,7000]].map(([a,b])=>{let sum=0,n=0;for(let j=Math.floor(a/hz);j<Math.min(fft.length,Math.ceil(b/hz));j++){sum+=fft[j];n++;}return n?Math.min(1,(sum/n)/255):0;});}
   frame=requestAnimationFrame(tick);
  }frame=requestAnimationFrame(tick);waves.textContent='Waves on';window.dispatchEvent(new CustomEvent('solvi:voice-waves',{detail:{active:true}}));}catch(e){failed(e.message);finishVoice();}
 }
 let voiceStream=null;function finishVoice(){cancelAnimationFrame(frame);voiceStream?.getTracks().forEach(t=>t.stop());voiceStream=null;world.localVoiceLevel=0;world.localVoiceBands=[0,0,0];waves.textContent='Voice waves';}
 waves?.addEventListener('click',voiceLevels);
 window.addEventListener('pagehide',()=>{stop();finishVoice();});
 window.addEventListener('solvi:session-lost',()=>{if(enabled&&engine.value==='server'){stop();failed('Sign in again to use server transcription.');}});
 show('off','CC off · microphone released');preview.hidden=true;
 engineStatus.textContent='The orange/red OS icon means your microphone is active. Browser CC sends final phrases; Ubuntu Whisper sends 4-second chunks to the shared Rantlist model. Disable CC to release the mic.';
}
