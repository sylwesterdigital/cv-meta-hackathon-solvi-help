import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const css=source('styles.css'),html=source('index.html'),backend=source('backend/server.py');
const editor=source('js/editor.js'),robots=source('js/robots.js'),physics=source('js/scene-physics.js');
const speech=source('js/robot-speech.js'),brains=source('js/robot-brains.js');
test('my chat messages align to right and other speakers left with edge avatars',()=>{
 assert.match(css,/#chatFeed \.chat-row\.mine\{align-self:flex-end!important/);
 assert.match(css,/#chatFeed \.chat-row\.theirs\{align-self:flex-start!important/);
 assert.match(css,/#chatFeed \.chat-row\.mine \.chat-avatar\{order:2!important\}/);
 assert.match(css,/#chatFeed \.chat-row\.theirs \.chat-avatar\{order:1!important\}/);
 assert.match(css,/#chatFeed \.chat-row\.theirs \.chat-meta\{flex-direction:row-reverse!important;text-align:right!important\}/);
 assert.match(css,/#chatFeed \.chat-row\.mine \.chat-bubble::before\{right:-7px/);
 assert.match(css,/#chatFeed \.chat-row\.theirs \.chat-bubble::before\{left:-7px/);
});
test('room physics is preserved while scene is rehydrated and owned dynamic bodies do not reset their pose',()=>{
 assert.match(editor,/const restorePhysics=this\.physics\.enabled;this\.physics\.clear\(\)/);
 assert.match(editor,/if\(restorePhysics\)this\.physics\.setEnabled\(true\)/);
 assert.match(physics,/type==='dynamic'\?R\.RigidBodyDesc\.dynamic\(\)/);
 assert.match(physics,/if\(type==='dynamic'\)body\.wakeUp\(\)/);
 assert.match(physics,/Owner-controlled dynamic bodies must integrate gravity between scene updates/);
 assert.match(physics,/this\.world=new R\.World\(\{x:0,y:-9\.81,z:0\}\)/);
 assert.match(physics,/this\.generation/);
 assert.match(html,/id="physicsRuntimeStatus"/);
});
test('bounded obstacle recovery, robot target retargeting and task ownership exist',()=>{
 assert.match(editor,/recoverRobot\(robot,reason\)/);
 assert.match(editor,/if\(attempts>=3\)return false/);
 assert.match(editor,/pathBlocked\(candidate\.x,candidate\.z,obstacles/);
 assert.match(editor,/retargetRobot\(robot\)/);
 assert.match(editor,/mission\.kind!=='go_to'/);
 assert.match(robots,/onMove\.recover\?\.\(robot,/);
 assert.match(robots,/onMove\.retarget\?\.\(robot\)/);
 assert.match(backend,/Only the ongoing_task for YOUR robot ID is yours/);
 assert.match(backend,/You may ask a relevant short question only when the objective genuinely cannot be determined|Ask a short question only when the objective truly cannot be determined/);
});
test('robot command card and editable gender/voice preferences are wired',()=>{
 assert.match(html,/id="robotCommandsButton"/);
 assert.match(html,/id="robotCommandsCard"/);
 assert.match(html,/id="brainsGender"/);
 assert.match(html,/id="brainsVoiceGender"/);
 assert.match(brains,/gender:\$\('brainsGender'\)\.value/);
 assert.match(brains,/voiceGender:\$\('brainsVoiceGender'\)\.value/);
 assert.match(backend,/def robot_voice_catalog\(robot\):/);
 assert.match(backend,/def robot_preference_command\(text\):/);
 assert.match(speech,/gender:\['female','male','neutral'\]/);
});
test('robot prompts retain speaker attribution and coffee visit is explicitly non-physical',()=>{
 assert.match(backend,/SELECT text,user_id,role,speaker_override FROM messages WHERE room_id/);
 assert.match(robots,/mission.kind==='coffee_visit'/);
 assert.match(backend,/'coffee-visit':f'I visited/);
});
