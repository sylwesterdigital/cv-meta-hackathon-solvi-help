import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {attachmentKind,attachmentName} from '../js/chat-attachments.js';
const src=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const api=src('backend/server.py'),studio=src('js/studio.js');

test('attachment MIME determines inline media, reading and fallback',()=>{
 for(const mime of ['image/jpeg','image/png','image/webp','image/gif'])assert.equal(attachmentKind(mime),'image');
 for(const mime of ['audio/webm','audio/mpeg','audio/wav'])assert.equal(attachmentKind(mime),'audio');
 for(const mime of ['video/mp4','video/webm'])assert.equal(attachmentKind(mime),'video');
 assert.equal(attachmentKind('application/pdf'),'pdf');
 assert.equal(attachmentKind('text/plain; charset=UTF-8'),'text');
 assert.equal(attachmentKind('text/html'),'file');
 assert.equal(attachmentName('<bad>.txt','text'),'bad.txt');
});
test('authenticated attachment controls and safe viewer are wired',()=>{
 const media=src('js/chat-attachments.js'),html=src('index.html');
 assert.match(html,/accept="[^"]*application\/pdf[^"]*text\/plain/);
 assert.match(studio,/renderChatAttachment\(slot,info/);
 assert.match(studio,/clearChatAttachments\(\);feed\.replaceChildren/);
 assert.match(media,/blob\.text\(\)/);
 assert.match(media,/pre\.textContent=text\.slice/);
 assert.match(media,/frame\.setAttribute\('sandbox','allow-downloads'\)/);
 assert.match(media,/compactMediaPlayer\(\{url,id,label,kind:'video'\}\)/);
 assert.match(api,/X-Solvi-File-Name/);
 assert.match(api,/application\/pdf.*\.pdf/);
});
test('robot-to-robot @handoff retains 2-hop bound and deduplicates per recipient',()=>{
 assert.match(api,/def robot_handle_mentions\(text,robots\):/);
 assert.match(api,/def robot_recipient_queue\(text,robots,from_robot=False,speaker_id=None\):/);
 assert.match(api,/if from_robot and \(not speaker or m\['model'\]!='muse-spark-1\.3' or int\(m\['relay_depth'\]\)>=2\)/);
 assert.match(api,/robot_reactions/);
 assert.match(api,/PRIMARY KEY\(message_id,robot_id\)/);
 assert.match(api,/relay_source,relay_depth/);
 assert.match(studio,/robotTurnSerial/);
 assert.match(studio,/reactOneRobot\(item\.message,robot\.id,item\.interruptedRobot\)/);
 assert.match(api,/Address at most one other robot per answer/);
});
test('furniture colour and number are strict navigation objectives',()=>{
 assert.match(api,/Never substitute Black Sofa for Grey Sofa/);
 assert.match(api,/number_match=re\.search/);
 assert.match(api,/No scene object matches /);
});
