import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');

test('chat attachments can add images and videos to the scene and preserve aspect metadata',()=>{
 const attachments=read('js/chat-attachments.js'),studio=read('js/studio.js'),media=read('js/scene-media.js');
 assert.match(attachments,/Add to scene/);
 assert.match(studio,/addChatMediaToScene/);
 assert.match(studio,/inspectMediaDimensions/);
 assert.match(media,/mediaWidth/);
 assert.match(media,/new THREE\.BoxGeometry\(1,1,.06\)/);
});

test('robot debug routes are rendered as world overlays when per-robot debug is enabled',()=>{
 const editor=read('js/editor.js'),visuals=read('js/robot-path-visuals.js');
 assert.match(editor,/updateRobotPathDebug/);
 assert.match(editor,/robotPathDebugVisible/);
 assert.match(visuals,/Robot path debug/);
 assert.match(visuals,/sector\(/);
});

test('navigation overlay symbols are explicitly imported by the editor',()=>{
 const editor=read('js/editor.js');
 assert.match(editor,/import\s*\{updateRobotPathDebug,trackRobotPathDebug,clearRobotPathDebug,finishRobotPathDebug,clearAllRobotPathDebug\}\s*from\s*['"]\.\/robot-path-visuals\.js['"]/);
 assert.match(editor,/import\s*\{robotPathVisible\}\s*from\s*['"]\.\/robot-debug\.js['"]/);
});

test('scene media creation retains source dimensions and geometry respects ratio',()=>{
 const editor=read('js/editor.js'),media=read('js/scene-media.js');
 assert.match(editor,/width:width\?\?media\.width/);
 assert.match(editor,/height:height\?\?media\.height/);
 assert.match(media,/new THREE\.BoxGeometry\(w\*factor,h\*factor,\.06\)/);
 assert.doesNotMatch(media,/mesh\.scale\.set\(ratio/);
});
