import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('release 0.2.5 exposes compact settings, profile roundel, resize grip and export',()=>{
 const html=read('index.html'),css=read('styles.css'),studio=read('js/studio.js');
 for(const id of ['settingsButton','settingsDrawer','profileButton','bubbleOpacity','groupMessages','soundEffects','exportChatSettings','chatResizeGrip'])assert.ok(html.includes(`id="${id}"`),id);
 for(const token of ['--chat-width','--bubble-alpha','chat-row.mine','chat-row.theirs','.drawer'])assert.ok(css.includes(token),token);
 for(const token of ['loadMessages','group','exportRoomTranscript','pointerdown','windowed','profile-drawer-mode'])assert.ok(studio.includes(token),token);
});
test('robot keyboard commands, duplicate and delete are present',()=>{
 const js=read('js/editor.js'),motions=read('js/animations.js');
 for(const token of ['KeyD','KeyX','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','robotJumpUntil','duplicate()']){
  assert.ok(js.includes(token)||read('js/robots.js').includes(token),token);
 }
 assert.ok(motions.includes("jump:['jump','jumping']"));
});
test('head orientation, attached wrists and chest pose',()=>{
 const world=read('js/world.js');
 for(const token of ['flipHead?Math.PI:0','faceGroup.position.y-.2',"point(side+'Wrist')",'torso'])assert.ok(world.includes(token),token);
});
test('dev log renders explicit time seconds and timezone',()=>{
 const dev=read('js/devlog.js');for(const token of ["second:'2-digit'","timeZoneName:'short'"])assert.ok(dev.includes(token));
});
test('backend and front end version match',()=>{
 const pkg=JSON.parse(read('package.json'));const releases=JSON.parse(read('releases.json'));const server=read('backend/server.py');
 assert.equal(pkg.version,'0.2.5');assert.equal(releases.currentVersion,pkg.version);assert.ok(server.includes("version='0.2.5'"));
});
