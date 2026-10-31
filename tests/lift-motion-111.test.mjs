import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {liftHeightAt,liftMotionFinished,motionSnapshot,safeLiftMotion,liftBaseY,legacyLiftBaseY} from '../js/lift-sync.js';
import {cleanStairExtras,stairGeometryKey} from '../js/stair-extensions.js';
import {clampSwitcherPosition} from '../js/control-switcher-drag.js';
const source=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const start=1793450000000;
test('One lift event is sampled continuously across both clients, upward and descending',()=>{
 const up=motionSnapshot(0,4,.5,start);
 assert.equal(liftHeightAt(up,3,5,start),0);
 assert.equal(liftHeightAt(up,3,5,start+8000),4);
 assert.equal(liftHeightAt(up,3,5,start+24000),12);
 assert.equal(liftMotionFinished(up,3,5,start+24000),true);
 const down=motionSnapshot(12,0,2,start+25000);
 assert.equal(liftHeightAt(down,3,5,start+26500),9);
 assert.equal(liftHeightAt(down,3,5,start+31000),0);
 assert.equal(liftMotionFinished(down,3,5,start+31000),true);
});
test('Persistent motion checkpoint rebuilds an arriving cabin position rather than resetting to floor one',()=>{
 const motion=motionSnapshot(0,4,1,start);
 const incoming=cleanStairExtras({variant:'lift',lift:{levels:5,levelHeight:3,target:4,currentHeight:1,motion}}).lift;
 assert.deepEqual(incoming.motion,motion);
 const base=liftBaseY(4,1);
 assert.equal(base+liftHeightAt(incoming.motion,3,5,start+9000),12);
 assert.equal(stairGeometryKey({lift:{currentHeight:0,motion,target:4}}),stairGeometryKey({lift:{currentHeight:12,motion:motionSnapshot(12,0,1,start+30000),target:0}}));
});
test('Invalid and malicious lift motion data is rejected before transport',()=>{
 const m=motionSnapshot(0,1,.5,start);
 for(const bad of [{...m,speed:1e8},{...m,fromHeight:Infinity},{...m,target:12},{...m,startedAt:'bad'},{...m,active:'true'}])assert.equal(safeLiftMotion(bad),null);
 assert.equal(safeLiftMotion(m).target,1);
});
test('Transport emits start and arrival, never a high-frequency whole-scene lift save',()=>{
 const transport=source('js/stair-transport.js');
 const editor=source('js/editor.js');
 assert.match(transport,/liftHeightAt\(runtime.motion/);
 assert.match(transport,/runtime.authority&&editor.canEdit\(device\)/);
 assert.doesNotMatch(transport,/runtime.lastSave>1100/);
 assert.match(editor,/applyRemoteLiftMotion\(packet\)/);
 assert.match(editor,/runtime.baseY=baseY;runtime.motion=effective/);
 assert.match(editor,/cfg.currentHeight=runtime.height;obj.position.y=baseY\+runtime.height/);
});
test('WebSocket lift commands have backend ownership and room-level validation',()=>{
 const server=source('backend/server.py'),live=source('js/live.js');
 assert.match(server,/msg.get\('type'\)=='lift-motion'/);
 assert.match(server,/may_edit\(uid,device,room_policy\(room_id\),ws_admin_enabled\(\)\)/);
 assert.match(server,/if abs\(started_at-time.time\(\)\*1000\)>15000:continue/);
 assert.match(live,/applyRemoteLiftMotion\(m\)/);
 assert.match(server,/mode not in \('idle','walk','run','wave','lift','conveyor'\)/);
});
test('Robot ownership for persistence is unchanged while lift spectators can render riders',()=>{
 const sourceCode=source('js/stair-transport.js');
 assert.match(sourceCode,/!phys\?\.owns\(item\)&&!\(variant==='lift'&&item.userData.editorKind==='robot'\)/);
 assert.match(sourceCode,/if\(!moved\|\|!phys\?\.owns\(item\)\)return/);
 assert.match(sourceCode,/function transfer\(editor,item,delta,mode='lift'\)/);
});
test('Robot portrait selector is draggable and scene selection updates active robot',()=>{
 const html=source('index.html'),editor=source('js/editor.js'),styles=source('styles.css');
 assert.match(html,/id="controlSwitcherDrag"/);
 assert.match(editor,/attachControlSwitcherDrag\(byId\('controlSwitcher'\)/);
 assert.match(editor,/if\(obj\?\.userData.editorKind==='robot'&&this.canEdit\(obj\)\)\{this.controlledRobotId=obj.userData.editorId/);
 assert.match(styles,/#controlSwitcher \.robot-face-avatar\{width:50px!important/);
 assert.deepEqual(clampSwitcherPosition(-100,1000,200,100,900,700),{x:4,y:596});
});

test('Legacy lift checkpoints with an elevated floor number and ground-level cabin recover correctly',()=>{
 assert.equal(legacyLiftBaseY(0,12),0);
 assert.equal(legacyLiftBaseY(2,12),2);
 assert.equal(legacyLiftBaseY(14,12),2);
 assert.equal(legacyLiftBaseY(12,12),0);
 const editor=source('js/editor.js');
 assert.match(editor,/legacyLiftBaseY\(o.position.y,h\)/);
});
