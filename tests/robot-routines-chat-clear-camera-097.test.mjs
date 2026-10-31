import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freeCameraAxes} from '../js/camera-key-movement.js';
import {askUser,confirmAction,exactNameAction,textEntry} from '../js/app-dialogs.js';
const code=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('Shift+Up/Down moves the free camera vertically without forward or backward drift',()=>{
 assert.deepEqual(freeCameraAxes(new Set(['ShiftLeft','ArrowUp'])),{forward:0,side:0,vertical:1,boost:2.4});
 assert.deepEqual(freeCameraAxes(new Set(['ShiftRight','ArrowDown'])),{forward:0,side:0,vertical:-1,boost:2.4});
 assert.equal(freeCameraAxes(new Set(['ArrowUp'])).forward,1);
 assert.equal(freeCameraAxes(new Set(['ArrowDown'])).forward,-1);
 assert.deepEqual(freeCameraAxes(new Set(['ShiftLeft','ArrowUp','PageDown'])),{forward:0,side:0,vertical:0,boost:2.4});
});
test('Routine panel participates in the common window drag and position persistence system',()=>{
 const studio=code('js/studio.js'),css=code('styles.css'),html=code('index.html');
 assert.match(html,/id="robotRoutinePanel" class="solvi-floating-window/);
 assert.match(html,/Active robot routines/);
 assert.match(studio,/'robotRoutinePanel'\]/);
 assert.match(studio,/#diagnosticsPanel,#robotRoutinePanel/);
 assert.match(css,/#robotRoutinePanel \.panel-title\.drag-handle/);
 assert.match(css,/#robotRoutinePanel \.robot-routine-controls\{overflow-y:auto/);
});
test('Browser confirmation and prompts are replaced by accessible app dialogs for destructive operations',async()=>{
 const scripts=['studio','editor','robot-routines','avatar-gallery','asset-gallery','camera-bookmarks','settings-extended'];
 for(const name of scripts){const source=code(`js/${name}.js`);assert.doesNotMatch(source,/\b(?:window\.)?confirm\s*\(|\b(?:window\.)?prompt\s*\(/,name);}
 assert.match(code('js/app-dialogs.js'),/dialog\.showModal\(\)/);
 assert.match(code('js/studio.js'),/exactNameAction\(`Permanently remove ALL chat messages/);
 assert.match(code('js/robot-routines.js'),/await confirmAction\(/);
 // Without a DOM, no browser-native popup should be called or security bypassed.
 assert.equal(await askUser(),null);
 assert.equal(await confirmAction('Delete?'),false);
 assert.equal(await exactNameAction('Delete?','Room'),false);
 assert.equal(await textEntry('Title'),null);
});
test('Clear-chat generations prevent old request, avatar, or attachment callbacks from rendering',()=>{
 const source=code('js/studio.js');
 assert.match(source,/chatEpoch\+\+;chatLoadSerial\+\+/);
 assert.match(source,/if\(room!==activeRoom\|\|epoch!==chatEpoch\|\|request!==chatLoadSerial\|\|chatClearingRoom===room\)return/);
 assert.match(source,/if\(room!==activeRoom\|\|epoch!==chatEpoch\|\|request!==chatLoadSerial\)break/);
 assert.match(source,/if\(renderEpoch!==chatEpoch\|\|roomAtBubble!==activeRoom\|\|!pic\.isConnected\)return/);
 assert.match(source,/if\(generation!==chatEpoch\)\{URL\.revokeObjectURL\(info\.url\)/);
 assert.match(source,/invalidateChatRoom\(room,\{dropTraces:true\}\)/);
 assert.match(source,/roomActivities\.delete\(room\)/);
 assert.match(source,/window\.addEventListener\('solvi:room-chat-cleared',event/);
});
