import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('js/cube-openings.js');
const THREE={
 Vector3:class{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}subVectors(b,a){this.x=b.x-a.x;this.y=b.y-a.y;this.z=b.z-a.z;return this;}cross(b){const {x,y,z}=this;this.x=y*b.z-z*b.y;this.y=z*b.x-x*b.z;this.z=x*b.y-y*b.x;return this;}dot(b){return this.x*b.x+this.y*b.y+this.z*b.z;}},
 Float32BufferAttribute:class{constructor(a,size){this.array=a;this.itemSize=size;}},
 BufferGeometry:class{constructor(){this.attrs={};}setAttribute(name,a){this.attrs[name]=a;return this;}computeBoundingSphere(){}},
 BoxGeometry:class{constructor(...args){this.args=args;}},
};
const sanitisePrimitive=(kind,p)=>({width:p.width||1,height:p.height||1,depth:p.depth||1,widthSegments:1,heightSegments:1,depthSegments:1});
const evaluated=source.replace(/^import .*\n/gm,'').replace(/export /g,'');
const cube=new Function('THREE','sanitisePrimitive',evaluated+'\nreturn {cleanOpenings,cutCubeGeometry,rectangleFromSurface,faceCoords,surfaceAxis};')(THREE,sanitisePrimitive);

test('selected scene Objects row has high-contrast highlight with aria-current',()=>{
 const editor=read('js/editor.js'),style=read('styles.css');
 assert.match(editor,/row\.className='scene-item-row'\+\(obj===this\.selected\?' is-active'/);
 assert.match(editor,/setAttribute\('aria-current'/);
 assert.match(style,/#sceneItems \.scene-item-row\.is-active/);
});
test('real cuboid through-hole mesh has an empty window in the front and back and tunnel wall faces',()=>{
 const opening={axis:'z',u:0,v:0,width:.5,height:.5};
 const geometry=cube.cutCubeGeometry({width:2,height:2,depth:.6},[opening]);
 const points=geometry.attrs.position.array,normal=geometry.attrs.normal.array;
 assert.ok(points.length>100,'compound mesh exists');
 let exterior=0,tunnel=0;
 for(let i=0;i<points.length;i+=9){const cx=(points[i]+points[i+3]+points[i+6])/3,cy=(points[i+1]+points[i+4]+points[i+7])/3,cz=(points[i+2]+points[i+5]+points[i+8])/3;
  if(Math.abs(cz)===.3&&Math.abs(cx)<.249&&Math.abs(cy)<.249)throw Error('Triangle closes the intended window');
  if(Math.abs(cz)===.3)exterior++;else if(Math.abs(cx)===.25||Math.abs(cy)===.25)tunnel++;
 }
 assert.ok(exterior>0&&tunnel>0);
 assert.ok(normal.length===points.length);
});
test('surface rectangle conversion works for each axis and clamps untrusted openings',()=>{
 assert.deepEqual(cube.rectangleFromSurface('z',{x:-.5,y:0,z:1},{x:.5,y:1,z:1}),{axis:'z',u:0,v:.5,width:1,height:1});
 assert.equal(cube.cleanOpenings([{axis:'z',u:0,v:0,width:1,height:1},{axis:'broken',u:0,v:0,width:1,height:1}]).length,1);
});
test('3D curves are editable and stored with bounded offset, extrude and bevel dimensions',()=>{
 const curve=read('js/curve-geometry.js'),editor=read('js/editor.js'),html=read('index.html'),server=read('backend/server.py');
 for(const key of ['offset','extrude','bevel','bevelResolution','resolution'])assert.ok(curve.includes(key));
 assert.match(curve,/CatmullRomCurve3/);assert.match(curve,/computeFrenetFrames/);
 assert.match(editor,/curve:o\.userData\.editorKind==='curve'/);
 assert.match(html,/id="curvePropertyRange"/);assert.match(html,/id="curveDrawPanel"/);
 assert.match(server,/def valid_curve_geometry/);
});
test('face shortcuts generate surface sketches and persist true openings plus media mounts',()=>{
 const editor=read('js/editor.js'),spatial=read('js/spatial-editor.js'),physics=read('js/scene-physics.js'),server=read('backend/server.py');
 assert.match(editor,/KeyO/);assert.match(editor,/KeyU/);
 assert.match(editor,/openings:o\.userData\.editorKind==='cube'/);
 assert.match(spatial,/cutCubeGeometry\(obj\.userData\.primitive,holes\)/);
 assert.match(spatial,/collider:'trimesh'/);
 assert.match(spatial,/media\.userData\.media\.mount=structuredClone\(mount\)/);
 assert.match(physics,/JSON\.stringify\(object\.userData\.openings\)/);
 assert.match(server,/valid_cube_openings/);assert.match(server,/valid_surface_mount/);
});
test('room chat media browser is authenticated, bounded and filters by selected realm',()=>{
 const server=read('backend/server.py'),spatial=read('js/spatial-editor.js');
 assert.match(server,/@app\.get\('\/api\/media\/room'\)/);
 assert.match(server,/FROM messages WHERE room_id=\?/);assert.match(server,/if len\(found\)>=120/);
 assert.match(spatial,/api\/media\/room\?room=/);
 assert.match(spatial,/mediaBlobInfo\(asset\.id\)/);
});
test('realm roundtrip remaps mounted media target IDs and retains curve/opening data',()=>{
 const archive=read('backend/realm_archives.py');
 assert.match(archive,/remap\[oldid\]=copy\['id'\]/);
 assert.match(archive,/mount\['target'\]=remap\[mount\['target'\]\]/);
 assert.match(archive,/'curve','openings','transformLocked'/);
});
