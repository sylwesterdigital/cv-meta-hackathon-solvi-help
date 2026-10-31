import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('realm gallery has one shared management toolbar, not repeating Rename/Delete per tile',()=>{
 const cards=load('js/realm-gallery.js'),html=load('index.html'),studio=load('js/studio.js'),css=load('styles.css');
 assert.doesNotMatch(cards,/realm-card-action|realm-card-controls/);
 for(const id of ['realmCloneButton','realmRenameButton','realmDeleteButton']){
  assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(studio,new RegExp("\\$\\('"+id+"'\\)"));
 }
 assert.match(studio,/selectedCard=\(\)/);
 assert.match(css,/v0\.2\.92/);
});
test('server clones realm without reimport, preserves assets, assigns unique copy titles',()=>{
 const server=load('backend/server.py');
 assert.match(server,/@app\.post\('\/api\/rooms\/<room_id>\/clone'\)/);
 assert.match(server,/copy \('/);
 assert.match(server,/assets='shared server references'/);
 assert.match(server,/room_policies\(room_id,objects,robots,physics\)/);
 assert.match(server,/old\['owner_id'\]!=user\['id'\]/);
});
test('full realm import reports failure instead of replacing missing assets with silent placeholders',()=>{
 const server=load('backend/server.py'),arch=load('backend/realm_archives.py');
 assert.match(server,/validate_archive_inventory/);
 assert.match(server,/Import aborted: archive contains missing/);
 assert.match(server,/Missing model mapping during import/);
 assert.doesNotMatch(server,/obj\.update\(kind='cube',name='Placeholder/);
 assert.match(arch,/missing_realm_assets/);
 assert.match(server,/Import aborted without creating a partial realm/);
});

test('full realm import maps uploaded model and speaker URLs by UUID, and never drops them silently',()=>{
 const backend=load('backend/server.py');
 assert.match(backend,/model_match=re\.fullmatch/);
 assert.match(backend,/model_map\.get\(model_match\[1\]/);
 assert.match(backend,/speaker_match=re\.fullmatch/);
 assert.match(backend,/model_map\.get\(speaker_match\[1\]/);
 assert.match(backend,/Missing avatar mapping during import/);
});
