// SOLVI v0.2.177 — lightweight screen-space comic balloons for in-world robots.
// Source SVG outlines supplied by the room author. Text remains HTML, not a texture.
export function comicBubbleDuration(text,thinking=false){
 return thinking?6200:Math.max(7000,Math.min(23000,4800+String(text||'').length*65));
}
export function comicBubbleText(text,max=370){
 return String(text||'').replace(/\s+/g,' ').trim().slice(0,max);
}
export function installRobotComicBubbles(world){
 if(typeof document==='undefined'||typeof requestAnimationFrame!=='function')return ()=>{};
 const entries=new Map(),layer=document.createElement('div');
 layer.id='solviComicBubbles';layer.setAttribute('aria-hidden','true');document.body.append(layer);
 let raf=0,active=true;
 const clear=()=>{for(const entry of entries.values())entry.node.remove();entries.clear();};
 const receive=e=>{
  const d=e.detail||{},name=String(d.name||'').trim(),text=comicBubbleText(d.text);
  if(!name||!text)return;
  const robot=window.solviEditor?.items?.find(o=>o.userData.editorKind==='robot'&&o.name===name);
  if(!robot)return;
  const cfg=robot.userData.robotBrain||{};
  if(d.kind==='speech'){
   const mentioned=window.solviEditor?.items?.filter(o=>o!==robot&&o.userData?.editorKind!=='robot'&&o.visible&&o.name?.trim().length>=4)
    .filter(o=>new RegExp('(^|[^\\p{L}\\p{N}])'+o.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^\\p{L}\\p{N}])','iu').test(text))||[];
   const target=mentioned.sort((a,b)=>b.name.length-a.name.length).find(o=>mentioned.filter(other=>other.name.toLocaleLowerCase()===o.name.toLocaleLowerCase()).length===1);
   if(target)window.dispatchEvent(new CustomEvent('solvi:realm-object-mentioned',{detail:{id:target.userData.editorId,name:target.name,robot:name}}));
  }
  if(cfg.comicEnabled==='off'||d.kind==='thought'&&cfg.comicThought==='off')return;
  entries.get(name)?.node.remove();
  const node=document.createElement('div');
  const thinking=d.kind==='thought';node.className='solvi-comic-balloon '+(thinking?'solvi-comic-thought':'solvi-comic-speech');
  node.classList.add('comic-shape-'+(['rounded','oval','cloud'].includes(cfg.comicShape)?cfg.comicShape:'rounded'));
  node.classList.add('comic-font-'+(['digital','comic','sans'].includes(cfg.comicFont)?cfg.comicFont:'digital'));
  const caption=document.createElement('span');caption.className='solvi-comic-text';caption.textContent=cfg.comicCaps==='upper'?text.toLocaleUpperCase():text;
  node.append(caption);layer.append(node);
  entries.set(name,{robot,node,until:performance.now()+comicBubbleDuration(text,thinking)});
 };
 const brain=e=>{
  const d=e.detail||{};
  if(!/PLAN|THINK|DECISION|REASON|INTENT/i.test(d.step||''))return;
  window.dispatchEvent(new CustomEvent('solvi:robot-comic',{detail:{name:d.robotName,text:comicBubbleText(d.detail,90)||d.step,kind:'thought'}}));
 };
 const room=()=>clear();
 window.addEventListener('solvi:robot-comic',receive);
 window.addEventListener('solvi:brain-trace',brain);
 window.addEventListener('solvi:room-changed',room);
 const follow=()=>{
  if(!active)return;
  const now=performance.now();
  for(const [name,entry] of entries){
   const {robot,node,until}=entry;
   if(now>until||!robot.parent||!robot.visible){node.remove();entries.delete(name);continue;}
   // Project the moving character's head without mutating their scene pose.
   const point=robot.getWorldPosition(robot.position.clone());point.y+=2.12;
   point.project(world.camera);
   if(point.z< -1||point.z>1||Math.abs(point.x)>1.2||Math.abs(point.y)>1.2){node.hidden=true;continue;}
   node.hidden=false;
   node.style.left=`${((point.x+1)/2*innerWidth).toFixed(1)}px`;
   node.style.top=`${((1-point.y)/2*innerHeight).toFixed(1)}px`;
  }
  raf=requestAnimationFrame(follow);
 };
 raf=requestAnimationFrame(follow);
 return ()=>{active=false;cancelAnimationFrame(raf);window.removeEventListener('solvi:robot-comic',receive);window.removeEventListener('solvi:brain-trace',brain);window.removeEventListener('solvi:room-changed',room);clear();layer.remove();};
}
