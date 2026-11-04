import * as THREE from 'three';
import {naturalTexture,NATURAL_MATERIALS} from './procedural-natural-textures.js';
import {sanitiseWall,wallSegments,wallWindowLayout,pointWithinPolygon,wallArrayTransforms,wallRoofCopyIndices} from './office-wall-math.js';
export {sanitiseWall,simplifyWallPoints,smoothWallPoints,snapWallPoint,wallSegments,wallWorldToLocal,wallRoofCopyIndices} from './office-wall-math.js';

export function wallPresetTexture(name,options={}){
 if(['wood','marble','granite'].includes(name))return naturalTexture(name,options);
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
 ctx.fillStyle=name==='bricks'?'#bc876b':name==='concrete'?'#a0a5ab':'#e0e4de';ctx.fillRect(0,0,256,256);
 if(name==='bricks'){ctx.strokeStyle='#61554c';ctx.lineWidth=5;for(let row=0;row<8;row++){ctx.beginPath();ctx.moveTo(0,row*32);ctx.lineTo(256,row*32);ctx.stroke();for(let col=0;col<5;col++){const x=col*64+(row%2?32:0);ctx.beginPath();ctx.moveTo(x,row*32);ctx.lineTo(x,(row+1)*32);ctx.stroke();}}}
 else if(name==='concrete'){for(let i=0;i<250;i++){const x=(i*83)%256,y=(i*157)%256;ctx.fillStyle=i%3?'#969ca2':'#abb0b3';ctx.fillRect(x,y,2+i%4,2+i%3);}}
 else {ctx.fillStyle='#d5dad6';for(let i=0;i<30;i++)ctx.fillRect((i*41)%256,(i*71)%256,60,1);}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1,1);return texture;
}
function loadCustomWallTexture(group,id){
 if(!id||!window.solviAPI?.mediaBlobInfo)return;
 const previous=group.userData.wallTextureSource;
 if(previous?.id===id)return;
 const state={id,token:Symbol('wall-texture')};group.userData.wallTextureSource=state;
 window.solviAPI.mediaBlobInfo(id).then(info=>{
  if(group.userData.wallTextureSource!==state){URL.revokeObjectURL(info.url);return;}
  new THREE.TextureLoader().load(info.url,tex=>{
   URL.revokeObjectURL(info.url);
   if(group.userData.wallTextureSource!==state){tex.dispose();return;}
   tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
   state.texture=tex;
   for(const child of group.children){if(child.userData.wallSegment){child.material.map=tex;child.material.needsUpdate=true;}}
  },undefined,()=>URL.revokeObjectURL(info.url));
 }).catch(()=>{});
}
const solid=(w,h,d,mat,x,y,z,yaw,group,extra={})=>{
 if(w<.009||h<.009||d<.009)return;
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
 mesh.position.set(x,y,z);mesh.rotation.y=yaw;mesh.castShadow=true;mesh.receiveShadow=true;
 Object.assign(mesh.userData,{wallSegment:true},extra);group.add(mesh);return mesh;
};
function wallMaterial(s,texture){
 const glass=s.texture==='glass';
 return new THREE.MeshPhysicalMaterial({color:s.color,map:texture,roughness:glass?.12:.82,metalness:0,
  transparent:s.opacity<1||glass,opacity:s.opacity,transmission:glass?.76:0,
  ior:1.45,thickness:glass?s.width:0,depthWrite:s.opacity>.98&&!glass,side:THREE.DoubleSide});
}
export function rebuildOfficeWall(group,settings,lifts=[]){
 const s=sanitiseWall(settings);
 const prior=group.userData.wallTextureSource;
 const retain=prior&&s.texture==='custom'&&s.textureMediaId===prior.id;
 for(const child of [...group.children]){group.remove(child);child.traverse?.(m=>{m.geometry?.dispose();if(m.material?.map&&m.material.map!==prior?.texture)m.material.map.dispose();m.material?.dispose?.();});}
 if(prior&&!retain){prior.texture?.dispose();group.userData.wallTextureSource=null;}
 group.userData.wall=s;
 const segments=wallSegments(s);
 let windowId=0;
 for(const [segmentIndex,seg] of segments.entries()){
  const tex=s.texture==='glass'||s.texture==='custom'?(retain?prior.texture||null:null):wallPresetTexture(s.texture,{scale:s.textureScale,distortion:s.textureDistortion,contrast:s.textureContrast});
  const material=wallMaterial(s,tex);
  const doorOn=s.doors.enabled&&s.doors.segments.includes(segmentIndex)&&seg.length>s.doors.width+.24;
  const openings=doorOn?[]:wallWindowLayout(seg.length,s.height,s.windows);
  const c=Math.cos(seg.yaw),sn=Math.sin(seg.yaw);
  const add=(w,h,d,lx,cy,lz=0,mat=material,extra={})=>solid(w,h,d,mat,seg.x+c*lx+sn*lz,cy,seg.z-sn*lx+c*lz,seg.yaw,group,extra);
  let cursor=-seg.length/2;
  if(doorOn){
   const width=Math.min(s.doors.width,seg.length-.24),height=Math.min(s.height-.12,s.doors.height);
   const left=-width/2,right=width/2;
   add(left-cursor,s.height,s.width,(cursor+left)/2,s.height/2);
   add(width,s.height-height,s.width,0,height+(s.height-height)/2);
   const frame=new THREE.MeshStandardMaterial({color:'#6f7782',roughness:.68});
   add(.065,height,.07,left+.015,height/2,0,frame,{wallDoorFrame:true});
   add(.065,height,.07,right-.015,height/2,0,frame,{wallDoorFrame:true});
   add(width+.07,.075,.07,0,height+.035,0,frame,{wallDoorFrame:true});
   cursor=right;
  }
  for(const slot of openings){
   const left=slot.x-slot.width/2,right=slot.x+slot.width/2,top=slot.bottom+slot.height;
   add(left-cursor,s.height,s.width,(cursor+left)/2,s.height/2);
   add(slot.width,slot.bottom,s.width,slot.x,slot.bottom/2);
   add(slot.width,s.height-top,s.width,slot.x,top+(s.height-top)/2);
   // Separate glass is not a wall section; opening it removes its collider, not the adjacent masonry.
   const open=s.windows.openIds.includes(windowId);
   const swing=open?Math.PI*.48:0;
   const glassMaterial=new THREE.MeshPhysicalMaterial({color:s.windows.color,roughness:.09,metalness:0,
    transparent:true,opacity:s.windows.opacity,transmission:.72,ior:1.46,side:THREE.DoubleSide,depthWrite:false});
   const leftHinge=left,half=slot.width/2, localX=leftHinge+half*Math.cos(swing),localZ=half*Math.sin(swing);
   solid(slot.width,slot.height,.028,glassMaterial,seg.x+c*localX+sn*localZ,slot.bottom+slot.height/2,
    seg.z-sn*localX+c*localZ,seg.yaw+swing,group,{wallGlass:true,windowId,wallSegment:!open,windowHinge:[seg.x+c*left,seg.z-sn*left],windowYaw:seg.yaw,windowHalf:half});
   if(s.windows.openable){
    for(const face of [-1,1]){
     const button=new THREE.Mesh(new THREE.SphereGeometry(.07,10,8),new THREE.MeshBasicMaterial({color:open?0x8eeaaa:0x77dbff}));
     const bx=right-.16;button.position.set(seg.x+c*bx+sn*(face*s.width*.60),slot.bottom+.17,seg.z-sn*bx+c*(face*s.width*.60));
     button.userData.wallWindowButton=true;button.userData.windowId=windowId;
     group.add(button);
    }
   }
   cursor=right;windowId++;
  }
  add(seg.length/2-cursor,s.height,s.width,(cursor+seg.length/2)/2,s.height/2);
 }
 const area=s.points.reduce((sum,[x,z],i)=>{const [nx,nz]=s.points[(i+1)%s.points.length];return sum+x*nz-nx*z;},0)/2;
 if(s.ceiling.enabled&&s.points.length>=3&&Math.abs(area)>.4){
  const shape=new THREE.Shape();
  s.points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
  // Project lift footprints into the wall's local plane and cut real holes into the ceiling.
  if(s.ceiling.autoLiftOpenings){
   group.updateWorldMatrix(true,false);
   for(const lift of lifts){
    if(lift?.userData?.stairs?.variant!=='lift')continue;
    const pivot=lift.getWorldPosition(new THREE.Vector3());
    const center=group.worldToLocal(pivot.clone());
    if(!pointWithinPolygon([center.x,center.z],s.points))continue;
    const width=Math.max(1.2,Number(lift.userData.stairs.width)||1.6)+.5;
    const depth=Math.max(1.25,Math.min(3.5,width/1.6*1.25))+.5;
    // Four corners are transformed individually so wall and lift rotation remain independent.
    const path=new THREE.Path();let corners=[];
    for(const [dx,dz] of [[-width/2,-depth/2],[-width/2,depth/2],[width/2,depth/2],[width/2,-depth/2]]){
     const pos=group.worldToLocal(lift.localToWorld(new THREE.Vector3(dx,0,dz)));
     corners.push([pos.x,-pos.z]);
    }
    corners.forEach(([x,y],i)=>i?path.lineTo(x,y):path.moveTo(x,y));path.closePath();
    if(corners.every(([x,y])=>pointWithinPolygon([x,-y],s.points)))shape.holes.push(path);
   }
  }
  const geom=new THREE.ExtrudeGeometry(shape,{depth:s.ceiling.thickness,bevelEnabled:false,steps:1,curveSegments:2});
  geom.rotateX(-Math.PI/2);
  const ceiling=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({color:s.ceiling.color,roughness:.86,
   map:wallPresetTexture(s.ceiling.texture,{scale:s.textureScale,distortion:s.textureDistortion,contrast:s.textureContrast}),side:THREE.DoubleSide}));
  ceiling.position.y=s.height-s.ceiling.thickness;
  ceiling.userData.wallCeiling=true;ceiling.receiveShadow=true;ceiling.castShadow=true;group.add(ceiling);
 }
  // A bounded, independent roof mesh sits above the room outline. A pitched
  // roof slopes to one of four directions; pyramid roofs rise at the centre.
  // Flat skylights have a genuine rectangular cut-out in their deck mesh.
  if(s.roof.enabled&&s.closed&&s.points.length>=3){
   const xs=s.points.map(pt=>pt[0]),zs=s.points.map(pt=>pt[1]),o=s.roof.overhang;
   const x0=Math.min(...xs)-o,x1=Math.max(...xs)+o,z0=Math.min(...zs)-o,z1=Math.max(...zs)+o;
   const cx=(x0+x1)/2,cz=(z0+z1)/2,y=s.height+.025,r=s.roof;
   const mat=new THREE.MeshStandardMaterial({color:r.color,roughness:.86,side:THREE.DoubleSide,
    map:wallPresetTexture(r.texture,{scale:s.textureScale,distortion:s.textureDistortion,contrast:s.textureContrast})});
   const addRoof=(points,indices)=>{
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    const roofMesh=new THREE.Mesh(geometry,mat);roofMesh.castShadow=true;roofMesh.receiveShadow=true;roofMesh.userData.wallCeiling=true;roofMesh.userData.wallRoof=true;group.add(roofMesh);
   };
   if(r.style==='flat'){
    const outline=new THREE.Shape();outline.moveTo(x0,-z0);outline.lineTo(x1,-z0);outline.lineTo(x1,-z1);outline.lineTo(x0,-z1);outline.closePath();
    if(r.skylight&&x1-x0>2&&z1-z0>2){const w=Math.min(1.3,(x1-x0)*.29),d=Math.min(1.1,(z1-z0)*.29);
     const opening=new THREE.Path();opening.moveTo(cx-w/2,-cz-d/2);opening.lineTo(cx-w/2,-cz+d/2);opening.lineTo(cx+w/2,-cz+d/2);opening.lineTo(cx+w/2,-cz-d/2);opening.closePath();outline.holes.push(opening);}
    const deck=new THREE.ExtrudeGeometry(outline,{depth:r.thickness,bevelEnabled:false});deck.rotateX(-Math.PI/2);
    const roofMesh=new THREE.Mesh(deck,mat);roofMesh.position.y=y;roofMesh.userData.wallCeiling=true;roofMesh.userData.wallRoof=true;roofMesh.receiveShadow=true;roofMesh.castShadow=true;group.add(roofMesh);
   }else if(r.style==='pyramid'){
    const corners=[[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1],[cx,y+r.rise,cz]];
    addRoof(corners,[0,1,4,1,2,4,2,3,4,3,0,4]);
   }else{
    const up=(x,z)=>r.direction==='north'?(z1-z)/(z1-z0):r.direction==='south'?(z-z0)/(z1-z0):r.direction==='east'?(x-x0)/(x1-x0):(x1-x)/(x1-x0);
    addRoof([[x0,y+r.rise*up(x0,z0),z0],[x1,y+r.rise*up(x1,z0),z0],[x1,y+r.rise*up(x1,z1),z1],[x0,y+r.rise*up(x0,z1),z1]],[0,1,2,0,2,3]);
   }
   if(r.chimney){const chimney=new THREE.Mesh(new THREE.BoxGeometry(.43,1.0,.43),new THREE.MeshStandardMaterial({color:'#82746e',roughness:.85}));chimney.position.set(x0+.8,y+r.rise*.7+.45,z0+.8);chimney.userData.wallSegment=true;chimney.userData.wallRoofAccessory=true;chimney.castShadow=true;group.add(chimney);}
   if(r.solarPanels){const panelMaterial=new THREE.MeshStandardMaterial({color:'#183c5b',metalness:.38,roughness:.35});
    for(let i=0;i<3;i++){const panel=new THREE.Mesh(new THREE.BoxGeometry(.72,.035,1.25),panelMaterial);
     panel.position.set(cx+(i-1)*.82,y+r.rise+.055,cz);panel.userData.wallRoofPanel=true;panel.rotation.x=r.style==='shed'?.17:0;group.add(panel);}}
   if(r.skylight&&r.style!=='flat'){const glass=new THREE.Mesh(new THREE.PlaneGeometry(.9,.8),new THREE.MeshPhysicalMaterial({color:'#97c8dd',transparent:true,opacity:.5,side:THREE.DoubleSide,roughness:.08}));glass.rotation.x=-Math.PI/2;glass.position.set(cx,y+r.rise+.02,cz);glass.userData.wallRoofPanel=true;group.add(glass);}
  }
 // Roofs and their accessories must follow the topmost vertical floor only.
 // The authored base roof is used as a cloning source when a higher floor wins.
 // Intermediate ceilings are kept on every level and are never filtered here.
 const roofCopies=new Set(wallRoofCopyIndices(s));
 const isRoofPart=child=>Boolean(child.userData.wallRoof||child.userData.wallRoofPanel||child.userData.wallRoofAccessory);
 // Arrays are one saved, editable room object. Flatten generated meshes into direct
 // children so existing Rapier compound-collider traversal includes every copy.
 if(s.array.enabled&&s.closed&&s.points.length>=3){
  const originals=[...group.children];
  for(const copy of wallArrayTransforms(s).slice(1)){
   const pivot=new THREE.Vector3(...copy.pivot),displacement=new THREE.Vector3(...copy.offset);
   const quaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(...copy.rotation,'XYZ'));
   const matrix=new THREE.Matrix4().makeTranslation(...copy.offset)
    .multiply(new THREE.Matrix4().makeTranslation(...copy.pivot))
    .multiply(new THREE.Matrix4().compose(new THREE.Vector3(),quaternion,new THREE.Vector3(...copy.scale)))
    .multiply(new THREE.Matrix4().makeTranslation(-pivot.x,-pivot.y,-pivot.z));
   for(const original of originals){
    if(isRoofPart(original)&&!roofCopies.has(copy.index))continue;
    const clone=original.clone(false);
    clone.geometry=original.geometry.clone();clone.material=original.material.clone();
    clone.userData={...original.userData};
    const localId=original.userData.windowId;
    if(Number.isInteger(localId)){
     clone.userData.windowId=copy.index*1024+localId;
     const open=s.windows.openIds.includes(clone.userData.windowId);
     if(original.userData.wallGlass){
      const [hx,hz]=original.userData.windowHinge;
      const yaw=original.userData.windowYaw,swing=open?Math.PI*.48:0,half=original.userData.windowHalf;
      const lx=half*Math.cos(swing),lz=half*Math.sin(swing);
      clone.position.set(hx+Math.cos(yaw)*lx+Math.sin(yaw)*lz,original.position.y,hz-Math.sin(yaw)*lx+Math.cos(yaw)*lz);
      clone.rotation.y=yaw+swing;clone.userData.wallSegment=!open;
     }else if(original.userData.wallWindowButton)clone.material.color.set(open?0x8eeaaa:0x77dbff);
    }
    clone.updateMatrix();
    const transform=matrix.clone().multiply(clone.matrix);
    transform.decompose(clone.position,clone.quaternion,clone.scale);
    group.add(clone);
   }
  }
  if(!roofCopies.has(0))for(const original of originals){
   if(isRoofPart(original)){
    group.remove(original);
    original.geometry?.dispose();original.material?.dispose?.();
   }
  }
 }
 if(s.texture==='custom'&&s.textureMediaId&&!retain)loadCustomWallTexture(group,s.textureMediaId);
 return group;
}
export function makeOfficeWall(settings={}){const group=new THREE.Group();group.userData.editorKind='wall';group.name='Office wall';group.userData.wall=sanitiseWall(settings);rebuildOfficeWall(group,group.userData.wall);return group;}
