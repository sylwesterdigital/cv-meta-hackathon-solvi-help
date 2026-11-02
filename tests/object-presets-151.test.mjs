import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canPreset,presetEntry,presetCategory} from '../js/object-preset-data.js';
import {groundIntersection} from '../js/scene-placement-math.js';
const source=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('presets distinguish furniture, props, geometry and architecture',()=>{
 assert.equal(presetCategory({kind:'furniture',furniture:{variant:'sofa'}}),'Furniture');
 assert.equal(presetCategory({kind:'furniture',furniture:{variant:'mug'}}),'Props');
 assert.equal(presetCategory({kind:'cube'}),'Geometry');
 assert.equal(presetCategory({kind:'ladder'}),'Architecture');
 assert.equal(canPreset({kind:'robot'}),false);
 assert.equal(canPreset({kind:'stairs',stairs:{variant:'lift'}}),false);
 assert.equal(canPreset({kind:'cube',texture:'custom'}),false);
});
test('preset is a deep-copy template without source object id, ownership or position',()=>{
 const source={id:'old',owner:'someone',position:[9,10,11],kind:'furniture',name:'My sofa',furniture:{variant:'sofa',width:2.4,color:'#ac9292'},physics:{mode:'static'},scale:[1,1,1],rotation:[0,0.25,0],pickable:true,followHandRotation:false};
 const preset=presetEntry(source);assert.equal(preset.id,undefined);assert.equal(preset.owner,undefined);assert.equal(preset.position,undefined);
 assert.equal(preset.furniture.width,2.4);assert.deepEqual(preset.rotation,[0,.25,0]);
 source.furniture.width=3.2;assert.equal(preset.furniture.width,2.4);
});
test('downward camera centre ray hits ground rather than stopping short below viewport',()=>{
 const hit=groundIntersection({x:0,y:30,z:0},{x:0,y:-0.6,z:-0.8},{x:10,y:0,z:0});
 assert.ok(Math.abs(hit.z+40)<1e-9);assert.equal(hit.y,0);
 const horizon=groundIntersection({x:0,y:30,z:0},{x:0,y:-0.00001,z:-1},{x:4,y:2,z:-3});
 assert.deepEqual(horizon,{x:4,y:0,z:-3});
});
test('compact checkbox layout and controls are scoped inside physics panel',()=>{
 const html=source('index.html'),css=source('styles.css');
 for(const id of ['objectPickableRow','objectFollowHandRotationRow','objectClimbableRow'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/id="objectPhysicsToggles"/);assert.match(css,/#propertiesPanel #physicsObjectControls #objectPhysicsToggles input\[type=checkbox\]/);
 assert.match(css,/width:15px!important/);assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
test('scene editor creates new identity, restores procedural configuration and persists created preset',()=>{
 const code=source('js/editor.js');assert.match(code,/addFromPreset\(saved\)/);assert.match(code,/this\.addSceneEntry\(entry\)/);assert.match(code,/positionNewOnGround\(obj,point\)/);assert.match(code,/this\.physics\.sync\(obj\)/);assert.match(code,/this\.queueSave\(obj\)/);
 assert.match(code,/centreGroundFromCamera\(this\.world\.camera/);
});
test('saved preset gallery is authenticated, searchable, filterable and offers thumbnail, add, delete',()=>{
 const client=source('js/object-presets.js'),server=source('backend/server.py');
 assert.match(client,/\/api\/object-presets/);assert.match(client,/toLocaleLowerCase\(\)/);assert.match(client,/capturePresetThumbnail/);assert.match(client,/Delete/);assert.match(client,/editor\.addFromPreset/);
 assert.match(server,/@app\.route\('\/api\/object-presets'/);assert.match(server,/WHERE user_id=\?/);assert.match(server,/DELETE FROM object_presets WHERE id=\? AND user_id=\?/);assert.match(server,/CREATE TABLE IF NOT EXISTS object_presets/);
});
