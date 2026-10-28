import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Visual questions route through a camera capture before Muse Spark',()=>{
 const js=read('js/studio.js'), server=read('backend/server.py');
 assert.match(server,/def is_robot_visual_question\(text\):/);
 assert.match(server,/needs_vision=True/);
 assert.match(js,/if\(response\.needs_vision\)/);
 assert.match(js,/captureRobotView\(editor\.world,robot\)/);
 assert.match(js,/\/api\/robots\/vision-reply/);
 assert.match(server,/@app\.post\('\/api\/robots\/vision-reply'\)/);
 assert.match(server,/\{'type':'input_image','image_url':photo\}/);
 assert.match(server,/json\.dumps\(\[mid\]\)/);
});
test('Robot and human portraits use front-facing rendered JPEG and a saved image',()=>{
 const robots=read('js/robots.js'),brains=read('js/robot-brains.js'),html=read('index.html');
 assert.match(robots,/export async function captureRobotPortrait/);
 assert.match(brains,/saveRobotChatPortrait/);
 assert.match(html,/id="captureAvatarHeadshot"/);
 assert.match(html,/id="saveRobotChatPortrait"/);
 assert.match(read('backend/server.py'),/['"]portrait['"]:36/);
});
test('Direct webcam navigation is reachable independently of world toolbox',()=>{
 const html=read('index.html'),css=read('styles.css');
 assert.equal((html.match(/id="webcamButton"/g)||[]).length,1);
 assert.ok(html.indexOf('id="webcamButton"')>html.indexOf('id="toolNav"'));
 assert.ok(html.indexOf('id="webcamButton"')<html.indexOf('id="settingsButton"'));
 assert.match(css,/#toolNav>#webcamButton\{display:inline-flex!important/);
});
