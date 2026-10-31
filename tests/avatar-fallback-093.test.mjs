import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('removing a robot avatar preserves room scene objects and broadcasts changed revisions',()=>{
 const code=read('backend/server.py');
 assert.match(code,/def migrate_deleted_avatar_models\(con,deleted_urls\)/);
 assert.match(code,/if isinstance\(obj,dict\) and obj\.get\('kind'\)=='robot'/);
 assert.match(code,/obj\['avatar'\]=DEFAULT_ROBOT_AVATAR/);
 assert.match(code,/UPDATE room_scenes SET revision=\?,payload=\?/);
 assert.match(code,/reason':'avatar-model-deleted'/);
 assert.match(code,/kind=='models' and library_references\(con,kind,ids\)/);
 assert.doesNotMatch(code,/if bundled_avatar_references\(con,bundled\):return json_error/);
 assert.match(code,/if 'solvi-character' in bundled:return json_error/);
 const client=read('js/robots.js');
 assert.match(client,/gltf=await loader\.loadAsync\(DEFAULT_ROBOT_AVATAR\)/);
 assert.match(client,/group\.userData\.avatarUrl=DEFAULT_ROBOT_AVATAR/);
});
test('delete confirmation and results explain retained robots and fallback avatar',()=>{
 assert.match(read('js/library-management.js'),/Robots using a deleted avatar keep their name, position and settings/);
 assert.match(read('js/avatar-gallery.js'),/replacedRobots/);
 assert.match(read('backend/test_api.py'),/saved\['revision'\]==before\+1/);
});
