import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {characterTrackColor} from '../js/robot-character-editor.js';
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const rule=(selector)=>{const at=css.lastIndexOf(selector+'{');assert.ok(at>=0,selector+' is defined');return css.slice(at+selector.length+1,css.indexOf('}',at));};
const input='#robotBrainsPanel .character-trait input[type=range]';
test('no hot-dog stripe: solid track colour is assigned to both native track engines, not painted under a grey track',()=>{
 const container=rule(input);
 assert.match(container,/background:transparent!important/);
 for(const selector of [input+'::-webkit-slider-runnable-track',input+'::-moz-range-track',input+'::-moz-range-progress']){
  const native=rule(selector);
  assert.match(native,/background:var\(--trait-track-color,#266cd7\)/);
  assert.match(native,/border:0/);
  assert.match(native,/border-radius:0/);
  assert.match(native,/box-shadow:none/);
  assert.doesNotMatch(native,/linear-gradient|color-mix/);
 }
});
test('range tracks have hard square ends; thumb is one white colour without rings or borders',()=>{
 for(const sel of [input+'::-webkit-slider-thumb',input+'::-moz-range-thumb']){
  const thumb=rule(sel);
  assert.match(thumb,/background:#fff/);
  assert.match(thumb,/border:0/);
  assert.match(thumb,/box-shadow:none/);
  assert.doesNotMatch(thumb,/border:2px/);
 }
 assert.equal(characterTrackColor(0),'#266cd7');
 assert.equal(characterTrackColor(50),'#38b171');
 assert.equal(characterTrackColor(100),'#db3e41');
});
