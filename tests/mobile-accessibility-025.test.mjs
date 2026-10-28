import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {fontStack,safeFontName,uiScalePercent,validLabelMode,resolvedLabelMode,THEME_PRESETS,contrast} from '../js/preferences.js';
import {iconForButton} from '../js/ui-controls.js';
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('mobile device defaults to icon-only labels and desktop to icon plus description',()=>{
 assert.equal(resolvedLabelMode('auto',true),'icon');assert.equal(resolvedLabelMode('auto',false),'both');
 for(const v of ['both','text','icon'])assert.equal(resolvedLabelMode(v,true),v);
 assert.equal(validLabelMode('invalid'),'auto');
});
test('50–200 percent scale clamps invalid input, installed font family is sanitised',()=>{
 assert.deepEqual(['0','50','135','200','999'].map(uiScalePercent),[100,50,140,200,200]);
 assert.equal(safeFontName('Avenir Next'),'Avenir Next');
 assert.equal(safeFontName('Arial; color:red'),'');
 assert.match(fontStack('installed','Avenir Next'),/"Avenir Next"/);
 assert.doesNotMatch(fontStack('installed','a;url(bad)'),/url/);
});
test('colour theme body text exceeds WCAG AA standard text contrast',()=>{
 for(const [name,t] of Object.entries(THEME_PRESETS))assert.ok(contrast(t.foreground,t.panel)>=4.5,`${name}: ${contrast(t.foreground,t.panel)}`);
});
test('SVG icons are bound to semantic controls and exact scene items retain names',()=>{
 const mock=(id,text,scene=false)=>({id,textContent:text,title:'',getAttribute:()=>null,classList:{contains:()=>false},closest:()=>scene?{}:null});
 assert.equal(iconForButton(mock('captionsButton','CC off')),'captions');
 assert.equal(iconForButton(mock('addObjectButton','Add')),'add');
 assert.equal(iconForButton(mock('','Cube')),'cube');
 assert.equal(iconForButton(mock('','Delete')),'delete');
 assert.equal(iconForButton(mock('','Sofa · Red Sofa',true)),null);
});
test('Settings exposes all three UI modes, scale, fonts, named themes, CC status, mobile More',()=>{
 const html=file('index.html');
 for(const str of ['id="uiScale"','id="uiFontTheme"','id="uiCustomFont"','id="themePresetGallery"','id="ccSettingsStatus"','id="mobileMenuButton"','value="both"','value="text"','value="icon"'])assert.ok(html.includes(str),str);
 const css=file('styles.css');assert.match(css,/data-button-labels='icon'/);assert.match(css,/\.theme-swatches button\.theme-swatch\{background:var\(--swatch-color\)!important/);
 const cc=file('js/voice-captions.js'),studio=file('js/studio.js');
 assert.match(cc,/window\.solviPublishCaption\(text\)/);assert.match(studio,/const caption='CC: '\+text/);
});
