import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cleanPortal,portalActivation,portalDestination,pairedPortal} from '../js/portal-core.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('portal pairs have independent transformable Entry and Exit objects',()=>{
 const editor=read('js/editor.js');
 assert.match(editor,/addPortalPair=function/);
 assert.match(editor,/partner:exit\.userData\.editorId/);
 assert.match(editor,/partner:entry\.userData\.editorId/);
 assert.match(editor,/portal:o\.userData\.editorKind==='portal'/);
 const a={userData:{editorId:'aaaa1111',editorKind:'portal',portal:cleanPortal({partner:'bbbb2222',role:'entry'})}};
 const b={userData:{editorId:'bbbb2222',editorKind:'portal',portal:cleanPortal({partner:'aaaa1111',role:'exit'})}};
 assert.equal(pairedPortal([a,b],a),b);
 assert.equal(pairedPortal([a],a),null);
 b.userData.portal.partner='bad';assert.equal(pairedPortal([a,b],a),null);
});
test('portal openings are bounded and permit passage at robot foot height',()=>{
 const c=cleanPortal({width:2,height:2.7,openingWidth:7,openingHeight:9});
 assert.ok(c.openingWidth<c.width&&c.openingHeight<c.height);
 assert.equal(portalActivation({x:0,y:-.05,z:.02},c),true);
 assert.equal(portalActivation({x:2,y:1,z:0},c),false);
 assert.equal(portalActivation({x:0,y:1,z:2},c),false);
 assert.equal(cleanPortal({delay:99,mode:'invalid'}).delay,12);
 assert.equal(cleanPortal({delay:99,mode:'invalid'}).mode,'auto');
 const dest=portalDestination({}, {x:5,y:0,z:2,yaw:0});assert.ok(dest.z<2);
});
test('real opening geometry has three frame colliders, no blocking box',()=>{
 const geometry=read('js/portal-geometry.js'),physics=read('js/scene-physics.js');
 assert.match(geometry,/w-ow/);assert.match(geometry,/h-oh/);
 assert.match(geometry,/portalFrame/);assert.match(physics,/segment\.userData\.portalFrame/);
 assert.match(physics,/kind==='portal'/);
 assert.match(geometry,/polygonOffset/);
});
test('teleport moves kinematic physics and prevents immediate loops',()=>{
 const code=read('js/portal-transport.js');
 assert.match(code,/setTranslation\(pos,true\)/);
 assert.match(code,/setNextKinematicTranslation/);
 assert.match(code,/portalBlockedUntil=now\+2200/);
 assert.match(code,/editor\.queueSave\(item\)/);
 assert.match(code,/cfg\.delay\*1000/);
 assert.match(code,/source\.userData\.portalArmedUntil/);
});
test('scene and server handle portal persistence and archive pair remapping',()=>{
 const api=read('backend/server.py'),arch=read('backend/realm_archives.py'),editor=read('js/editor.js');
 assert.match(api,/def valid_portal_geometry/);
 assert.match(api,/if obj\['kind'\]=='portal' and not valid_portal_geometry/);
 assert.match(arch,/cfg\['partner'\]=remap\.get/);
 assert.match(editor,/rebuildPortal\(o,entry\.portal\|\|\{\}\)/);
 assert.match(editor,/rebuildPortal\(obj,entry\.portal\|\|\{\}\)/);
 assert.match(editor,/tickPortals\(this,dt\)/);
});
test('mouse and XR selectors share in-scene portal button activation',()=>{
 const editor=read('js/editor.js'),world=read('js/world.js'),html=read('index.html');
 assert.match(editor,/hitPortalButton\(raycaster\)/);
 assert.match(editor,/activatePortalButton\(button\)/);
 assert.match(world,/selection\.liftButton\.userData\.portalButton/);
 assert.match(html,/id="portalProperties"/);
 assert.match(html,/id="portalTexture"/);
});
test('world XR and free-camera travellers pass through linked portals',()=>{
 const code=read('js/portal-transport.js');
 assert.match(code,/portalViewerTransit/);
 assert.match(code,/renderer\.xr\.getCamera\(\)/);
 assert.match(code,/world\.teleportTo\(destination\)/);
 assert.match(code,/world\.controls\.target\.add\(shift\)/);
 assert.match(code,/portalViewerBlockedUntil/);
});
test('procedural seams have staggered faces and non-coplanar overlays',()=>{
 const stairs=read('js/office-stairs.js'),wall=read('js/office-walls.js');
 assert.match(stairs,/polygonOffsetFactor:-2/);
 assert.match(stairs,/st\.depth-\.018/);
 assert.match(wall,/polygonOffsetFactor:1/);
});
