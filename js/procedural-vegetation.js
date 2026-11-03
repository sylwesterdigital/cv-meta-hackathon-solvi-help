// SOLVI procedural vegetation v0.2.165. WebGL-compatible, deterministic, bounded geometry.
// References: Roystan and Alisavakis grass tutorials (concepts adapted from Unity to WebGL).
import * as THREE from 'three';

export const VEGETATION_TYPES=['tree','shrub','vegetationArea','groundPlot','cropBed'];
export const VEGETATION_NUMERIC={
 treeHeight:[4.5,.4,18],trunkRadius:[.18,.025,1.4],canopyRadius:[1.5,.15,7],
 branchCount:[9,0,28],leafClusters:[30,0,80],leafSize:[.23,.05,.8],treeSeed:[42,0,999999],
 trunkWobble:[.16,0,.7],blossomDensity:[.55,0,1],palmFronds:[9,4,16],
 grassDensity:[.7,0,1],grassHeight:[.21,.02,.7],grassWidth:[.025,.005,.1],
 windStrength:[.22,0,1.5],windSpeed:[1.1,0,6],soilRoughness:[.55,0,1],
 cropRows:[4,1,12],cropSpacing:[.45,.15,2],growthPercent:[65,0,100],plotSeed:[17,0,999999],
 scatterCount:[36,1,160],scatterSpacing:[2.0,.3,12],scatterJitter:[.24,0,1],scatterCluster:[.58,0,1],
 scatterScale:[.28,0,.85],shrubHeight:[.85,.12,3.5],shrubRadius:[.65,.12,2.5],shrubLeaves:[15,3,48],shrubBranches:[4,0,16]
};
export const DEFAULT_PLOT=[[-2,-1.25],[2,-1.25],[2,1.25],[-2,1.25]];
const hex=(value,def)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:def;
export function cleanPlotPoints(points){
 if(!Array.isArray(points))return DEFAULT_PLOT.map(p=>[...p]);
 const result=[];
 for(const pair of points.slice(0,80)){
  if(!Array.isArray(pair)||pair.length!==2)continue;
  const [x,z]=pair;if(typeof x!=='number'||typeof z!=='number'||!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>80||Math.abs(z)>80)continue;
  if(!result.length||Math.hypot(x-result.at(-1)[0],z-result.at(-1)[1])>.075)result.push([x,z]);
 }
 if(result.length>3&&Math.hypot(result[0][0]-result.at(-1)[0],result[0][1]-result.at(-1)[1])<.12)result.pop();
 return result.length>=3?result:DEFAULT_PLOT.map(p=>[...p]);
}
export function smoothClosedPlot(points,iterations=1){
 let ring=cleanPlotPoints(points);
 for(let pass=0;pass<Math.min(2,Math.max(0,iterations));pass++){
  const out=[];for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length];
   out.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]);
  }ring=out;
 }return ring;
}
function random(seed){let s=((Number(seed)||0)>>>0)+1;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
export function polygonContains(points,x,z){
 let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];if(((a[1]>z)!==(b[1]>z))&&(x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]))inside=!inside;
 }return inside;
}
export function plotArea(points){let sum=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sum+=a[0]*b[1]-b[0]*a[1];}return Math.abs(sum)*.5;}
export function cleanVegetation(p={}){
 const value={...p};
 for(const [key,[def,min,max]] of Object.entries(VEGETATION_NUMERIC)){
  const n=Number(p[key]);let v=Number.isFinite(n)?Math.max(min,Math.min(max,n)):def;
  if(['branchCount','leafClusters','treeSeed','palmFronds','cropRows','plotSeed','scatterCount','shrubLeaves','shrubBranches'].includes(key))v=Math.round(v);
  value[key]=v;
 }
 value.treeStyle=['deciduous','conifer','orchard','blossom','palm'].includes(p.treeStyle)?p.treeStyle:'deciduous';
 value.fruitType=['none','apple','orange','plum','coconut'].includes(p.fruitType)?p.fruitType:(value.treeStyle==='palm'?'coconut':'none');
 value.groundCover=['soil','grass','mixed'].includes(p.groundCover)?p.groundCover:'mixed';
 value.soilPreset=['loam','sand','clay','compost'].includes(p.soilPreset)?p.soilPreset:'loam';
 value.cropType=['carrot','tomato','lettuce','strawberry'].includes(p.cropType)?p.cropType:'carrot';
 value.scatterMode=['orchard','forest','thicket','brushwood'].includes(p.scatterMode)?p.scatterMode:'forest';
 value.scatterSpecies=['mixed','deciduous','conifer','orchard','blossom','palm'].includes(p.scatterSpecies)?p.scatterSpecies:'mixed';
 value.shrubShape=['round','oval','wild','hedge'].includes(p.shrubShape)?p.shrubShape:'wild';
 value.plotSmooth=p.plotSmooth===true;value.plotPoints=cleanPlotPoints(p.plotPoints??(p.variant==='vegetationArea'?[[-7,-5],[7,-5],[7,5],[-7,5]]:undefined));
 value.leafColor=hex(p.leafColor,'#4a9254');value.soilColor=hex(p.soilColor,'#66503a');value.blossomColor=hex(p.blossomColor,'#eea6c2');
 return value;
}
const leafMaterial=c=>new THREE.MeshStandardMaterial({color:c,roughness:.9,flatShading:true,side:THREE.DoubleSide});
function mesh(group,geometry,material,x=0,y=0,z=0,collider=false){
 const part=new THREE.Mesh(geometry,material);part.position.set(x,y,z);part.castShadow=true;part.receiveShadow=true;
 part.userData.furniturePart=collider;group.push(part);return part;
}
function branchBetween(group,from,to,r1,r2,mat){
 const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),d=b.clone().sub(a),len=d.length();
 if(len<.03)return;
 const obj=mesh(group,new THREE.CylinderGeometry(r2,r1,len,7,1),mat,...a.clone().add(b).multiplyScalar(.5).toArray(),true);
 obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
}
function instanceMaterialGeometry(geometry,material,count){const instance=new THREE.InstancedMesh(geometry,material,count);instance.userData.furniturePart=false;instance.castShadow=true;instance.receiveShadow=true;return instance;}
function treeGeometry(p,trunkMaterial){
 const out=[],rnd=random(p.treeSeed),trunk=trunkMaterial||new THREE.MeshStandardMaterial({color:p.color||'#90735b',roughness:1,flatShading:true}),leaves=leafMaterial(p.leafColor);
 const H=p.treeHeight,R=p.trunkRadius,wiggle=p.trunkWobble;
 const N=p.treeStyle==='palm'?4:5,center=(t)=>[Math.sin(t*4.3+p.treeSeed*.001)*wiggle*t*t, H*t, Math.sin(t*5.1+p.treeSeed*.003)*wiggle*.7*t*t];
 for(let i=0;i<N;i++)branchBetween(out,center(i/N*(p.treeStyle==='palm'?.91:.79)),center((i+1)/N*(p.treeStyle==='palm'?.91:.79)),R*(1-i/N*.62),Math.max(.012,R*(1-(i+1)/N*.62)),trunk);
 if(p.treeStyle==='palm'){
  // Leaflets are four triangles per curved palm frond, merged into one geometry.
  const vertices=[],normals=[],colors=[],count=p.palmFronds,top=center(.91);
  const green=new THREE.Color(p.leafColor);const colorA=green.clone().multiplyScalar(.72),colorB=green.clone().multiplyScalar(1.14);
  const addTri=(a,b,c,t)=>{for(const v of [a,b,c]){vertices.push(...v);normals.push(0,1,0);const col=t<.5?colorA:colorB;colors.push(col.r,col.g,col.b);}};
  for(let k=0;k<count;k++){
   const angle=2*Math.PI*k/count+.12*(rnd()-.5),dx=Math.cos(angle),dz=Math.sin(angle),s=p.canopyRadius*(.85+rnd()*.24),steps=7;
   const pt=t=>[top[0]+dx*s*t,top[1]+s*(.30*Math.sin(t*Math.PI)-.52*t*t),top[2]+dz*s*t];
   for(let j=0;j<steps;j++){
    const t=j/steps,u=(j+1)/steps,hw=t=>(.17*s)*Math.sin(Math.PI*t)*(.6+.4*(1-t));
    const L=t=>{const a=pt(t);return[a[0]-dz*hw(t),a[1],a[2]+dx*hw(t)];};
    const Rv=t=>{const a=pt(t);return[a[0]+dz*hw(t),a[1],a[2]-dx*hw(t)];};
    addTri(L(t),Rv(t),L(u),t);addTri(Rv(t),Rv(u),L(u),u);
   }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
  mesh(out,g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,side:THREE.DoubleSide}));out.at(-1).castShadow=false;
  if(p.fruitType==='coconut'){
   const fruit=instanceMaterialGeometry(new THREE.IcosahedronGeometry(.13,1),leafMaterial('#96723e'),5);
   const m=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3(),s=new THREE.Vector3();
   for(let i=0;i<5;i++){const a=i*6.283/5;v.set(top[0]+Math.cos(a)*R*1.7,top[1]-.12-rnd()*.12,top[2]+Math.sin(a)*R*1.7);s.setScalar(.6+rnd()*.5);m.compose(v,q,s);fruit.setMatrixAt(i,m);}
   fruit.instanceMatrix.needsUpdate=true;out.push(fruit);
  }
  return out;
 }
 if(p.treeStyle==='conifer'){
  const levels=Math.max(3,Math.min(7,Math.floor(H/1.2)));
  for(let i=0;i<levels;i++){
   const t=i/(levels-1),radius=p.canopyRadius*(.96-.78*t),y=H*(.27+.62*t);
   mesh(out,new THREE.ConeGeometry(radius,H*.25,8,1),leaves,0,y,0);
  }
 }else{
  const count=p.branchCount,cloud=Math.max(1,p.leafClusters),clusterCount=Math.min(180,cloud*3);
  const geo=new THREE.IcosahedronGeometry(1,0),clusters=instanceMaterialGeometry(geo,leaves,clusterCount);
  const matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scale=new THREE.Vector3();
  for(let i=0;i<count;i++){
   const a=(i/count)*6.283+rnd()*.35,y=H*(.34+rnd()*.31),length=p.canopyRadius*(.4+rnd()*.62);
   branchBetween(out,center(y/H),[center(y/H)[0]+Math.cos(a)*length,y+length*(.4+rnd()*.45),center(y/H)[2]+Math.sin(a)*length],R*.21,R*.04,trunk);
  }
  for(let i=0;i<clusterCount;i++){
   const a=rnd()*6.283,radius=Math.sqrt(rnd())*p.canopyRadius;
   pos.set(Math.cos(a)*radius,H*(.54+rnd()*.40),Math.sin(a)*radius);
   const sz=p.canopyRadius*p.leafSize*(.65+rnd()*.65);scale.set(sz,sz*(.58+rnd()*.4),sz);matrix.compose(pos,quat,scale);clusters.setMatrixAt(i,matrix);
  }
  clusters.instanceMatrix.needsUpdate=true;out.push(clusters);
  if(p.treeStyle==='blossom'){
   const amount=Math.min(220,Math.floor(clusterCount*2*p.blossomDensity));
   if(amount){const flowers=instanceMaterialGeometry(new THREE.IcosahedronGeometry(1,0),leafMaterial(p.blossomColor),amount);
    for(let i=0;i<amount;i++){const a=rnd()*6.283,r=Math.sqrt(rnd())*p.canopyRadius;pos.set(Math.cos(a)*r,H*(.58+rnd()*.35),Math.sin(a)*r);const sz=.035+R*.06+rnd()*.035;scale.set(sz*1.4,sz*.55,sz*1.4);matrix.compose(pos,quat,scale);flowers.setMatrixAt(i,matrix);}
    flowers.instanceMatrix.needsUpdate=true;flowers.castShadow=false;out.push(flowers);
   }
  }
  if(p.fruitType!=='none'&&p.fruitType!=='coconut'){
   const amount=Math.min(24,cloud),fruitMat=leafMaterial(p.fruitType==='orange'?'#f59a2b':p.fruitType==='plum'?'#794889':'#c94638');
   const fruit=instanceMaterialGeometry(new THREE.IcosahedronGeometry(1,0),fruitMat,amount);
   for(let i=0;i<amount;i++){
    const a=rnd()*6.283,r=p.canopyRadius*Math.sqrt(rnd())*.87,sz=.065+H*.006;
    pos.set(Math.cos(a)*r,H*(.54+rnd()*.34),Math.sin(a)*r);scale.setScalar(sz);matrix.compose(pos,quat,scale);fruit.setMatrixAt(i,matrix);
   }fruit.instanceMatrix.needsUpdate=true;out.push(fruit);
  }
 }
 return out;
}
const soilVertex=`varying vec2 vGround;void main(){vGround=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const soilFragment=`
 uniform vec3 uSoil;uniform vec3 uGrass;uniform float uBlend;uniform float uRough;varying vec2 vGround;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0)),f.x),f.y);}
 void main(){float large=noise(vGround*1.75),fine=noise(vGround*16.0),micro=noise(vGround*68.0);
  float coverage=clamp(uBlend+(.28*large-.14)*uRough,0.0,1.0);vec3 base=mix(uSoil,uGrass,coverage);
  base*=.91+(.20*fine+.08*micro-.14)*(.25+uRough*.75);
  gl_FragColor=vec4(base,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`;
function grassBladeGeometry(width){
 // Three vertically subdivided segments preserve a rooted blade while the tip bends in the vertex shader.
 const geo=new THREE.PlaneGeometry(width,1,1,3);geo.translate(0,.5,0);return geo;
}
function grassBladeMaterial(p){
 const mat=new THREE.MeshStandardMaterial({color:p.leafColor,side:THREE.DoubleSide,roughness:1,metalness:0});
 mat.userData.windShader=null;
 mat.onBeforeCompile=shader=>{
  shader.uniforms.uWindTime={value:0};shader.uniforms.uWindStrength={value:p.windStrength};shader.uniforms.uWindSpeed={value:p.windSpeed};
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\nuniform float uWindTime;uniform float uWindStrength;uniform float uWindSpeed;`)
    .replace('#include <begin_vertex>',`#include <begin_vertex>
     float windPhase = (position.x*8.0 + instanceMatrix[3].x*1.23 + instanceMatrix[3].z*1.65) + uWindTime*uWindSpeed;
     float bend = sin(windPhase) * .65 + sin(windPhase*.47 + instanceMatrix[3].x*.63)*.35;
     transformed.x += bend * uWindStrength * pow(max(position.y,0.0),2.0) * .16;
     transformed.z += cos(windPhase*.78) * uWindStrength * pow(max(position.y,0.0),2.0) * .08;`);
  mat.userData.windShader=shader;
 };
 mat.customProgramCacheKey=()=>`solvi-grass-wind-166`;
 return mat;
}
function plotGeometry(p,isCrop){
 const pts=p.plotSmooth?smoothClosedPlot(p.plotPoints):p.plotPoints;
 const out=[],shape=new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,-z)));
 const base=p.soilPreset==='sand'?'#b9a475':p.soilPreset==='clay'?'#875641':p.soilPreset==='compost'?'#555248':p.soilColor;
 const mat=new THREE.ShaderMaterial({
  uniforms:{uSoil:{value:new THREE.Color(base)},uGrass:{value:new THREE.Color(p.leafColor)},uBlend:{value:isCrop?0:p.groundCover==='soil'?0:p.groundCover==='grass'?1:.48},uRough:{value:p.soilRoughness}},
  vertexShader:soilVertex,fragmentShader:soilFragment,side:THREE.DoubleSide,depthWrite:true
 });
 const soil=mesh(out,new THREE.ShapeGeometry(shape),mat,0,.006,0,false);soil.rotation.x=-Math.PI/2;soil.castShadow=false;
 const xs=pts.map(q=>q[0]),zs=pts.map(q=>q[1]),minx=Math.min(...xs),maxx=Math.max(...xs),minz=Math.min(...zs),maxz=Math.max(...zs);
 const area=Math.min(3200,plotArea(pts)),rnd=random(p.plotSeed),density=isCrop?0:p.groundCover==='soil'?0:p.grassDensity;
 const count=Math.min(2200,Math.floor(area*density*78));
 if(count){
  const material=grassBladeMaterial(p),grass=instanceMaterialGeometry(grassBladeGeometry(p.grassWidth),material,count);
  grass.castShadow=false;grass.frustumCulled=false;
  grass.onBeforeRender=()=>{const shader=material.userData.windShader;if(shader){shader.uniforms.uWindTime.value=performance.now()*.001;}};
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),pos=new THREE.Vector3();let built=0;
  for(let i=0;i<count*7&&built<count;i++){
   const x=minx+rnd()*(maxx-minx),z=minz+rnd()*(maxz-minz);if(!polygonContains(pts,x,z))continue;
   const scale=.65+rnd()*.75;pos.set(x,.015,z);q.setFromAxisAngle(new THREE.Vector3(0,1,0),rnd()*6.283);s.set(.72+rnd()*.6,p.grassHeight*scale,1);m.compose(pos,q,s);grass.setMatrixAt(built++,m);
  }
  grass.count=built;grass.instanceMatrix.needsUpdate=true;out.push(grass);
 }
 if(isCrop){
  const count=Math.min(180,Math.floor(area/Math.max(.08,p.cropSpacing*p.cropSpacing)));
  const plant=instanceMaterialGeometry(p.cropType==='lettuce'?new THREE.IcosahedronGeometry(.13,0):new THREE.ConeGeometry(.12,.3,5),leafMaterial(p.leafColor),count);
  plant.castShadow=false;
  const m=new THREE.Matrix4(),pos=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3(1,1,1);let built=0;
  const step=Math.max(.15,p.cropSpacing),cols=Math.ceil((maxx-minx)/step),rows=Math.min(p.cropRows,Math.max(1,Math.ceil((maxz-minz)/step))),gap=(maxz-minz)/rows;
  for(let row=0;row<rows&&built<count;row++)for(let col=0;col<cols&&built<count;col++){
   const x=minx+(col+.5)*step,z=minz+(row+.5)*gap;if(!polygonContains(pts,x,z))continue;
   const grow=Math.max(.03,p.growthPercent/100);pos.set(x,.17*grow,z);scale.set(grow,grow,grow);m.compose(pos,q,scale);plant.setMatrixAt(built++,m);
  }plant.count=built;plant.instanceMatrix.needsUpdate=true;out.push(plant);
 }
 return out;
}

