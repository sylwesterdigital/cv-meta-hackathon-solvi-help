import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('release version matches frontend, backend health, and watcher install checks', () => {
  const version = JSON.parse(read('package.json')).version;
  const release = JSON.parse(read('releases.json'));
  assert.equal(release.currentVersion, version);
  assert.equal(release.releases[0].version, version);
  assert.ok(read('index.html').includes(`id="version">v${version}`));
  assert.match(read('backend/server.py'), new RegExp(`version='${version.replaceAll('.', '\\.')}\'`));
  const installer = read('backend/install-ubuntu.sh');
  assert.ok(installer.includes(`EXPECTED_VERSION=\${SOLVI_EXPECTED_VERSION:-${version}}`));
  assert.ok(installer.includes('export SOLVI_EXPECTED_VERSION="$EXPECTED_VERSION"'));
  assert.doesNotMatch(installer, /environ\.get\('SOLVI_EXPECTED_VERSION',/);
  const apiTest = read('backend/test_api.py');
  assert.match(apiTest, /package\.json/);
  assert.doesNotMatch(apiTest, /environ\.get\('SOLVI_EXPECTED_VERSION',\s*'0\./);
});
