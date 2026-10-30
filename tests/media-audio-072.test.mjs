import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('scene media supports audio speakers and group sync controls',()=>{
 const scene=fs.readFileSync(new URL('../js/scene-media.js', import.meta.url),'utf8');
 const editor=fs.readFileSync(new URL('../js/editor.js', import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../index.html', import.meta.url),'utf8');
 assert.match(scene,/sceneMediaKind=.*audio/s);
 assert.match(scene,/PositionalAudio/);
 assert.match(scene,/syncSceneMediaGroup/);
 assert.match(editor,/mediaSyncGroup/);
 assert.match(html,/mediaAutoplayDistance/);
 assert.match(html,/mediaInteractionHud/);
});
