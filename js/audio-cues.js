import {readPreferences} from './preferences.js';
// Oscillator-only earcons: no files, remote assets or microphone required.
let audio=null;
const sounds={incoming:[[740,.045],[980,.065]],sent:[[620,.045],[840,.045]],join:[[480,.06],[670,.075]],leave:[[670,.06],[420,.09]],error:[[195,.11],[160,.15]],click:[[540,.035]]};
export function primeAudio(){const Ctx=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Ctx)return;try{audio||=new Ctx();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
export function playCue(kind){
 if(!readPreferences().sounds)return;
 const Ctx=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Ctx)return;
 try{audio||=new Ctx();if(audio.state==='suspended'){audio.resume().catch(()=>{});return;}
  const sequence=sounds[kind]||sounds.click;let start=audio.currentTime+.005;
  for(const [freq,duration] of sequence){const oscillator=audio.createOscillator(),gain=audio.createGain();
    oscillator.type=kind==='error'?'triangle':'sine';oscillator.frequency.setValueAtTime(freq,start);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.038,start+.009);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(start);oscillator.stop(start+duration+.01);start+=duration*.8;
  }
 }catch(e){console.debug('Audio cue disabled:',e);}
}
