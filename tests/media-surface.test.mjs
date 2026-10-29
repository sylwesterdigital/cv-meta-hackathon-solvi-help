import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('scene media surfaces are wired through frontend editor and backend validators', () => {
  const editor = read('js/editor.js');
  const studio = read('js/studio.js');
  const sceneMedia = read('js/scene-media.js');
  const backend = read('backend/server.py');
  assert.match(editor, /addSceneMedia\(media,\{backing='white'\}\=\{\}\)/);
  assert.match(editor, /kind==='media'/);
  assert.match(editor, /mediaObjectControls/);
  assert.match(studio, /solviHandleWorldFileDrop/);
  assert.match(studio, /scene white/);
  assert.match(sceneMedia, /toggleSceneMediaPlayback/);
  assert.match(sceneMedia, /setSceneMediaBacking/);
  assert.match(backend, /stream\.m3u8/);
  assert.match(backend, /Invalid media surface/);
});
