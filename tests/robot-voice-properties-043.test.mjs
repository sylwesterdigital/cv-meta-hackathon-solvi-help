import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('selected robot voice provider and both voice browsers live in Properties, not hidden Brains',()=>{
 const html=read('index.html');
 const begin=html.indexOf('id="robotControls"'),voice=html.indexOf('id="robotVoiceProperties"'),brainButton=html.indexOf('id="openRobotBrains"');
 const brainPanel=html.indexOf('id="robotBrainsPanel"');
 assert.ok(begin>=0&&begin<voice&&voice<brainButton&&brainButton<brainPanel);
 for(const id of ['robotVoiceDetails','brainsVoiceProvider','brainsVoiceLang','brainsVoiceName','brainsElevenVoiceList','loadElevenVoices','testRobotVoice','saveRobotVoice','robotVoiceStatus']){
  const found=[...html.matchAll(new RegExp('id="'+id+'"','g'))];
  assert.equal(found.length,1,`${id}: must occur exactly once`);
  assert.ok(found[0].index>voice&&found[0].index<brainButton,`${id} must be in Properties`);
 }
 assert.match(html,/id="robotVoiceDetails" open/);
 assert.match(html,/id="saveRobotBrains" type="button" class="primary">Save identity</);
});
test('changing selected robot rebinds voice inputs and respects edit permissions',()=>{
 const brains=read('js/robot-brains.js'),editor=read('js/editor.js');
 assert.match(editor,/solvi:properties-robot-selected/);
 assert.match(brains,/window\.addEventListener\('solvi:properties-robot-selected',\(\)=>syncVoiceInspector\(\)\)/);
 assert.match(brains,/const selectedVoiceRobot=\(\)=>window\.solviEditor\?\.robot\(\)/);
 assert.match(brains,/for\(const id of voiceIds\)\$\(id\)\.disabled=!canEdit/);
 assert.match(brains,/\$\('saveRobotVoice'\)\.onclick=\(\)=>\{/);
 assert.match(brains,/window\.solviEditor\.recordEdit\(before,window\.solviEditor\.snapshot\(robot\)\)/);
 assert.match(brains,/window\.solviEditor\.queueSave\(robot\)/);
 assert.match(brains,/if\(selectedVoiceRobot\(\)\?\.userData\.editorId!==robotId\)return/);
});
test('voice provider-specific controls, language filtering, real status and Polish voice preview',()=>{
 const brains=read('js/robot-brains.js'),css=read('styles.css'),speech=read('js/robot-speech.js');
 assert.match(brains,/\$\('robotLocalVoicesRow'\)\.hidden=provider!=='local'/);
 assert.match(brains,/\$\('robotCloudVoicesRow'\)\.hidden=provider!=='elevenlabs'/);
 assert.match(brains,/const matches=all\.filter\(v=>language==='auto'\|\|/);
 assert.match(brains,/const response=await fetch\('\/api\/robots\/voices'/);
 assert.match(brains,/solvi:test-robot-voice/);
 assert.match(speech,/Cześć, jestem/);
 assert.match(css,/#robotControls #robotLocalVoicesRow\[hidden\]/);
});
