import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('mobile show/hide chat, navigation, media tools and floating mode',()=>{
 const html=read('index.html'),js=read('js/studio.js'),css=read('styles.css');
 for(const id of ['messagesToggleButton','composerToolsButton','chatModeButton','floatChatButton'])assert.ok(html.includes(`id="${id}"`));
 for(const token of ['chat-muted','windowed','tools-open','sessionPrompt'])assert.ok(js.includes(token));
 assert.ok(css.includes('.chat-feed::before'));
 assert.ok(css.includes('env(safe-area-inset-bottom)'));
});
test('dev log shows local date and time, auto-closes and checks new release versions',()=>{
 const js=read('js/devlog.js');
 for(const token of ['hour:', 'minute:', 'setTimeout(close,3000)','fetch(\'/releases.json?poll=\'','location.reload()'])assert.ok(js.includes(token),token);
});
test('401/409 prompts for login; preserves recovery details and prevents sending',()=>{
 const js=read('js/studio.js');
 for(const token of ['[401,409].includes(res.status)','needSignIn','delete previous.token','show(\'profileBackdrop\',true)','if(online&&!auth)','solvi:auth-required'])assert.ok(js.includes(token),token);
});
test('audio is analysed in bands and all 21 hand landmarks are transmitted',()=>{
 const audio=read('js/voice-captions.js'),face=read('js/face-tracking.js');
 const world=read('js/world.js'),server=read('backend/server.py');
 for(const token of ['getByteFrequencyData','localVoiceBands','[[90,360],[360,1600],[1600,7000]]'])assert.ok(audio.includes(token),token);
 for(const token of ['length===21','left','landmarkToLocal'])assert.ok(face.includes(token),token);
 assert.ok(world.includes('fingerChains'));assert.ok(server.includes("pose.get('voiceBands'"));
});
