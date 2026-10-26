import test from 'node:test';
import assert from 'node:assert/strict';
import {findClip,computeMode} from '../js/animations.js';
test('Mixamo action names resolve',()=>{
 const clips=[{name:'Idle__117780901'},{name:'Walking__118080901'},{name:'Running__105940901'},{name:'Waving__106100901'}];
 for(const [mode,name] of [['idle','Idle'],['walk','Walking'],['run','Running'],['wave','Waving']])assert.match(findClip(clips,mode).name,new RegExp(name));
});
test('speed to animation mode',()=>{assert.equal(computeMode(0),'idle');assert.equal(computeMode(1.4),'walk');assert.equal(computeMode(3.3),'run');});
