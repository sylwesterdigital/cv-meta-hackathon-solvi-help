import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('saved robot character can be inspected without Meta and has honest attribution',()=>{
 const py=read('backend/server.py');
 assert.match(py,/api\/robots\/character\/self/);
 assert.match(py,/character_self_insight\(brain/);
 assert.match(py,/robot-character-self-report/);
 assert.match(py,/model_used=False/);
 assert.match(py,/wants_character_self_report\(command_text\)/);
 assert.ok(py.indexOf('wants_character_self_report(command_text)')<py.indexOf('if not model_ready and ack is None:'), 'read-only introspection precedes the Meta missing-key fallback');
 assert.match(py,/do NOT claim you cannot see the numbers/);
});
test('autonomous planner sees strengths and tradeoffs but real tool permission remains authoritative',()=>{
 const py=read('backend/server.py');
 assert.match(py,/fictional_persona_self_insight/);
 assert.match(py,/favourable score never grants tools|favourable score never grants/i);
 assert.match(py,/read_only=True,executed=False,model_used=False/);
 const helper=read('backend/robot_character.py');
 assert.match(helper,/SELF_LOW_TRADEOFFS/);
 assert.match(helper,/all 96 keys/i);
 assert.match(helper,/not measured intelligence/);
});
