import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html'),js=read('js/devlog.js'),readme=read('README.md'),history=read('CHANGELOG.md'),about=read('ABOUT.md');
test('app README is a project introduction, not release history',()=>{
 assert.match(readme,/SOLVI\.help — AI That Can See, Move, and Build/);
 assert.match(readme,/Meta Muse Spark/);
 assert.match(readme,/Run locally/);
 assert.match(readme,/Status and limitations/);
 assert.ok(readme.length<12000);
 assert.doesNotMatch(readme,/v0\.2\.181 —|v0\.2\.174 —/);
 assert.match(readme,/\]\(CHANGELOG\.md\)/);
});
test('historic development log preserved separately in changelog and technical handover remains',()=>{
 assert.ok(history.length>155000);
 assert.match(history,/v0\.2\.194 — Reliable shared scene editing/);
 assert.match(history,/v0\.2\.181 — multiplayer presence/);
 assert.match(read('docs/LLM_HANDOVER.md'),/Master LLM Handover — v0\.2\.224/);
});
test('in-app About view has accessible independent tab and local static content',()=>{
 for(const id of ['devAboutTab','devReleasesTab','devDiagnosticsTab','devAbout','logEntries','devDiagnostics'])assert.ok(html.includes(`id="${id}"`));
 assert.match(html,/id="devAbout"[^>]*hidden>/);
 assert.match(html,/id="devLogNavButton"[^>]*>About<\/button>/);
 assert.match(html,/AI that can see, move, and build/);
 assert.match(html,/target="_blank" rel="noopener noreferrer"/);
 assert.match(js,/const panels=\{about:'devAbout',releases:'logEntries',diagnostics:'devDiagnostics'\}/);
 assert.match(js,/byId\('devAboutTab'\)\.addEventListener\('click',\(\)=>selectTab\('about'\)\)/);
 assert.match(js,/byId\('devLogNavButton'\)\.addEventListener\('click',\(\)=>\{selectTab\('about'\);open\(\);\}\)/);
 assert.match(read('styles.css'),/\.dev-about\[hidden\],\.log-scroll\[hidden\]\{display:none!important\}/);
 assert.doesNotMatch(js,/fetch\(['"]ABOUT/);
});
test('ABOUT is human readable and explicit about prototype limitations',()=>{
 assert.match(about,/living 3D world for humans and AI/);
 assert.match(about,/software avatars/);
 assert.match(about,/Meta's multimodal AI models/);
});
test('release 195 keeps historical release metadata distinct',()=>{
 const pkg=JSON.parse(read('package.json')),releases=JSON.parse(read('releases.json'));
 assert.equal(pkg.version,'0.2.224');assert.equal(releases.currentVersion,'0.2.224');
 assert.equal(releases.releases[0].version,'0.2.224');
 assert.ok(releases.releases.some(r=>r.version==='0.2.195'));assert.ok(releases.releases.some(r=>r.version==='0.2.200'));
 assert.match(html,/styles\.css\?v=0\.2\.224/);
 assert.match(html,/js\/main\.js\?v=0\.2\.224/);
});
