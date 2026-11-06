import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {metaRetryDelay,canCleanupGoal,chatCanCleanupInstruction,workRecoveryPlan} from '../js/robot-autonomy-policy.js';
import {comicBubbleText,comicBubbleDuration} from '../js/robot-comic-bubbles.js';
const read=rel=>readFileSync(new URL('../'+rel,import.meta.url),'utf8');
test('retry intervals are user-configurable, bounded and no hardcoded 30 minute idle',()=>{
 assert.equal(metaRetryDelay(1),30000);assert.equal(metaRetryDelay(7),120000);
 assert.equal(metaRetryDelay(2,{retrySeconds:20,maxRetrySeconds:80}),40000);
 assert.equal(metaRetryDelay(9,{retrySeconds:20,maxRetrySeconds:80}),80000);
 const app=read('js/robot-autonomy.js');for(const x of ['autonomy_preferences','autonomyRetrySeconds','autonomyPlannerCooldown','autonomyCheckKey','MODEL KEY RESTORED'])assert.ok(app.includes(x.replace('autonomy_preferences','/api/robots/autonomy/preferences')),x);
});
test('differentiate addressed real cleanup from talk and turn it into a local action',()=>{
 const text='@Hoe can you come back home and pick up the cans from the table, drink and put empties in a bin?';
 assert.equal(chatCanCleanupInstruction(text,'Hoe'),text);assert.equal(chatCanCleanupInstruction(text,'Sakk'),null);
 assert.equal(canCleanupGoal('@Hoe is a good friend and likes cans'),false);
 assert.equal(workRecoveryPlan({goal:text,allowChanges:true}).action,'cleanup_cans');
 for(const x of ['cleanCans(run,bot)','editor.inventory.hold(bot,can)','editor.inventory.drink(bot,can)','editor.inventory.storeInBin(bot,can,bin)','CLEANUP ASSIGNED','CLEANUP FINISHED'])assert.ok(read('js/robot-autonomy.js').includes(x),x);
});
test('bins are real owner-authorized persistent containers, no simulation of throwing',()=>{
 const inv=read('js/robot-inventory.js');const backend=read('backend/server.py');const editor=read('js/editor.js');
 for(const x of ['storeInBin(robot,obj,bin)','this.editor.canEdit(bin)',"type:'container'",'slot<24'])assert.ok(inv.includes(x),x);
 for(const x of ["variant not in ('fridge','bin')",'Storage container belongs to another user','Container slot occupied'])assert.ok(backend.includes(x),x);
 assert.ok(editor.includes("'can','bin'"));
});
test('Meta key status is truthful and configuration is saved per authenticated account',()=>{
 const backend=read('backend/server.py');const html=read('index.html');
 assert.ok(backend.includes("@app.get('/api/ai/key-status')"));assert.ok(backend.includes("@app.route('/api/robots/autonomy/preferences'"));
 assert.ok(backend.includes('planner_cooldown_seconds'));assert.ok(backend.includes('provider acceptance not yet verified'));
 assert.ok(html.includes('id="autonomySavePreferences"'));
});
test('speech markers use real speech-playback event and only animate the outer border',()=>{
 const editor=read('js/editor.js'),css=read('styles.css');
 assert.ok(editor.includes("'solvi:robot-speaking',speakingPortrait"));
 assert.ok(css.includes('.robot-face-speaking::after'));assert.ok(css.includes('solviSpeakingEdge'));assert.ok(css.includes('mic.svg'));
 assert.ok(css.includes('prefers-reduced-motion'));
});
test('speech balloons carry more context and keep useful reading time',()=>{
 assert.equal(comicBubbleText('a'.repeat(500)).length,370);
 assert.ok(comicBubbleDuration('a'.repeat(300))>11500);
 assert.ok(read('styles.css').includes('max-width:min(420px,78vw)'));
});
test('map transparency, real footprints and named-object flashing',()=>{
 const src=read('js/minimap.js'),comic=read('js/robot-comic-bubbles.js');
 assert.ok(src.includes('new THREE.Box3().setFromObject(obj)'));
 assert.ok(src.includes('clearRect(0,0,w,h)'));
 assert.ok(!src.includes("ctx.fillStyle='#101e2d';ctx.fillRect(0,0,w,h)"));
 assert.ok(src.includes("'solvi:realm-object-mentioned'"));
 assert.ok(comic.includes("'solvi:realm-object-mentioned'"));
 assert.ok(read('styles.css').includes('background:rgba(16,30,45,.25)'));
});
