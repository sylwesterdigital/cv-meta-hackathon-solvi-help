// Audible robot replies. Local TTS uses Ubuntu espeak-ng (genuine spatial audio)
// with a browser-installed-voice fallback; cloud TTS is ElevenLabs on the server.
// Meta Muse Voice Transcribe is speech-to-text only, not a TTS provider.

// Match the spoken text, not the browser interface language. Explicit
// Polish clues override an English default to avoid English voices reading Polish.
export function spokenLanguage(text,preferred='auto'){
 const t=String(text||'').toLocaleLowerCase();
 if(/[ąćęłńóśźż]/.test(t)||/\b(cześć|jestem|proszę|krzesło|krzesła|chodź|zobacz|dziękuję|czy|masz|dzisiaj|tutaj|dobrze|dlaczego|mogę|już|będzie|gdzie|siedzę|głos|mój|twoim)\b/.test(t))return 'pl';
 if(preferred!=='auto')return preferred;
 if(/\b(bonjour|merci|avec|je suis)\b/.test(t))return 'fr';
 if(/\b(hola|gracias|estoy|quiero)\b/.test(t))return 'es';
 if(/\b(hallo|danke|ich bin|bitte)\b/.test(t))return 'de';
 return 'en';
}
export const robotVoiceConfig=brain=>({
 provider:['local','elevenlabs','mute'].includes(brain?.voiceProvider)?brain.voiceProvider:'local',
 voiceId:/^[A-Za-z0-9_-]{0,80}$/.test(brain?.voiceId||'')?brain?.voiceId||'':'',
 voiceName:String(brain?.voiceName||'').slice(0,100),
 lang:['auto','en','pl','de','es','fr'].includes(brain?.voiceLang)?brain.voiceLang:'auto',
 rate:Math.max(.6,Math.min(1.6,Number(brain?.voiceRate)||1)),
 pitch:Math.max(.5,Math.min(1.7,Number(brain?.voicePitch)||1))
});
export const distanceVolume=(distance,base=.75)=>Math.max(0,Math.min(1,base/(1+Math.max(0,distance-2)*.12)));

