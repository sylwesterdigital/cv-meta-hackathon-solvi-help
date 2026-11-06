import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chatSingleObjectTransfer} from '../js/robot-object-intent.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const scene=[{name:'Box copy7',id:'box7-12345678',kind:'furniture'},
 {name:'Bin - Big Junk',id:'bin-12345678',kind:'furniture'},
 {name:'Bin',id:'bin-other-12345678',kind:'furniture'},
 {name:'Table',id:'table1-12345678',kind:'furniture'},
 {name:'Table',id:'table2-12345678',kind:'furniture'},
 {name:'Table copy1',id:'tablecopy-12345678',kind:'furniture'}];
test('named single-object transfer grounds IDs, never guesses duplicate named destinations',()=>{
 const action=chatSingleObjectTransfer('@Lea please pick up Box copy7 and put it in Bin - Big Junk','Lea',scene);
 assert.equal(action.sourceId,'box7-12345678');assert.equal(action.destinationId,'bin-12345678');
 const next=chatSingleObjectTransfer('@Lea move Box copy7 to Table copy1','Lea',scene);
 assert.equal(next.destinationId,'tablecopy-12345678');
 assert.equal(chatSingleObjectTransfer('@Lea move Box copy7 to Table','Lea',scene),null);
 assert.equal(chatSingleObjectTransfer('@Jiz move Box copy7 to Bin','Lea',scene),null);
 assert.equal(chatSingleObjectTransfer('@Lea the box looks great','Lea',scene),null);
 assert.equal(chatSingleObjectTransfer('@Lea pick up Box copy7 and put it in Unknown bin','Lea',scene),null);
});
test('explicitly named work order uses real inventory storage and acknowledges scene server save',async()=>{
 const source=read('js/robot-autonomy.js');
 const fragment=source.slice(source.indexOf(' async function deliverNamedObject('),source.indexOf(' // One verified can per cycle,'));
 assert.ok(fragment.startsWith(' async function deliverNamedObject('));
 const actor={position:{x:0,y:0,z:0},userData:{editorId:'robot-12345678'}};
 const sourceObject={name:'Box copy7',position:{x:.3,y:0,z:0},userData:{editorKind:'furniture',editorId:'box7-12345678',furniture:{variant:'box'}}};
 const target={name:'Bin - Big Junk',position:{x:1.1,y:0,z:0},userData:{editorKind:'furniture',editorId:'bin-12345678',furniture:{variant:'bin'}}};
 sourceObject.updateWorldMatrix=()=>{};
 const saved=[];
 const editor={canEdit:()=>true,queueSave(){},async persistObject(obj){saved.push(obj.userData.editorId);return true;},inventory:{heldFor(){return null;},hold(_,obj){obj.userData.storage={type:'held',holderId:'robot-12345678',hand:'right'};return true;},storeInBin(_,obj,bin){obj.userData.storage={type:'container',containerId:bin.userData.editorId,slot:0};return true;}}};
 class Vec{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z;}}
 class Box{setFromObject(){return this;}getSize(){return new Vec(.35,.28,.3);}}
 const ctor=new Function('editor','THREE','requireActive','approachTransferTarget','autonomyProximity','trace',fragment+'\nreturn deliverNamedObject;');
 const func=ctor(editor,{Box3:Box,Vector3:Vec},()=>{},async()=>{},(a,b,d)=>Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)<=d,()=>{});
 const result=await func({order:{allowChanges:true},room:'loft-16',id:'robot-12345678'},actor,sourceObject,target);
 assert.match(result,/server acknowledged scene edit/);
 assert.deepEqual(saved,['box7-12345678']);
 assert.equal(sourceObject.userData.storage.containerId,'bin-12345678');
});
