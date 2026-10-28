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
 assert.equal(robotVoiceConfig({voiceLang:'invalid'}).lang,'auto');
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

test('ElevenLabs failure is exposed, never silently replaced with a device voice',async()=>{
 const {RobotSpeech}=await import('../js/robot-speech.js');
 const original={fetch:globalThis.fetch,window:globalThis.window,sessionStorage:globalThis.sessionStorage};
 globalThis.window={};globalThis.sessionStorage={getItem:()=>null};
 globalThis.fetch=async()=>({ok:false,status:401,json:async()=>({error:'ElevenLabs rejected the API key (HTTP 401).'})});
 try{
  const client=Object.create(RobotSpeech.prototype);
  client.api={online:true,auth:()=>({token:'example-token',tab:'example-tab'})};
  client.room=()=> 'lab';
  client.playSpatial=async()=>{throw Error('Should never play audio');};
  client.playBrowser=async()=>{throw Error('Should never use device TTS when cloud fails');};
  client.robot=()=>({});
  const job={room:'lab',robotId:'robot-01',test:true,entry:{text:'Hello'},settings:{provider:'elevenlabs',voiceId:'21m00Tcm4TlvDq8ikWAM',lang:'en',rate:1,pitch:1}};
  await assert.rejects(()=>client.play(job,{}),/ElevenLabs rejected the API key/);
 }finally{globalThis.fetch=original.fetch;globalThis.window=original.window;globalThis.sessionStorage=original.sessionStorage;}
});
test('voice catalogue, ElevenLabs status and preview configuration are wired',()=>{
 const server=read('backend/server.py'),brains=read('js/robot-brains.js'),voice=read('js/robot-speech.js'),html=read('index.html');
 assert.match(server,/@app.get\('\/api\/robots\/voices'\)/);
 assert.match(server,/api.elevenlabs.io\/v2\/voices/);
 assert.match(server,/_elevenlabs_failure/);
 assert.match(brains,/solvi:robot-voice-status/);
 assert.match(brains,/Voice list failed:/);
 assert.match(voice,/if\(settings.provider==='elevenlabs'\)throw error/);
 assert.match(html,/id="brainsElevenVoiceList"/);
 assert.match(html,/id="loadElevenVoices"/);
});
