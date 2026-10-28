import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('WebXR entry points start hidden, and remain hidden without positive immersive-vr check',()=>{
 const html=src('index.html'),css=src('styles.css'),world=src('js/world.js');
 assert.match(html,/<button[^>]+id="xrButton" hidden/);
 assert.match(html,/<button[^>]+id="xrStageButton"[^>]+hidden/);
 assert.match(css,/#xrButton\[hidden\],#xrStageButton\[hidden\]\{display:none!important/);
 assert.match(world,/navigator\.xr\?\.isSessionSupported && navigator\.xr\?\.requestSession/);
 assert.match(world,/isSessionSupported\('immersive-vr'\)/);
});
test('profile badge remains a photo or initials, settings loses the duplicate glyph',()=>{
 const icons=src('js/ui-controls.js'),css=src('styles.css');
 assert.match(icons,/button\.id==='profileButton'\)return null/);
 assert.match(icons,/b\.id==='settingsButton'[^\n]+b\.textContent/);
 assert.match(css,/#profileButton::before\{display:none!important\}/);
});
test('panel controls and labels stay compact; active range is unique',()=>{
 const css=src('styles.css'),html=src('index.html');
 assert.match(css,/-webkit-line-clamp:2/);
 assert.match(css,/#scenePanel\{width:min\(282px/);
 assert.match(css,/width:34px!important;min-width:34px!important;max-width:34px!important/);
 assert.equal((html.match(/<input[^>]+type="range"[^>]+id="inspectorActiveRange"/g)||[]).length,1);
 assert.doesNotMatch(html,/id="position-0-range"/);
});
