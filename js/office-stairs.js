import * as THREE from 'three';
import {sanitiseStairs,stairSegments} from './office-stairs-math.js';
import {cleanStairExtras} from './stair-extensions.js';
import {liftPanelState,LIFT_BUTTON_COLORS,liftCallState,LIFT_CALL_COLORS} from './lift-panel-state.js';
import {wallPresetTexture} from './office-walls.js';
export {sanitiseStairs,stairSegments} from './office-stairs-math.js';
const cachedTextures=new Map();
function textureFor(name){
 if(name==='none')return null;
 if(!cachedTextures.has(name)){
  if(name==='metal'||name==='tiles'){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle=name==='metal'?'#c2cbd2':'#d4dade';ctx.fillRect(0,0,128,128);ctx.strokeStyle=name==='metal'?'#a6b2bf':'#a7b4bd';ctx.lineWidth=2;
   for(let n=0;n<=128;n+=name==='metal'?8:32){ctx.beginPath();ctx.moveTo(n,0);ctx.lineTo(n,128);ctx.moveTo(0,n);ctx.lineTo(128,n);ctx.stroke();}
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;cachedTextures.set(name,texture);
  }else cachedTextures.set(name,wallPresetTexture(name));
 }
 return cachedTextures.get(name);
}
function material(spec,{metal=false}={}){const glass=spec.material==='glass';return new THREE.MeshStandardMaterial({color:spec.color,transparent:spec.opacity<1||glass,opacity:glass?Math.min(.55,spec.opacity):spec.opacity,roughness:glass?.1:metal?.36:.82,metalness:metal?.67:0,map:textureFor(spec.texture),side:THREE.DoubleSide});}
function box(group,{x,y,z,width,height,depth,yaw=0},mat,tag='stairStructure'){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.02,width),Math.max(.02,height),Math.max(.02,depth)),mat);
 mesh.position.set(x,y,z);mesh.rotation.y=yaw;mesh.userData[tag]=true;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
}
function rod(group,a,b,radius,mat,tag='stairStructure'){
 const start=new THREE.Vector3(a.x,a.y,a.z),end=new THREE.Vector3(b.x,b.y,b.z),dir=end.clone().sub(start);if(dir.length()<.01)return;
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,dir.length(),6),mat);
 mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
 mesh.userData[tag]=true;mesh.castShadow=true;group.add(mesh);
}
function stairDecoration(group,s,segments){
 const {rail,roof,supports}=s;
 const sides=(mode)=>mode==='both'?[-1,1]:mode==='left'?[1]:mode==='right'?[-1]:[0];
 if(supports.enabled){const mat=material(supports);for(let i=0;i<segments.length;i+=supports.every){const st=segments[i];for(const side of sides(supports.side)){
  const offset=side*(st.width/2-supports.width/2),x=st.x-Math.sin(st.yaw)*offset,z=st.z-Math.cos(st.yaw)*offset;
  if(st.top>.1)box(group,{x,z,y:st.top/2,width:supports.width,height:st.top,depth:supports.width},mat);
 }}}
 if(rail.enabled){const mat=material(rail,{metal:rail.material==='metal'});
  // One handrail and N infill rails per span; posts are spaced in stair steps.
  for(const side of sides(rail.side)){
   if(side===0)continue;
   const anchors=[];
   for(let i=0;i<segments.length;i+=rail.every){const st=segments[i],offset=side*st.width/2;anchors.push({x:st.x-Math.sin(st.yaw)*offset,y:st.top,z:st.z-Math.cos(st.yaw)*offset});}
   const last=segments.at(-1),offset=side*last.width/2;
   const lastAnchor={x:last.x-Math.sin(last.yaw)*offset,y:last.top,z:last.z-Math.cos(last.yaw)*offset};
   if(!anchors.length||Math.hypot(anchors.at(-1).x-lastAnchor.x,anchors.at(-1).z-lastAnchor.z)>.05)anchors.push(lastAnchor);
   for(const a of anchors)rod(group,a,{...a,y:a.y+rail.height},rail.width/2,mat);
   for(let i=1;i<anchors.length;i++)for(let j=1;j<=rail.rods+1;j++){
    const lift=rail.height*j/(rail.rods+1);
    rod(group,{...anchors[i-1],y:anchors[i-1].y+lift},{...anchors[i],y:anchors[i].y+lift},rail.width*(j===rail.rods+1?.62:.35),mat);
   }
  }
 }
 if(roof.enabled){const mat=material(roof);for(const st of segments){
  const y=st.top+roof.height;
  box(group,{x:st.x,z:st.z,y,width:Math.max(.05,st.depth-.018),height:roof.thickness,depth:st.width+.18,yaw:st.yaw},mat);
  if(roof.walls)for(const side of [-1,1]){const offset=side*(st.width/2+.08);
   box(group,{x:st.x-Math.sin(st.yaw)*offset,z:st.z-Math.cos(st.yaw)*offset,y:st.top+roof.height/2,width:Math.max(.05,st.depth-.018),height:Math.max(.05,roof.height-.025),depth:.10,yaw:st.yaw},mat);
  }
 }}
}
const floorGlyphTextures=new Map();
function floorGlyph(level){
 if(!floorGlyphTextures.has(level)){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,128,128);ctx.font='bold 84px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f5ffe8';ctx.fillText(String(level),64,67);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;floorGlyphTextures.set(level,tex);
 }
 return floorGlyphTextures.get(level);
}
function liftControlColumn(group,s,side,inside){
 const count=s.lift.levels,spacing=Math.min(.205,(s.lift.cabinHeight-.55)/count),height=count*spacing+.17;
 const x=side*(s.width/2+(inside?-.10:.14)),z=-Math.max(.30,s.width*.31);
 const housing=material({color:'#30373c',opacity:1,material:'metal',texture:'none'},{metal:true});
 box(group,{x,y:.48+height/2,z,width:.065,height,depth:.28},housing,'liftControlHousing');
 const faceDirection=inside?-side:side;
 for(let level=0;level<count;level++){
  const size=Math.min(.15,spacing*.78),y=.58+level*spacing;
  const key=new THREE.Mesh(new THREE.BoxGeometry(.065,size,size),new THREE.MeshStandardMaterial({color:LIFT_BUTTON_COLORS.idle,roughness:.36,metalness:.25,emissive:LIFT_BUTTON_COLORS.idle,emissiveIntensity:.22}));
  key.position.set(x+faceDirection*.055,y,z);key.userData.liftLevel=level;key.userData.liftButton=true;key.userData.liftButtonInside=inside;key.userData.liftColor='idle';
  key.name='Lift level '+(level+1);group.add(key);
  // The digit faces the user on the visible side of each physical switch.
  const label=new THREE.Mesh(new THREE.PlaneGeometry(size*.86,size*.86),new THREE.MeshBasicMaterial({map:floorGlyph(level+1),transparent:true,side:THREE.DoubleSide,depthWrite:false}));
  label.rotation.y=faceDirection*Math.PI/2;label.position.set(x+faceDirection*.092,y,z);label.userData.liftDecoration=true;label.userData.liftButton=true;label.userData.liftLabel=true;label.userData.liftLevel=level;group.add(label);
 }
}
function liftFloorReadout(group,s){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const dark=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});
 const digit=new THREE.Mesh(new THREE.PlaneGeometry(.68,.68),dark);
 digit.position.set(-s.width/2+.11,Math.min(1.6,s.lift.cabinHeight-.45),0);
 digit.rotation.y=Math.PI/2;digit.userData.liftReadout={canvas,texture,last:''};digit.name='Lift floor display';group.add(digit);
}
// Per-level summon stations are attached to the counter-moving landing group,
// not to the travelling cabin. This keeps them accessible at every floor.
function liftLandingCall(shaft,s,level,depth,trim){
 const side=s.lift.callSide==='left'?-1:1;
 const x=side*(s.width/2+.25),y=level*s.lift.levelHeight+1.15,z=-depth/2-.14;
 box(shaft,{x,y,z:z+.025,width:.24,height:.32,depth:.10},trim,'liftCallHousing');
 const key=new THREE.Mesh(new THREE.CylinderGeometry(.087,.087,.052,18),new THREE.MeshStandardMaterial({color:LIFT_CALL_COLORS.idle,metalness:.15,roughness:.36,emissive:LIFT_CALL_COLORS.idle,emissiveIntensity:.3}));
 key.rotation.x=Math.PI/2;key.position.set(x,y,z-.055);
 key.name='Call lift to level '+(level+1);
 key.userData.liftButton=true;key.userData.liftCallButton=true;key.userData.liftLevel=level;key.userData.liftColor='idle';
 shaft.add(key);
 // Number beneath the physical red switch, on the entrance-facing side.
 const label=new THREE.Mesh(new THREE.PlaneGeometry(.13,.13),new THREE.MeshBasicMaterial({map:floorGlyph(level+1),transparent:true,side:THREE.DoubleSide,depthWrite:false}));
 label.position.set(x,y-.17,z-.079);
 label.name='Call lift level '+(level+1)+' label';
 label.userData.liftDecoration=true;label.userData.liftButton=true;label.userData.liftCallButton=true;label.userData.liftLabel=true;label.userData.liftLevel=level;
 shaft.add(label);
}
export function updateLiftPanel(group){
 const lift=group?.userData?.stairs?.lift;if(!lift)return;
 const runtime=group.userData.stairRuntime||{height:lift.currentHeight,target:lift.target,moving:false};
 const state=liftPanelState(lift,runtime);
 group.traverse(child=>{
  if(child.userData.liftButton&&!child.userData.liftLabel){
   const status=child.userData.liftCallButton?liftCallState(lift,runtime,child.userData.liftLevel):state.colors[child.userData.liftLevel];
   if(child.userData.liftColor!==status){const color=(child.userData.liftCallButton?LIFT_CALL_COLORS:LIFT_BUTTON_COLORS)[status];if(color!==undefined){child.material.color.setHex(color);child.material.emissive.setHex(color);child.userData.liftColor=status;}}
  }
  if(child.userData.liftReadout){const display=String(state.display);if(child.userData.liftReadout.last===display)return;
   const {canvas,texture}=child.userData.liftReadout,ctx=canvas.getContext('2d');ctx.fillStyle='#14262b';ctx.fillRect(0,0,256,256);ctx.strokeStyle='#6b9c88';ctx.lineWidth=10;ctx.strokeRect(6,6,244,244);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#cbffda';ctx.font='bold 188px system-ui';ctx.fillText(display,128,133);texture.needsUpdate=true;child.userData.liftReadout.last=display;
  }
 });
}

