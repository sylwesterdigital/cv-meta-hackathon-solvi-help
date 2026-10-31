export function clampSwitcherPosition(x,y,width,height,viewportWidth,viewportHeight){
 return {x:Math.max(4,Math.min(Math.max(4,viewportWidth-width-4),x)),y:Math.max(4,Math.min(Math.max(4,viewportHeight-height-4),y))};
}
export function attachControlSwitcherDrag(panel,handle){
 if(!panel||!handle)return;let state=null;const storage='solvi-control-switcher-position-v1';
 const place=(x,y)=>{const pt=clampSwitcherPosition(x,y,panel.offsetWidth,panel.offsetHeight,innerWidth,innerHeight);panel.style.setProperty('left',pt.x+'px','important');panel.style.setProperty('top',pt.y+'px','important');panel.style.setProperty('bottom','auto','important');panel.style.setProperty('right','auto','important');return pt;};
 try{const saved=JSON.parse(sessionStorage.getItem(storage)||'null');if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))requestAnimationFrame(()=>place(saved.x,saved.y));}catch{}
 handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();const bounds=panel.getBoundingClientRect();const point=place(bounds.left,bounds.top);state={pointer:event.pointerId,x:event.clientX,y:event.clientY,left:point.x,top:point.y};handle.setPointerCapture(event.pointerId);});
 handle.addEventListener('pointermove',event=>{if(!state||state.pointer!==event.pointerId)return;place(state.left+event.clientX-state.x,state.top+event.clientY-state.y);});
 const finish=event=>{if(!state||state.pointer!==event.pointerId)return;const bounds=panel.getBoundingClientRect();const point=place(bounds.left,bounds.top);try{sessionStorage.setItem(storage,JSON.stringify(point));}catch{}state=null;};
 handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
 window.addEventListener('resize',()=>{if(panel.style.top){const r=panel.getBoundingClientRect();place(r.left,r.top);}});
}
