import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHARACTER_SCHEMA,CHARACTER_PRESETS,TRAIT_DESCRIPTORS,makeCharacter,traitValue,traitBand,normalizeCharacter,characterSummary,characterPolicy,characterImport,characterExport,evaluateCharacterAction} from '../js/robot-character-core.js';
import {CHARACTER_ACTION_POLICY} from '../js/robot-character-policy-schema.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('30 original categories and exactly 96 stable bipolar 0-100 traits',()=>{
 assert.equal(CHARACTER_SCHEMA.categories.length,30);assert.equal(TRAIT_DESCRIPTORS.length,96);
 assert.equal(new Set(TRAIT_DESCRIPTORS.map(x=>x.id)).size,96);
 assert.ok(TRAIT_DESCRIPTORS.every(x=>x.low&&x.high&&x.default===50));
 assert.ok(['honesty','integrity','manipulation','trust','bravery','aggression','skepticism','persistence','persuadability'].every(id=>TRAIT_DESCRIPTORS.some(t=>t.id===id)));
 assert.deepEqual(JSON.parse(read('robot-character-schema.json')),CHARACTER_SCHEMA);
 assert.deepEqual(JSON.parse(read('robot-character-policy.json')),CHARACTER_ACTION_POLICY);
});
test('persistent import/export round trip retains every trait including 0 and 100',()=>{
 const profile=makeCharacter('builder');profile.traits.honesty=0;profile.traits.persistence=100;
 const saved=characterImport(characterExport('Sakk',profile));
 assert.deepEqual(saved,profile);
 assert.equal(Object.keys(saved.traits).length,96);
 assert.match(traitBand(saved,'honesty'),/Deceptive/);
 assert.match(traitBand(saved,'persistence'),/Persistent/);
 assert.equal(traitValue(saved,'honesty'),0);
});
test('strict import denies unknown fields, out-of-range, fractions, and incompatible formats',()=>{
 const profile=JSON.parse(characterExport('Bot',makeCharacter()));
 const malicious=JSON.parse(JSON.stringify(profile));malicious.character.traits.new_privilege=100;
 assert.throws(()=>characterImport(JSON.stringify(malicious)),/Unknown/);
 malicious.character.traits={honesty:101};delete malicious.character.traits.new_privilege;
 assert.throws(()=>characterImport(JSON.stringify(malicious)),/integer/);
 malicious.character.traits={honesty:42.2};assert.throws(()=>characterImport(JSON.stringify(malicious)),/integer/);
 assert.throws(()=>characterImport(JSON.stringify({...profile,format:'not-solvi'})),/compatible/);
});
test('presets change exploration and persistence preferences but never grant scene authority',()=>{
 const builder=makeCharacter('builder'),explorer=makeCharacter('explorer'),care=makeCharacter('caretaker');
 assert.ok(characterPolicy(builder).retryBudget>=characterPolicy(makeCharacter('balanced')).retryBudget);
 assert.ok(characterPolicy(explorer).explorationWeight>characterPolicy(builder).explorationWeight);
 assert.ok(characterPolicy(care).peerWeight>characterPolicy(explorer).peerWeight);
 assert.ok(characterSummary(explorer).includes('fictional'));
 assert.equal(evaluateCharacterAction(explorer,'explore',{authorized:false}).approved,false);
 assert.equal(evaluateCharacterAction(explorer,'explore',{authorized:true,reachable:false}).approved,false);
 assert.equal(evaluateCharacterAction(explorer,'unknown',{authorized:true}).approved,false);
 assert.equal(evaluateCharacterAction(explorer,'explore',{authorized:true}).approved,true);
});
test('brain UI preserves draggable panel, temperature slider, profile save and relationship evidence',()=>{
 const html=read('index.html'),css=read('styles.css'),brain=read('js/robot-brains.js'),module=read('js/robot-character-editor.js'),studio=read('js/studio.js');
 for(const id of ['brainsCharacterPreset','brainsCharacterCategories','brainsCharacterFile','brainsCharacterSave','brainsCharacterExport','brainsCharacterImport','brainsCharacterRelationships'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(css,/background:var\(--trait-track-color/);
 assert.match(css,/#robotBrainsPanel.*resize:both/);
 assert.match(module,/window\.addEventListener\('solvi:character-profile-refresh'/);
 assert.match(module,/solviEditor|save\(normalizeCharacter\(current\)\)/);
 assert.match(brain,/initCharacterEditor/);
 assert.match(studio,/id==='robotBrainsPanel'&&Number\(stored.width\)/);
});
test('backend enforces schema and persists observed relationships without fabricated emotions',()=>{
 const server=read('backend/server.py'),validator=read('backend/robot_character.py'),installer=read('backend/install-ubuntu.sh');
 assert.match(server,/valid_character\(v\)/);
 assert.match(server,/robot_relationships/);
 assert.match(server,/observe_robot_relationship\(/);
 assert.match(server,/character\/evaluate/);
 assert.match(server,/contextual_character\(brain\)/);
 assert.match(server,/approved=False|executed=False/);
 assert.match(validator,/trait_index/);
 assert.match(installer,/robot_character\.py robot-character-schema\.json robot-character-policy\.json/);
});