// Deterministic, shape-contained vegetation scattering. One saved patch owns the entire
// distribution; no child scene objects, physics bodies or multiplayer network entities.
// The work is bounded even for huge, malicious, or extremely thin polygons.
export function scatterVegetationPositions(config={}){
 const p=cleanVegetation(config),pts=p.plotSmooth?smoothClosedPlot(p.plotPoints):p.plotPoints;
 const xs=pts.map(v=>v[0]),zs=pts.map(v=>v[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
 const rand=random(p.plotSeed),area=plotArea(pts),limit=Math.min(160,p.scatterCount);
 if(area<.01)return [];
 const result=[],cell=Math.max(.3,p.scatterSpacing),tooClose=(x,z,clearance)=>result.some(v=>Math.hypot(x-v.x,z-v.z)<clearance);
 const classify=()=>p.scatterMode==='brushwood'?'shrub':p.scatterMode==='thicket'?(rand()<.75?'shrub':'tree'):p.scatterMode==='forest'?(rand()<.18?'shrub':'tree'):'tree';
 const species=()=>p.scatterSpecies!=='mixed'?p.scatterSpecies:['deciduous','conifer','orchard','blossom','palm'][Math.floor(rand()*5)];
 const push=(x,z)=>{
  if(result.length>=limit||!polygonContains(pts,x,z))return false;
  const kind=classify(),scale=1+(rand()*2-1)*p.scatterScale;
  result.push({x,z,kind,style:species(),scale,rotation:rand()*Math.PI*2});return true;
 };
 if(p.scatterMode==='orchard'){
  // Regular agricultural planting rows with optional bounded irregularity.
  for(let z=minZ+cell*.5;z<maxZ&&result.length<limit;z+=cell)
   for(let x=minX+cell*.5;x<maxX&&result.length<limit;x+=cell){
    const j=cell*p.scatterJitter*.38;
    push(x+(rand()-.5)*j,z+(rand()-.5)*j);
   }
 }else{
  const clusters=[],number=p.scatterMode==='forest'?5:Math.max(3,Math.ceil(Math.sqrt(limit)/2));
  for(let i=0,attempt=0;i<number&&attempt<100;attempt++){
   const x=minX+rand()*(maxX-minX),z=minZ+rand()*(maxZ-minZ);
   if(polygonContains(pts,x,z)){clusters.push([x,z]);i++;}
  }
  // Spatially clustered proposals are mixed with uniform ones; thinning maintains
  // minimum spacing and produces natural gaps rather than a uniformly packed grid.
  for(let attempt=0;attempt<limit*75&&result.length<limit;attempt++){
   let x,z;
   if(clusters.length&&rand()<p.scatterCluster){
    const [cx,cz]=clusters[Math.floor(rand()*clusters.length)],radius=cell*(p.scatterMode==='forest'?2.8:1.7);
    const theta=rand()*Math.PI*2,r=radius*Math.sqrt(rand());x=cx+Math.cos(theta)*r;z=cz+Math.sin(theta)*r;
   }else{x=minX+rand()*(maxX-minX);z=minZ+rand()*(maxZ-minZ);}
   const clearance=cell*(p.scatterMode==='brushwood'?.42:p.scatterMode==='thicket'?.57:.78);
   if(!tooClose(x,z,clearance))push(x,z);
  }
 }
 return result;
}
function shrubGeometry(p){
 const out=[],rand=random(p.treeSeed),wood=new THREE.MeshStandardMaterial({color:p.color||'#79513a',roughness:1,flatShading:true});
 const leaves=leafMaterial(p.leafColor),height=p.shrubHeight,radius=p.shrubRadius;
 const branches=p.shrubBranches;
 for(let i=0;i<branches;i++){
  const a=(i+rand()*.3)*Math.PI*2/Math.max(1,branches),r=radius*(.35+rand()*.4);
  branchBetween(out,[0,.06,0],[Math.cos(a)*r,height*(.45+rand()*.4),Math.sin(a)*r],.028,.008,wood);
 }
 const count=p.shrubLeaves,leavesMesh=instanceMaterialGeometry(new THREE.IcosahedronGeometry(1,0),leaves,count);
 const mat=new THREE.Matrix4(),pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scale=new THREE.Vector3();
 for(let i=0;i<count;i++){
  const a=rand()*Math.PI*2,r=Math.sqrt(rand())*radius;
  pos.set(Math.cos(a)*r,height*(.36+rand()*.57),Math.sin(a)*r);
  const sz=radius*(.28+rand()*.28);
  scale.set(sz*(p.shrubShape==='hedge'?1.4:1),sz*(p.shrubShape==='oval'?.65:1),sz*(p.shrubShape==='hedge'?.7:1));
  mat.compose(pos,quat,scale);leavesMesh.setMatrixAt(i,mat);
 }
 leavesMesh.instanceMatrix.needsUpdate=true;leavesMesh.castShadow=false;out.push(leavesMesh);
 return out;
}
function vegetationAreaGeometry(p,trunkMaterial){
 const out=plotGeometry(p,false),positions=scatterVegetationPositions(p);
 // One instanced batch per geometry/material family, including all shrubs and trees.
 // This avoids one draw call per plant in WebXR and bounds output mesh count.
 const makeBatch=(geometry,material,entries)=>{
  if(!entries.length)return;
  const mesh=instanceMaterialGeometry(geometry,material,entries.length);
  const matrix=new THREE.Matrix4(),v=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
  entries.forEach((item,i)=>{v.set(...item.pos);q.setFromAxisAngle(new THREE.Vector3(0,1,0),item.angle||0);s.set(...item.scale);matrix.compose(v,q,s);mesh.setMatrixAt(i,matrix);});
  mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=false;mesh.userData.furniturePart=false;out.push(mesh);
 };
 const trunks=[],crowns=[],conifers=[],palms=[],shrubs=[],branches=[],blossoms=[],fruits=[];
 const rnd=random(p.treeSeed^p.plotSeed);
 for(const v of positions){
  if(v.kind==='shrub'){
   const height=p.shrubHeight*v.scale,radius=p.shrubRadius*v.scale;
   branches.push({pos:[v.x,height*.24,v.z],scale:[.027,height*.48,.027],angle:v.rotation});
   for(let i=0;i<Math.min(p.shrubLeaves,22);i++){
    const a=rnd()*6.283,r=Math.sqrt(rnd())*radius,z=v.z+Math.sin(a)*r,x=v.x+Math.cos(a)*r;
    const size=radius*(.22+rnd()*.21),y=height*(.33+rnd()*.62);
    shrubs.push({pos:[x,y,z],scale:[size*(p.shrubShape==='hedge'?1.35:1),size*(p.shrubShape==='oval'?.75:1),size],angle:a});
   }
  }else{
   const H=p.treeHeight*v.scale,R=p.canopyRadius*v.scale;
   trunks.push({pos:[v.x,H*.39,v.z],scale:[p.trunkRadius*v.scale,H*.78,p.trunkRadius*v.scale],angle:v.rotation});
   if(v.style==='conifer'){
    conifers.push({pos:[v.x,H*.72,v.z],scale:[R,H*.62,R],angle:v.rotation});
   }else if(v.style==='palm'){
    for(let i=0;i<Math.min(p.palmFronds,12);i++){
     const a=6.283*i/p.palmFronds+v.rotation,rad=R*.5;
     palms.push({pos:[v.x+Math.cos(a)*rad,H*.91,v.z+Math.sin(a)*rad],scale:[R*.51,R*.13,R*.18],angle:a});
    }
   }else{
    for(let i=0;i<8;i++){
     const a=rnd()*6.283,r=R*Math.sqrt(rnd())*.75,sz=R*p.leafSize*(.75+rnd()*.45);
     crowns.push({pos:[v.x+Math.cos(a)*r,H*(.66+rnd()*.28),v.z+Math.sin(a)*r],scale:[sz,sz*.8,sz],angle:a});
    }
    if(v.style==='orchard')for(let i=0;i<4;i++){
     const a=rnd()*6.283,r=R*Math.sqrt(rnd())*.8,sz=.075*v.scale;
     fruits.push({pos:[v.x+Math.cos(a)*r,H*(.65+rnd()*.2),v.z+Math.sin(a)*r],scale:[sz,sz,sz],angle:a});
    }
    if(v.style==='blossom')for(let i=0;i<6;i++){
     const a=rnd()*6.283,r=R*Math.sqrt(rnd())*.8,sz=.10*v.scale;
     blossoms.push({pos:[v.x+Math.cos(a)*r,H*(.7+rnd()*.2),v.z+Math.sin(a)*r],scale:[sz,sz*.5,sz],angle:a});
    }
   }
  }
 }
 const wood=trunkMaterial||new THREE.MeshStandardMaterial({color:p.color||'#90735b',roughness:1,flatShading:true});
 const leaf=leafMaterial(p.leafColor);
 makeBatch(new THREE.CylinderGeometry(1,1,1,6),wood,trunks);
 makeBatch(new THREE.CylinderGeometry(.4,1,1,4),wood,branches);
 makeBatch(new THREE.IcosahedronGeometry(1,0),leaf,crowns);
 makeBatch(new THREE.ConeGeometry(1,1,7),leaf,conifers);
 makeBatch(new THREE.IcosahedronGeometry(1,0),leaf,palms);
 makeBatch(new THREE.IcosahedronGeometry(1,0),leaf,shrubs);
 makeBatch(new THREE.IcosahedronGeometry(1,0),leafMaterial(p.blossomColor),blossoms);
 makeBatch(new THREE.IcosahedronGeometry(1,0),leafMaterial('#cd4936'),fruits);
 return out;
}

export function vegetationParts(config,trunkMaterial=null){
 const p=cleanVegetation(config);
 if(p.variant==='tree')return treeGeometry(p,trunkMaterial);
 if(p.variant==='shrub')return shrubGeometry(p);
 if(p.variant==='vegetationArea')return vegetationAreaGeometry(p,trunkMaterial);
 if(p.variant==='groundPlot'||p.variant==='cropBed')return plotGeometry(p,p.variant==='cropBed');
 return [];
}
