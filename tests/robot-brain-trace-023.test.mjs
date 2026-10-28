import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Brains has collapsible editable identity, readable task trace and real image history',()=>{
 const ui=file('index.html'),js=file('js/robot-brains.js'),css=file('styles.css');
 assert.match(ui,/<details id="brainsIdentityDetails"/);
 for(const id of ['brainsEyeGallery','brainsEyeImage','brainsEyeMeta','brainsTaskTrace','brainsScenarioResult'])assert.ok(ui.includes(`id="${id}"`));
 assert.match(css,/#robotBrainsPanel\{width:min\(900px/);
 assert.match(js,/renderFrameGallery/);assert.match(js,/rememberFrame/);
 assert.match(js,/showFrame\(rec.blob,rec.label,rec.boxes\)/);
});
test('Unlabelled furniture triggers real four-view SAM vision and 3D-raycast navigation',()=>{
 const server=file('backend/server.py'),brains=file('js/robot-brains.js'),studio=file('js/studio.js'),robots=file('js/robots.js');
 assert.match(server,/'kind':'vision_search'/);
 assert.match(server,/def robot_task_result/);
 assert.match(brains,/directions=\[0,Math.PI\/2,Math.PI,3\*Math.PI\/2\]/);
 assert.match(brains,/captureRobotView\(world,robot,\{yawOffset/);
 assert.match(brains,/mode:'segment'/);
 assert.match(brains,/raycastSAMBox\(pose,box,editor,robot\)/);
 assert.match(studio,/runRobotVisualSearch\(editor.world,editor,robot,command,api/);
 assert.match(studio,/kind:command.sit\?'go_sit':'go_to'/);
 assert.match(robots,/onPose/);
});
test('Verbose debug is opt-in and explicit task results persist as robot chat',()=>{
 const ui=file('index.html'),studio=file('js/studio.js'),server=file('backend/server.py');
 assert.match(ui,/id="verboseRobotDebug"/);
 assert.match(studio,/solvi:brain-trace/);
 assert.match(studio,/localBrainTrace.push/);
 assert.match(studio,/reportRobotTask\(/);
 assert.match(server,/robot-task-result/);
 assert.match(server,/model':\s*'robot-task'|model','robot-task'/);
 assert.match(server,/My plan:/);
 assert.match(server,/role':'developer'/);
});
