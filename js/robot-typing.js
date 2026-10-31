// Animate only newly received robot responses. History and accessibility
// reduced-motion users always see complete text immediately.
export function typeRobotReply(node,text,{active=()=>true,onProgress=()=>{}}={}){
 const message=String(text||'');
 if(!node||!message||message.length>700||typeof requestAnimationFrame!=='function'||document.hidden||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){if(node)node.textContent=message;return;}
 node.textContent='';node.classList.add('robot-typing');
 let started=null,done=false;
 const finish=()=>{node.textContent=message;node.classList.remove('robot-typing');done=true;};
 const step=stamp=>{
  if(done)return;
  if(!node.isConnected||!active()||document.hidden){finish();return;}
  started??=stamp;
  const duration=Math.min(4300,Math.max(550,message.length*19));
  const count=Math.min(message.length,Math.floor((stamp-started)/duration*message.length));
  node.textContent=message.slice(0,count);
  if(count>=message.length){finish();return;}
  onProgress();requestAnimationFrame(step);
 };
 requestAnimationFrame(step);
}
