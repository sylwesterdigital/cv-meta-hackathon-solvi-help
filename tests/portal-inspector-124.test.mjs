import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cleanPortal,resizePortalAperture} from '../js/portal-core.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const portalPanel=()=>read('index.html').split('<details id="portalProperties"')[1].split('<details id="primitiveProperties"')[0];

test('portal uses one width, one height and exactly one shared slider',()=>{
 const html=portalPanel();
 assert.match(html,/id="portalOpeningWidth"/);
 assert.match(html,/id="portalOpeningHeight"/);
 assert.doesNotMatch(html,/id="portalWidth"|id="portalHeight"/);
 assert.equal((html.match(/type="range"/g)||[]).length,1);
 assert.match(html,/id="portalParameterRange"/);
 assert.doesNotMatch(html,/portalWidthRange|portalOpeningWidthRange|portalOpacityRange|portalDelayRange/);
 assert.match(html,/id="portalColor" type="color"/);
 assert.doesNotMatch(html,/portal-swatch|portal-swatches|data-color/);
});

test('changing portal width resizes frame and aperture together, preserving legacy portal data otherwise',()=>{
 const old=cleanPortal({role:'entry',partner:'aaaaaaaa',width:3.8,openingWidth:2.4,height:5,openingHeight:4.2,depth:.4});
 const next=resizePortalAperture(old,'openingWidth',3.2);
 assert.equal(next.openingWidth,3.2);
 assert.ok(next.width>next.openingWidth);
 assert.ok(next.width-next.openingWidth<.4);
 assert.equal(next.height,old.height);
 assert.equal(next.openingHeight,old.openingHeight);
 assert.equal(next.partner,'aaaaaaaa');
 assert.equal(old.width,3.8);
 const tall=resizePortalAperture(next,'openingHeight',5.5);
 assert.equal(tall.openingHeight,5.5);
 assert.ok(tall.height>tall.openingHeight);
 assert.ok(tall.height-tall.openingHeight<.4);
 assert.equal(tall.openingWidth,next.openingWidth);
 assert.equal(tall.width,next.width);
});

test('portal inspector offers compact matching colour picker and contextual settings',()=>{
 const html=portalPanel();const editor=read('js/editor.js'),css=read('styles.css');
 for(const id of ['portalShape','portalEffect','portalMode','portalTexture','portalDepth','portalOpacity','portalDelay','portalSound'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(editor,/resizePortalAperture\(o\.userData\.portal,key,raw\)/);
 assert.match(editor,/this\.portalActiveParameter=key/);
 assert.match(editor,/slider\.min=el\.min;slider\.max=el\.max;slider\.step=el\.step/);
 assert.doesNotMatch(editor,/portal-swatch/);
 assert.doesNotMatch(css,/\.portal-swatches\{/);
});
