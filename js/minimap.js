// Live top-down map of the shared scene. Uses existing Three.js objects; no extra WebGL context.
export function initMinimap(world){
 const $=id=>document.getElementById(id);
 const panel=$('minimapPanel'),body=$('minimapBody'),button=$('minimapButton'),canvas=$('minimapCanvas');
 if(!panel||!button||!canvas)return;
 const ctx=canvas.getContext('2d');let minimized=false,zoom=35,panX=0,panZ=0;
 function show(open){panel.hidden=!open;button.setAttribute('aria-expanded',String(open));if(open)paint();}
 button.addEventListener('click',()=>show(panel.hidden));
 $('minimapClose').addEventListener('click',()=>show(false));
 $('minimapMinimize').addEventListener('click',()=>{minimized=!minimized;body.hidden=minimized;$('minimapMinimize').textContent=minimized?'+':'−';$('minimapMinimize').setAttribute('aria-label',minimized?'Expand minimap':'Minimize minimap');$('minimapMinimize').title=minimized?'Expand minimap':'Minimize minimap';});
 $('minimapReset').addEventListener('click',()=>{panX=0;panZ=0;zoom=35;paint();});
 // Move the floating window by its header, including touch gestures.
 const drag=$('minimapDrag');let pointer=null;
 drag.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,left:panel.getBoundingClientRect().left,top:panel.getBoundingClientRect().top};drag.setPointerCapture(e.pointerId);e.preventDefault();});
 drag.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;const left=Math.max(0,Math.min(innerWidth-panel.offsetWidth,pointer.left+e.clientX-pointer.x));const top=Math.max(0,Math.min(innerHeight-56,pointer.top+e.clientY-pointer.y));panel.style.left=left+'px';panel.style.top=top+'px';panel.style.right='auto';panel.style.bottom='auto';});
 const end=e=>{if(pointer?.id===e.pointerId)pointer=null;};drag.addEventListener('pointerup',end);drag.addEventListener('pointercancel',end);
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(6,Math.min(120,zoom*Math.exp(e.deltaY*.001)));paint();},{passive:false});
 let mapDrag=null;
 canvas.addEventListener('pointerdown',e=>{mapDrag={id:e.pointerId,x:e.clientX,y:e.clientY,panX,panZ};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!mapDrag||mapDrag.id!==e.pointerId)return;panX=mapDrag.panX-(e.clientX-mapDrag.x)/canvas.clientWidth*(2*zoom);panZ=mapDrag.panZ+(e.clientY-mapDrag.y)/canvas.clientHeight*(2*zoom);paint();});
 canvas.addEventListener('pointerup',()=>mapDrag=null);canvas.addEventListener('pointercancel',()=>mapDrag=null);
 function paint(){
  if(panel.hidden||minimized)return;
  const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#101e2d';ctx.fillRect(0,0,w,h);
  const toXY=(x,z)=>[w/2+(x-panX)/(2*zoom)*w,h/2+(z-panZ)/(2*zoom)*h];
  ctx.lineWidth=1;ctx.strokeStyle='#29475a';
  for(let v=-35;v<=35;v+=5){const [x1,y1]=toXY(v,-35),[x2,y2]=toXY(v,35);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();const [xa,ya]=toXY(-35,v),[xb,yb]=toXY(35,v);ctx.beginPath();ctx.moveTo(xa,ya);ctx.lineTo(xb,yb);ctx.stroke();}
  ctx.strokeStyle='#5b7d8b';const [fl,ft]=toXY(-35,-35),[fr,fb]=toXY(35,35);ctx.strokeRect(fl,ft,fr-fl,fb-ft);
  for(const obj of world.robotEditor?.items||[]){if(!obj?.visible)continue;const kind=obj.userData?.editorKind||'';const pos=obj.getWorldPosition?.(world.camera.position.clone());if(!pos)continue;const [x,y]=toXY(pos.x,pos.z);if(x<-10||y<-10||x>w+10||y>h+10)continue;
   const size=kind==='robot'?5:kind==='light'?3:4;ctx.fillStyle=kind==='robot'?'#7fe4c0':kind==='light'?'#ffe094':'#80b2e4';ctx.strokeStyle='#0b1526';ctx.lineWidth=1.5;
   if(kind==='robot'){ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();ctx.stroke();let yaw=obj.rotation.y;ctx.strokeStyle='#f3fff8';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.sin(yaw)*11,y+Math.cos(yaw)*11);ctx.stroke();}
   else{ctx.fillRect(x-size,y-size,size*2,size*2);ctx.strokeRect(x-size,y-size,size*2,size*2);}
  }
  // The route overlay uses the same geometry-based obstacle footprints as
  // autonomous robot navigation, not a separate guessed radar map.
  const editor=world.robotEditor,selected=editor?.robot?.();
  if(selected&&selected.userData?.robotGoal){
   const footprint=editor.navigationObstacles?.(selected)||[];
   ctx.save();ctx.fillStyle='rgba(242,146,116,.12)';ctx.strokeStyle='rgba(242,146,116,.5)';ctx.lineWidth=1;
   for(const box of footprint){const [a,b]=toXY(box.minX,box.minZ),[c,d]=toXY(box.maxX,box.maxZ);
     ctx.fillRect(a,b,c-a,d-b);ctx.strokeRect(a,b,c-a,d-b);}
   const path=[selected.position,selected.userData.robotGoal,...(selected.userData.robotWaypoints||[])];
   ctx.strokeStyle='#6ce3dd';ctx.lineWidth=2.3;ctx.beginPath();
   path.forEach((point,i)=>{const [x,y]=toXY(point.x,point.z);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();
   ctx.restore();
  }
  const c=world.camera.position,dir=world.camera.getWorldDirection(world.camera.position.clone().set(0,0,-1));const [cx,cy]=toXY(c.x,c.z);ctx.fillStyle='#ffb4cb';ctx.beginPath();ctx.arc(cx,cy,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffb4cb';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+dir.x*19,cy+dir.z*19);ctx.stroke();
  ctx.font='11px system-ui';ctx.fillStyle='#e0edf9';ctx.fillText('N',w/2-3,14);
 }
 let prior=0;function tick(t){if(!panel.hidden&&!minimized&&t-prior>150){prior=t;paint();}requestAnimationFrame(tick);}requestAnimationFrame(tick);
 window.addEventListener('resize',()=>{const r=panel.getBoundingClientRect();if(r.right>innerWidth){panel.style.left=Math.max(0,innerWidth-panel.offsetWidth)+'px';panel.style.right='auto';}});
}
