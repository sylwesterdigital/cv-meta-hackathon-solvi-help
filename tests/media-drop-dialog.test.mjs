import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');

test('drop chooser has in-app preview, chat and scene actions, backing options, and cancel',()=>{
 const html=read('index.html'),js=read('js/media-drop-dialog.js'),css=read('styles.css');
 for(const id of ['mediaDropDialog','mediaDropPreview','mediaDropChat','mediaDropScene','mediaDropBacking','mediaDropCancel','mediaDropDismiss'])assert.match(html,new RegExp(`id="${id}"`));
 for(const value of ['white','black','mirror'])assert.match(html,new RegExp(`value="${value}"`));
 assert.match(html,/role="dialog" aria-modal="true"/);
 assert.match(js,/URL\.createObjectURL\(file\)/);
 assert.match(js,/URL\.revokeObjectURL\(url\)/);
 assert.match(js,/event\.key==='Escape'/);
 assert.match(js,/event\.key!=='Tab'/);
 assert.match(js,/release\(\{mode:'chat'\}\)/);
 assert.match(js,/release\(\{mode:'scene',backing:backing.value\}\)/);
 assert.doesNotMatch(js,/(?:window\.)?(?:prompt|alert)\(/);
 assert.match(css,/\.media-drop-backdrop/);
});

test('world drop hint is no longer restricted to 3D models; composer does not attach files twice',()=>{
 const html=read('index.html'),studio=read('js/studio.js'),editor=read('js/editor.js');
 assert.match(html,/Drop into SOLVI/);
 assert.doesNotMatch(html,/Drop 3D model into world/);
 assert.match(studio,/import \{chooseDroppedMediaAction\} from '\.\/media-drop-dialog\.js'/);
 assert.match(studio,/if\(choice.mode==='chat'\)return await postDroppedMediaToChat\(file\)/);
 assert.match(studio,/media:\[media.id\]/);
 assert.match(studio,/e\.preventDefault\(\);e\.stopPropagation\(\);await attach\(file\)/);
 assert.match(editor,/if\(e\.defaultPrevented\)return;/);
 assert.match(editor,/this\.importModel\(modelFile\)/);
});
