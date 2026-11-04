import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const world=read('js/world.js'),editor=read('js/editor.js'),html=read('index.html'),css=read('styles.css');

test('single action row hosts control mode, camera mode, contextual distance, save and portrait size',()=>{
 assert.match(html,/id="controlSwitcher"[^>]*class="control-switcher"/);
 assert.match(html,/class="control-switcher-action-row"/);
 assert.match(world,/holder\?\.querySelector\('\.control-switcher-action-row'\)/);
 assert.match(world,/actions\.append\(follow,distance,button,actions\.querySelector\('\.robot-face-size-actions'\)\)/);
 assert.match(css,/#controlSwitcher \.control-switcher-action-row\{display:flex!important;flex-flow:row nowrap!important/);
 assert.match(css,/#controlSwitcher #chaseDistanceControl\[hidden\]\{display:none!important/);
 assert.doesNotMatch(world,/mode\.id='cameraStartMode'/);
});
test('contextual start options shown only on save, entry/last/here stored per room',()=>{
 assert.match(world,/menu\.id='cameraStartChoices'/);
 assert.match(world,/menu\.hidden=true/);
 assert.match(world,/button\.onclick=toggle/);
 assert.match(world,/event\.key==='Escape'/);
 for(const [mode,label] of [['entry','Entry'],['last','Last'],['saved','Here']])assert.ok(world.includes(`['${mode}','${label}'`));
 assert.match(world,/localStorage\.setItem\(this\.cameraStartKey\('mode'\),value\)/);
 assert.match(world,/this\.cameraStartKey\('saved'\),JSON\.stringify\(this\.cameraStartSnapshot\(\)\)/);
 assert.match(world,/This saves only your camera position, not the game or scene/);
 assert.match(world,/event\.code!=='KeyP'/);
 assert.match(css,/#controlSwitcher #cameraStartChoices\[hidden\]\{display:none!important/);
});
test('robot and camera controls use icons and short names, no duplicate generic pictograms',()=>{
 assert.match(editor,/const modeName=robotMode\?\(this\.controlledRobot\(\)\?\.name\|\|'Robot'\):'Scene'/);
 assert.match(editor,/switch-\$\{modeIcon\}\.svg/);
 assert.match(world,/const labels=\{free:'Free',chase:'Chase','chase-smart':'Smart',orbit:'Orbit'\}/);
 assert.match(world,/switch-\$\{icons\[this\.cameraFollowMode\]\}\.svg/);
 assert.match(css,/\.solvi-switcher-icon,#controlSwitcher #saveCameraPosition \.solvi-save-position-icon/);
 assert.match(css,/filter:brightness\(0\) invert\(1\)!important/);
 assert.match(css,/#controlSwitcher :is\(#controlModeButton,#cameraFollowButton,#saveCameraPosition\)\[data-ui-icon\]::before\{display:none!important/);
 for(const name of ['control','scene','camera-free','free','orbit-follow','smart','chase']){
  assert.ok(existsSync(new URL('../assets/ui-icons/switch-'+name+'.svg',import.meta.url)));
  assert.match(read(`assets/ui-icons/switch-${name}.svg`),/<svg/);
 }
});
test('camera saved preference remains backwards compatible and always opt-in on confirmation',()=>{
 assert.match(world,/solvi-camera-\$\{type\}-\$\{window\.solviRoom\|\|'main'\}/);
 assert.match(world,/if\(!approved\)return/);
 assert.match(world,/this\.restoreCameraStartSelection\(\);close\(\)/);
 assert.match(world,/window\.addEventListener\('solvi:room-changed'/);
 assert.match(world,/window\.addEventListener\('pagehide'/);
});
