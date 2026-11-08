// SOLVI v0.2.252: deterministic bounded organic geometry. No eval or generated code.
import * as THREE from 'three';
export const AMORPHOUS_DEFAULT=Object.freeze({radius:1,distortion:.28,frequency:2.4,seed:7,resolution:28,smoothing:1,base:0,effect:0,speed:1});
export const AMORPHOUS_FIELDS=Object.freeze({radius:[1,.1,12],distortion:[.28,0,.85],frequency:[2.4,.3,10],seed:[7,0,10000],resolution:[28,6,64],smoothing:[1,0,1],base:[0,0,2],effect:[0,0,3],speed:[1,0,5]});
export const AMORPHOUS_EFFECTS=['Natural','Glow','Rainbow','Swirl'];
export function cleanAmorphous(input={}){
 const data={};for(const [key,[fallback,min,max]] of Object.entries(AMORPHOUS_FIELDS)){
  const raw=Number(input?.[key]);data[key]=Number.isFinite(raw)?Math.max(min,Math.min(max,raw)):fallback;
  if(['seed','resolution','base','effect'].includes(key))data[key]=Math.round(data[key]);
 }return data;
}
const lerp=(a,b,t)=>a+(b-a)*t;
const fade=t=>t*t*(3-2*t);
function lattice(x,y,z,seed){let a=Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791)^Math.imul(seed,2654435761);a=Math.imul(a^(a>>>16),2246822507);a=Math.imul(a^(a>>>13),3266489909);return ((a^(a>>>16))>>>0)/4294967295*2-1;}
export function organicNoise(x,y,z,seed){const a=Math.floor(x),b=Math.floor(y),c=Math.floor(z),u=fade(x-a),v=fade(y-b),w=fade(z-c);
 const g=(dx,dy,dz)=>lattice(a+dx,b+dy,c+dz,seed);
 return lerp(lerp(lerp(g(0,0,0),g(1,0,0),u),lerp(g(0,1,0),g(1,1,0),u),v),lerp(lerp(g(0,0,1),g(1,0,1),u),lerp(g(0,1,1),g(1,1,1),u),v),w);
}
export function organicRadius(direction,settings){const p=cleanAmorphous(settings),f=p.frequency;
 const n=.72*organicNoise(direction.x*f,direction.y*f,direction.z*f,p.seed)+.28*organicNoise(direction.x*f*2.13,direction.y*f*2.13,direction.z*f*2.13,p.seed+19);
 return p.radius*Math.max(.28,1+p.distortion*n);
}
export function buildAmorphousGeometry(config){const p=cleanAmorphous(config);
 let geometry;
 if(p.base===1){const size=p.radius*1.65;geometry=new THREE.BoxGeometry(size,size,size,Math.min(32,p.resolution),Math.min(32,p.resolution),Math.min(32,p.resolution));}
 else if(p.base===2)geometry=new THREE.IcosahedronGeometry(p.radius,Math.min(4,Math.floor(p.resolution/13)));
 else geometry=new THREE.SphereGeometry(p.radius,p.resolution,Math.max(5,Math.floor(p.resolution*.7)));
 const attr=geometry.getAttribute('position'),direction=new THREE.Vector3();
 for(let i=0;i<attr.count;i++){direction.fromBufferAttribute(attr,i);const len=direction.length()||1;direction.divideScalar(len);const r=organicRadius(direction,p);
  // Base=1 retains a soft cube-like silhouette; base=2 is a low-poly rock.
  const t=p.base===1?.76:1;
  attr.setXYZ(i,direction.x*r*t+(1-t)*attr.getX(i),direction.y*r*t+(1-t)*attr.getY(i),direction.z*r*t+(1-t)*attr.getZ(i));
 }
 attr.needsUpdate=true;geometry.computeVertexNormals();
 if(p.smoothing<.5){const raw=geometry.toNonIndexed();geometry.dispose();geometry=raw;geometry.computeVertexNormals();}
 geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export function applyAmorphousEffect(mesh,config){if(!mesh?.isMesh)return;const p=cleanAmorphous(config),mat=mesh.material;
 if(!mat?.isMeshStandardMaterial)return;
 mat.onBeforeCompile=shader=>{
  shader.uniforms.solviOrganicTime={value:0};shader.uniforms.solviOrganicEffect={value:p.effect};
  shader.vertexShader='varying vec3 solviOrganicPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsolviOrganicPosition = position;');
  shader.fragmentShader='varying vec3 solviOrganicPosition;\nuniform float solviOrganicTime;\nuniform float solviOrganicEffect;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  float solviWave = sin(solviOrganicPosition.x * 3.2 + solviOrganicPosition.y * 2.4 + solviOrganicTime * 2.0);
  if (solviOrganicEffect > 1.5 && solviOrganicEffect < 2.5) {
   vec3 rainbow = vec3(.5+.5*sin(solviWave+0.),.5+.5*sin(solviWave+2.094),.5+.5*sin(solviWave+4.188));
   diffuseColor.rgb = mix(diffuseColor.rgb,rainbow,.75);
  } else if(solviOrganicEffect > 2.5) {
   float swirl = atan(solviOrganicPosition.z,solviOrganicPosition.x)*4.0+length(solviOrganicPosition.xz)*3.0-solviOrganicTime*1.7;
   diffuseColor.rgb *= .55+.45*sin(swirl)*sin(swirl);
  }`);
  if(p.effect===1)shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * (.22 + .3 * (0.5 + 0.5*sin(solviOrganicTime*2.0)));');
  mesh.userData.solviOrganicUniform=shader.uniforms.solviOrganicTime;
 };
 mat.customProgramCacheKey=()=>`solvi-organic-v1-${p.effect}`;
 mat.needsUpdate=true;
 mesh.onBeforeRender=()=>{if(mesh.userData.solviOrganicUniform)mesh.userData.solviOrganicUniform.value=performance.now()/1000*p.speed;};
 mesh.userData.solviOrganicEffect=p.effect;
}
