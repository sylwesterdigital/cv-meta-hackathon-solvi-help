import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {intent,stepRobotMotion,makeRemoteCorrection,applyRemoteCorrection} from '../js/robot-net.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('Remote error correction gradually converges without snapping',()=>{
 let state={x:0,z:0,yaw:0},residual=makeRemoteCorrection(state,{x:1.4,z:0,yaw:.4});
 let prev=state.x;
 for(let i=0;i<90;i++){
  const next=applyRemoteCorrection(state,residual,1/60);
  assert.ok(next.x>=prev&&next.x-prev<=.051,'must not teleport small corrections');
  prev=next.x;residual=next.residual;state={x:next.x,z:next.z,yaw:next.yaw};
 }
 assert.ok(Math.abs(state.x-1.4)<.05);
 assert.ok(Math.abs(state.yaw-.4)<.01);
});
test('Remote locomotion keeps advancing while correction residual decays',()=>{
 let state={x:0,z:0,yaw:0,velocity:0,steer:0,lateral:0};
 let correction=makeRemoteCorrection(state,{x:.05,z:.1,yaw:0});
 const input={f:1,t:0,r:0,s:1};
 for(let i=0;i<65;i++){
  state=stepRobotMotion(state,input,1/60);
  const next=applyRemoteCorrection(state,correction,1/60);
  state.x=next.x;state.z=next.z;state.yaw=next.yaw;correction=next.residual;
 }
 assert.ok(state.z>.65,'should continue forward rather than pulled to an old packet location');
});
test('Genuine teleport is not slowly animated across the entire scene',()=>{
 const next=applyRemoteCorrection({x:0,z:0,yaw:0},{dx:10,dz:0,dyaw:0},1/60);
 assert.equal(next.x,10);assert.equal(next.teleport,true);
});
test('Scene model import has size control, direct drop and persistent model reference',()=>{
 const html=read('index.html'),editor=read('js/editor.js'),models=read('js/scene-models.js');
 assert.match(html,/sceneModelMaxSize/);assert.match(html,/value="0\.1"/);
 assert.match(editor,/dragover/);assert.match(editor,/dataTransfer/);assert.match(editor,/this\.importModel/);
 assert.match(editor,/model:o\.userData\.editorKind==='model'/);
 assert.match(models,/FBXLoader/);assert.match(models,/loadSceneAsset/);
});
test('Backend validates assets and stores models outside room JSON',()=>{
 const python=read('backend/server.py');
 assert.match(python,/MAX_SCENE_MODEL_BYTES = 20 \* 1024 \* 1024/);
 assert.match(python,/@app\.post\('\/api\/scene\/models'\)/);
 assert.match(python,/model_asset_exists/);
 assert.match(python,/scene_models/);
 assert.match(python,/obj\['kind'\]=='model'/);
});
