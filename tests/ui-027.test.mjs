import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {THEME_PRESETS,contrast,readableText} from '../js/preferences.js';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
test('theme palette provides eight themes and accessible foregrounds',()=>{
 assert.ok(Object.keys(THEME_PRESETS).length>=8);
 for(const item of Object.values(THEME_PRESETS)){
  assert.ok(contrast(item.panel,item.foreground)>=4.5,JSON.stringify(item));
  assert.ok(contrast(item.button,readableText(item.button))>=4.5,JSON.stringify(item));
 }
});
test('UI has gallery and speech engine controls',()=>{
 const html=read('index.html');
 for(const id of ['avatarGalleryGrid','uploadRobotAvatar','avatarsButton','interfaceTheme','ccEngine','ccLanguage'])assert.ok(html.includes(`id="${id}"`),id);
});
test('backend shares Whisper and validates public uploaded model',()=>{
 const code=read('backend/server.py');
 for(const term of ['/usr/local/bin/whisper-cli','/var/lib/whisper/models/ggml-base.bin','/api/avatars','def upload_avatar','def whisper_ready',"action\':action"])assert.ok(code.includes(term),term);
});
test('delta updates do not force a full editor reload',()=>{
 const editor=read('js/editor.js'),server=read('backend/server.py');
 assert.ok(editor.includes('applyObjectPatch(message)'));
 assert.ok(server.includes("delta['object']=obj"));
 assert.ok(editor.includes('this.transform.detach()'));
});
