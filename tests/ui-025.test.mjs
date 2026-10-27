import test from 'node:test';import assert from 'node:assert/strict';
import {shouldGroupMessages,themePalette,exportRoomTranscript} from '../js/preferences.js';
import {groupMessages} from '../js/chat-render.js';
test('groups adjacent messages by speaker, origin and time',()=>{
 const a={speaker:'One',user_id:'u1',role:'user',model:null,created:'2026-10-27T13:00:00Z',text:'A'};
 const b={...a,text:'B',created:'2026-10-27T13:00:40Z'};
 const c={...a,text:'C',created:'2026-10-27T13:03:00Z'};
 assert.ok(shouldGroupMessages(a,b));assert.equal(groupMessages([a,b,c]).length,2);assert.equal(groupMessages([a,b,c],false).length,3);
 assert.ok(!shouldGroupMessages(a,{...b,user_id:'u2'}));
});
test('theme generator provides valid, distinct colours',()=>{
 assert.match(themePalette(4),/^#[0-9a-f]{6}$/);assert.notEqual(themePalette(4),themePalette(5));
});
test('exports safe transcript with role and timestamps',()=>{
 const a={speaker:'Test',role:'user',created:'2026-10-27T13:05:00Z',text:'question'};
 assert.match(exportRoomTranscript([a],'main','md'),/question/);
 assert.deepEqual(JSON.parse(exportRoomTranscript([a],'main')).messages[0].role,'user');
});
