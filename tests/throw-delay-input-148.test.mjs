import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const carrySource=readFileSync(new URL('../js/object-carry.js',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
const {cleanThrowSettings,editThrowSetting}=new Function('THREE',carrySource+'\nreturn {cleanThrowSettings,editThrowSetting};')({});
const editorSource=readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
const start=editorSource.indexOf('  // Commit valid values as they are entered;');
const end=editorSource.indexOf("  byId('robotThrowTrajectory').addEventListener",start);
assert.ok(start>=0&&end>start,'throw inspector listeners must be present');
const wire=new Function('byId','editThrowSetting','cleanThrowSettings',editorSource.slice(start,end));

function setup(){
 const fields=new Map();
 const byId=id=>{
  if(!fields.has(id)){
   const listeners=new Map();
   fields.set(id,{value:'',addEventListener(kind,fn){listeners.set(kind,[...(listeners.get(kind)||[]),fn]);},fire(kind){for(const fn of listeners.get(kind)||[])fn();}});
  }
  return fields.get(id);
 };
 const bot={userData:{editorId:'robot-a',editorKind:'robot',robotThrowSettings:cleanThrowSettings()}};
 const saves=[],edits=[];
 const ctx={selected:bot,canEdit:()=>true,queueSave:b=>saves.push(structuredClone(b.userData.robotThrowSettings)),
  snapshot:b=>structuredClone(b.userData.robotThrowSettings),recordEdit:(before,after)=>edits.push({before,after})};
 wire.call(ctx,byId,editThrowSetting,cleanThrowSettings);
 return {bot,ctx,byId,saves,edits,field:byId('robotThrowDelay')};
}

test('release delay changes 55 → 42 → 90 through real inspector focus/input/change callbacks',()=>{
 const f=setup();f.field.fire('focus');
 f.field.value='42';f.field.fire('input');
 assert.equal(f.bot.userData.robotThrowSettings.delay,42,'input commits valid percentage before blur');
 f.field.fire('change');f.field.fire('blur');
 assert.equal(f.field.value,42);
 assert.equal(f.edits.length,1);
 assert.equal(f.edits[0].before.delay,55);assert.equal(f.edits[0].after.delay,42);
 f.field.fire('focus');f.field.value='90';f.field.fire('input');f.field.fire('change');f.field.fire('blur');
 assert.equal(f.bot.userData.robotThrowSettings.delay,90);
 assert.equal(cleanThrowSettings(f.saves.at(-1)).delay,90,'valid release percentage remains serializable');
});

test('partial out-of-range entry does not snap to default; completed entry is retained',()=>{
 const f=setup();f.field.fire('focus');
 f.field.value='4';f.field.fire('input');
 assert.equal(f.bot.userData.robotThrowSettings.delay,55,'partial 4 is not committed before 42 is typed');
 assert.equal(f.field.value,'4','editing text is not reset');
 f.field.value='42';f.field.fire('input');f.field.fire('change');
 assert.equal(f.bot.userData.robotThrowSettings.delay,42);
 assert.equal(f.field.value,42);
});

test('delay values outside bounds clamp to nearest valid 5–95%, not to 55%',()=>{
 const f=setup();f.field.fire('focus');f.field.value='0';f.field.fire('input');
 assert.equal(f.bot.userData.robotThrowSettings.delay,55,'incomplete value is not prematurely saved');
 f.field.fire('change');assert.equal(f.bot.userData.robotThrowSettings.delay,5);
 assert.equal(f.field.value,5);
 f.field.fire('blur');f.field.fire('focus');f.field.value='100';f.field.fire('input');f.field.fire('change');
 assert.equal(f.bot.userData.robotThrowSettings.delay,95);
 assert.equal(f.field.value,95);
});

test('clearing field cannot silently restore default; other throw controls are independent',()=>{
 const f=setup();f.field.fire('focus');f.field.value='70';f.field.fire('input');f.field.fire('change');
 f.field.value='';f.field.fire('input');f.field.fire('change');
 assert.equal(f.bot.userData.robotThrowSettings.delay,70);
 assert.equal(f.field.value,70);
 const force=f.byId('robotThrowForce');force.fire('focus');force.value='6';force.fire('input');force.fire('change');
 assert.equal(f.bot.userData.robotThrowSettings.force,6);
 assert.equal(f.bot.userData.robotThrowSettings.delay,70);
});

test('inspector refresh preserves the currently focused throw field for the same robot',()=>{
 assert.match(editorSource,/field!==document\.activeElement\|\|this\.throwEditingRobotId!==obj\.userData\.editorId/);
 assert.match(editorSource,/const throwEditBefore=new WeakMap\(\)/);
 assert.match(editorSource,/field\.addEventListener\('input'/);
 assert.match(editorSource,/field\.addEventListener\('change'/);
});
