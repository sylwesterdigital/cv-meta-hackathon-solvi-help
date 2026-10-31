import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {moveTransportRider,transportDisplacement} from '../js/transport-rider.js';
const get=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function rider(kind='robot',y=.14){
 const calls=[];const body={translation:()=>({...body.at}),at:{x:0,y,z:0},
  setTranslation(p){calls.push(['translate',p]);body.at={...p};},
  setNextKinematicTranslation(p){calls.push(['next',p]);}};
 const item={position:{x:0,y,z:0},userData:{editorKind:kind}};
 return {body,item,calls};
}
test('Lift moves a robot on a plain xyz displacement without Three Vector3 methods',()=>{
 const {body,item,calls}=rider();
 for(let i=0;i<60;i++)assert.equal(moveTransportRider(item,body,{x:0,y:.05,z:0}),true);
 assert.ok(Math.abs(item.position.y-3.14)<1e-8);
 assert.ok(Math.abs(body.translation().y-3.14)<1e-8);
 assert.equal(calls.length,120);assert.equal(calls.at(-1)[0],'next');assert.ok(Math.abs(calls.at(-1)[1].y-3.14)<1e-8);
});
test('Lift returns down with robot and rider has correct body position each tick',()=>{
 const {body,item,calls}=rider('robot',3.14);
 for(let i=0;i<60;i++)assert.equal(moveTransportRider(item,body,{x:0,y:-.05,z:0}),true);
 assert.ok(Math.abs(item.position.y-.14)<1e-8);
 assert.ok(Math.abs(body.translation().y-.14)<1e-8);
 assert.equal(calls.length,120);
});
test('Dynamic loose objects carry once, without writing robot kinematic target',()=>{
 const {body,item,calls}=rider('cube');
 assert.equal(moveTransportRider(item,body,{x:0,y:.025,z:0}),true);
 assert.equal(calls.length,1);assert.equal(calls[0][0],'translate');
});
test('Invalid transport displacement is ignored rather than stopping animation frames',()=>{
 const {body,item,calls}=rider();
 for(const d of [null,{}, {x:1,y:NaN,z:0},{x:Infinity,y:0,z:0},{x:0,y:0,z:0},{x:2,y:0,z:0}])assert.equal(moveTransportRider(item,body,d),false);
 assert.equal(item.position.y,.14);assert.equal(calls.length,0);
 assert.equal(transportDisplacement({x:0,y:.04,z:0}).y,.04);
});
test('Frame transport calls shared rider helper rather than vector-only lengthSq',()=>{
 const src=get('js/stair-transport.js');
 assert.match(src,/moveTransportRider\(item,body,\{x:delta.x\/n,y:delta.y\/n,z:delta.z\/n\}\)/);
 assert.doesNotMatch(src.slice(src.indexOf('function transfer(')),/delta\.lengthSq\(/);
 assert.match(src,/body\.setTranslation\(next,true\);body\.setNextKinematicTranslation\(next\)/);
 assert.ok(fs.existsSync(new URL('../assets/ui-icons/square.svg',import.meta.url)));
 assert.match(get('index.html'),/id="profileAdminLoginRow" class="profile-admin-login-row" autocomplete="off"/);
});