export class RobotSpeech{
 constructor(world,api,room,notify=()=>{}){
  this.world=world;this.api=api;this.room=room;this.notify=notify;
  this.seen=new Set();this.jobs=[];this.playing=false;this.active=null;this.audio=null;this.context=null;
  const prime=()=>{const Ctx=window.AudioContext||window.webkitAudioContext;if(Ctx&&!this.context){try{this.context=new Ctx();}catch{}}this.context?.resume().catch(()=>{});};
  document.addEventListener('pointerdown',prime,{passive:true});document.addEventListener('keydown',prime);
  window.addEventListener('pagehide',()=>this.stop());
  window.addEventListener('solvi:room-changed',()=>this.stop());
 }
 robot(name,id=null){return window.solviEditor?.items?.find(o=>o.userData.editorKind==='robot'&&(id?o.userData.editorId===id:o.name.toLocaleLowerCase()===String(name||'').toLocaleLowerCase()));}
 enabled(){return localStorage.getItem('solvi-robot-speech')!=='0';}
 volume(){return Math.max(0,Math.min(1,Number(localStorage.getItem('solvi-robot-speech-volume')||75)/100));}
 speak(entry){
  if(!entry||entry.role!=='assistant'||!entry.id||!entry.text?.trim()||!this.enabled()||!this.volume())return;
  if(this.seen.has(entry.id))return;
  const robot=this.robot(entry.speaker);if(!robot)return;
  const settings=robotVoiceConfig(robot.userData.robotBrain);
  this.seen.add(entry.id);if(this.seen.size>400)this.seen.delete(this.seen.values().next().value);
  if(settings.provider==='mute')return;
  settings.lang=spokenLanguage(entry.text,settings.lang);
  this.jobs.push({entry,robotId:robot.userData.editorId,room:this.room(),settings});
  if(this.jobs.length>5)this.jobs.shift();
  if(!this.playing)this.consume();
 }
 test({robotId,name,config}={}){
  const robot=this.robot(name,robotId);if(!robot)return;
  // Preview is a fixed safe phrase, not arbitrary billable text from the browser.
  const settings=robotVoiceConfig(config);
  if(settings.provider==='mute'){this.report({robotId,settings},'error','Robot voice is muted.');return;}
  if(!this.enabled()){this.report({robotId,settings},'error','Enable Robots speak in 3D in Settings.');return;}
  if(settings.provider==='elevenlabs'&&!settings.voiceId){this.report({robotId,settings},'error','Select a valid ElevenLabs voice ID first.');return;}
  settings.lang=settings.lang==='auto'?'en':settings.lang;
  this.jobs.push({robotId:robot.userData.editorId,room:this.room(),settings,test:true,
    entry:{text:`Hello, I'm ${robot.name}. This is my voice.`,speaker:robot.name}});
  if(!this.playing)this.consume();
 }
 report(job,status,message,provider=job.settings.provider){
  window.dispatchEvent(new CustomEvent('solvi:robot-voice-status',{detail:{robotId:job.robotId,status,provider,message}}));
 }
 stop(){this.jobs=[];this.active?.pause?.();this.active?.dispatchEvent?.(new Event('ended'));if(this.active?.src?.startsWith('blob:'))URL.revokeObjectURL(this.active.src);this.active=null;
  window.speechSynthesis?.cancel?.();window.dispatchEvent(new CustomEvent('solvi:robot-speaking',{detail:{active:false}}));}
 async consume(){
  if(this.playing)return;this.playing=true;
  while(this.jobs.length){const job=this.jobs.shift();if(job.room!==this.room()||!this.enabled())continue;
   const robot=this.robot(null,job.robotId);if(!robot)continue;
   const started={active:true,name:robot.name};window.dispatchEvent(new CustomEvent('solvi:robot-speaking',{detail:started}));
   try{
     this.report(job,'pending',`Generating ${job.settings.provider==='elevenlabs'?'ElevenLabs':'local'} audio…`);
     const source=await this.play(job,robot);
     this.report(job,'ok',`${source==='elevenlabs'?'ElevenLabs':source==='local'?'Ubuntu local TTS':'Device voice'} audio played successfully.`,source);
   }catch(error){
     console.warn('SOLVI robot voice:',error.message);
     this.report(job,'error',error.message);
     this.notify('Robot voice: '+error.message);
   }finally{window.dispatchEvent(new CustomEvent('solvi:robot-speaking',{detail:{active:false,name:robot.name}}));}
  }
  this.playing=false;
 }
 async play(job,robot){
  const settings=job.settings;
  // An explicitly chosen device voice must be honoured; Ubuntu cannot use macOS voices.
  if(settings.provider==='local'&&settings.voiceName&&window.speechSynthesis?.getVoices?.().some(v=>v.name===settings.voiceName&&v.lang.toLowerCase().startsWith(settings.lang))){
    await this.playBrowser(job.entry.text,robot,settings);return 'device';
  }
  const headers={'Content-Type':'application/json','X-Solvi-Tab':this.api.auth?.()?.tab||sessionStorage.getItem('solvi-tab')||''};
  const auth=this.api.auth?.();if(auth?.token)headers.Authorization='Bearer '+auth.token;
  const voiceKey=sessionStorage.getItem('solvi-elevenlabs-key');if(voiceKey&&settings.provider==='elevenlabs')headers['X-Solvi-Voice-Key']=voiceKey;
  if(auth&&this.api.online){
   try{
    const response=await fetch('/api/robots/speech',{method:'POST',headers,cache:'no-store',body:JSON.stringify({room:job.room,robot_id:job.robotId,message_id:job.entry.id||'',test:!!job.test,provider:settings.provider,voice_id:settings.voiceId,rate:settings.rate,pitch:settings.pitch,lang:settings.lang})});
    if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.error||`TTS HTTP ${response.status}`);}
    const blob=await response.blob();if(blob.size<100)throw Error('Empty speech audio');
    // Generation and playback both have to succeed to report cloud voice as working.
    await this.playSpatial(blob,robot);
    return settings.provider;
   }catch(error){
    if(settings.provider==='elevenlabs')throw error; // Never silently substitute a browser voice.
    console.warn('SOLVI local spatial TTS unavailable; using device voice:',error.message);
   }
  }else if(settings.provider==='elevenlabs'){
   throw Error('Sign in before using ElevenLabs voice generation.');
  }
  await this.playBrowser(job.entry.text,robot,settings);
  return 'device';
 }
 async playSpatial(blob,robot){
  const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)throw Error('Web Audio unsupported');
  this.context||=new Ctx();if(this.context.state==='suspended')await this.context.resume();
  const audio=new Audio(URL.createObjectURL(blob));audio.preload='auto';this.active=audio;
  const source=this.context.createMediaElementSource(audio),panner=this.context.createPanner(),gain=this.context.createGain();
  panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=2.5;panner.maxDistance=70;panner.rolloffFactor=1;
  gain.gain.value=this.volume();source.connect(panner).connect(gain).connect(this.context.destination);
  const point=robot.position.clone(),look=robot.position.clone(),up=this.world.camera.up.clone();
  let frame=0;
  const update=()=>{
   const object=this.robot(null,robot.userData.editorId);if(object){object.getWorldPosition(point);panner.positionX.value=point.x;panner.positionY.value=point.y+1.4;panner.positionZ.value=point.z;}
   const camera=this.world.camera;camera.getWorldPosition(point);camera.getWorldDirection(look);up.set(0,1,0).applyQuaternion(camera.getWorldQuaternion(camera.quaternion.clone()));
   const listener=this.context.listener;
   if(listener.positionX){listener.positionX.value=point.x;listener.positionY.value=point.y;listener.positionZ.value=point.z;
    listener.forwardX.value=look.x;listener.forwardY.value=look.y;listener.forwardZ.value=look.z;
    listener.upX.value=up.x;listener.upY.value=up.y;listener.upZ.value=up.z;
   }else{listener.setPosition(point.x,point.y,point.z);listener.setOrientation(look.x,look.y,look.z,up.x,up.y,up.z);}
   frame=requestAnimationFrame(update);
  };
  update();
  try{await new Promise((resolve,reject)=>{audio.onended=resolve;audio.onerror=()=>reject(Error('Audio playback failed'));audio.play().catch(reject);});}
  finally{cancelAnimationFrame(frame);source.disconnect();panner.disconnect();gain.disconnect();URL.revokeObjectURL(audio.src);if(this.active===audio)this.active=null;}
 }
 async playBrowser(text,robot,settings){
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance)throw Error('No device voice is available');
  const speech=new SpeechSynthesisUtterance(String(text).slice(0,600));
  speech.lang=settings.lang;speech.rate=settings.rate;speech.pitch=settings.pitch;
  const all=window.speechSynthesis.getVoices();
  const candidates=all.filter(v=>v.lang.toLowerCase().startsWith(settings.lang));
  const selected=candidates.find(v=>v.name===settings.voiceName)||candidates[0];
  if(!selected)throw Error('No '+settings.lang+' device voice installed; choose a matching voice, Ubuntu local synthesis or ElevenLabs.');
  speech.voice=selected;
  const distance=robot.getWorldPosition(robot.position.clone()).distanceTo(this.world.camera.getWorldPosition(this.world.camera.position.clone()));
  speech.volume=distanceVolume(distance,this.volume());
  await new Promise((resolve,reject)=>{speech.onend=resolve;speech.onerror=e=>e.error==='interrupted'?resolve():reject(Error('Device TTS '+e.error));window.speechSynthesis.speak(speech);});
 }
}
