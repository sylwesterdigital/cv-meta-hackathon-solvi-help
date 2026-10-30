import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {linkedScale} from '../js/transform-values.js';
import {combatContact,combatReach} from '../js/robot-combat.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('linked Scale X input updates displayed XYZ continuously, with one saved edit on commit',()=>{
 const scale=linkedScale({x:1,y:1,z:1},'x',1.288);
 assert.deepEqual(scale,{x:1.288,y:1.288,z:1.288});
 const editor=read('js/editor.js');
 assert.match(editor,/number\.addEventListener\('input',[\s\S]*?syncScaleFields\(obj,number\)/);
 assert.match(editor,/byId\('scaleUniform'\)\.checked\)\{const next=linkedScale/);
 assert.match(editor,/range\.addEventListener\('change',[\s\S]*?activeNumeric\.dispatchEvent\(new Event\('change'/);
 assert.match(editor,/scaleEditBefore\.get\(el\)\|\|this\.snapshot\(obj\)/);
});

test('melee detects the collider surface even when its model pivot is distant',()=>{
 const box={min:{x:-.4,y:0,z:.9},max:{x:.4,y:2.1,z:3.7}};
 const touch=combatContact(box,{x:0,y:0,z:0},0,'punch');
 assert.ok(touch,'surface at 0.9m is inside punching reach despite 2.3m pivot');
 assert.equal(touch.z,.9);
 assert.equal(combatContact(box,{x:0,y:0,z:0},Math.PI,'punch'),null,'cannot punch through one’s back');
 assert.equal(combatContact(box,{x:0,y:0,z:-1},0,'punch'),null,'target too far away');
});

test('combat hits the body at arm/leg height, not remote upper floors',()=>{
 const high={min:{x:-.4,y:4,z:.4},max:{x:.4,y:7,z:1}};
 assert.equal(combatContact(high,{x:0,y:0,z:0},0,'punch'),null);
 const low={min:{x:-.4,y:-.5,z:.4},max:{x:.4,y:.5,z:1}};
 assert.equal(combatContact(low,{x:0,y:0,z:0},0,'punch'),null);
 assert.ok(combatContact(low,{x:0,y:0,z:0},0,'kick'));
 assert.equal(combatReach('kick'),1.35);
});

test('only a movable Dynamic object receives melee physics, and the UI explains No physics',()=>{
 const physics=read('js/scene-physics.js'),editor=read('js/editor.js'),html=read('index.html');
 assert.match(physics,/const contact=combatContact\(box,actor\.position,actor\.rotation\.y,kind\)/);
 assert.match(physics,/target\.userData\.physics\?\.mode!=='dynamic'/);
 assert.match(physics,/body\.isDynamic\?\.\(\)/);
 assert.match(physics,/applyImpulseAtPoint\(impulse,contact,true\)/);
 assert.match(html,/id="makeObjectPushable"/);
 assert.match(editor,/mode==='off'\?'No physics: attacks pass through/);
 assert.match(editor,/physicsOptions\(\{\.\.\.obj\.userData\.physics,mode:'dynamic',collider:'box'\}\)/);
 assert.match(editor,/No pushable target hit/);
});

test('real combat handler applies Rapier impulse to in-reach Dynamic object only',async()=>{
 const source=read('js/scene-physics.js');
 const a=source.indexOf(' applyCombat(actor,kind,force,fromRemote=false){');
 const b=source.indexOf('\n }\n // Compact hit impulse:',a);
 assert(a>=0&&b>a);
 const fragment=source.slice(a+' applyCombat(actor,kind,force,fromRemote=false){'.length,b);
 const THREE={Box3:class{
  setFromObject(target){this.min=target.bounds.min;this.max=target.bounds.max;return this;}
  getSize(){return {x:this.max.x-this.min.x,y:this.max.y-this.min.y,z:this.max.z-this.min.z};}
 },Vector3:class{}};
 const {combatDirection,impactImpulse}=await import('../js/robot-combat.js');
 const simulate=new Function('THREE','combatContact','combatDirection','impactImpulse',
  'return function applyCombat(actor,kind,force,fromRemote=false){'+fragment+'\n}')
 (THREE,combatContact,combatDirection,impactImpulse);
 const actor={position:{x:0,y:0,z:0},rotation:{y:0},userData:{editorId:'a',editorKind:'robot'}};
 const box={min:{x:-.4,y:0,z:.75},max:{x:.4,y:2,z:3}};
 const target={bounds:box,position:{x:0,y:0,z:2},userData:{editorId:'b',editorKind:'model',physics:{mode:'dynamic'}}};
 const impulses=[];
 const body={isDynamic:()=>true,wakeUp:()=>{},applyImpulseAtPoint:(f,point)=>impulses.push({f,point})};
 const physics={enabled:true,world:{},editor:{items:[actor,target]},bodies:new Map([['b',body]]),owns:()=>true};
 assert.equal(simulate.call(physics,actor,'punch',7,false),1);
 assert.equal(impulses.length,1);assert(impulses[0].f.z>0);assert.equal(impulses[0].point.z,.75);
 target.userData.physics.mode='static';assert.equal(simulate.call(physics,actor,'punch',7,false),0);
 target.userData.physics.mode='off';assert.equal(simulate.call(physics,actor,'kick',7,false),0);
 physics.enabled=false;target.userData.physics.mode='dynamic';assert.equal(simulate.call(physics,actor,'punch',7,false),0);
 assert.equal(impulses.length,1);
});
