import test from 'node:test';
import assert from 'node:assert/strict';
import {attachControlSwitcherDrag} from '../js/control-switcher-drag.js';

test('Switcher moves from empty area, but portrait/select/size buttons remain ordinary clicks',()=>{
 const orig={window:globalThis.window,innerWidth:globalThis.innerWidth,innerHeight:globalThis.innerHeight,sessionStorage:globalThis.sessionStorage};
 const events={},style={},captured=[];let position={left:80,top:140},stored;
 globalThis.innerWidth=800;globalThis.innerHeight=600;
 globalThis.sessionStorage={getItem:()=>null,setItem:(key,value)=>{stored=[key,value];}};
 globalThis.window={addEventListener:()=>{}};
 const panel={offsetWidth:180,offsetHeight:95,
  addEventListener(type,cb){events[type]=cb;},
  getBoundingClientRect(){return {...position,width:180,height:95};},
  style:{setProperty(key,value){style[key]=value;if(key==='left')position.left=parseFloat(value);if(key==='top')position.top=parseFloat(value);}},
  setPointerCapture(id){captured.push(id);}
 };
 const event=target=>({button:0,pointerId:7,clientX:130,clientY:160,target:{closest:()=>target},preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}});
 try{
  attachControlSwitcherDrag(panel);
  events.pointerdown(event('button'));
  events.pointerdown(event('select'));
  assert.deepEqual(captured,[]);
  const press=event(null);
  events.pointerdown(press);
  assert.deepEqual(captured,[7]);
  assert.equal(press.prevented,true);
  events.pointermove({pointerId:7,clientX:190,clientY:200});
  assert.equal(style.left,'140px');
  assert.equal(style.top,'180px');
  events.pointerup({pointerId:7});
  assert.deepEqual(stored,['solvi-control-switcher-position-v1',JSON.stringify({x:140,y:180})]);
 }finally{Object.assign(globalThis,orig);}
});
