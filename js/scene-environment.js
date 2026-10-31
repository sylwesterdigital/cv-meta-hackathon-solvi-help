// Room-scoped environment settings. Pure normalization is also used by tests.
export const ENVIRONMENT_DEFAULTS=Object.freeze({
 fogEnabled:true,fogColor:'#101b2c',fogNear:12,fogFar:130,
 gridEnabled:true,gridColor:'#455a6a',floorSize:70,floorColor:'#344758',floorTexture:'none',
 backgroundColor:'#101b2c',skyType:'solid',skyTop:'#10315e',skyHorizon:'#7ea2bd',
 skySpeed:0.4,skyIntensity:0.75,starDensity:0.65,viewDistance:1500
});
const ranges={fogNear:[0,100000],fogFar:[1,150000],floorSize:[40,20000],skySpeed:[0,5],skyIntensity:[0,2],starDensity:[0,2],viewDistance:[200,100000]};
const types=new Set(['solid','gradient','sunset','rainbow','stars','nebula']);
const floorTypes=new Set(['none','concrete','soil','tarmac','sand','tiles','gradient-tiles','random-tiles']);
const validHex=v=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v);
export function normalizeEnvironment(input={}){
 const out={...ENVIRONMENT_DEFAULTS};
 if(!input||typeof input!=='object'||Array.isArray(input))return out;
 for(const key of ['fogEnabled','gridEnabled'])if(typeof input[key]==='boolean')out[key]=input[key];
 for(const key of ['fogColor','gridColor','floorColor','backgroundColor','skyTop','skyHorizon'])if(validHex(input[key]))out[key]=input[key].toLowerCase();
 for(const [key,[a,b]] of Object.entries(ranges)){
  const value=typeof input[key]==='number'?input[key]:typeof input[key]==='string'&&input[key].trim()?Number(input[key]):NaN;
  if(Number.isFinite(value))out[key]=Math.round(Math.max(a,Math.min(b,value))*1000)/1000;
 }
 if(types.has(input.skyType))out.skyType=input.skyType;
 if(floorTypes.has(input.floorTexture))out.floorTexture=input.floorTexture;
 out.fogFar=Math.max(out.fogNear+1,out.fogFar);
 return out;
}
export function environmentViewLimit(config,extent=0){
 const c=normalizeEnvironment(config);
 return Math.min(100000,Math.max(250,c.viewDistance,c.floorSize*2.2,Number.isFinite(extent)?extent*3:0));
}

const vertexShader=`varying vec3 vSkyDirection; void main(){
 vSkyDirection=position;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;
const fragmentShader=`
precision highp float;
varying vec3 vSkyDirection;
uniform vec3 uTop;uniform vec3 uHorizon;uniform float uTime;
uniform float uIntensity;uniform float uDensity;uniform int uMode;
float hash13(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x),mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x),mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){float f=0.,a=.5;for(int i=0;i<5;i++){f+=a*noise3(p);p=p*2.03+vec3(3.1,1.7,.9);a*=.5;}return f;}
vec3 starfield(vec3 d,float t){
 vec3 grid=d*350.;vec3 cell=floor(grid);vec3 f=fract(grid)-.5;
 float h=hash13(cell),threshold=mix(.9987,.978,clamp(uDensity/2.,0.,1.));
 vec3 offset=vec3(hash13(cell+7.)-.5,hash13(cell+21.)-.5,hash13(cell+43.)-.5)*.5;
 float dist=length(f-offset);
 float sparkle=.78+.22*sin(t*(1.+h*2.4)+h*150.);
 float core=pow(max(0.,1.-dist*2.35),12.)*step(threshold,h)*sparkle;
 float halo=pow(max(0.,1.-dist*1.6),8.)*step(.994,h)*.42;
 vec3 tint=mix(vec3(.56,.72,1.),vec3(1.,.88,.67),hash13(cell+57.));
 return tint*(core+halo)*uIntensity*2.8;
}
void main(){
 vec3 d=normalize(vSkyDirection);float h=clamp(d.y*.5+.5,0.,1.);
 vec3 col=mix(uHorizon,uTop,smoothstep(.23,.92,h));
 if(uMode==2){
  float haze=fbm(d*6.+vec3(uTime*.012,0.,0.));
  col=mix(col,vec3(.98,.35,.26),pow(1.-h,2.2)*.54*uIntensity);
  col+=vec3(1.,.48,.18)*max(0.,haze-.52)*.32*uIntensity;
 }
 if(uMode==3){
  float a=atan(d.z,d.x);float arc=abs(d.y-(.18+.42*sin(a*.58+uTime*.17)));
  float band=exp(-pow(arc/.115,2.));
  float hue=clamp(arc/.11,0.,1.);
  vec3 rainbow=.53+.46*cos(6.28318*(vec3(0.,.33,.67)+hue*.85));
  col=mix(col,rainbow,clamp(band*.72*uIntensity,0.,1.));
  float cloud=fbm(d*6.+vec3(uTime*.025,0.,0.));
  col+=vec3(.12,.14,.25)*pow(max(cloud-.55,0.),2.)*uIntensity;
 }
 if(uMode==4||uMode==5){
  vec3 deep=mix(vec3(.012,.018,.047),uTop*.30,max(.0,d.y)*.7);
  float gal=exp(-pow((d.y+.16*sin(atan(d.z,d.x)*1.7))/.22,2.));
  float dust=fbm(d*8.+vec3(uTime*.002));
  deep+=vec3(.10,.08,.22)*gal*max(.0,dust-.35)*1.3*uIntensity;
  if(uMode==5){
   float n=fbm(d*5.+vec3(uTime*.006,0.,0.));
   float n2=fbm(d*11.-vec3(0.,uTime*.009,0.));
   deep+=mix(vec3(.10,.13,.65),vec3(.76,.11,.38),n2)*pow(max(0.,n-.42),1.7)*1.8*uIntensity;
  }
  col=deep+starfield(d,uTime);
 }
 gl_FragColor=vec4(max(col,vec3(0.)),1.);
}
`;
export function createSkyDome(THREE){
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,48,24),new THREE.ShaderMaterial({
  vertexShader,fragmentShader,side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,
  uniforms:{uTop:{value:new THREE.Color('#10315e')},uHorizon:{value:new THREE.Color('#7ea2bd')},
   uTime:{value:0},uIntensity:{value:0.75},uDensity:{value:0.65},uMode:{value:1}}}));
 mesh.name='solvi-sky-dome';mesh.renderOrder=-100000;mesh.frustumCulled=false;
 return mesh;
}
export function skyModeIndex(type){return {solid:0,gradient:1,sunset:2,rainbow:3,stars:4,nebula:5}[type]??0;}
