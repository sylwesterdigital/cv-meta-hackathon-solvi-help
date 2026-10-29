import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('webcam control belongs to message drag header and is not duplicated in nav or toolbox',()=>{
 const html=read('index.html');
 assert.equal((html.match(/id="webcamButton"/g)||[]).length,1);
 const header=html.match(/<div class="composer-window-head">([\s\S]*?)<\/div>/)?.[1];
 assert.ok(header?.includes('id="webcamButton"'));
 assert.ok(header.includes('data-ui-icon="webcam"'));
 assert.match(header,/aria-pressed="false"/);
 assert.match(header,/aria-label="Open webcam"/);
 assert.ok(header.indexOf('id="composerMove"')<header.indexOf('id="webcamButton"'));
 assert.ok(header.indexOf('id="webcamButton"')<header.indexOf('id="composerMinimize"'));
});

test('webcam button remains icon only as the feed changes its active state',()=>{
 const face=read('js/face-tracking.js'),controls=read('js/ui-controls.js'),css=read('styles.css');
 assert.match(controls,/utilityIconOnly=new Set\(\['webcamButton'/);
 assert.match(face,/webcamBtn\.setAttribute\('aria-pressed',String\(active\)\)/);
 assert.match(face,/webcamBtn\.setAttribute\('aria-label',active\?'Close webcam':'Open webcam'\)/);
 assert.doesNotMatch(face,/webcamBtn\.textContent=/);
 assert.match(css,/#chatPanel \.composer-window-head #webcamButton\[aria-pressed="true"\]/);
});

test('walk/turn/jump and sitting tasks are implemented, not a chatbot-only response',()=>{
 const robots=read('js/robots.js'),net=read('js/robot-net.js'),editor=read('js/editor.js');
 for(const action of ['walk','run','jump'])assert.ok(robots.includes(`mode==='${action}'`));
 assert.match(robots,/robot\.rotation\.y\+=/);
 assert.match(robots,/robot\.userData\.jumpVel=4\.6/);
 assert.match(robots,/robot\.userData\.robotSitPose=clip\?'clip':'procedural'/);
 assert.match(editor,/e\.code==='Space'/);
 assert.match(net,/u:\+\(i\.u\|\|1\)/);
});
