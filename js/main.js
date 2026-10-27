import {SolviWorld} from './world.js';
import {LiveRoom} from './live.js';
import {initDevLog} from './devlog.js';
import {initMedia} from './media.js';

initDevLog();initMedia();
const world=new SolviWorld(document.getElementById('viewport'),(status)=>{
  if(!status.loaded){const toast=document.getElementById('toast');toast.textContent='Model load issue: '+status.error;toast.hidden=false;}
});
world.loadAvatar();
const room=new LiveRoom(
  peers=>world.setRemotePeers(peers),
  (id,state)=>world.updateRemoteState(id,state),
  ()=>{} // Reserved for WebRTC offer/answer/ICE signaling.
);
world.onPose=pose=>room.state(pose);
// Enable shared room only once the Flask backend and Nginx /ws proxy are configured.
// Test explicitly with https://solvi.help/?live=1
if(new URLSearchParams(location.search).get('live')==='1')room.connect();
const buttons=[...document.querySelectorAll('[data-motion],#autoButton')];
for(const btn of buttons){btn.addEventListener('click',()=>{
  const mode=btn.id==='autoButton'?'auto':btn.dataset.motion;
  world.setMode(mode);
  buttons.forEach(b=>b.classList.toggle('selected',b===btn));
});}
window.addEventListener('pagehide',()=>room.close());
