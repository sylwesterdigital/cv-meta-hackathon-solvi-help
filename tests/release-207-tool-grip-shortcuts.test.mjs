import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=read('index.html'),css=read('styles.css'),editor=read('js/editor.js'),inventory=read('js/robot-inventory.js'),keys=read('js/robot-shortcut-help.js');

function shortcutCase(){
 const start=editor.indexOf("if(e.code==='KeyI'){");
 const end=editor.indexOf("}else if(e.code==='KeyO')",start);
 assert.ok(start>0&&end>start,'actual I handler available');
 return new Function('e','bot','pickableTarget','cleanInventory',editor.slice(start,end+1));
}

test('I drops held shovel rather than trying impossible backpack stow; inventory remains open',()=>{
 const handler=shortcutCase(),tool={name:'Shovel',userData:{storage:{type:'held',hand:'right'}}},robot={userData:{robotCarry:null}};
 const calls=[],panel={hidden:false};
 const client={inventory:{heldFor:(_,hand)=>hand==='right'?tool:null,drop:(r,o)=>{calls.push(['drop',o]);return true;},stow:()=>{throw Error('must not stow on I');}},items:[],toast:x=>calls.push(['toast',x])};
 handler.call(client,{code:'KeyI'},robot,()=>null,()=>({category:'tool'}));
 assert.deepEqual(calls,[['drop',tool]]);assert.equal(panel.hidden,false);
});

test('I works for left-hand-only equipment, while still permitting pickup when hands empty',()=>{
 const handler=shortcutCase(),tool={name:'Saw',userData:{storage:{type:'held',hand:'left'}}},robot={userData:{robotCarry:null}};
 let dropped=null,picked=0,carried=0;
 const client={inventory:{heldFor:(_,h)=>h==='left'?tool:null,drop:(_,item)=>{dropped=item;return true;},pickupNearest:()=>{picked++;return true;}},items:[],carry:{pickup:()=>{carried++;return true;}},toast:()=>{}};
 handler.call(client,{code:'KeyI'},robot,()=>null,()=>({category:'tool'}));assert.equal(dropped,tool);
 client.inventory.heldFor=()=>null;
 handler.call(client,{code:'KeyI'},robot,()=>({userData:{inventory:{category:'tool'}}}),()=>({category:'tool'}));
 assert.equal(picked,1);assert.equal(carried,0);
});

test('I still handles transient carrying and does not turn I into a throw command',()=>{
 const handler=shortcutCase(),robot={userData:{robotCarry:{objectId:'old'}}},calls=[];
 const client={carry:{drop:()=>{calls.push('carry-drop');return true;}},inventory:{heldFor:()=>{throw Error('transient carry takes priority');}},toast:()=>{}};
 handler.call(client,{code:'KeyI'},robot,()=>null,()=>({category:'world'}));assert.deepEqual(calls,['carry-drop']);
});

test('compact tool grip matches Transform: one label and controls per row, angle has reset',()=>{
 const section=html.split('<details id="toolGripDetails"')[1].split('<details id="wearableAttachmentDetails"')[0];
 assert.match(section,/class="tool-grip-line tool-grip-angle-line"/);
 assert.match(section,/Angle °/);assert.match(section,/data-grip-field="rotation"/);
 assert.ok(section.indexOf('id="toolGripReset"')<section.indexOf('id="toolGripAdvanced"'),'reset is visible on the main axis row');
 assert.match(section,/<details id="toolGripAdvanced" class="tool-grip-advanced">/);
 assert.doesNotMatch(section,/Fine settings are saved|Preview by equipping|Follow animated hand rotation/);
 assert.match(css,/#propertiesPanel #toolGripDetails \.tool-grip-line\{display:grid!important;grid-template-columns:72px minmax\(0,1fr\)/);
 assert.match(css,/#propertiesPanel #toolGripDetails \.tool-grip-angle-line\{grid-template-columns:72px minmax\(0,1fr\) 27px/);
 assert.match(css,/tool-grip-advanced\[open\]\{display:grid!important;gap:4px/);
});

test('I/U/B shortcuts are displayed and B toggles inventory',()=>{
 assert.match(html,/Pick up · I/);
 assert.match(inventory,/`Drop \$\{held\.name\} \(\$\{hand\}\) · I`/);
 assert.match(inventory,/I · pick up \/ drop/);
 assert.match(keys,/Hold \/ pick up nearby item or drop held tool/);
 assert.match(keys,/Toggle inventory \(open \/ close\)/);
 assert.match(editor,/if\(panel&&!panel\.hidden\)panel\.hidden=true;else this\.inventory\.show\(bot\)/);
 assert.match(inventory,/Keep the inventory open while calibrating/);
 assert.match(editor,/Keep Inventory open even when aiming fails/);
});

test('equipped tool does not show misleading physics body missing warning',()=>{
 assert.match(editor,/const equipped=this\.selected\?\.userData\?\.storage\?\.type==='held';runtime\.hidden=mode==='off'\|\|equipped/);
 assert.match(editor,/if\(mode!=='off'&&!equipped\)/);
});
