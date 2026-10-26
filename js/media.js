// Intentionally minimal opt-in media capture scaffold. No unsolicited camera/microphone use.
export function initMedia() {
  const $=id=>document.getElementById(id);
  const dialog=$('callBackdrop');let stream;
  $('callButton').onclick=()=>{dialog.hidden=false;};
  $('closeCall').onclick=()=>{dialog.hidden=true;};
  async function start(video){
    if(stream)stream.getTracks().forEach(t=>t.stop());
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:true,video});
      $('localVideo').srcObject=stream;$('localVideo').hidden=!video;
      $('callStatus').textContent='Local media enabled. Peer-call signaling is scaffolded but not connected yet.';
      $('leaveCall').disabled=false;
    }catch(e){$('callStatus').textContent='Access denied/unavailable: '+e.message;}
  }
  $('joinAudio').onclick=()=>start(false);
  $('joinVideo').onclick=()=>start(true);
  $('leaveCall').onclick=()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;$('localVideo').srcObject=null;$('localVideo').hidden=true;$('leaveCall').disabled=true;$('callStatus').textContent='Media stopped.';};
  window.addEventListener('pagehide',()=>stream?.getTracks().forEach(t=>t.stop()));
}