function liftCabin(group,s){
 const {lift}=s,mat=material(s.surface),trim=material(s.rail,{metal:true});const w=s.width,depth=Math.max(1.25,Math.min(3.5,s.width*1.25)),h=lift.cabinHeight;
 // Open front and back: entrance at one end; exit at the destination level.
 box(group,{x:0,y:.07,z:0,width:w,height:.14,depth},mat,'stairTread');
 for(const side of [-1,1]){
  box(group,{x:side*(w/2-.04),y:h/2,z:0,width:.08,height:h,depth},mat);
  for(const end of [-1,1])box(group,{x:side*(w/2-.04),y:h/2,z:end*(depth/2-.04),width:.08,height:h,depth:.08},trim);
 }
 box(group,{x:0,y:h,z:0,width:w,height:.1,depth},mat);
 // Floor keys remain attached to the moving cabin: one inside, one outside.
 liftControlColumn(group,s,1,false);
 liftControlColumn(group,s,1,true);
 liftFloorReadout(group,s);
 // Static landing frames at each stop. The runner cancels the cabin's vertical
 // transform on this child, keeping every landing at a fixed world elevation.
 const shaft=new THREE.Group();shaft.name='Lift landings';shaft.userData.stairShaft=true;
 const levels=lift.levels,total=(levels-1)*lift.levelHeight;
 for(let level=0;level<levels;level++){
  const y=level*lift.levelHeight;
  for(const side of [-1,1])for(const end of [-1,1]){
   box(shaft,{x:side*w/2,y:y+h/2,z:end*depth/2,width:.065,height:h,depth:.065},trim);
  }
  for(const end of [-1,1])box(shaft,{x:0,y:y+h+.04,z:end*depth/2,width:w+.15,height:.08,depth:.08},trim);
  if(lift.callButtons)liftLandingCall(shaft,s,level,depth,trim);
 }
 for(const side of [-1,1])for(const end of [-1,1])box(shaft,{x:side*w/2,y:total/2,z:end*depth/2,width:.045,height:total+.1,depth:.045},trim);
 shaft.position.y=-(lift.currentHeight||0);
 group.add(shaft);
 group.userData.liftFootprint={width:w,depth};
 updateLiftPanel(group);
}
export function rebuildOfficeStairs(group,params={}){
 const s=sanitiseStairs(params);
 for(const child of [...group.children]){group.remove(child);child.traverse(node=>{node.userData.liftReadout?.texture?.dispose();node.geometry?.dispose?.();node.material?.dispose?.();});}
 group.userData.stairs=s;
 if(s.variant==='lift'){
  liftCabin(group,s);
 }else{
  const segments=stairSegments(s),mat=material(s.surface,{metal:s.surface.material==='metal'});
  for(const spec of segments){box(group,{x:spec.x,y:spec.y,z:spec.z,width:spec.depth,height:spec.height,depth:spec.width,yaw:spec.yaw},mat,'stairTread');}
  if(s.variant!=='standard')stairDecoration(group,s,segments);
  if(['escalator','walkway'].includes(s.variant)&&segments.length){
   const indicatorMat=new THREE.MeshBasicMaterial({color:'#49c7d8',transparent:true,opacity:.63,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
   for(let i=0;i<Math.min(16,segments.length);i++){
    const st=segments[Math.floor(i*segments.length/Math.min(16,segments.length))];
    const indicator=box(group,{x:st.x,y:st.top+.026,z:st.z,width:.055,height:.015,depth:Math.min(.24,st.width*.45),yaw:st.yaw},indicatorMat,'transportMarker');
    indicator.userData.transportPhase=i/Math.min(16,segments.length);
   }
  }
 }
 return group;
}
export function makeOfficeStairs(params={}){const group=new THREE.Group();group.userData.editorKind='stairs';group.name='Office stairs';return rebuildOfficeStairs(group,params);}
