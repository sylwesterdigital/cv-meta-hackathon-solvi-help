import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('Profile is the single administrator password entry point with lock and status',()=>{
 const html=read('index.html');
 for(const id of ['profileAdminSection','profileAdminPassword','profileAdminUnlock','profileAdminLock','profileAdminBadge','profileAdminDashboard'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.doesNotMatch(html,/id="avatarGalleryAdminPassword"/);
 assert.match(read('js/avatar-gallery.js'),/Open Profile → Administrator access/);
});

test('Profile admin token stays in runtime state and is supplied on application API requests',()=>{
 const s=read('js/studio.js');
 assert.match(s,/let pending=.*adminToken=null,adminExpiresAt=0/);
 assert.match(s,/adminExpiresAt=Date\.now\(\)\+/);
 assert.match(s,/headers\['X-Solvi-Admin'\]=sessionAdmin/);
 assert.match(s,/async function lockAdmin\(/);
 assert.match(s,/await api\.req\('\/api\/admin\/logout'/);
 assert.match(s,/window\.solviIsAdmin=/);
 assert.doesNotMatch(s,/localStorage\.setItem\(['"](?:adminToken|solvi-admin)/);
});

test('Backend verifies admin for protected operations, offers revocation, and maintains owner checks',()=>{
 const server=read('backend/server.py');
 assert.match(server,/@app\.post\('\/api\/admin\/login'\)/);
 assert.match(server,/@app\.post\('\/api\/admin\/logout'\)/);
 assert.match(server,/DELETE FROM admin_sessions WHERE token_hash/);
 assert.match(server,/def may_edit\(user_id,obj,policy,ws_admin=False\):\s*#.*\n\s*if ws_admin or \(has_request_context\(\) and admin_authorized\(\)\):return True/);
 assert.match(server,/if not admin_authorized\(\):return json_error/);
 assert.match(read('backend/test_api.py'),/global Profile administrator session can unlock server operations and revoke/);
});

test('Versioned browser modules include the updated runtime and handover is packaged',()=>{
 const html=read('index.html');
 for(const js of ['studio.js','avatar-gallery.js','asset-gallery.js','editor.js'])assert.ok(html.includes('./js/'+js+'?v='+JSON.parse(read('package.json')).version));
 assert.match(read('docs/LLM_HANDOVER.md'),/Master Project Handover/);
});

test('Live room carries the admin session only after normal WS authentication, checking expiry on each protected robot action',()=>{
 const live=read('js/live.js'),server=read('backend/server.py'),main=read('js/main.js');
 assert.match(live,/type:'join'.*admin:window\.solviLibraryAdminToken/);
 assert.match(main,/solvi:admin-changed/);
 assert.match(main,/type:'admin-auth'/);
 assert.match(server,/def ws_admin_enabled\(\):/);
 assert.match(server,/SELECT expires FROM admin_sessions WHERE token_hash/);
 assert.match(server,/may_edit\(uid,controlled,room_policy\(room_id\),ws_admin_enabled\(\)\)/);
 assert.match(server,/if msg\.get\('type'\)=='admin-auth':/);
});
