// User-gesture unlocked Web Audio cues. No streaming, external assets or timers.
let context=null;
export function liftChime(which){
 try{
  const AC=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!AC)return false;
  context??=new AC();
  if(context.state==='suspended')context.resume().catch(()=>{});
  const start=context.currentTime+.015;
  const sequence=which==='arrival'?[[659,0],[880,.115],[1047,.23]]:[[523,0],[659,.12]];
  for(const [frequency,delay] of sequence){
   const osc=context.createOscillator(),gain=context.createGain(),at=start+delay;
   osc.type='sine';osc.frequency.setValueAtTime(frequency,at);
   gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.045,at+.017);
   gain.gain.exponentialRampToValueAtTime(.0001,at+.24);
   osc.connect(gain);gain.connect(context.destination);osc.start(at);osc.stop(at+.255);
   osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  return true;
 }catch{return false;}
}
