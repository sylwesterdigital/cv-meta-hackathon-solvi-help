import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ENVIRONMENT_DEFAULTS,normalizeEnvironment,environmentViewLimit,skyModeIndex} from '../js/scene-environment.js';

test('world appearance defaults preserve the original floor and background',()=>{
 const d=normalizeEnvironment();
 assert.equal(d.floorSize,70);assert.equal(d.gridEnabled,true);assert.equal(d.fogEnabled,true);
 assert.equal(d.backgroundColor,'#101b2c');assert.equal(d.skyType,'solid');
});
test('scene controls enable fog/grid toggles and large floors',()=>{
 const d=normalizeEnvironment({fogEnabled:false,gridEnabled:false,floorSize:20000,skyType:'rainbow',skySpeed:3,backgroundColor:'#AABBCC'});
 assert.equal(d.fogEnabled,false);assert.equal(d.gridEnabled,false);assert.equal(d.floorSize,20000);
 assert.equal(d.skyType,'rainbow');assert.equal(d.skySpeed,3);assert.equal(d.backgroundColor,'#aabbcc');
 assert.equal(normalizeEnvironment({floorSize:1,skyType:'url'}).floorSize,40);
 assert.equal(normalizeEnvironment({skyType:'url'}).skyType,'solid');
});
test('fog limits and invalid color cannot break the renderer',()=>{
 const d=normalizeEnvironment({fogNear:500,fogFar:100,fogColor:'red',gridColor:'#12345z'});
 assert.equal(d.fogFar,501);assert.equal(d.fogColor,ENVIRONMENT_DEFAULTS.fogColor);
 assert.equal(d.gridColor,ENVIRONMENT_DEFAULTS.gridColor);
 assert.equal(normalizeEnvironment({starDensity:1.8}).starDensity,1.8);
});
test('large imported models raise camera clip and orbit limits',()=>{
 assert.ok(environmentViewLimit({floorSize:3000})>=6600);
 assert.ok(environmentViewLimit({floorSize:70},30000)>=90000);
 assert.equal(environmentViewLimit({viewDistance:100000},300000),100000);
});
test('sky shader includes cloud, rainbows, stars and valid menu choices',()=>{
 for(const k of ['solid','gradient','sunset','rainbow','stars','nebula'])assert.ok(skyModeIndex(k)>=0);
 assert.equal(skyModeIndex('bogus'),0);
 const world=fs.readFileSync(new URL('../js/world.js',import.meta.url),'utf8');
 assert.match(world,/this\.scene\.fog=cfg\.fogEnabled\?new THREE\.Fog/);
 assert.match(world,/this\.grid\.visible=cfg\.gridEnabled/);
 assert.match(world,/PlaneGeometry\(cfg\.floorSize,cfg\.floorSize\)/);
 assert.match(world,/camera\.far=max/);
 assert.match(world,/updateWorldExtent\(\)/);
});
test('world drawer exposes and saves every scene field',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for(const id of ['envFogEnabled','envGridEnabled','envFogColor','envFogNear','envFogFar','envFloorSize','envFloorColor','envGridColor','envSkyType','envBackgroundColor','envSkyTop','envSkyHorizon','envSkySpeed','envSkyIntensity','envStarDensity','envViewDistance','worldSettingsStatus'])
  assert.ok(html.includes(`id="${id}"`),id);
 const studio=fs.readFileSync(new URL('../js/studio.js',import.meta.url),'utf8');
 assert.match(studio,/\/api\/room\/environment/);
 assert.match(studio,/createRoomAutosave/);
 assert.match(studio,/environmentAutosave\.update\(activeRoom,env/);
 assert.match(studio,/policyAutosave\.update\(activeRoom,policy/);
 assert.doesNotMatch(studio,/savedRoomEnvironment\);fillEnvironmentFields\(savedRoomEnvironment\);\$\('worldSettingsDrawer'\)\.hidden/);
 assert.ok(!html.includes('id="saveWorldSettings"')); 
});
