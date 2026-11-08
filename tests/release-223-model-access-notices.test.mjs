import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('missing key produces a server-persisted, attributed non-model notice rather than silence',()=>{
 const backend=read('backend/server.py');
 const start=backend.indexOf('def robot_model_access_notice(');
 const end=backend.indexOf("@app.post('/api/robots/react')",start);
 const body=backend.slice(start,end);
 assert.ok(start>0&&end>start);
 for(const token of ["'robot-system-notice'", "'assistant'",'INSERT INTO messages','publish({','model_access_required=True','usage=None',"'step':'model access'"])
  assert.ok(body.includes(token),token);
 const route=backend.slice(end,backend.indexOf("@app.post('/api/robots/task-result')",end));
 assert.ok(route.includes("if not model_ready and ack is None:"));
 assert.ok(route.includes('return robot_model_access_notice(user,robot,room_id,message_id,key_issue)'));
 assert.ok(route.includes("return robot_model_access_notice(user,robot,room_id,message_id,'rejected')"));
 assert.ok(route.indexOf("if not model_ready and ack is None:") < route.indexOf('natural_vision=('));
 assert.ok(route.includes("if from_robot:\n            # Never form an automated chain"));
 assert.ok(route.includes("if command and model_ready and command['kind'] not in"));
 assert.ok(route.includes("except ValueError:\n        model_ready=False"));
 assert.ok(!route.includes("note='Robot heard the message. Set a Meta key to enable speech.'"));
});
test('client shows meta access explanation in chat and does not auto-trigger peer discussion without model',()=>{
 const ui=read('js/studio.js');
 assert.ok(ui.includes("if(response.answer)await bubble(response.answer);"));
 assert.ok(ui.includes('response.model_access_required'));
 assert.ok(ui.includes('no model reply generated'));
 assert.ok(ui.includes('result.discussion?.enabled&&item.depth===0&&result.model_ready!==false'));
 const backend=read('backend/server.py');
 assert.ok(backend.includes('model_ready=model_ready,discussion='));
});
test('cost policy is visible in existing Meta settings without claiming a subscription exists',()=>{
 const ui=read('index.html');
 assert.ok(ui.includes('id="metaAccessPolicy"'));
 assert.ok(ui.includes('each user can supply their own Meta API key'));
 assert.ok(ui.includes('session key works only in this browser tab'));
 assert.ok(ui.includes('not currently included or promised'));
 assert.match(read('releases.json'),/"currentVersion": "0\.2\.244"/);
});
