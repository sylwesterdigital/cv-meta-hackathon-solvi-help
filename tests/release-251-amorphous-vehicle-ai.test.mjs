import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cleanVehicleBlueprint,vehiclePartBlueprint,VEHICLE_PRESETS} from '../js/vehicle-blueprint.js';
import {parseAiChatCommand,safeAiFileName} from '../js/ai-chat-command.js';
import {validateSceneSnapshot} from '../js/scene-snapshot-guard.js';
const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('vehicle blueprints are bounded, portable and define wheel/chassis geometry',()=>{
 const extreme=cleanVehicleBlueprint({length:999,width:-2,wheels:47,wheelRadius:300,paint:'<script>',name:'<bad>'});
 assert.equal(extreme.length,12);assert.equal(extreme.width,.7);assert.equal(extreme.wheels,4);assert.equal(extreme.wheelRadius,1.5);
 assert.equal(extreme.paint,VEHICLE_PRESETS['City Car'].paint);
 for(const [name,preset] of Object.entries(VEHICLE_PRESETS)){
  const {blueprint,parts}=vehiclePartBlueprint(preset);assert.equal(blueprint.name,name);
  assert.equal(parts.length,blueprint.wheels+2);
  assert.equal(parts.filter(p=>p.name.startsWith('Wheel')).length,blueprint.wheels);
  assert.ok(parts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)));
  assert.ok(parts.filter(p=>p.kind==='cylinder').every(p=>p.rotation[2]===Math.PI/2));
 }
});

test('amorphous distortion is seeded, finite, adjustable and restored as valid scene kind',()=>{
 const src=source('js/amorphous-geometry.js');
 const executable=src.replace(/^import .*;\s*$/gm,'').replace(/export (const|function) /g,'$1 ');
 const {cleanAmorphous,organicNoise,organicRadius}=new Function('THREE',executable+'\nreturn {cleanAmorphous,organicNoise,organicRadius};')({});
 const p=cleanAmorphous({radius:2,distortion:100,resolution:999,seed:22,effect:100});
 assert.equal(p.distortion,.85);assert.equal(p.resolution,64);assert.equal(p.effect,3);
 const point={x:.35,y:.44,z:.82};
 assert.equal(organicNoise(1.2,.4,-3,8),organicNoise(1.2,.4,-3,8));
 assert.equal(organicRadius(point,p),organicRadius(point,p));
 assert.notEqual(organicRadius(point,{...p,seed:7}),organicRadius(point,p));
 assert.match(src,/computeVertexNormals\(\)/);
 assert.match(src,/onBeforeCompile/);assert.match(src,/solviOrganicTime/);
 assert.equal(validateSceneSnapshot({revision:4,objects:[{id:'rock1',kind:'amorphous',position:[0,1,0],rotation:[0,0,0],scale:[1,1,1]}]}).ok,true);
});

test('/ai is explicit, quoted prompts work, robot eye framing is optional and no tool order is synthesized',()=>{
 assert.equal(parseAiChatCommand('@Albert build a maze'),null);
 assert.deepEqual(parseAiChatCommand('/ai "What is a collider?"'),{mode:'ask',prompt:'What is a collider?',robot:''});
 assert.deepEqual(parseAiChatCommand('/ai --eyes @Lemox: explain this'),{mode:'eyes',prompt:'explain this',robot:'Lemox'});
 assert.equal(parseAiChatCommand('/ai --file write a report').mode,'file');
 assert.equal(parseAiChatCommand('/ai --image draw a car').mode,'image-generate');
 assert.equal(safeAiFileName('../foo <script>.js'),'.._foo__script_.js');
 const client=source('js/studio.js');assert.match(client,/parseAiChatCommand\(text\)/);
 assert.match(client,/\/api\/ai\/assist/);assert.match(client,/latestRobotObservationFrame/);
 assert.match(client,/if\(ai\)\{/);assert.match(client,/return;\n }\n const useAI=false/);
});

test('actual editor uses native SOLVI placement and colliders for vehicle lab and real 3D geometry for rocks',()=>{
 const editor=source('js/editor.js'),primitive=source('js/primitive-properties.js'),backend=source('backend/server.py');
 assert.match(editor,/\['Meta Vehicle Lab',\['meta vehicle lab'\]\]/);
 assert.match(editor,/addVehicleBlueprint\(input\)/);
 assert.match(editor,/this\.placeSmartNewObject\(draft\)/);
 assert.match(editor,/object\.userData\.physics=physicsOptions\(\{mode:'static',friction:\.95\}\)/);
 assert.match(editor,/this\.physics\.sync\(object\);results\.push\(object\)/);
 assert.match(primitive,/amorphous:\{/);
 assert.match(backend,/if o\['kind'\]=='amorphous'/);
 assert.match(backend,/def ai_assist\(\):/);
 assert.match(backend,/\(mid,user\['id'\],'user'/);
});

test('amorphous objects survive live realm hydration and support editable inspector effects',()=>{
 const editor=source('js/editor.js');
 assert.match(editor,/const kinds=\[[^\]]*'amorphous'[^\]]*\]/);
 assert.match(editor,/addSceneEntry\(entry\)\{if\(!kinds\.includes\(entry\.kind\)\)return;/);
 assert.match(editor,/entry\.kind==='amorphous'\)applyAmorphousEffect/);
 assert.match(editor,/\['effect','Animated surface'/);
 assert.match(editor,/this\.items\.length\+parts\.length>512/);
 const portable=source('js/creative-build-preset.js');
 assert.match(portable,/const TYPES=new Set\(\[[^\]]*'amorphous'/);
});
