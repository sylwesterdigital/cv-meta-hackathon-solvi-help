import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mentionCandidates} from '../js/chat-mentions.js';
const file=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('@All is available as a completion target, scoped to unique robots',()=>{
 const c=mentionCandidates([{name:'Elox',kind:'robot'},{name:'Jessica',kind:'robot'}],'al');
 assert.deepEqual(c,[{name:'All',kind:'broadcast'}]);
});
test('compact image tiles share a readable full-screen viewer',()=>{
 const css=file('styles.css'),render=file('js/chat-attachments.js');
 assert.match(css,/#chatFeed \.chat-media-grid\{display:grid!important/);
 assert.match(css,/\.chat-media-grid \.chat-image-open\{display:block;width:100%;aspect-ratio:1/);
 assert.match(css,/#chatFeed \.chat-bubble > \.chat-attachment-image/);
 assert.match(render,/button\.onclick=\(\)=>openViewer\(\{kind,url,label\}\)/);
});
test('all queue replies are verified, serialized, capped and never relay to @All',()=>{
 const studio=file('js/studio.js'),api=file('backend/server.py'),speech=file('js/robot-speech.js');
 assert.match(studio,/robotTurnSerial/);
 assert.match(studio,/for\(const robot of result\.targets\|\|\[\]\)/);
 assert.match(studio,/await robotSpeech\?\.waitUntilQuiet\(\)/);
 assert.match(studio,/robotTurnSerial\.catch\(\(\)=>\{\}\)\.then\(perform\)/);
 assert.match(api,/@app\.post\('\/api\/robots\/queue'\)/);
 assert.match(api,/MAX_ROBOT_TURNS=6/);
 assert.match(api,/choices=robots if not from_robot else \[\]/);
 assert.match(api,/INSERT OR IGNORE INTO robot_reactions/);
 assert.match(speech,/waitUntilQuiet\(timeoutMs=18000\)/);
 assert.match(api,/reply with exactly \[PASS\]/);
});
