import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('backend creative design tests use registered /autonomy/design POST rather than /group/design',()=>{
  const backend=read('backend/server.py');
  const integration=read('backend/test_api.py');
  assert.match(backend, /@app\.post\('\/api\/robots\/autonomy\/design'\)/);
  assert.match(integration, /design_endpoint='\/api\/robots\/autonomy\/design'/);
  assert.match(integration, /c\.post\(design_endpoint,headers=headers/);
  assert.doesNotMatch(integration,/c\.post\(endpoint\+'design'/);
  assert.match(integration, /assert len\(design_routes\)===?1|assert len\(design_routes\)==1/);
});
