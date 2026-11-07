import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {validateSceneSnapshot} from '../js/scene-snapshot-guard.js';
const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const python=code=>spawnSync('python3',['-c',code,new URL('../backend/server.py',import.meta.url).pathname,new URL('./fixtures/release-196-furniture-configs.json',import.meta.url).pathname],{encoding:'utf8'});

test('all 45 complete normal procedural furniture configs are accepted; invalid keys and invalid values are rejected',()=>{
 const code=`import ast,json,math,re,sys
src=ast.parse(open(sys.argv[1]).read());names={'valid_basic_furniture','valid_smart_channels','valid_smart_options','_preset_finite'}
code=ast.Module(body=[n for n in src.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[])
env={'math':math,'re':re,'MAX_FURNITURE_FIELDS':200};exec(compile(code,'<validators>','exec'),env)
items=json.load(open(sys.argv[2]));normal={k:v for k,v in items.items() if k!='infrastructure'}
assert len(normal)==45
for kind,entry in normal.items():
 assert len(entry)==129,(kind,len(entry))
 assert env['valid_basic_furniture'](entry),kind
 assert env['_preset_finite'](entry),kind
bad=dict(normal['rake']);bad['unknownPrivateField']='bad'
assert not env['valid_basic_furniture'](bad)
bad=dict(normal['rake']);bad['handleRadius']=100
assert not env['valid_basic_furniture'](bad)
bad=dict(normal['rake']);bad['channels']=[{'title':'bad','url':'http://insecure.example/video.mp4'}]
assert not env['valid_basic_furniture'](bad)
bad=dict(normal['rake']);bad.update({f'extra_{i}':i for i in range(100)})
assert not env['valid_basic_furniture'](bad)
print('45/45 valid furniture variants; hostile payloads rejected')`;
 const result=python(code);assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/45\/45/);
});

test('infrastructure retains required point/variant checks under same bounds',()=>{
 const code=`import ast,json,math,re,sys
src=ast.parse(open(sys.argv[1]).read());names={'valid_basic_furniture','valid_smart_channels','valid_smart_options'}
env={'math':math,'re':re,'MAX_FURNITURE_FIELDS':200};exec(compile(ast.Module(body=[n for n in src.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'<v>','exec'),env)
base=json.load(open(sys.argv[2]))['infrastructure'];base.update({'infraType':'fence','infraStyle':'plank','infraSurface':'concrete','infraTraffic':'twoway','infraPoints':[[0,0],[3,0]]})
assert env['valid_basic_furniture'](base)
base['infraPoints']=[[0,0]];assert not env['valid_basic_furniture'](base)
print('infrastructure OK')`;
 const result=python(code);assert.equal(result.status,0,result.stderr);
});

test('scene snapshots are checksummed, compressed and preserve last-known scene within a transaction',()=>{
 const code=`import ast,json,math,re,sys,sqlite3,zlib,hashlib,time,uuid
src=ast.parse(open(sys.argv[1]).read());names={'save_scene_snapshot','decode_scene_snapshot'}
ns={'sqlite3':sqlite3,'json':json,'zlib':zlib,'hashlib':hashlib,'time':time,'uuid':uuid}
exec(compile(ast.Module(body=[n for n in src.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'<backup>','exec'),ns)
c=sqlite3.connect(':memory:');c.row_factory=sqlite3.Row
c.execute('CREATE TABLE scene_snapshots (id TEXT PRIMARY KEY,room_id TEXT,revision INT,payload BLOB,sha256 TEXT,object_count INT,reason TEXT,created REAL)')
data=json.dumps([{'id':'sofa12345678','kind':'furniture','furniture':{'variant':'sofa'}}])
assert ns['save_scene_snapshot'](c,'main',31,data,'remove')
r=c.execute('SELECT * FROM scene_snapshots').fetchone()
assert ns['decode_scene_snapshot'](r)==json.loads(data)
assert r['object_count']==1 and r['revision']==31
assert not ns['save_scene_snapshot'](c,'main',32,data,'upsert')
assert ns['save_scene_snapshot'](c,'main',32,data,'bulk')
print('snapshots OK')`;
 const result=python(code);assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/snapshots OK/);
});

test('malformed and unexpectedly blank remote scenes cannot erase a populated room',()=>{
 assert.deepEqual(validateSceneSnapshot({revision:4,objects:[]},{sameRoom:true,localCount:10}).ok,false);
 assert.equal(validateSceneSnapshot({revision:4,objects:[]},{sameRoom:false,localCount:10}).ok,true);
 assert.equal(validateSceneSnapshot({revision:4,objects:null}).ok,false);
 assert.equal(validateSceneSnapshot({revision:4,objects:[{id:'a',kind:'furniture',position:[1,2,3],rotation:[0,0,0],scale:[1,1,1]}]}).ok,true);
 assert.equal(validateSceneSnapshot({revision:4,objects:[{id:'a',kind:'cube',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},{id:'a',kind:'cube',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}]}).ok,false);
 assert.equal(validateSceneSnapshot({revision:4,objects:[{id:'a',kind:'furniture',position:[1,2,Infinity],rotation:[0,0,0],scale:[1,1,1]}]}).ok,false);
 const editor=source('js/editor.js');assert.match(editor,/validateSceneSnapshot\(data/);assert.match(editor,/scene-snapshot-rejected/);assert.match(editor,/solvi-scene-last-good-/);
});

test('backend retains per-object updates, atomic bulk checks, startup snapshots and read-only recovery APIs',()=>{
 const server=source('backend/server.py');assert.match(server,/MAX_FURNITURE_FIELDS = 200/);
 assert.match(server,/save_scene_snapshot\(_backup_con,.*'pre-upgrade'\)/);
 assert.match(server,/save_scene_snapshot\(con,room_id,old,before_payload,'bulk'\)/);
 assert.match(server,/save_scene_snapshot\(con,room_id,row\['revision'\],row\['payload'\],'remove'/);
 assert.match(server,/explicit confirmation required/);
 assert.match(server,/@app\.get\('\/api\/scene\/backups'\)/);
 assert.match(server,/@app\.get\('\/api\/scene\/backups\/<snapshot_id>'\)/);
 const installer=source('backend/install-ubuntu.sh');assert.match(installer,/BACKEND_PY_MODULES=\(realm_archives\.py prune_removed_avatars\.py scene_recovery\.py robot_character\.py robot-character-schema\.json robot-character-policy\.json\)/);
 const recovery=source('backend/scene_recovery.py');assert.match(recovery,/before-restore-/);assert.match(recovery,/RESTORE:/);assert.match(recovery,/--service-stopped/);
});
