import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {intent,stepIntent,packetFor} from '../js/robot-net.js';
const root=new URL('../',import.meta.url),read=f=>readFileSync(new URL(f,root),'utf8');
test('Robot steering is bicycle-like, backward is signed motion without snap turns',()=>{
  const left=intent(new Set(['ArrowLeft'])),right=intent(new Set(['ArrowRight']));
  assert.ok(stepIntent(0,0,0,left,.05).x<0);
  assert.equal(stepIntent(0,0,.5,right,.05).yaw,.5);
  assert.equal(intent(new Set(['ArrowDown'])).f,-1);
  assert.equal(intent(new Set(['ArrowDown'])).b,1);
  assert.doesNotMatch(read('js/editor.js'),/rotation\.y\+=Math\.PI/);
});
test('Robot speed affects prediction; compact network packet carries speed and jump',()=>{
  const slow=stepIntent(0,0,0,{f:1,r:0,s:.5},.05).z;
  const fast=stepIntent(0,0,0,{f:1,r:0,s:2},.05).z;
  assert.ok(fast>slow*3.9);
  const packet=packetFor('robot123',{f:1,t:0,r:1,s:1.75,j:1},{position:{x:0,y:0,z:0},rotation:{y:0}});
  assert.equal(packet.s,1.75);assert.equal(packet.j,1);assert.ok(JSON.stringify(packet).length<155);
  assert.match(read('backend/server.py'),/'s':round\(speed,2\)/);
});
test('World has camera orbit, pan, keyboard fly and optional pointer lock',()=>{
  const w=read('js/world.js');assert.match(w,/LEFT:THREE\.MOUSE\.ROTATE/);
  assert.match(w,/RIGHT:THREE\.MOUSE\.PAN/);
  assert.match(w,/navigateCamera\(dt\)/);assert.match(w,/requestPointerLock/);
  assert.match(w,/isSessionSupported\('immersive-vr'\)/);
});
test('Scene toolbox and inspector are compact and context-specific',()=>{
 const ui=read('index.html'),e=read('js/editor.js'),c=read('styles.css');
 for(const id of ['editorToolbox','toolboxActions','toolboxMinimize','cameraFlyButton','texturePreset','lightControls','lightType','lightIntensity','lightAngle','lightPenumbra','robotSpeed','profilePhotoBadge','xrStageButton'])assert.match(ui,new RegExp(`id="${id}"`));
 assert.doesNotMatch(ui,/id="confirmProperties"/);
 assert.match(e,/cleanLightSettings/);assert.match(e,/showLightHelper/);assert.match(e,/pointerdown/);
 assert.match(c,/#scenePanel\.minimized/);
});
test('Backend validates per-light settings and persists without full room refresh',()=>{
 const b=read('backend/server.py'),e=read('js/editor.js');
 assert.match(b,/Invalid light configuration/);assert.match(b,/Invalid light type/);
 assert.match(b,/'light','speed'/);assert.match(e,/applyObjectPatch/);
});
