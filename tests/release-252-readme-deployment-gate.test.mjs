import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('public README stays below watcher size limit and reflects current package version',()=>{
  const readme=read('README.md'),pkg=JSON.parse(read('package.json'));
  assert.ok(readme.length<12000,'README should remain a concise introduction, not a release log');
  assert.ok(readme.startsWith('# SOLVI.help — AI That Can See, Move, and Build'));
  assert.match(readme,/\[full change history\]\(CHANGELOG\.md\)/);
  assert.ok(readme.includes(`**v${pkg.version}**`),'README should not advertise an older version');
});

test('Amorphous, Vehicle Lab and /ai release history remains available outside README',()=>{
  const history=read('CHANGELOG.md'),spec=read('docs/RELEASE_0.2.251_SPEC.md');
  assert.match(history,/v0\.2\.251 — Amorphous, Meta Vehicle Lab and \/ai/);
  assert.match(spec,/Amorphous/i);
  assert.match(spec,/Vehicle/i);
  assert.match(spec,/\/ai/);
});
