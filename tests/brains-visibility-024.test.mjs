import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = x => readFileSync(new URL('../'+x, import.meta.url), 'utf8');
test('robot-eye image leads Brains panel, with full-size viewing and normal-flow sizing',()=>{
 const html=read('index.html'),css=read('styles.css'),code=read('js/robot-brains.js');
 const brains=html.slice(html.indexOf('id="robotBrainsPanel"'),html.indexOf('id="diagnosticsPanel"'));
 assert.ok(brains.indexOf('id="brainsObservation"')<brains.indexOf('id="brainsIdentityDetails"'));
 assert.match(brains,/id="brainsEyeImage" width="512" height="512"/);
 assert.match(brains,/id="brainsEyePlaceholder"/);
 assert.match(brains,/id="brainsEyeLightbox"/);
 assert.match(brains,/id="expandBrainsEye"/);
 assert.match(css,/#robotBrainsPanel #brainsEyeImage\{display:block;width:100%;height:auto/);
 assert.match(css,/#robotBrainsPanel #brainsEyeStage\.brains-eye-stage\{display:block;position:relative/);
 assert.match(code,/\$\('brainsEyeLarge'\)\.src=frameURL/);
 assert.match(code,/\$\('brainsEyePlaceholder'\)\.hidden=true/);
});
test('debug chat is initially active and receives actual robot operations, request and response metadata',()=>{
 const html=read('index.html'),studio=read('js/studio.js'),brains=read('js/robot-brains.js'),api=read('backend/server.py');
 assert.match(html,/id="verboseRobotDebug" checked/);
 assert.match(html,/id="showBrainChat"/);
 assert.match(studio,/sessionStorage\.getItem\('solvi-brain-debug'\)!=='0'/);
 assert.match(studio,/window\.addEventListener\('solvi:brain-trace'/);
 assert.match(studio,/window\.addEventListener\('solvi:show-brain-chat'/);
 assert.match(studio,/for\(const item of response\.trace\|\|\[\]\)emitBrainTrace/);
 assert.match(brains,/'EYE CAPTURE'/);
 assert.match(brains,/'META REQUEST'/);
 assert.match(api,/'step':'muse response'/);
 assert.match(api,/'step':'intent'/);
});
test('optional identity and scenario editing are collapsible without obscuring image',()=>{
 const html=read('index.html');
 assert.match(html,/<details id="brainsIdentityDetails"/);
 assert.match(html,/<details class="brains-section" id="brainsScenarioDetails"/);
 assert.match(html,/<details class="brains-section" id="brainsTraceDetails"/);
 assert.match(html,/id="saveRobotBrains"/);
 assert.match(html,/id="suggestBrainsScenario"/);
});
