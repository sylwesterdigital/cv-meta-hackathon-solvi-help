import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('Ubuntu install deploys the archive helper next to server, backs it up and preflights imports',()=>{
 const script=read('backend/install-ubuntu.sh');
 assert.match(script,/BACKEND_PY_MODULES=\(realm_archives\.py\s+prune_removed_avatars\.py\)/);
 assert.match(script,/install -m 644 "\$SRC\/\$module" "\$TARGET\/\$module"/);
 assert.match(script,/\$BACKUP\/python-modules\/\$module/);
 assert.match(script,/Python backend import preflight/);
 assert.match(script,/SOLVI_DATA_DIR="\$BACKUP\/preflight-state"/);
 assert.match(script,/import server/);
 assert.match(read('backend/server.py'),/from realm_archives import/);
 assert.match(read('backend/test_api.py'),/local backend modules deployed/);
});

test('realm archive module imports without a Flask service',()=>{
 const helper=new URL('../backend/realm_archives.py',import.meta.url).pathname;
 execFileSync('python3',['-c',`import importlib.util;spec=importlib.util.spec_from_file_location("realm_archives",${JSON.stringify(helper)});mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);assert callable(mod.archive_bytes)`]);
});
