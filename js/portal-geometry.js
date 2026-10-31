import * as THREE from 'three';
import {cleanPortal} from './portal-core.js';
import {wallPresetTexture} from './office-walls.js';
const textures=new Map();
function frameTexture(name){if(name==='none')return null;if(!textures.has(name))textures.set(name,wallPresetTexture(name==='metal'?'concrete':name==='tiles'?'plaster':name));return textures.get(name);}
function slab(group,x,y,z,w,h,d,mat,tag='portalFrame'){
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
 m.position.set(x,y,z);m.userData[tag]=true;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;
}
function circlePoints(radius,start,end,segments=24){
 const points=[];for(let i=0;i<=segments;i++){const t=start+(end-start)*(i/segments);points.push(new THREE.Vector2(Math.cos(t)*radius,Math.sin(t)*radius));}return points;
}
function roundedShape(width,height,r){
 const hw=width/2,hh=height/2,rad=Math.min(r,hw*.8,hh*.8);
 const pts=[new THREE.Vector2(-hw+rad,-hh),new THREE.Vector2(hw-rad,-hh),...circlePoints(rad,-Math.PI/2,0,10).map(p=>p.add(new THREE.Vector2(hw-rad,-hh+rad))),new THREE.Vector2(hw,hh-rad),...circlePoints(rad,0,Math.PI/2,10).map(p=>p.add(new THREE.Vector2(hw-rad,hh-rad))),new THREE.Vector2(-hw+rad,hh),...circlePoints(rad,Math.PI/2,Math.PI,10).map(p=>p.add(new THREE.Vector2(-hw+rad,hh-rad))),new THREE.Vector2(-hw,-hh+rad),...circlePoints(rad,Math.PI,Math.PI*1.5,10).map(p=>p.add(new THREE.Vector2(-hw+rad,-hh+rad)))];
 return new THREE.Shape(pts);
}
function portalShape(shape,w,h){
 if(shape==='triangle'){const s=new THREE.Shape();s.moveTo(0,h/2);s.lineTo(w/2,-h/2);s.lineTo(-w/2,-h/2);s.closePath();return s;}
 if(shape==='rounded')return roundedShape(w,h,Math.min(w,h)*.22);
 return new THREE.Shape().moveTo(-w/2,-h/2).lineTo(w/2,-h/2).lineTo(w/2,h/2).lineTo(-w/2,h/2).closePath();
}
function makeRing(group,cfg,shapeMat){
 const ow=Math.min(cfg.openingWidth,cfg.width-.2),oh=Math.min(cfg.openingHeight,cfg.height-.12),depth=Math.max(.03,cfg.depth*.42);
 if(cfg.shape==='rounded'||cfg.shape==='triangle'){
  const outer=portalShape(cfg.shape,cfg.width,cfg.height),inner=portalShape(cfg.shape,ow,oh);
  outer.holes=[new THREE.Path(inner.getPoints())];
  const geo=new THREE.ExtrudeGeometry(outer,{depth,bevelEnabled:false});geo.center();
  const mesh=new THREE.Mesh(geo,shapeMat);mesh.userData.portalFrame=true;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return {ow,oh};
 }
 if(cfg.shape==='field'){
  const radius=Math.max(.32,ow/2),tube=Math.max(.05,Math.min(.16,cfg.depth*.35));
  const torus=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,18,64),shapeMat);torus.rotation.x=Math.PI/2;torus.position.y=.02;torus.userData.portalFrame=true;torus.castShadow=true;torus.receiveShadow=true;group.add(torus);return {ow:radius*2,oh:radius*2};
 }
 if(cfg.shape==='orb'){
  const radius=Math.max(.35,Math.min(ow,oh)*.36),tube=Math.max(.045,Math.min(.14,cfg.depth*.28));
  const torus=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,20,72),shapeMat);torus.position.y=Math.max(radius,.62);torus.userData.portalFrame=true;torus.castShadow=true;torus.receiveShadow=true;group.add(torus);return {ow:radius*2,oh:radius*2,centerY:torus.position.y,radius};
 }
 // Classic square portal keeps side segments sized from width minus opening (w-ow) and header from height minus opening (h-oh).
 const side=(cfg.width-ow)/2;
 slab(group,-cfg.width/2+side/2,cfg.height/2,0,side,cfg.height,cfg.depth,shapeMat);
 slab(group,cfg.width/2-side/2,cfg.height/2,0,side,cfg.height,cfg.depth,shapeMat);
 slab(group,0,oh+(cfg.height-oh)/2,0,ow,cfg.height-oh,cfg.depth,shapeMat);
 return {ow,oh};
}
function innerEffectMaterial(cfg){
 return new THREE.MeshBasicMaterial({color:cfg.effect==='mystery'?'#8e74ff':cfg.effect==='glow'?'#90fff7':cfg.effect==='pulse'?'#5de3ff':'#ffffff',transparent:true,opacity:cfg.shape==='field'?0.42:0.24,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
}
function addInnerField(group,cfg,info){
 const mat=innerEffectMaterial(cfg);mat.userData.portalInnerEffect=true;
 let mesh;
 if(cfg.shape==='field'){
  mesh=new THREE.Mesh(new THREE.CircleGeometry(Math.max(.28,info.ow/2-.06),42),mat);mesh.rotation.x=-Math.PI/2;mesh.position.y=.015;
 }else if(cfg.shape==='orb'){
  mesh=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.24,(info.radius||.6)*.82),24,24),mat);mesh.position.y=info.centerY||Math.max(.5,info.oh/2);
 }else{
  const shape=portalShape(cfg.shape,Math.max(.4,info.ow-.08),Math.max(.55,info.oh-.08));
  const geo=new THREE.ShapeGeometry(shape);
  mesh=new THREE.Mesh(geo,mat);mesh.position.z=-cfg.depth/2-.014;mesh.position.y=Math.max(.3,info.oh/2);
 }
 mesh.userData.portalInner=true;group.add(mesh);
}
function addBorderGlow(group,cfg,info){
 const glow=new THREE.MeshBasicMaterial({color:'#54d6ff',transparent:true,opacity:.17,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 glow.userData.portalGlowMaterial=true;
 if(cfg.shape==='field'){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(Math.max(.32,info.ow/2),.03,12,48),glow);ring.rotation.x=Math.PI/2;ring.position.y=.028;ring.userData.portalGlow=true;group.add(ring);return;
 }
 if(cfg.shape==='orb'){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(Math.max(.28,info.radius||.6),.03,16,48),glow);ring.position.y=info.centerY||.9;ring.rotation.y=Math.PI/2;ring.userData.portalGlow=true;group.add(ring);return;
 }
 if(cfg.shape==='rounded'||cfg.shape==='triangle'){
  const outline=portalShape(cfg.shape,info.ow,info.oh).getPoints(48);
  const path=new THREE.CatmullRomCurve3(outline.map(p=>new THREE.Vector3(p.x,p.y+Math.max(.3,info.oh/2)-info.oh/2,-cfg.depth/2-.013)),true);
  const tube=new THREE.Mesh(new THREE.TubeGeometry(path,96,.016,8,true),glow);tube.userData.portalGlow=true;group.add(tube);return;
 }
 for(const x of [-info.ow/2,info.ow/2])slab(group,x,info.oh/2,-cfg.depth/2-.013,.025,info.oh,.024,glow,'portalGlow');
 slab(group,0,info.oh,-cfg.depth/2-.013,info.ow,.025,.024,glow,'portalGlow');
}
export function rebuildPortal(group,raw){
 const c=cleanPortal(raw);
 for(const child of [...group.children]){group.remove(child);child.geometry?.dispose?.();const mats=Array.isArray(child.material)?child.material:[child.material];for(const mat of mats)if(mat&&!mat.userData?.sharedMaterial)mat.dispose?.();}
 group.userData.portal=c;
 const frame=new THREE.MeshStandardMaterial({color:c.color,roughness:.65,metalness:.12,transparent:c.opacity<1,opacity:c.opacity,map:frameTexture(c.texture),side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
 const info=makeRing(group,c,frame);
 addBorderGlow(group,c,info);
 addInnerField(group,c,info);
 if(c.role==='entry'&&c.mode==='button'){
  const key=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,.07,16),new THREE.MeshStandardMaterial({color:'#dd3c5f',emissive:'#8d1f40',emissiveIntensity:.45}));
  key.rotation.x=Math.PI/2;key.position.set(c.width/2+.18,Math.max(.42,c.shape==='field'?.22:1.12),-c.depth/2-.065);key.userData.portalButton=true;key.name='Activate portal';group.add(key);
 }
 return group;
}
export function makePortal(config={}){const group=new THREE.Group();group.userData.editorKind='portal';group.name=config.role==='exit'?'Portal Exit':'Portal Entry';return rebuildPortal(group,config);}
export function portalPulse(group,amount){
 const cfg=group.userData.portal||cleanPortal({});
 const t=performance.now()*0.0011;
 const wave=.35+.65*Math.abs(Math.sin(performance.now()*.011));
 group.traverse(part=>{
  if(part.userData.portalGlow&&part.material){
   const mat=part.material;
   let color=new THREE.Color('#54d6ff');
   if(cfg.effect==='rainbow')color=new THREE.Color().setHSL((t*.23)%1,.9,.62);
   else if(cfg.effect==='mystery')color=new THREE.Color().setHSL(.74+.06*Math.sin(t*1.7),.72,.58);
   else if(cfg.effect==='glow')color=new THREE.Color('#96fff0');
   else if(cfg.effect==='pulse')color=new THREE.Color().setHSL(.56,.92,.55+.1*Math.sin(t*3.4));
   mat.color?.copy(color);
   mat.opacity=Math.min(.82,.14+Math.max(0,amount)*.54*wave+(cfg.effect==='rainbow'?0.08:0));
  }
  if(part.userData.portalInner&&part.material){
   const mat=part.material;
   let opacity=.16+.08*Math.sin(t*2.5);
   if(cfg.effect==='mystery'){mat.color?.setHSL(.76+.04*Math.sin(t*1.2),.68,.55);opacity=.22+.11*Math.sin(t*2.1+.5);}
   else if(cfg.effect==='rainbow'){mat.color?.setHSL((t*.18+.15)%1,.8,.6);opacity=.17+.08*Math.sin(t*3.2);}
   else if(cfg.effect==='glow'){mat.color?.set('#a7fff6');opacity=.18+.05*Math.sin(t*2.2);}
   else {mat.color?.setHSL(.58,.95,.58);opacity=.15+.12*Math.sin(t*4.5);}
   part.scale.setScalar(part.userData.portalInner&&cfg.shape==='orb'?1+.03*Math.sin(t*2.7):1);
   mat.opacity=Math.max(.06,opacity+Math.max(0,amount)*.08);
  }
 });
}
