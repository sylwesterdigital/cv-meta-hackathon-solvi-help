// SOLVI lightweight vegetation: deterministic meshes, fixed complexity budgets.
// Design informed by the user's MIT-licensed ez-tree reference, but this module
// is a new, deliberately much smaller implementation with no external GUI/runtime.
import * as THREE from 'three';

export const VEGETATION_TYPES=['tree','groundPlot','cropBed'];
export const VEGETATION_NUMERIC={
 treeHeight:[4.5,.4,18],trunkRadius:[.18,.025,1.4],canopyRadius:[1.5,.15,7],
 branchCount:[9,0,28],leafClusters:[12,0,60],treeSeed:[42,0,999999],
 grassDensity:[.55,0,1],grassHeight:[.18,.02,.7],soilRoughness:[.65,0,1],
 cropRows:[4,1,12],cropSpacing:[.45,.15,2],growthPercent:[65,0,100],plotSeed:[17,0,999999]
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
  const out=[];
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length];
   out.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]);
  }
  ring=out;
 }
 return ring;
}
function random(seed){let s=((Number(seed)||0)>>>0)+1;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
export function polygonContains(points,x,z){
 let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];if(((a[1]>z)!==(b[1]>z))&&(x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]))inside=!inside;
 }return inside;
}
export function plotArea(points){let sum=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sum+=a[0]*b[1]-b[0]*a[1];}return Math.abs(sum)*.5;}
export function cleanVegetation(p){
 const value={...p};
 for(const [key,[def,min,max]] of Object.entries(VEGETATION_NUMERIC)){
  const n=Number(p[key]);let v=Number.isFinite(n)?Math.max(min,Math.min(max,n)):def;
  if(['branchCount','leafClusters','treeSeed','cropRows','plotSeed'].includes(key))v=Math.round(v);
  value[key]=v;
 }
 value.treeStyle=['deciduous','conifer','orchard'].includes(p.treeStyle)?p.treeStyle:'deciduous';
 value.fruitType=['none','apple','orange','plum'].includes(p.fruitType)?p.fruitType:'none';
 value.groundCover=['soil','grass','mixed'].includes(p.groundCover)?p.groundCover:'mixed';
 value.soilPreset=['loam','sand','clay','compost'].includes(p.soilPreset)?p.soilPreset:'loam';
 value.cropType=['carrot','tomato','lettuce','strawberry'].includes(p.cropType)?p.cropType:'carrot';
 value.plotSmooth=p.plotSmooth===true;
 value.plotPoints=cleanPlotPoints(p.plotPoints);
 value.leafColor=hex(p.leafColor,'#4a9254');value.soilColor=hex(p.soilColor,'#66503a');
 return value;
}
const leafMaterial=(c)=>new THREE.MeshStandardMaterial({color:c,roughness:1,flatShading:true,side:THREE.DoubleSide});
function mesh(group,geometry,material,x=0,y=0,z=0,collider=false){
 const part=new THREE.Mesh(geometry,material);part.position.set(x,y,z);part.castShadow=true;part.receiveShadow=true;
 part.userData.furniturePart=collider;group.push(part);return part;
}
function branchBetween(group,from,to,r1,r2,mat){
 const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),d=b.clone().sub(a),len=d.length();
 if(len<.03)return;
 const obj=mesh(group,new THREE.CylinderGeometry(r2,r1,len,6,1),mat,...a.clone().add(b).multiplyScalar(.5).toArray(),true);
 obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
}
function treeGeometry(p){
 const out=[],rnd=random(p.treeSeed),trunk=new THREE.MeshStandardMaterial({color:p.color||'#765039',roughness:1,flatShading:true}),leaves=leafMaterial(p.leafColor);
 const H=p.treeHeight,R=p.trunkRadius;
 branchBetween(out,[0,0,0],[0,H*.75,0],R,Math.max(.018,R*.36),trunk);
 if(p.treeStyle==='conifer'){
  const levels=Math.max(3,Math.min(7,Math.floor(H/1.2)));
  for(let i=0;i<levels;i++){
   const t=i/(levels-1),radius=p.canopyRadius*(.96-.78*t),y=H*(.27+.62*t);
   mesh(out,new THREE.ConeGeometry(radius,H*.25,7,1),leaves,0,y,0);
  }
 }else{
  const count=p.branchCount,cloud=Math.max(1,p.leafClusters),leafGeo=new THREE.IcosahedronGeometry(1,0);
  const clusters=new THREE.InstancedMesh(leafGeo,leaves,cloud);clusters.userData.furniturePart=false;
  const matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scale=new THREE.Vector3();
  for(let i=0;i<count;i++){
   const a=(i/count)*Math.PI*2+rnd()*.35,tilt=.48+rnd()*.4,y=H*(.35+rnd()*.33),length=p.canopyRadius*(.6+rnd()*.55);
   branchBetween(out,[0,y,0],[Math.cos(a)*length,y+tilt*length,Math.sin(a)*length],R*.2,R*.055,trunk);
  }
  for(let i=0;i<cloud;i++){
   const a=rnd()*Math.PI*2,radius=Math.sqrt(rnd())*p.canopyRadius;
   pos.set(Math.cos(a)*radius,H*(.57+rnd()*.37),Math.sin(a)*radius);
   const s=p.canopyRadius*(.24+.27*rnd());scale.set(s,s*(.67+rnd()*.4),s);matrix.compose(pos,quat,scale);clusters.setMatrixAt(i,matrix);
  }
  clusters.instanceMatrix.needsUpdate=true;clusters.castShadow=true;clusters.receiveShadow=true;out.push(clusters);
  if(p.fruitType!=='none'){
   const count=Math.min(20,cloud*2),fruitMat=leafMaterial(p.fruitType==='orange'?'#f59a2b':p.fruitType==='plum'?'#794889':'#c94638');
   const fruit=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),fruitMat,count);
   for(let i=0;i<count;i++){
    const a=rnd()*6.283,r=p.canopyRadius*Math.sqrt(rnd())*.87,sz=.075+H*.006;
    pos.set(Math.cos(a)*r,H*(.54+rnd()*.34),Math.sin(a)*r);scale.setScalar(sz);matrix.compose(pos,quat,scale);fruit.setMatrixAt(i,matrix);
   }
   fruit.instanceMatrix.needsUpdate=true;fruit.castShadow=true;fruit.userData.furniturePart=false;out.push(fruit);
  }
 }
 return out;
}
function plotGeometry(p,isCrop){
 const pts=p.plotSmooth?smoothClosedPlot(p.plotPoints):p.plotPoints;
 const out=[],shape=new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,-z)));
 // One small GPU shader per plot; no grass blade shadow casters or colliders.
 const base=p.soilPreset==='sand'?'#b9a475':p.soilPreset==='clay'?'#875641':p.soilPreset==='compost'?'#39372e':p.soilColor;
 const mat=new THREE.ShaderMaterial({
  uniforms:{uSoil:{value:new THREE.Color(base)},uGrass:{value:new THREE.Color(p.leafColor)},uBlend:{value:isCrop?0:p.groundCover==='soil'?0:p.groundCover==='grass'?1:.48},uRough:{value:p.soilRoughness}},
  vertexShader:'varying vec2 vWorld; void main(){vWorld=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'uniform vec3 uSoil;uniform vec3 uGrass;uniform float uBlend;uniform float uRough;varying vec2 vWorld;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){float grit=hash(floor(vWorld*43.0));float patches=hash(floor(vWorld*2.6));float grass=clamp(uBlend+(patches-.5)*.7,0.,1.);vec3 c=mix(uSoil,uGrass,grass);c*=.78+(.15+uRough*.2)*grit;gl_FragColor=vec4(c,1.0);}',
  side:THREE.DoubleSide,depthWrite:true
 });
 const soil=mesh(out,new THREE.ShapeGeometry(shape),mat,0,.006,0,false);soil.rotation.x=-Math.PI/2;soil.castShadow=false;
 const xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]),minx=Math.min(...xs),maxx=Math.max(...xs),minz=Math.min(...zs),maxz=Math.max(...zs);
 const area=Math.min(3200,plotArea(pts)),rnd=random(p.plotSeed),density=isCrop?0:p.grassDensity;
 const count=Math.min(450,Math.floor(area*density*34));
 if(count){
  const grass=new THREE.InstancedMesh(new THREE.ConeGeometry(.045,p.grassHeight,3),leafMaterial(p.leafColor),count);
  grass.userData.furniturePart=false;grass.castShadow=false;
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),pos=new THREE.Vector3();let built=0;
  for(let i=0;i<count*5&&built<count;i++){
   const x=minx+rnd()*(maxx-minx),z=minz+rnd()*(maxz-minz);if(!polygonContains(pts,x,z))continue;
   const scale=.65+rnd()*.75;pos.set(x,p.grassHeight*scale*.5+.012,z);q.setFromAxisAngle(new THREE.Vector3(0,1,0),rnd()*6.283);s.setScalar(scale);m.compose(pos,q,s);grass.setMatrixAt(built++,m);
  }
  grass.count=built;grass.instanceMatrix.needsUpdate=true;out.push(grass);
 }
 if(isCrop){
  // Simple distinctive, low-poly crop clusters, one InstancedMesh draw call each.
  const count=Math.min(180,Math.floor(area/Math.max(.08,p.cropSpacing*p.cropSpacing)));
  const plant=new THREE.InstancedMesh(p.cropType==='lettuce'?new THREE.IcosahedronGeometry(.13,0):new THREE.ConeGeometry(.12,.3,5),leafMaterial(p.leafColor),count);
  plant.userData.furniturePart=false;plant.castShadow=false;
  const m=new THREE.Matrix4(),pos=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3(1,1,1);let built=0;
  const step=Math.max(.15,p.cropSpacing),cols=Math.ceil((maxx-minx)/step),rows=Math.min(p.cropRows,Math.max(1,Math.ceil((maxz-minz)/step)));const gap=(maxz-minz)/rows;
  for(let row=0;row<rows&&built<count;row++)for(let col=0;col<cols&&built<count;col++){
   const x=minx+(col+.5)*step,z=minz+(row+.5)*gap;if(!polygonContains(pts,x,z))continue;
   const grow=Math.max(.03,p.growthPercent/100);pos.set(x,.17*grow,z);scale.set(grow,grow,grow);m.compose(pos,q,scale);plant.setMatrixAt(built++,m);
  }
  plant.count=built;plant.instanceMatrix.needsUpdate=true;out.push(plant);
 }
 return out;
}
export function vegetationParts(config){
 const p=cleanVegetation(config);
 if(p.variant==='tree')return treeGeometry(p);
 if(p.variant==='groundPlot'||p.variant==='cropBed')return plotGeometry(p,p.variant==='cropBed');
 return [];
}
