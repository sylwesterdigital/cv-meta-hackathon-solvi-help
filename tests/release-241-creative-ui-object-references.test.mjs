import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {measuredSpeechLevel} from '../js/robot-speech.js';
import {sceneReferenceQuery,sceneReferenceCandidates,insertSceneReference,mentionQuery,mentionCandidates} from '../js/chat-mentions.js';
import {addressedCreativeRobot} from '../js/robot-creative-design.js';
import {creativeSessionDurationMs,creativeSessionDeadline} from '../js/robot-creative-session.js';
import {groupCreativeIntent} from '../js/robot-creative-builder.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>readFileSync(path.join(root,f),'utf8');
test('amplitude envelope is measured from PCM samples, silent samples stay zero',()=>{
 assert.equal(measuredSpeechLevel(new Uint8Array(256).fill(128)),0);
 assert.ok(measuredSpeechLevel(Uint8Array.from({length:256},(_,i)=>i%2?180:76))>.1);
 assert.equal(measuredSpeechLevel(Uint8Array.from({length:256},(_,i)=>i%2?255:0)),1);
 assert.equal(measuredSpeechLevel(null),0);
});
test('the actual source analyser feeds the comic-border event; browser TTS is explicitly unmeasured',()=>{
 const src=read('js/robot-speech.js'),css=read('styles.css'),comic=read('js/robot-comic-bubbles.js');
 assert.match(src,/createAnalyser\(\)/);assert.match(src,/getByteTimeDomainData\(samples\)/);
 assert.match(src,/measured:true/);assert.match(src,/measured:false/);
 assert.match(comic,/solvi:robot-speech-level/);assert.match(comic,/--speech-level/);
 assert.match(css,/\.solvi-comic-speech\.comic-audio-active/);
 assert.match(css,/border-color:rgba\(16,16,16,calc\(/);
});
test('$ autocomplete is scoped to real nonrobot objects and inserts immutable ID tokens',()=>{
 const uuid='12345678-1234-4234-8234-123456789abc';
 const objects=[{id:uuid,name:'MointainMovieLounge1-2-c',kind:'model'},{id:'12345678-1234-4234-8234-123456789abd',name:'Albert',kind:'robot'}];
 const query=sceneReferenceQuery('Go to $Mointain',15);
 assert.deepEqual(query,{start:6,end:15,query:'Mointain'});
 assert.equal(sceneReferenceCandidates(objects,'Mointain').length,1);
 assert.deepEqual(sceneReferenceCandidates(objects,'Albert'),[]);
 const result=insertSceneReference('Go to $Mointain',query,objects[0]);
 assert.equal(result.text,`Go to $[MointainMovieLounge1-2-c](${uuid}) `);
 assert.equal(sceneReferenceQuery('Go to $[MointainMovieLounge1-2-c]('+uuid+')'),null);
 assert.equal(insertSceneReference('$',sceneReferenceQuery('$'),{id:'wrong',name:'old object'}),null);
});
test('@ handles keep portrait IDs and remain separate from object references',()=>{
 assert.equal(mentionQuery('@Al',3).query,'Al');
 const candidates=mentionCandidates([{name:'Albert',kind:'robot',id:'robot-1',avatar:'portrait-1'}],'alb');
 assert.equal(candidates[0].avatar,'portrait-1');
 assert.match(read('js/studio.js'),/chat-mention-avatar/);
 assert.match(read('js/studio.js'),/chat-mention-label/);
 assert.match(read('js/studio.js'),/sceneReferenceCandidates\(allObjects\(\)/);
 assert.match(read('styles.css'),/chat-mention-label\{min-width:0;flex:1 1 auto/);
});
test('an unknown-place creative building session is authorized without a noun list, with bounded time',()=>{
 const cmd='@Albert and now perform extreme creative session of building an amazing metropolis for pink elephants';
 const result=addressedCreativeRobot(cmd,[{id:'id-a',name:'Albert',kind:'robot'}]);
 assert.equal(result?.robotId,'id-a');
 assert.equal(creativeSessionDurationMs(cmd),900000);
 assert.equal(creativeSessionDeadline(cmd,1_000_000),1_900_000);
 assert.equal(creativeSessionDurationMs('@Albert create a pink car'),0);
 assert.ok(groupCreativeIntent('@all perform an extreme creative session of building a city for fantastical beings'));
 assert.equal(groupCreativeIntent('@all do not build anything'),null);
});
test('server verifies UUID and label against current room scene rather than old remembered labels',()=>{
 const src=read('backend/server.py');
 assert.match(src,/explicit_ref=re.search/);
 assert.match(src,/o\.get\('id'\).*explicit_ref\.group\(2\)/s);
 assert.match(src,/The referenced object is no longer available in this realm/);
 assert.match(src,/series_index 0\.\.8/);
});
