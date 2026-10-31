import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('robot portrait row is positioned above cameraFollowButton and visible with robots',()=>{
 const html=get('index.html'),css=get('styles.css'),editor=get('js/editor.js');
 assert.ok(html.indexOf('id="controlledRobotFaces"')<html.indexOf('id="cameraFollowButton"'));
 assert.match(css,/#controlSwitcher\.control-switcher\{position:fixed!important;left:130px!important;bottom:calc\(50px/);
 assert.match(editor,/robotFaces\.hidden=robots\.length===0/);
 assert.match(editor,/button\.onclick=\(\)=>this\.activateControlledRobot\(bot\.userData\.editorId\)/);
 assert.match(editor,/btn\.setAttribute\('aria-pressed',String\(active\)\)/);
});
test('arrow-key robot control uses independent selected robot ID and not scene object selection',()=>{
 const editor=get('js/editor.js'),world=get('js/world.js');
 assert.match(editor,/this\.controlledRobotId=robot\.userData\.editorId/);
 assert.match(editor,/this\.controlMode='robot'/);
 assert.match(editor,/this\.controlledRobot\(\)\.userData\.robotGoal=null/);
 assert.match(editor,/const robot=this\.controlledRobot\?\.\(\),canControl=/);
 assert.match(world,/this\.robotEditor\?\.cameraTargetRobot\?\.\(\)/);
 assert.match(world,/this\.robotEditor\?\.controlMode==='robot'&&robot/);
});
test('video preparation is non-recording until explicit Start click',()=>{
 const source=get('js/studio.js'),html=get('index.html');
 assert.match(source,/function prepareVideoRecording\(sourceStream=null\)/);
 assert.match(source,/Camera ready · not recording/);
 assert.match(source,/\$\('composerRecorderStart'\)\.onclick=/);
 assert.match(source,/recorder\.start\(250\)/);
 assert.match(html,/id="composerRecorderStart" hidden>Start/);
 assert.match(source,/\$\('recordVideo'\)\.onclick=\(\)=>prepareVideoRecording\(\)/);
 assert.match(source,/\$\('webcamRecord'\)\.onclick=\(\)=>/);
 assert.match(source,/void prepareVideoRecording\(source\)/);
});
test('custom chat video/audio controls are compact and lazy on-demand HLS',()=>{
 const attach=get('js/chat-attachments.js'),player=get('js/compact-media-player.js'),css=get('styles.css');
 assert.match(attach,/compactMediaPlayer\(\{url,id,label,kind:'video'\}\)/);
 assert.match(player,/media\.controls=false/);
 assert.match(player,/progress\.oninput/);
 assert.match(player,/getHlsLibrary\(\)/);
 assert.match(player,/script\.src='\.\/vendor\/hls\/hls\.min\.js'/);
 assert.match(css,/#chatFeed \.chat-player-video video/);
 assert.match(css,/#chatFeed \.chat-attachment-actions/);
});
test('chat media uses metadata instead of eager WebM download; backend enforces deletion ownership',()=>{
 const studio=get('js/studio.js'),server=get('backend/server.py'),attachments=get('js/chat-attachments.js');
 assert.match(studio,/api\.req\('\/api\/media\/'\+encodeURIComponent\(key\)\+'\/info'\)/);
 assert.match(studio,/if\(\(info\.mime\?\.startsWith\('audio\/'\)\|\|info\.mime\?\.startsWith\('video\/'\)\)\)return/);
 assert.match(server,/@app\.get\('\/api\/media\/<mid>\/info'\)/);
 assert.match(server,/@app\.delete\('\/api\/media\/<mid>'\)/);
 assert.match(server,/media\['user_id'\]!=user\['id'\] and not admin_authorized\(\)/);
 assert.match(attachments,/downloadFull=async\(event\)/);
});
test('self-hosted HLS.js is staged by watcher npm preparation, not fetched from a CDN',()=>{
 const prepare=get('scripts/prepare_vendor.mjs'),pkg=JSON.parse(get('package.json'));
 assert.equal(pkg.dependencies['hls.js'],'1.6.15');
 assert.match(prepare,/node_modules','hls\.js','dist','hls\.min\.js/);
 assert.doesNotMatch(get('js/compact-media-player.js'),/cdn\.jsdelivr/);
});
