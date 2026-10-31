import * as THREE from 'three';
import {cleanPortal} from './portal-core.js';
import {wallPresetTexture} from './office-walls.js';

const textures=new Map();
const tmpColor=new THREE.Color();

function frameTexture(name){
 if(name==='none')return null;
 if(!textures.has(name))textures.set(name,wallPresetTexture(name==='metal'?'concrete':name==='tiles'?'plaster':name));
 return textures.get(name);
}
function circlePoints(radius,start,end,segments=24){
 const points=[];
 for(let i=0;i<=segments;i++){
  const t=start+(end-start)*(i/segments);
  points.push(new THREE.Vector2(Math.cos(t)*radius,Math.sin(t)*radius));
 }
 return points;
}
function floorPortalShape(shape,width,height){
 const hw=width/2;
 if(shape==='triangle'){
  const s=new THREE.Shape();
  s.moveTo(-hw,0); s.lineTo(0,height); s.lineTo(hw,0); s.closePath();
  return s;
 }
 if(shape==='rounded'){
  const archRadius=Math.min(hw,Math.max(.24,height*.32));
  const sideTop=Math.max(0,height-archRadius);
  const s=new THREE.Shape();
  s.moveTo(-hw,0);
  s.lineTo(-hw,sideTop);
  for(const p of circlePoints(archRadius,Math.PI,0,20))s.lineTo(p.x,p.y+sideTop);
  s.lineTo(hw,0);
  s.closePath();
  return s;
 }
 const s=new THREE.Shape();
 s.moveTo(-hw,0); s.lineTo(-hw,height); s.lineTo(hw,height); s.lineTo(hw,0); s.closePath();
 return s;
}
function roleTint(cfg){return cfg.role==='exit' ? new THREE.Color('#ff74d1') : new THREE.Color('#63d3ff');}
function effectColors(cfg){
 if(cfg.effect==='mystery')return [new THREE.Color('#4b16c3'),new THREE.Color('#ff68ed')];
 if(cfg.effect==='glow')return [new THREE.Color('#7cf5ff'),new THREE.Color('#e7fffd')];
 if(cfg.effect==='pulse')return [new THREE.Color('#35b1ff'),new THREE.Color('#ffffff')];
 return [new THREE.Color('#66d9ff'),new THREE.Color('#ff5bd8')];
}
function buildFrameMaterial(cfg){
 const frameColor=tmpColor.copy(new THREE.Color(cfg.color)).lerp(roleTint(cfg),.18).getHex();
 return new THREE.MeshStandardMaterial({
  color:frameColor,
  roughness:.42,
  metalness:cfg.texture==='metal'?.44:.12,
  transparent:cfg.opacity<1,
  opacity:cfg.opacity,
  map:frameTexture(cfg.texture),
  side:THREE.DoubleSide,
  polygonOffset:true,
  polygonOffsetFactor:1,
  polygonOffsetUnits:1,
  emissive:roleTint(cfg).clone().multiplyScalar(.06),
  emissiveIntensity:.55
 });
}
function buildFrameFxMaterial(cfg){
 const [a,b]=effectColors(cfg);
 return new THREE.ShaderMaterial({
  uniforms:{time:{value:0}, effectMode:{value:cfg.effect==='mystery'?1:cfg.effect==='glow'?2:cfg.effect==='pulse'?3:0}, colorA:{value:a}, colorB:{value:b}, roleColor:{value:roleTint(cfg)}, strength:{value:.18}},
  transparent:true,
  depthWrite:false,
  side:THREE.DoubleSide,
  blending:THREE.AdditiveBlending,
  vertexShader:`varying vec2 vUv; varying vec3 vPos; void main(){vUv=uv; vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`
   varying vec2 vUv; varying vec3 vPos;
   uniform float time; uniform float effectMode; uniform vec3 colorA; uniform vec3 colorB; uniform vec3 roleColor; uniform float strength;
   vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.,2./3.,1./3.,3.); vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www); return c.z*mix(K.xxx, clamp(p-K.xxx,0.,1.), c.y); }
   float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
   float noise(vec2 p){ vec2 i=floor(p), f=fract(p); float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1)); vec2 u=f*f*(3.-2.*f); return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y; }
   void main(){
    float t=time;
    float flow=.5+.5*sin((vUv.y*15.+vUv.x*6.) + t*6.0);
    float scan=.5+.5*sin(vUv.y*38.0 - t*8.0);
    float n=noise(vUv*5.0+vec2(t*.5,-t*.25));
    vec3 col=mix(colorA,colorB,flow*.65+.35*n);
    float a=.08 + .1*scan + .08*flow;
    if(effectMode<0.5){ col=hsv2rgb(vec3(fract(vUv.y*.55+t*.12+vUv.x*.18),.85,1.0)); a=.12+.15*scan; }
    else if(effectMode<1.5){ a=.08+.14*(.5+.5*sin(vUv.y*25.-t*10.+n*2.)); col=mix(colorA,colorB,n); }
    else if(effectMode<2.5){ a=.08+.12*n; col=mix(colorA,colorB,scan); }
    else { a=.1+.14*(.5+.5*sin(t*5.+vUv.y*18.)); }
    col=mix(col,roleColor,.18);
    gl_FragColor=vec4(col, clamp(a*(1.0+strength*1.2),0.0,.42));
   }`
 });
}
function buildInnerShader(cfg){
 const [cA,cB]=effectColors(cfg);
 return new THREE.ShaderMaterial({
  uniforms:{time:{value:0}, strength:{value:.3}, effectMode:{value:cfg.effect==='mystery'?1:cfg.effect==='glow'?2:cfg.effect==='pulse'?3:0}, colorA:{value:cA}, colorB:{value:cB}, roleColor:{value:roleTint(cfg)}},
  transparent:true,
  depthWrite:false,
  side:THREE.DoubleSide,
  blending:THREE.AdditiveBlending,
  vertexShader:`varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`
   varying vec2 vUv;
   uniform float time; uniform float strength; uniform float effectMode; uniform vec3 colorA; uniform vec3 colorB; uniform vec3 roleColor;
   vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.,2./3.,1./3.,3.); vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www); return c.z*mix(K.xxx, clamp(p-K.xxx,0.,1.), c.y); }
   float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
   float noise(vec2 p){ vec2 i=floor(p), f=fract(p); float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1)); vec2 u=f*f*(3.-2.*f); return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y; }
   void main(){
    vec2 uv=vUv*2.-1.;
    float r=length(uv);
    float ang=atan(uv.y,uv.x);
    float t=time;
    vec3 col=vec3(0.); float alpha=0.;
    if(effectMode<0.5){
      float hue=fract(ang/6.2831853 + r*.22 + t*.1);
      float arc=.5+.5*sin(r*18.-t*6.+ang*4.);
      col=hsv2rgb(vec3(hue,.78,1.0));
      alpha=.2+.34*(1.-smoothstep(.05,1.0,r))*(.65+.35*arc);
    }else if(effectMode<1.5){
      vec2 swirl=uv;
      float rr=max(length(swirl),0.001);
      float phi=atan(swirl.y,swirl.x)+t*1.4+(1.0-rr)*4.0;
      vec2 p=vec2(cos(phi),sin(phi))*rr;
      float neb=noise(p*6.0 + vec2(t*.4,-t*.25));
      float core=1.0-smoothstep(.0,.45,rr);
      float spiral=.5+.5*sin(phi*6.0 - rr*10.0 - t*7.0);
      col=mix(colorA,colorB,neb*.6+.4*spiral);
      col=mix(col,vec3(.02,.0,.08),smoothstep(.0,.35,rr));
      alpha=.16 + .34*(1.-smoothstep(.15,1.05,rr)) + .22*core;
    }else if(effectMode<2.5){
      float mist=noise(uv*3.4 + vec2(t*.3,-t*.18));
      float mist2=noise(uv*6.2 + vec2(-t*.42,t*.21));
      col=mix(colorA,colorB,mist*.55+.45*mist2);
      alpha=.16+.28*(1.-smoothstep(.0,1.05,r))*(.45+.55*mist);
    }else{
      float wave=.5+.5*sin(t*5. + r*20.0 - ang*2.0);
      float ring=.5+.5*sin(r*24.0 - t*9.0);
      col=mix(colorA,colorB,wave);
      alpha=.16+.32*(1.-smoothstep(.0,1.0,r))*(.35+.65*ring);
    }
    col+=roleColor*.12;
    alpha*=1.0 + strength*.65;
    gl_FragColor=vec4(col,clamp(alpha,0.02,.92));
   }`
 });
}
function outlineCurveFromShape(shape,z){
 const pts=shape.getSpacedPoints(64);
 return new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p.x,p.y,z)),true);
}

