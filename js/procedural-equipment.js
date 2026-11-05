import * as THREE from 'three';
// Procedural assets share the existing furniture scene, preset and collider paths.
export const EQUIPMENT_TYPES=['tv','monitor','miniComputer','keyboard','trackpad','mouse','printer','laptop','fridge','bin','backpack','sunbed','deckChair','beachUmbrella','lamp','speaker'];
export const EQUIPMENT_NUMERIC={diagonalInches:[27,6,120],bezel:[.015,.003,.12],standHeight:[.17,0,1.2],curvature:[0,0,1],strapWidth:[.04,.01,.15],rimWidth:[.018,.005,.1],reclineDeg:[30,0,85],canopyRadius:[1.35,.4,4],canopySegments:[8,3,16],lampIntensity:[2,0,20],lampRange:[8,.5,80],shadeOpacity:[.55,.05,1]};
export function displayDimensions(p){const [a,b]=({'16:9':[16,9],'21:9':[21,9],'4:3':[4,3]})[p.aspect]||[16,9];const diagonal=p.diagonalInches*.0254;return {width:diagonal*a/Math.hypot(a,b),height:diagonal*b/Math.hypot(a,b)};}
export function buildEquipment(p,{add,box,cylinder,wood,fabric,partsAddLight}){
 const dark=new THREE.MeshStandardMaterial({color:'#17202a',roughness:.5,metalness:.2});
 const indicator=new THREE.MeshBasicMaterial({color:p.fabricColor});
 if(p.variant==='tv'||p.variant==='monitor'){
  const {width:w,height:h}=displayDimensions(p),d=Math.max(.025,Math.min(.2,p.depth*.25));
  const lift=['feet','center'].includes(p.mount)?p.standHeight:0,y=lift+h/2;
  box(w+p.bezel*2,h+p.bezel*2,d,0,y,0,wood);
  const plane=new THREE.PlaneGeometry(w,h,p.variant==='monitor'&&p.curved?32:1,1);
  if(p.variant==='monitor'&&p.curved&&p.curvature){const pos=plane.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i);pos.setZ(i,p.curvature*.15*(1-(x*2/w)**2));}plane.computeVertexNormals();}
  const surface=new THREE.MeshBasicMaterial({color:p.powered?'#213b50':'#05080c',side:THREE.DoubleSide});
  const screen=add(plane,0,y,d/2+.003,surface);screen.name='equipmentScreen';screen.userData.equipmentScreen=true;
  if(p.mount==='center'){cylinder(.025,p.standHeight||.03,0,p.standHeight/2,0,dark);box(Math.max(.14,w*.22),.025,.15,0,.013,.02,dark);}
  if(p.mount==='feet')for(const s of [-1,1]){cylinder(.014,p.standHeight||.03,s*w*.36,p.standHeight/2,0,dark);box(w*.12,.02,.13,s*w*.36,.01,.02,dark);}
  if(p.mount==='wall'){box(Math.min(w*.3,.26),Math.min(.15,h*.4),.06,0,y,-d/2-.04,dark);box(.10,.08,.10,0,y,-d/2-.10,dark);}
  if(p.powered)cylinder(.004,.005,w*.45,y-h*.46,d/2+.01,indicator,8);
 }else if(p.variant==='keyboard'){
  const w=p.width,d=p.depth,h=p.height;
  box(w,h,d,0,h/2,0,dark);
  const rows=5,cols=13,keyW=w*.91/cols,keyD=d*.82/rows;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   if(row===4&&col>3&&col<9){if(col!==4)continue;const key=box(keyW*4.8,.008,keyD*.8,0,h+.004,d*.4-row*keyD,dark);key.userData.keyboardKey=true;continue;}
   const key=box(keyW*.75,.008,keyD*.72,-w*.455+(col+.5)*w*.91,h+.004,d*.38-row*keyD,dark);key.userData.keyboardKey=true;
  }
 }else if(['trackpad','mouse'].includes(p.variant)){
  const mode=p.variant==='mouse'?'mouse':p.deviceMode;
  if(mode==='mouse'){
   const shell=box(p.width*.60,p.height*.6,p.depth,0,p.height*.4,0,wood);shell.name='equipmentMouse';
   const button=box(.009,p.height*.12,p.depth*.36,0,p.height*.77,p.depth*.20,dark);button.userData.inputDevice=true;
  }else{
   const slab=box(p.width,p.height,p.depth,0,p.height/2,0,wood);slab.name='equipmentTrackpad';
   box(p.width*.91,.003,p.depth*.87,0,p.height+.003,0,dark);
   if(mode==='stylus'){
    const stylus=cylinder(.008,p.depth*.83,p.width*.35,p.height+.03,0,fabric);stylus.rotation.x=Math.PI/2;stylus.name='equipmentStylus';
   }
  }
 }else if(p.variant==='printer'){
  const w=p.width,d=p.depth,h=p.height;
  box(w,h*.70,d,0,h*.40,0,wood);
  const lid=box(w*.91,.035,d*.68,0,h*.82,-d*.12,dark);lid.name='printerLid';
  const page=box(w*.67,.009,d*.46,0,h*.12,d*.40,new THREE.MeshStandardMaterial({color:'#f0f3f6'}));page.name='printerOutput';
  box(w*.55,.016,.025,0,h*.51,d*.505,dark);
  cylinder(.012,.012,w*.35,h*.70,d*.495,indicator,10);
 }else if(p.variant==='laptop'){
  const w=p.width,d=p.depth,h=p.height,baseH=Math.max(.014,h*.22);
  box(w,baseH,d,0,baseH/2,0,wood);
  const rows=4,cols=11,keyW=w*.79/cols,keyD=d*.49/rows;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)box(keyW*.78,.003,keyD*.75,-w*.395+(col+.5)*w*.79,baseH+.003,-d*.12+(row-1.5)*keyD,dark);
  box(w*.34,.003,d*.20,0,baseH+.005,d*.33,dark);
  if(p.open){
   const ratio=displayDimensions({...p,diagonalInches:p.diagonalInches||14}),screenH=Math.min(w*ratio.height/ratio.width,h*.94),angle=THREE.MathUtils.degToRad(-(p.screenAngle-90));
   const hingeY=baseH+.025,hingeZ=-d/2+.023;
   const frame=box(w,.0+screenH+.026,.016,0,hingeY+(screenH/2+.01)*Math.cos(angle),hingeZ+(screenH/2+.01)*Math.sin(angle),wood);
   frame.rotation.x=angle;frame.name='laptopLid';frame.userData.propInteraction='toggle-open';
   const screen=add(new THREE.PlaneGeometry(w*.91,screenH*.9),0,hingeY+screenH*.52*Math.cos(angle),hingeZ+screenH*.52*Math.sin(angle)+.011,new THREE.MeshBasicMaterial({color:p.powered?'#213b50':'#05080c',side:THREE.DoubleSide}));
   screen.rotation.x=angle;screen.name='equipmentScreen';screen.userData.equipmentScreen=true;
   const hinge=box(w*.12,.023,.023,0,hingeY,hingeZ,dark);hinge.name='laptopHinge';hinge.userData.propInteraction='toggle-open';
  }else{
   const lid=box(w,.023,d,0,baseH+.02,0,wood);lid.name='laptopLid';lid.userData.propInteraction='toggle-open';
   const grip=box(w*.13,.005,.015,0,baseH+.033,d*.43,dark);grip.userData.propInteraction='toggle-open';
  }
 }else if(p.variant==='fridge'){
  const w=p.width,d=p.depth,h=p.height,t=Math.min(.065,w*.10,d*.10);
  // True hollow interior: six independent panels rather than an obstructing solid cube.
  box(w,t,d,0,t/2,0,wood);box(w,t,d,0,h-t/2,0,wood);
  for(const side of [-1,1])box(t,h-2*t,d,side*(w-t)/2,h/2,0,wood);
  box(w-2*t,h-2*t,t,0,h/2,-(d-t)/2,wood);
  const count=p.shelves;
  for(let i=1;i<=count;i++)box(w-2*t,t*.40,d-t*1.8,0,t+(h-2*t)*i/(count+1),-t*.2,fabric);
  if(p.open){
   const a=-Math.PI*.63,half=(w-t)/2,hingeX=-w/2+t/2,cz=d/2-t/2;
   const x=hingeX+Math.cos(a)*half,z=cz-Math.sin(a)*half;
   const door=box(w-t,h-t*1.5,t,x,h/2,z,wood);door.rotation.y=a;door.name='fridgeDoor';door.userData.propInteraction='toggle-open';
   const handle=box(.026,h*.23,.028,hingeX+Math.cos(a)*(w-t)*.86-Math.sin(a)*t*.7,h*.57,cz-Math.sin(a)*(w-t)*.86+Math.cos(a)*t*.7,dark);
   handle.name='fridgeHandle';handle.rotation.y=a;handle.userData.propInteraction='toggle-open';
  }else{
   const door=box(w-t,h-t*1.5,t,0,h/2,d/2,wood);door.name='fridgeDoor';door.userData.propInteraction='toggle-open';
   const handle=box(.023,h*.26,.025,w*.38,h*.58,d/2+t*.58,dark);handle.name='fridgeHandle';handle.userData.propInteraction='toggle-open';
  }
  const button=cylinder(.022,.017,w*.32,h*.89,d/2+t*.6,indicator,12);button.rotation.x=Math.PI/2;button.name='fridgeDoorButton';button.userData.propInteraction='toggle-open';
 }else if(p.variant==='miniComputer'){
  box(p.width,p.height,p.depth,0,p.height/2,0,wood);
  box(p.width*.85,.012,p.depth*.85,0,.007,0,dark);
  if(p.powered){const light=add(new THREE.SphereGeometry(.006,8,6),p.width*.35,p.height*.7,p.depth/2+.006,indicator);light.name='powerLED';}
 }else if(p.variant==='bin'){
  const h=p.height,t=Math.min(p.wallThickness,p.width*.18,p.depth*.18);
  if(p.binShape==='square'){
   box(p.width,t,p.depth,0,t/2,0);
   for(const sign of [-1,1]){box(t,h-t,p.depth,sign*(p.width-t)/2,(h+t)/2,0);box(p.width-2*t,h-t,t,0,(h+t)/2,sign*(p.depth-t)/2);}
   if(p.lid)box(p.width+.025,.025,p.depth+.025,0,h+.013,0,dark);
  }else{
   const r=p.width/2;
   // Compound side panels leave the mouth physically open: no enclosing AABB.
   const sides=16,wallLength=2*r*Math.sin(Math.PI/sides)*1.02;
   for(let i=0;i<sides;i++){const a=(i+.5)*2*Math.PI/sides;const panel=box(wallLength,h-t,t,Math.cos(a)*r,(h+t)/2,Math.sin(a)*r);panel.rotation.y=Math.PI/2-a;}
   cylinder(r*.87,t,0,t/2,0);
   if(p.lid)cylinder(r*1.04,.03,0,h+.015,0,dark);
   else {const rim=add(new THREE.RingGeometry(r-p.rimWidth,r+.005,32),0,h,0,dark);rim.rotation.x=-Math.PI/2;rim.userData.furniturePart=false;}
  }
 }else if(p.variant==='sunbed'||p.variant==='deckChair'){
  const {width:w,depth:d}=p,legHeight=p.height;
  // Two independent slabs; a rotated back does not create an invisible full-length collider.
  const frame=box(w,.07,d*.57,0,legHeight, -d*.22,wood);
  box(w*.93,.06,d*.55,0,legHeight+.065,-d*.22,fabric);
  const rise=d*.43,angle=THREE.MathUtils.degToRad(p.reclineDeg);
  const back=box(w,.065,rise,0,legHeight+Math.sin(angle)*rise/2,d*.285,wood);back.rotation.x=-angle;
  const upholstery=box(w*.94,.055,rise*.98,0,legHeight+.06+Math.sin(angle)*rise/2,d*.285,fabric);upholstery.rotation.x=-angle;
  for(const x of [-w*.43,w*.43])for(const z of [-d*.40,d*.35])box(.048,legHeight,.048,x,legHeight/2,z,dark);
 }else if(p.variant==='beachUmbrella'){
  const radius=p.canopyRadius,h=p.height,seg=p.canopySegments;
  cylinder(.027,h,0,h/2,0,dark,16);cylinder(.21,.045,0,.023,0,wood,28);
  const canopy=new THREE.ConeGeometry(radius,radius*.23,seg,1,false);
  // Open-sided, shallow pyramidal canopy. Cone is visual; pole and base have colliders.
  const shape=add(canopy,0,h-.08,0,fabric);shape.userData.furniturePart=false;
  for(let i=0;i<seg;i++){const a=i*2*Math.PI/seg;const rim=add(new THREE.SphereGeometry(.018,6,4),radius*Math.cos(a),h-radius*.23,radius*Math.sin(a),wood);rim.userData.furniturePart=false;}
 }else if(p.variant==='lamp'){
  const h=p.height,r=Math.max(.12,p.width/2);cylinder(.025,h*.75,0,h*.375,0,dark,20);cylinder(Math.min(.3,r*.7),.06,0,.03,0,dark,24);
  let geo;
  if(p.lampShape==='cube')geo=new THREE.BoxGeometry(r*1.6,r*1.4,r*1.6);
  else if(p.lampShape==='pyramid')geo=new THREE.ConeGeometry(r,r*1.5,4);
  else geo=new THREE.SphereGeometry(r,20,12);
  const shade=new THREE.MeshStandardMaterial({color:p.fabricColor,transparent:true,opacity:p.shadeOpacity,side:THREE.DoubleSide,roughness:.7,depthWrite:false,emissive:p.lampOn?p.fabricColor:'#000000',emissiveIntensity:p.lampOn?.15:0});
  const cap=add(geo,0,h-.12,0,shade);cap.name='lampShade';
  const switchMesh=box(.11,.065,.07,0,.16,r*.12,dark);switchMesh.name='lampSwitch';switchMesh.userData.lampSwitch=true;
  const light=p.lampType==='spot'?new THREE.SpotLight(p.fabricColor,p.lampOn?p.lampIntensity:0,p.lampRange,Math.PI/3,.45,1.6):new THREE.PointLight(p.fabricColor,p.lampOn?p.lampIntensity:0,p.lampRange,1.6);
  light.name='lampLight';light.position.set(0,h-.12,0);light.userData.furniturePart=false;partsAddLight(light);if(light.isSpotLight){light.target.position.set(0,0,0);light.target.userData.furniturePart=false;partsAddLight(light.target);}
 }else if(p.variant==='speaker'){
  const w=p.width,d=p.depth,h=p.height;
  const chassis=box(w,h,d,0,h/2,0,dark);chassis.name='equipmentSpeaker';
  for(const size of [Math.min(w*.33,h*.26),Math.min(w*.18,h*.15)]){
   const y=size===Math.min(w*.33,h*.26)?h*.35:h*.73;
   const cone=add(new THREE.CylinderGeometry(size*.85,size,.018,20),0,y,d/2+.015,wood);
   cone.rotation.x=Math.PI/2;cone.name='speakerCone';
  }
  const led=add(new THREE.SphereGeometry(.012,8,6),w*.35,h*.93,d/2+.025,p.powered?indicator:dark);led.name='speakerStatus';
 }else if(p.variant==='backpack'){
  const {width:w,height:h,depth:d}=p;
  box(w,h,d,0,h/2,0,wood);
  if(p.backpackStyle==='bag')box(w*.94,h*.92,d*.92,0,h/2,.017,fabric);
  if(p.frontPocket)box(w*.65,h*.28,d*.20,0,h*.3,d*.58,fabric);
  if(p.straps)for(const side of [-1,1]){
   const x=side*w*.32,curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,h*.9,-d/2),new THREE.Vector3(x,h*1.03,-d*.7),new THREE.Vector3(x,h*.7,-d*1.15),new THREE.Vector3(x,h*.35,-d*1.05),new THREE.Vector3(x,h*.1,-d/2)]);
   const strap=add(new THREE.TubeGeometry(curve,16,p.strapWidth*.28,5,false),0,0,0,dark);strap.userData.backpackStrap=true;
  }
  box(w*.32,.02,d*.45,0,h+.01,0,dark);
 }
}
