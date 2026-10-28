import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {robotVoiceConfig,distanceVolume} from '../js/robot-speech.js';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
test('robot voice mode, language, rate and pitch are bounded and per-robot',()=>{
 assert.equal(robotVoiceConfig({}).provider,'local');
 assert.equal(robotVoiceConfig({voiceProvider:'mute'}).provider,'mute');
 assert.deepEqual([robotVoiceConfig({voiceRate:'55',voicePitch:'-9'}).rate,robotVoiceConfig({voiceRate:'55',voicePitch:'-9'}).pitch],[1.6,.5]);
 assert.equal(robotVoiceConfig({voiceProvider:'bad'}).provider,'local');
 assert.equal(robotVoiceConfig({voiceLang:'invalid'}).lang,'en');
});
test('local voice distance attenuation decreases with distance',()=>{
 assert.ok(distanceVolume(1) > distanceVolume(9));
 assert.ok(distanceVolume(9) > distanceVolume(25));
});
test('robot speech plays only saved assistant replies, and the initial history remains silent',()=>{
 const studio=read('js/studio.js'),server=read('backend/server.py'),speech=read('js/robot-speech.js'),html=read('index.html');
 assert.match(studio,/suppressRobotSpeech=true;try\{for\(const entry of messages\)await bubble\(entry\)/);
 assert.match(studio,/if\(entry.role==='assistant'\)robotSpeech\?\.speak\(entry\)/);
 assert.match(speech,/entry.role!=='assistant'/);assert.match(speech,/this.seen.has\(entry.id\)/);
 assert.match(speech,/this.context.createPanner\(\)/);assert.match(speech,/getWorldPosition/);
 assert.match(server,/@app.post\('\/api\/robots\/speech'\)/);
 assert.match(server,/speaker_override/);assert.match(server,/SELECT text,role,speaker_override,room_id FROM messages/);
 for(const id of ['robotSpeechEnabled','robotVoiceVolume','brainsVoiceProvider','brainsVoiceLang','brainsVoiceId','testRobotVoice'])assert.match(html,new RegExp(`id="${id}"`));
});
test('ElevenLabs voice generation is server-side with no key bundled',()=>{
 const server=read('backend/server.py'),script=read('backend/install-ubuntu.sh');
 assert.match(server,/api.elevenlabs.io\/v1\/text-to-speech/);
 assert.match(server,/ELEVENLABS_API_KEY/);
 assert.match(server,/xi-api-key/);
 assert.match(script,/espeak-ng/);
});
