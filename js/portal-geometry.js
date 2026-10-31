import * as THREE from 'three';
import {cleanPortal} from './portal-core.js';
import {wallPresetTexture} from './office-walls.js';

const textures=new Map();
const tempColor=new THREE.Color();

function frameTexture(name){
 if(name==='none')return null;
 if(!textures.has(name))textures.set(name,wallPresetTexture(name==='metal'?'concrete':name==='tiles'?'plaster':name));
 return textures.get(name);
}
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
 const s=new THREE.Shape();s.moveTo(-w/2,-h/2);s.lineTo(w/2,-h/2);s.lineTo(w/2,h/2);s.lineTo(-w/2,h/2);s.closePath();return s;
}
function roleTint(cfg){return cfg.role==='exit' ? new THREE.Color('#ff70d4') : new THREE.Color('#64d8ff');}
function themeColors(cfg){
 if(cfg.effect==='mystery')return [new THREE.Color('#4819b8'),new THREE.Color('#f866ff')];
 if(cfg.effect==='glow')return [new THREE.Color('#76fff2'),new THREE.Color('#e1fffd')];
 if(cfg.effect==='pulse')return [new THREE.Color('#33b7ff'),new THREE.Color('#ffffff')];
 return [new THREE.Color('#79aaff'),new THREE.Color('#ffffff')];
}
function makeRing(group,cfg,shapeMat){
 const ow=Math.min(cfg.openingWidth,cfg.width-.2),oh=Math.min(cfg.openingHeight,cfg.height-.12),depth=Math.max(.04,cfg.depth*.44);
 if(cfg.shape==='rounded'||cfg.shape==='triangle'){
  const outer=portalShape(cfg.shape,cfg.width,cfg.height),inner=portalShape(cfg.shape,ow,oh);
  outer.holes=[new THREE.Path(inner.getPoints())];
  const geo=new THREE.ExtrudeGeometry(outer,{depth,bevelEnabled:false});geo.center();
  const mesh=new THREE.Mesh(geo,shapeMat);mesh.userData.portalFrame=true;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return {ow,oh,depth};
 }
 if(cfg.shape==='field'){
  const radius=Math.max(.34,ow/2),tube=Math.max(.055,Math.min(.18,cfg.depth*.38));
  const torus=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,28,96),shapeMat);torus.rotation.x=Math.PI/2;torus.position.y=.03;torus.userData.portalFrame=true;torus.castShadow=true;torus.receiveShadow=true;group.add(torus);return {ow:radius*2,oh:radius*2,depth,radius};
 }
 if(cfg.shape==='orb'){
  const radius=Math.max(.38,Math.min(ow,oh)*.38),tube=Math.max(.05,Math.min(.16,cfg.depth*.32));
  const torus=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,28,96),shapeMat);torus.position.y=Math.max(radius,.7);torus.userData.portalFrame=true;torus.castShadow=true;torus.receiveShadow=true;group.add(torus);return {ow:radius*2,oh:radius*2,depth,centerY:torus.position.y,radius};
 }
 // Classic square portal keeps side segments sized from width minus opening (w-ow) and header from height minus opening (h-oh).
 const side=(cfg.width-ow)/2;
 slab(group,-cfg.width/2+side/2,cfg.height/2,0,side,cfg.height,cfg.depth,shapeMat);
 slab(group,cfg.width/2-side/2,cfg.height/2,0,side,cfg.height,cfg.depth,shapeMat);
 slab(group,0,oh+(cfg.height-oh)/2,0,ow,cfg.height-oh,cfg.depth,shapeMat);
 return {ow,oh,depth};
}
function portalShaderMaterial(cfg){
 const [cA,cB]=themeColors(cfg),role=roleTint(cfg);
 const material=new THREE.ShaderMaterial({
  uniforms:{
   time:{value:0},
   strength:{value:.2},
   effectMode:{value:cfg.effect==='mystery'?1:cfg.effect==='glow'?2:cfg.effect==='pulse'?3:0},
   colorA:{value:cA},
   colorB:{value:cB},
   roleColor:{value:role}
  },
  transparent:true,
  depthWrite:false,
  side:THREE.DoubleSide,
  blending:THREE.AdditiveBlending,
  vertexShader:`varying vec2 vUv; varying vec3 vPos; void main(){ vUv=uv; vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`
   varying vec2 vUv; varying vec3 vPos;
   uniform float time; uniform float strength; uniform float effectMode; uniform vec3 colorA; uniform vec3 colorB; uniform vec3 roleColor;
   vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.,2./3.,1./3.,3.); vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www); return c.z*mix(K.xxx, clamp(p-K.xxx,0.,1.), c.y); }
   float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
   float noise(vec2 p){ vec2 i=floor(p), f=fract(p); float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1)); vec2 u=f*f*(3.-2.*f); return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y; }
   void main(){
    vec2 uv=vUv*2.-1.;
    float r=length(uv);
    float ang=atan(uv.y,uv.x);
    float edge=smoothstep(1.06,0.18,1.-r);
    float rim=smoothstep(.98,.7,r);
    float inner=1.-smoothstep(.0,.92,r);
    float t=time;
    vec3 col=vec3(0.);
    float alpha=0.;
    if(effectMode<0.5){
      float hue=fract((ang/6.2831853)+t*.12+r*.35);
      col=hsv2rgb(vec3(hue,.82,1.0));
      float bands=.5+.5*sin(ang*10.-t*8.+r*16.);
      alpha=(0.18+0.5*edge)*(0.55+0.45*bands);
      col=mix(col,roleColor,.22);
    }else if(effectMode<1.5){
      float pull=1.-smoothstep(.0,.95,r);
      float vortex=.5+.5*sin((1.2-r)*16.-t*9.+ang*5.);
      float warp=noise(vec2(ang*2.2,r*10.-t*2.5));
      col=mix(colorA,colorB,vortex*.65+.25*warp);
      col=mix(col,vec3(.03,.0,.07),smoothstep(.0,.45,r));
      alpha=.2+.45*edge+.22*pull*(.5+.5*sin(t*4.+ang*4.));
      col+=roleColor*.14;
    }else if(effectMode<2.5){
      float haze=noise(uv*4.+vec2(t*.8,-t*.45));
      col=mix(colorA,colorB,haze);
      alpha=.18+.28*edge+.1*haze;
      col+=roleColor*.2;
    }else{
      float rings=.5+.5*sin(r*24.-t*10.);
      col=mix(colorA,colorB,rings);
      alpha=.18+.42*(1.-smoothstep(.0,.92,r))*(.4+.6*rings);
      col+=roleColor*.16;
    }
    alpha*=mix(.55,1.35,clamp(strength,0.,1.));
    col*=1.0 + 0.55*clamp(strength,0.,1.);
    gl_FragColor=vec4(col, clamp(alpha,0.02,0.94));
   }`
 });
 material.userData.portalInnerShader=true;
 return material;
}
function addInnerField(group,cfg,info){
 const mat=portalShaderMaterial(cfg);
 let mesh;
 if(cfg.shape==='field'){
  mesh=new THREE.Mesh(new THREE.CircleGeometry(Math.max(.3,info.ow/2-.08),64),mat);mesh.rotation.x=-Math.PI/2;mesh.position.y=.02;
 }else if(cfg.shape==='orb'){
  mesh=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.26,(info.radius||.6)*.82),42,42),mat);mesh.position.y=info.centerY||Math.max(.6,info.oh/2);
 }else{
  const shape=portalShape(cfg.shape,Math.max(.45,info.ow-.08),Math.max(.65,info.oh-.08));
  const geo=new THREE.ShapeGeometry(shape);
  mesh=new THREE.Mesh(geo,mat);mesh.position.z=-cfg.depth/2-.025;mesh.position.y=Math.max(.32,info.oh/2);
 }
 mesh.userData.portalInner=true;mesh.renderOrder=2;group.add(mesh);
}
function glowMaterial(cfg){
 return new THREE.MeshBasicMaterial({color:cfg.color,transparent:true,opacity:.75,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
}
function addBorderGlow(group,cfg,info){
 const glow=glowMaterial(cfg);
 glow.userData.portalGlowMaterial=true;
 const tubeRadius=cfg.effect==='rainbow'?.045:cfg.effect==='mystery'?.034:cfg.effect==='pulse'?.032:.028;
 if(cfg.shape==='field'){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(Math.max(.34,info.ow/2),tubeRadius,22,96),glow);ring.rotation.x=Math.PI/2;ring.position.y=.03;ring.userData.portalGlow=true;group.add(ring);
  return;
 }
 if(cfg.shape==='orb'){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(Math.max(.3,info.radius||.6),tubeRadius,22,96),glow);ring.position.y=info.centerY||.9;ring.rotation.y=Math.PI/2;ring.userData.portalGlow=true;group.add(ring);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(Math.max(.26,(info.radius||.6)*.78),tubeRadius*.45,18,72),glow.clone());halo.position.y=ring.position.y;halo.rotation.x=Math.PI/2;halo.userData.portalGlow=true;group.add(halo);
  return;
 }
 if(cfg.shape==='rounded'||cfg.shape==='triangle'){
  const outline=portalShape(cfg.shape,info.ow+.02,info.oh+.02).getPoints(64);
  const baseY=Math.max(.32,info.oh/2)-info.oh/2;
  const points=outline.map(p=>new THREE.Vector3(p.x,p.y+baseY,-cfg.depth/2-.026));
  const path=new THREE.CatmullRomCurve3(points,true);
  const tube=new THREE.Mesh(new THREE.TubeGeometry(path,120,tubeRadius,12,true),glow);tube.userData.portalGlow=true;group.add(tube);
  return;
 }
 for(const x of [-info.ow/2,info.ow/2])slab(group,x,info.oh/2,-cfg.depth/2-.026,tubeRadius*1.6,info.oh,tubeRadius*1.4,glow,'portalGlow');
 slab(group,0,info.oh,-cfg.depth/2-.026,info.ow,tubeRadius*1.6,tubeRadius*1.4,glow,'portalGlow');
}
export function rebuildPortal(group,raw){
 const c=cleanPortal(raw);
 for(const child of [...group.children]){group.remove(child);child.geometry?.dispose?.();const mats=Array.isArray(child.material)?child.material:[child.material];for(const mat of mats)if(mat&&!mat.userData?.sharedMaterial)mat.dispose?.();}
 group.userData.portal=c;
 const frameColor=tempColor.copy(new THREE.Color(c.color)).lerp(roleTint(c),.18).getHex();
 const frame=new THREE.MeshStandardMaterial({color:frameColor,roughness:.45,metalness:c.texture==='metal'?.42:.16,transparent:c.opacity<1,opacity:c.opacity,map:frameTexture(c.texture),side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1,emissive:roleTint(c).clone().multiplyScalar(.05)});
 const info=makeRing(group,c,frame);
 addBorderGlow(group,c,info);
 addInnerField(group,c,info);
 if(c.role==='entry'&&c.mode==='button'){
  const key=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,.07,18),new THREE.MeshStandardMaterial({color:'#dd3c5f',emissive:'#8d1f40',emissiveIntensity:.7}));
  key.rotation.x=Math.PI/2;key.position.set(c.width/2+.18,Math.max(.42,c.shape==='field'?.24:1.08),-c.depth/2-.065);key.userData.portalButton=true;key.name='Activate portal';group.add(key);
 }
 return group;
}
export function makePortal(config={}){const group=new THREE.Group();group.userData.editorKind='portal';group.name=config.role==='exit'?'Portal Exit':'Portal Entry';return rebuildPortal(group,config);}
export function portalPulse(group,amount){
 const cfg=group.userData.portal||cleanPortal({});
 const t=performance.now()*0.001;
 const wave=.55+.45*Math.sin(performance.now()*.008);
 group.traverse(part=>{
  if(part.userData.portalGlow&&part.material){
   const mat=part.material;
   let color=roleTint(cfg).clone().lerp(new THREE.Color(cfg.color),.45);
   if(cfg.effect==='rainbow')color.setHSL((t*.22)%1,.95,.62);
   else if(cfg.effect==='mystery')color.setHSL(.79+.05*Math.sin(t*1.5),.85,.6);
   else if(cfg.effect==='glow')color.set('#b0fff8');
   else if(cfg.effect==='pulse')color.setHSL(.56,.95,.58+.12*Math.sin(t*3.2));
   mat.color?.copy(color);
   mat.opacity=cfg.effect==='rainbow'?.82:cfg.effect==='mystery'?.58:.46;
   mat.opacity+=(Math.max(0,amount)*.32)+(.14*wave);
   part.scale.setScalar(1+(cfg.effect==='pulse'?0.03*Math.sin(t*4.5):cfg.effect==='rainbow'?0.02*Math.sin(t*2.4):0));
  }
  if(part.userData.portalInner&&part.material?.uniforms){
   const u=part.material.uniforms;
   u.time.value=t;
   u.strength.value=Math.min(1,.28+Math.max(0,amount)*.72+(cfg.effect==='mystery'?0.12:0));
   if(cfg.shape==='orb')part.rotation.y=t*.35;
   if(cfg.shape==='field')part.rotation.z=t*.18;
  }
 });
}
