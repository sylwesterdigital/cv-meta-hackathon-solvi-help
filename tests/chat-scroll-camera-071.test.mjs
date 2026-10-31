import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {freeCameraAxes} from '../js/camera-key-movement.js';
import {atChatBottom,chatNextPage,chatTimeline} from '../js/chat-timeline.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('Shift+Up/Down climbs or descends without horizontal travel',()=>{
 assert.deepEqual(freeCameraAxes(new Set(['ArrowUp','ShiftLeft'])),{forward:0,side:0,vertical:1,boost:2.4});
 assert.deepEqual(freeCameraAxes(new Set(['ArrowDown','ShiftRight'])),{forward:0,side:0,vertical:-1,boost:2.4});
 assert.deepEqual(freeCameraAxes(new Set(['ArrowUp','ArrowRight','PageDown'])),{forward:1,side:1,vertical:-1,boost:1});
 assert.deepEqual(freeCameraAxes(new Set(['ArrowUp'])),{forward:1,side:0,vertical:0,boost:1});
 assert.deepEqual(freeCameraAxes(new Set(['ShiftLeft','ArrowUp','PageDown'])),{forward:0,side:0,vertical:0,boost:2.4});
 const code=read('js/world.js');assert.match(code,/freeCameraAxes\(this.keys\)/);assert.match(code,/this.cameraVelocity.lerp\(desired/);
});

test('chat next-page moves by most of viewport and the jump control disappears at latest messages',()=>{
 const model={scrollTop:100,clientHeight:400,scrollHeight:2100};
 assert.equal(chatNextPage(model),452);
 assert.equal(atChatBottom(model),false);
 assert.equal(atChatBottom({...model,scrollTop:1700}),true);
 assert.equal(chatNextPage({...model,scrollTop:1700}),1700);
 const ui=read('index.html'),script=read('js/studio.js'),css=read('styles.css');
 assert.match(ui,/id="chatPageDown"[^>]+hidden/);
 assert.match(script,/pageDown.onclick=/);assert.match(script,/wasFollowing/);
 assert.match(css,/#chatPanel\.windowed \.chat-feed-shell>.chat-feed\{pointer-events:auto!important/);
 assert.match(css,/#chatPanel \.chat-page-down\[hidden\]/);
});

test('human timeline inserts date and hour separators without inventing chat messages',()=>{
 const msg=(id,created)=>({id,created,text:id});
 const entries=chatTimeline([msg('a','2026-10-28T10:00:00Z'),msg('b','2026-10-28T11:05:00Z'),msg('c','2026-10-29T11:00:00Z')],[{created:'2026-10-28T10:10:00Z',name:'Jessica',action:'joined'}]);
 assert.deepEqual(entries.filter(e=>e.type==='message').map(e=>e.entry.id),['a','b','c']);
 assert.equal(entries.filter(e=>e.type==='presence').length,1);
 assert.equal(entries.filter(e=>e.type==='day').length,2);
 assert.equal(entries.filter(e=>e.type==='hour').length,3);
 assert.match(read('js/live.js'),/name,room:window.solviRoom/);
 assert.match(read('js/studio.js'),/joined the room/);
});
