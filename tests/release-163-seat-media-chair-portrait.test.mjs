import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

function seatingRuntime(){
 class V3{
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  clone(){return new V3(this.x,this.y,this.z);}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
  sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
  addScaledVector(v,t){this.x+=v.x*t;this.y+=v.y*t;this.z+=v.z*t;return this;}
 }
 class Matrix4{copy(){return this;}invert(){return this;}multiply(){return this;}}
 class Box3{
  constructor(min=new V3(Infinity,Infinity,Infinity),max=new V3(-Infinity,-Infinity,-Infinity)){this.min=min;this.max=max;}
  union(b){this.min.x=Math.min(this.min.x,b.min.x);this.min.y=Math.min(this.min.y,b.min.y);this.min.z=Math.min(this.min.z,b.min.z);this.max.x=Math.max(this.max.x,b.max.x);this.max.y=Math.max(this.max.y,b.max.y);this.max.z=Math.max(this.max.z,b.max.z);return this;}
  clone(){return new Box3(this.min.clone(),this.max.clone());}
  applyMatrix4(){return this;}
  isEmpty(){return this.min.x>this.max.x;}
 }
 const src=read('js/robot-seating.js');const isolated=src.slice(src.indexOf('export function standClearancePosition(')).replaceAll('export function ','function ');
 return new Function('THREE',isolated+'\nreturn {standClearancePosition,standUp};')({Vector3:V3,Box3,Matrix4});
}
function sampleSeat(){
 const bound={min:{x:-1,y:0,z:-1},max:{x:1,y:1,z:1},clone(){return {min:{...this.min},max:{...this.max},applyMatrix4(){return this;}}}};
 return {matrixWorld:{},userData:{editorId:'sofa'},traverse(cb){cb({matrixWorld:{},geometry:{boundingBox:bound}});},updateWorldMatrix(){},worldToLocal(v){return v;},getWorldScale(){return {x:1,y:1,z:1};}};
}
test('stand-up moves a seated avatar past the furniture footprint, preserves yaw and updates its physical body',()=>{
 const {standClearancePosition,standUp}=seatingRuntime();
 const target=sampleSeat();const robot={rotation:{y:Math.PI},position:{x:0,y:0,z:-.35,clone(){return new (class {constructor(x,y,z){this.x=x;this.y=y;this.z=z;}clone(){return new this.constructor(this.x,this.y,this.z);}add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}addScaledVector(v,t){this.x+=v.x*t;this.y+=v.y*t;this.z+=v.z*t;return this;}})(this.x,this.y,this.z);}},userData:{robotSeated:true,robotSeatedTarget:'sofa',robotMode:'idle'}};
 const next=standClearancePosition(robot,target);assert.ok(next.z < -1.5,next.z);
 let physics=0,save=0;
 const editor={items:[target],physics:{applyEditedPose(){physics++;}},queueSave(){save++;}};
 assert.equal(standUp(robot,editor),true);
 assert.ok(robot.position.z<-1.5);assert.equal(robot.rotation.y,Math.PI);assert.equal(physics,1);assert.equal(save,1);
 assert.equal(robot.userData.robotSeated,false);
});
test('stand-up has a safe no-target fallback and does not try to change a non-seated robot',()=>{
 const {standUp}=seatingRuntime();
 const robot={position:{x:2,y:0,z:3},rotation:{y:1},userData:{robotSeated:true,robotSeatedTarget:'deleted'}};
 assert.equal(standUp(robot,{items:[],queueSave(){}}),true);assert.equal(robot.position.z,3);
 assert.equal(standUp(robot,{items:[]}),false);
});
test('recording label is one sRGB canvas texture, smaller than the old two sprites, and directly clickable in 3D/XR',()=>{
 const media=read('js/scene-media.js'),editor=read('js/editor.js'),world=read('js/world.js');
 assert.match(media,/function makeAudioRecordingLabel\(mesh\)/);
 assert.match(media,/sprite\.scale\.set\(1\.22,\.255,1\)/);
 assert.match(media,/sprite\.userData\.mediaPlaybackLabel=true/);
 assert.match(media,/paintAudioRecordingLabel\(mesh,!mediaEl\.paused&&!mediaEl\.ended\)/);
 assert.match(editor,/h\.object\.userData\.mediaPlaybackLabel/);
 assert.match(editor,/sceneMediaKind\(obj\.userData\.media\?\.mime\)==='audio'/);
 assert.match(world,/else toggleSceneMediaPlayback\(mediaTarget\)/);
});
test('office-chair has a true lumbar opening, optional arms and five spherical casters',()=>{
 const geometry=read('js/primitive-properties.js'),editor=read('js/editor.js');
 assert.match(geometry,/result\.ergonomicBack=raw\.ergonomicBack!==false/);
 assert.match(geometry,/for\(let i=0;i<5;i\+\+\)/);
 assert.match(geometry,/officeChairWheel=true/);
 assert.match(geometry,/officeBackFrame/);
 assert.match(geometry,/if\(p\.armrests\)/);
 assert.match(editor,/add\('ergonomicBack','Open ergonomic back','checkbox'\)/);
 assert.match(editor,/add\('armrests','Armrests','checkbox'\)/);
});
test('chair refinements are valid in backend and unrelated fields remain rejected',()=>{
 const code=`import ast,sys,math,re\nsrc=open(sys.argv[1]).read();t=ast.parse(src);names=['valid_basic_furniture','valid_smart_options','valid_smart_channels'];ns={'math':math,'re':re};exec(compile(ast.Module(body=[n for n in t.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'<test>','exec'),ns)\nf=ns['valid_basic_furniture'];assert f({'variant':'officeChair','ergonomicBack':True,'armrests':True,'legStyle':'single'});assert f({'variant':'officeChair','ergonomicBack':False,'armrests':False,'legStyle':'four'});assert not f({'variant':'officeChair','armrests':'yes'});assert not f({'variant':'officeChair','badProperty':True});print('ok')`;
 const result=spawnSync('python3',['-c',code,new URL('../backend/server.py',import.meta.url).pathname],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.stdout);
});
test('headshot export receives sRGB framebuffer and neutral fill lighting, cleared on teardown',()=>{
 const src=read('js/robots.js').split('export async function captureRobotPortrait(world,robot){')[1]?.split('// Run AFTER Rapier')[0];
 assert.match(src,/rt\.texture\.colorSpace=THREE\.SRGBColorSpace/);
 assert.match(src,/new THREE\.HemisphereLight/);
 assert.match(src,/new THREE\.DirectionalLight/);
 assert.match(src,/world\.scene\.remove\(portraitFill,portraitKey\)/);
});
test('preset delete icon remains exactly centred without duplicate CSS pseudo-icon',()=>{
 const css=read('styles.css');
 assert.match(css,/#objectPresetsBackdrop \.object-preset-delete::before,#objectPresetsBackdrop \.object-preset-delete::after\{content:none!important;display:none!important\}/);
 assert.match(css,/transform:translate\(-50%,-50%\)!important/);
});
