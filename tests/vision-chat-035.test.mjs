import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Visual questions route through a camera capture before Muse Spark',()=>{
 const js=read('js/studio.js'), server=read('backend/server.py');
 assert.match(server,/def is_robot_visual_question\(text\):/);
 assert.match(server,/needs_vision=True/);
 assert.match(js,/if\(response\.needs_vision\)/);
 assert.match(js,/captureRobotObservation\(robot,message\.text\)/);
 assert.match(js,/\/api\/robots\/vision-reply/);
 assert.match(server,/@app\.post\('\/api\/robots\/vision-reply'\)/);
 assert.match(server,/'type':'input_image','image_url':'data:image\/jpeg;base64,'/);
 assert.match(server,/json\.dumps\(\(\[panorama_id\] if panorama_id else \[\]\)\+raw_ids\)/);
});
test('Robot and human portraits use front-facing rendered JPEG and a saved image',()=>{
 const robots=read('js/robots.js'),brains=read('js/robot-brains.js'),html=read('index.html');
 assert.match(robots,/export async function captureRobotPortrait/);
 assert.match(brains,/saveRobotChatPortrait/);
 assert.match(html,/id="captureAvatarHeadshot"/);
 assert.match(html,/id="saveRobotChatPortrait"/);
 assert.match(read('backend/server.py'),/['"]portrait['"]:36/);
});
test('One webcam launcher lives in the draggable Message composer header',()=>{
 const html=read('index.html'),css=read('styles.css');
 assert.equal((html.match(/id="webcamButton"/g)||[]).length,1);
 const start=html.indexOf('class="composer-window-head"');
 const end=html.indexOf('</div>',start);
 assert.ok(start>=0&&end>start);
 const header=html.slice(start,end);
 assert.ok(header.indexOf('id="composerMove"')<header.indexOf('id="webcamButton"'));
 assert.ok(header.indexOf('id="webcamButton"')<header.indexOf('id="composerMinimize"'));
 assert.match(header,/id="webcamButton"[^>]+aria-label="Open webcam"/);
 assert.doesNotMatch(html.slice(html.indexOf('id="toolNav"'),html.indexOf('</nav>')),/id="webcamButton"/);
 assert.match(css,/#chatPanel \.composer-window-head #webcamButton/);
});