function normalizePlanarUVs(geometry,axes='xy'){
 if(!geometry||typeof geometry.computeBoundingBox!=='function'||!geometry.attributes?.position)return geometry;
 geometry.computeBoundingBox();
 const box=geometry.boundingBox;
 const pos=geometry.attributes.position;
 if(!box||!pos||typeof pos.count!=='number')return geometry;
 const uvs=[];
 const [ua,va]=axes==='xz'?['x','z']:axes==='yz'?['y','z']:['x','y'];
 const minU=box.min[ua], maxU=box.max[ua];
 const minV=box.min[va], maxV=box.max[va];
 const spanU=Math.max(1e-6,maxU-minU);
 const spanV=Math.max(1e-6,maxV-minV);
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i), y=pos.getY(i), z=pos.getZ(i);
  const map={x,y,z};
  uvs.push((map[ua]-minU)/spanU,(map[va]-minV)/spanV);
 }
 if(typeof geometry.setAttribute==='function')geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 return geometry;
}

function pointInPolygon(point,polygon){
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const xi=polygon[i].x, yi=polygon[i].y;
  const xj=polygon[j].x, yj=polygon[j].y;
  const intersect=((yi>point.y)!==(yj>point.y)) && (point.x < (xj-xi)*(point.y-yi)/((yj-yi)||1e-9) + xi);
  if(intersect)inside=!inside;
 }
 return inside;
}
function addDoorPortal(group,cfg){
 const ow=Math.min(cfg.openingWidth,cfg.width-.15);
 const oh=Math.min(cfg.openingHeight,cfg.height-.12);
 const outer=floorPortalShape(cfg.shape,cfg.width,cfg.height);
 const inner=floorPortalShape(cfg.shape,ow,oh);
 const outerWithHole=outer.clone();
 outerWithHole.holes.push(new THREE.Path(inner.getPoints(48)));
 const frameGeo=new THREE.ExtrudeGeometry(outerWithHole,{depth:cfg.depth,bevelEnabled:false,steps:1});
 frameGeo.translate(0,0,-cfg.depth/2);
 normalizePlanarUVs(frameGeo,'xy');
 const frame=new THREE.Mesh(frameGeo,buildFrameMaterial(cfg));
 frame.userData.portalFrame=true; frame.castShadow=true; frame.receiveShadow=true; group.add(frame);
 const fxFrame=new THREE.Mesh(frameGeo.clone(),buildFrameFxMaterial(cfg));
 fxFrame.userData.portalFrameFx=true; fxFrame.position.z=.001; fxFrame.renderOrder=2; group.add(fxFrame);
 const innerGeo=normalizePlanarUVs(new THREE.ShapeGeometry(inner),'xy');
 const innerMesh=new THREE.Mesh(innerGeo,buildInnerShader(cfg));
 innerMesh.userData.portalInner=true;
 innerMesh.position.set(0,0,-cfg.depth*.18);
 innerMesh.renderOrder=3;
 group.add(innerMesh);
 const glowMat=new THREE.MeshBasicMaterial({color:cfg.color,transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
 const glowCurve=outlineCurveFromShape(inner,cfg.depth*.18);
 const glow=new THREE.Mesh(new THREE.TubeGeometry(glowCurve,128,Math.max(.018,Math.min(.05,cfg.depth*.1)),12,true),glowMat);
 glow.userData.portalGlow=true; glow.renderOrder=4; group.add(glow);
 addSparkles(group,cfg,{kind:'door', shape:inner, width:ow, height:oh, z:-cfg.depth*.18});
 return {ow,oh};
}
function addFieldPortal(group,cfg){
 const size=Math.max(.8,Math.min(cfg.openingWidth,cfg.width));
 const outer=size+.34;
 const borderH=.07;
 const mat=buildFrameMaterial(cfg);
 const t=(outer-size)/2;
 const parts=[[-outer/2+t/2,borderH/2,0,t,borderH,outer],[outer/2-t/2,borderH/2,0,t,borderH,outer],[0,borderH/2,-outer/2+t/2,outer,borderH,t],[0,borderH/2,outer/2-t/2,outer,borderH,t]];
 for(const [x,y,z,w,h,d] of parts){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.userData.portalFrame=true;m.castShadow=true;m.receiveShadow=true;group.add(m);}
 const frameFx=new THREE.Mesh(new THREE.PlaneGeometry(outer,outer),buildFrameFxMaterial(cfg));
 frameFx.rotation.x=-Math.PI/2; frameFx.position.y=.012; frameFx.userData.portalFrameFx=true; frameFx.renderOrder=2; group.add(frameFx);
 const inner=new THREE.Mesh(new THREE.PlaneGeometry(size,size),buildInnerShader(cfg));
 inner.rotation.x=-Math.PI/2; inner.position.y=.018; inner.userData.portalInner=true; inner.renderOrder=3; group.add(inner);
 const border=new THREE.Mesh(new THREE.RingGeometry(size*.47,size*.52,4),new THREE.MeshBasicMaterial({color:cfg.color,transparent:true,opacity:.7,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
 border.rotation.x=-Math.PI/2; border.position.y=.022; border.rotation.z=Math.PI/4; border.userData.portalGlow=true; border.renderOrder=4; group.add(border);
 addSparkles(group,cfg,{kind:'field', size});
 return {size};
}
// The orb is a traversable spherical event horizon, not an opaque ball or torus.
// View-space normals keep the vortex's focal point centered from every angle.
function orbShaderMaterial(cfg,layer){
 const [a,b]=effectColors(cfg);
 return new THREE.ShaderMaterial({
  uniforms:{time:{value:0},strength:{value:.35},portalOpacity:{value:cfg.opacity},effectMode:{value:cfg.effect==='mystery'?1:cfg.effect==='glow'?2:cfg.effect==='pulse'?3:0},colorA:{value:a},colorB:{value:b},roleColor:{value:roleTint(cfg)}},
  transparent:true,depthWrite:false,
  side:THREE.FrontSide,
  blending:layer==='shell'?THREE.AdditiveBlending:THREE.NormalBlending,
  vertexShader:`
   varying vec3 vEyeNormal;
   varying vec3 vPosition;
   void main(){
    vEyeNormal=normalize(normalMatrix*normal);
    vPosition=position;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
   }`,
  fragmentShader:`
   varying vec3 vEyeNormal;
   varying vec3 vPosition;
   uniform float time;
   uniform float strength;
   uniform float portalOpacity;
   uniform float effectMode;
   uniform vec3 colorA;
   uniform vec3 colorB;
   uniform vec3 roleColor;
   vec3 rainbow(float t){
    return .53+.47*cos(6.2831853*(t+vec3(0.,.33333,.66667)));
   }
   float ripples(vec2 p){
    return .5+.5*sin(p.x*16.3+p.y*11.2+sin(p.y*7.+time*1.8)*2.-time*3.);
   }
   void main(){
    // Front hemisphere projected into camera space: (0,0) is always the center.
    vec3 n=normalize(vEyeNormal);
    vec2 uv=n.xy;
    float r=clamp(length(uv),0.,1.);
    float a=atan(uv.y,uv.x);
    float t=time;
    float spiral=a*7.0 + r*24.0 - t*5.1 + 2.0*sin(r*9.0-t*1.2);
    float thread=pow(.5+.5*cos(spiral),7.0);
    float second=pow(.5+.5*cos(a*12.0-r*38.0+t*4.0),14.0);
    float crest=smoothstep(.48,.98,r);
    float throat=1.0-smoothstep(.025,.46,r);
    vec3 col=mix(colorA,colorB,.5+.5*sin(spiral*.33+t*.4));
    if(effectMode<.5){
     col=rainbow(a/6.2831853+r*.19+t*.09);
    }else if(effectMode<1.5){
     col=mix(colorA,colorB,thread*.82+.18);
    }else if(effectMode<2.5){
     col=mix(colorA,colorB,ripples(uv));
    }else{
     col=mix(colorA,colorB,.5+.5*sin(r*22.0-t*6.0));
    }
    col=mix(col,roleColor,.12);
    ${layer==='shell' ? `
      // Thin luminous atmosphere; transparent center and alive with filament arcs.
      float arcs=thread*.28+second*.22;
      float pulse=.78+.22*sin(t*3.2);
      float alpha=(.045 + .63*pow(crest,2.4) + arcs*crest)*pulse;
      col*=1.0 + crest*.65 + thread*.35;
      alpha*=.85+.5*strength;
    ` : `
      // A dark, penetrable throat surrounded by contracting luminous currents.
      float cosmic=(thread*.52+second*.25) * smoothstep(.02,.52,r);
      float bloom=.2 * (1.0-smoothstep(.12,.78,r));
      float alpha=(.16+.31*cosmic+.18*crest + bloom) * (.75+.55*strength);
      float dark=1.0-.88*throat;
      col*=dark*(.6+1.35*cosmic);
      col+=roleColor*thread*.22;
    `}
    gl_FragColor=vec4(col,clamp(alpha*portalOpacity,0.,.82));
   }`
 });
}
function addOrbPortal(group,cfg){
 const radius=Math.max(.42,Math.min(cfg.openingWidth,cfg.width,Math.max(1.1,cfg.openingHeight))*.5);
 const centerY=radius;
 // A fine view-dependent luminous boundary leaves the world visible through
 // the gateway. Unlike a solid sphere it has no physical collision surface.
 const shell=new THREE.Mesh(new THREE.SphereGeometry(radius,64,48),orbShaderMaterial(cfg,'shell'));
 shell.position.y=centerY;
 shell.userData.portalFrame=true;
 shell.userData.portalVisualOnly=true;
 shell.userData.portalFrameFx=true;
 shell.userData.portalOrbShell=true;
 shell.renderOrder=3;
 group.add(shell);
 const throat=new THREE.Mesh(new THREE.SphereGeometry(radius*.94,64,48),orbShaderMaterial(cfg,'throat'));
 throat.position.y=centerY;
 throat.userData.portalInner=true;
 throat.userData.portalOrbThroat=true;
 throat.renderOrder=2;
 group.add(throat);
 // Constellations appear within the volume, never as white latitude/longitude rings.
 addSparkles(group,cfg,{kind:'orb',radius,centerY});
 return {radius,centerY};
}
function addSparkles(group,cfg,info){
 const count=cfg.effect==='glow'?18:cfg.effect==='mystery'?28:24;
 const positions=[];
 const sizes=[];
 const color=roleTint(cfg);
 const push=(x,y,z)=>{positions.push(x,y,z);sizes.push(.01+Math.random()*.022);};
 if(info.kind==='orb'){
  for(let i=0;i<count;i++){
   const u=Math.random()*2-1,v=Math.random()*2-1,w=Math.random()*2-1;
   const len=Math.hypot(u,v,w)||1;
   const r=(.18+Math.random()*.55)*info.radius;
   push((u/len)*r, info.centerY+(v/len)*r, (w/len)*r);
  }
 }else if(info.kind==='field'){
  for(let i=0;i<count;i++)push((Math.random()-.5)*info.size*.82,.06+Math.random()*.18,(Math.random()-.5)*info.size*.82);
 }else{
  const w=info.width,h=info.height;
  const polygon=(info.shape?.getSpacedPoints?.(96)||[]).map(p=>({x:p.x,y:p.y}));
  let tries=0;
  while(positions.length<count*3&&tries<count*18){
   const x=(Math.random()-.5)*w*.96,y=Math.random()*h*.96;
   if(!polygon.length||pointInPolygon({x,y},polygon))push(x,y,info.z + (Math.random()-.5)*Math.max(.04,cfg.depth*.16));
   tries++;
  }
  if(!positions.length){
   for(let i=0;i<count;i++)push((Math.random()-.5)*w*.22,h*(0.2+Math.random()*0.55),info.z);
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setAttribute('aSize',new THREE.Float32BufferAttribute(sizes,1));
 const mat=new THREE.ShaderMaterial({
  uniforms:{time:{value:0}, tint:{value:color}},
  transparent:true,
  depthWrite:false,
  blending:THREE.AdditiveBlending,
  vertexShader:`attribute float aSize; uniform float time; varying float vAlpha; void main(){ vec3 p=position; p.y += sin(time*2.0 + position.x*8.0 + position.z*5.0)*0.02; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=aSize*900.0/(-mv.z); vAlpha=.55+.45*sin(time*4.0 + position.y*9.0); }`,
  fragmentShader:`uniform vec3 tint; varying float vAlpha; void main(){ vec2 uv=gl_PointCoord*2.0-1.0; float d=dot(uv,uv); float a=smoothstep(1.0,0.0,d); gl_FragColor=vec4(mix(vec3(1.0),tint,.55), a*vAlpha*.9); }`
 });
 const points=new THREE.Points(geo,mat);
 points.userData.portalParticles=true; points.renderOrder=5; group.add(points);
}
function addPortalButton(group,cfg){
 if(cfg.role!=='entry'||cfg.mode!=='button')return;
 const body=new THREE.Mesh(new THREE.BoxGeometry(.18,.34,.12),new THREE.MeshStandardMaterial({color:'#253a53',roughness:.55,metalness:.25}));
 body.position.set(cfg.width/2+.2,Math.max(.55,Math.min(cfg.height*.5,1.15)),-cfg.depth/2-.07);
 const button=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.06,24),new THREE.MeshStandardMaterial({color:'#e54b6d',emissive:'#9e2746',emissiveIntensity:.8}));
 button.rotation.x=Math.PI/2; button.position.set(0,0,.09); button.userData.portalButton=true; button.name='Activate portal'; body.add(button);
 group.add(body);
}
function disposeChild(child){
 child.traverse?.(part=>{
  part.geometry?.dispose?.();
  const mats=Array.isArray(part.material)?part.material:[part.material];
  for(const mat of mats)if(mat&&!mat.userData?.sharedMaterial)mat.dispose?.();
 });
}
// Build a new gate before removing the existing one. A shader/geometry exception
// must never erase a saved pair or abort scene restoration.
function emergencyPortalFrame(group,cfg){
 const material=new THREE.MeshStandardMaterial({color:cfg.color,roughness:.5,emissive:cfg.color,emissiveIntensity:.12});
 const w=cfg.width, h=cfg.height, gap=Math.min(cfg.openingWidth,w-.2), side=Math.max(.08,(w-gap)*.5);
 const parts=[[-w*.5+side*.5,h*.5,side,h],[w*.5-side*.5,h*.5,side,h],[0,h-.10,gap,.2]];
 for(const [x,y,bw,bh] of parts){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,cfg.depth),material);
  mesh.position.set(x,y,0);mesh.userData.portalFrame=true;group.add(mesh);
 }
}
export function rebuildPortal(group,raw){
 const cfg=cleanPortal(raw);
 const pending=new THREE.Group();
 try{
  if(cfg.shape==='orb')addOrbPortal(pending,cfg);
  else if(cfg.shape==='field')addFieldPortal(pending,cfg);
  else addDoorPortal(pending,cfg);
  addPortalButton(pending,cfg);
  if(!pending.children.some(child=>child.userData.portalFrame))throw Error('Missing portal frame');
 }catch(error){
  for(const child of [...pending.children]){pending.remove(child);disposeChild(child);}
  // Existing scene meshes and their working transport configuration remain intact.
  if(group.children.length){
   if(!group.userData.portalRenderError)console.error('SOLVI portal render preserved:',error);
   group.userData.portalRenderError=true;
   return group;
  }
  // A newly created portal is still visible and usable without optional effects.
  console.error('SOLVI portal effects fell back to a solid gate:',error);
  emergencyPortalFrame(pending,cfg);
  if(cfg.role==='entry'&&cfg.mode==='button')addPortalButton(pending,cfg);
 }
 for(const child of [...group.children]){group.remove(child);disposeChild(child);}
 for(const child of [...pending.children])group.add(child);
 group.userData.portal=cfg;
 group.userData.portalRenderError=false;
 group.name=cfg.role==='exit'?'Portal Exit':'Portal Entry';
 return group;
}
export function makePortal(config={}){const group=new THREE.Group();group.userData.editorKind='portal';return rebuildPortal(group,config);}
export function portalPulse(group,amount=0){
 const cfg=group.userData.portal||cleanPortal({});
 const t=performance.now()*0.001;
 const activated=Math.max(0,amount);
 group.traverse(part=>{
  if(part.userData.portalFrame&&part.material?.emissive){
   const base=roleTint(cfg).clone().lerp(new THREE.Color(cfg.color),.35);
   if(cfg.effect==='rainbow')base.setHSL((t*.14 + part.position.y*.03)%1,.88,.62);
   else if(cfg.effect==='mystery')base.setHSL(.78+.04*Math.sin(t*1.8),.85,.55);
   else if(cfg.effect==='glow')base.set('#bcfffc');
   else if(cfg.effect==='pulse')base.setHSL(.56,.95,.58+.11*Math.sin(t*4.2));
   part.material.emissive.copy(base);
   part.material.emissiveIntensity=.35 + activated*.6 + (cfg.effect==='pulse'?.22*(.5+.5*Math.sin(t*5.2)):cfg.effect==='rainbow'?.12*(.5+.5*Math.sin(t*2.7)):cfg.effect==='glow'?.14:.08);
  }
  if(part.userData.portalFrameFx&&part.material?.uniforms){
   part.material.uniforms.time.value=t;
   part.material.uniforms.strength.value=.22+activated*.9;
  }
  if(part.userData.portalInner&&part.material?.uniforms){
   part.material.uniforms.time.value=t;
   part.material.uniforms.strength.value=.35+activated*.85+(cfg.effect==='mystery'?.15:0);
   // Orb focal point follows camera-facing surface normals, not mesh rotation.
  }
  if(part.userData.portalGlow&&part.material){
   const glow=roleTint(cfg).clone().lerp(new THREE.Color(cfg.color),.5);
   if(cfg.effect==='rainbow')glow.setHSL((t*.2)%1,.95,.64);
   else if(cfg.effect==='mystery')glow.setHSL(.79,.84,.58+.08*Math.sin(t*3.1));
   else if(cfg.effect==='glow')glow.set('#e8fffd');
   else if(cfg.effect==='pulse')glow.setHSL(.56,.96,.62+.08*Math.sin(t*5.0));
   part.material.color?.copy(glow);
   part.material.opacity=Math.min(.95,(part.userData.portalGlow? .32: .2) + activated*.35 + (cfg.effect==='glow'?.12:cfg.effect==='rainbow'?.18:cfg.effect==='pulse'?.16:.1));
   const s=cfg.effect==='pulse'?1+.03*Math.sin(t*5.0):cfg.effect==='rainbow'?1+.02*Math.sin(t*2.2):1;
   part.scale.setScalar(s);
  }
  if(part.userData.portalParticles&&part.material?.uniforms){
   part.material.uniforms.time.value=t;
   part.rotation.y=t*.1;
  }
 });
}
