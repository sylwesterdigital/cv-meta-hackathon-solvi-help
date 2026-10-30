import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('installer validates local Gunicorn, HTTPS proxy and reports stage-specific failures',()=>{
 const script=read('backend/install-ubuntu.sh');
 assert.match(script,/DEPLOY_PHASE='local backend health'/);
 assert.match(script,/health_matches/);
 assert.match(script,/DEPLOY_PHASE='HTTPS proxy health'/);
 assert.match(script,/--resolve solvi\.help:443:127\.0\.0\.1/);
 assert.match(script,/systemctl reload nginx/);
 assert.match(script,/on_install_error/);
 assert.match(script,/Rolling back the service and Nginx configuration/);
});
