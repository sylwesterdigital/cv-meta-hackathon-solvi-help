import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {observationPlan,scanSummary} from '../js/robot-observation.js';
import {spokenLanguage,robotVoiceConfig} from '../js/robot-speech.js';
const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('eight bounded real camera directions for an explicit 360 panorama',()=>{
 const plan=observationPlan('Paris, look around and find a chair');
 assert.equal(plan.length,8);
 assert.deepEqual(plan.map(p=>p.yaw),[0,45,90,135,180,225,270,315]);
 assert.match(scanSummary(plan),/8 real JPEG camera views/);
});
test('down and up commands use genuine camera pitch, not a fabricated reply',()=>{
 assert.deepEqual(observationPlan('Paris, please tilt down and take a look').map(p=>p.pitch),[-38]);
 assert.deepEqual(observationPlan('Paris, please tild down and take a look').map(p=>p.pitch),[-38]);
 assert.deepEqual(observationPlan('Paris look up').map(p=>p.pitch),[32]);
 assert.equal(observationPlan('Paris what is in front of you or below?').length,2);
 assert.equal(observationPlan('Hi Paris').length,1);
});
test('proactive observation is bounded to four cardinals and one downward view',()=>{
 assert.deepEqual(observationPlan('',true).map(v=>v.yaw),[0,90,180,270,0]);
 assert.equal(observationPlan('',true).at(-1).pitch,-38);
});
test('local TTS selects Polish for Polish text, respecting available language setting',()=>{
 assert.equal(spokenLanguage('Paris, masz bardzo dziwny głos','en'),'pl');
 assert.equal(spokenLanguage('Hello, I can see a chair','auto'),'en');
 assert.equal(robotVoiceConfig({voiceLang:'auto'}).lang,'auto');
});
test('server validates eight JPEG media references, direction labels and one-time initiative',()=>{
 const server=load('backend/server.py'),studio=load('js/studio.js');
 assert.match(server,/0<=len\(raw_ids\)<=8/);
 assert.match(server,/Target scan with no retained JPEGs/);
 assert.match(server,/ROBOT_INITIATIVE_CAPTURE.pop\(key,None\)/);
 assert.match(server,/images=len\(paths\)/);
 assert.match(server,/content\.extend\(\[\{'type':'input_text'/);
 assert.match(studio,/observationPlan\(question,proactive\)/);
 assert.match(studio,/media_ids:scan.media_ids,views:scan.views/);
});
test('Brains interface provides voice lists and opt-in visual autonomy',()=>{
 const html=load('index.html'),brains=load('js/robot-brains.js');
 for(const id of ['brainsInitiativeVision','brainsVoiceName','brainsElevenVoiceList','captureBrainsPanorama'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(brains,/voiceschanged/);
 assert.match(brains,/filterElevenVoices/);
 assert.match(brains,/initiativeVision:\$\('brainsInitiativeVision'\)\.checked/);
});
