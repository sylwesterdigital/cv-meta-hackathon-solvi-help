import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');

test('discussion mode activates only for substantive multi-robot topics, not ordinary @All',()=>{
 const backend=read('backend/server.py');
 assert.match(backend,/def discussion_requested\(/);
 assert.match(backend,/DISCUSSION_SIGNAL/);
 assert.match(backend,/len\(robot_recipient_queue\(text,robots\)\)<2/);
 assert.match(backend,/discussion_requested\(m\['text'\],robots,from_robot\)/);
});

test('discussion backend uses saved messages, persists reference metadata and runs a finite staged sequence',()=>{
 const backend=read('backend/server.py');
 assert.match(backend,/CREATE TABLE IF NOT EXISTS robot_discussions/);
 assert.match(backend,/CREATE TABLE IF NOT EXISTS robot_discussion_turns/);
 assert.match(backend,/@app.post\('\/api\/robots\/discussion\/start'\)/);
 assert.match(backend,/@app.post\('\/api\/robots\/discussion\/step'\)/);
 assert.match(backend,/robot_discussion_turns WHERE message_id=\? AND step_index=\?/);
 assert.match(backend,/robot_discussion_step/);
 assert.match(backend,/research_topic_sources/);
 assert.match(backend,/no live external references verified/);
});

test('ordinary chat queue launches one serialized discussion and allows cancellation',()=>{
 const studio=read('js/studio.js'),html=read('index.html');
 assert.match(studio,/result\.discussion\?\.enabled/);
 assert.match(studio,/await runRobotDiscussion\(item\.message,room\)/);
 assert.match(studio,/await robotSpeech\?\.waitUntilQuiet\(\)/);
 assert.match(studio,/state\.cancelled/);
 assert.match(studio,/EXACT MODEL I\/O/);
 assert.match(html,/id="stopDiscussionButton"/);
});
