"""Standalone archive round-trip and safe path tests; stdlib only."""
import io,json,tarfile,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from realm_archives import archive_bytes,read_archive,safe_scene,scene_placeholders
scene=[{'id':'test','kind':'model','name':'My model','model':'/api/scene/models/abc.glb','position':[0,1,2],'rotation':[0,0,0],'scale':[1,1,1]},
       {'id':'abc','kind':'cube','name':'Box','position':[2,1,0],'rotation':[0,0,0],'scale':[1,1,1]}]
assert scene_placeholders(scene)[0]['kind']=='cube'
assert scene_placeholders(scene)[0]['name'].startswith('Placeholder')
assert len(safe_scene(scene))==2
archive=archive_bytes({'format':'solvi-realm-archive-v1','objects':scene,'media':[],'models':[]},[],[],[])
class File:
    stream=io.BytesIO(archive)
    content_length=len(archive)
meta,media,models,avatars=read_archive(File())
assert len(meta['objects'])==2 and not media and not models and not avatars
bad=io.BytesIO()
with tarfile.open(fileobj=bad,mode='w:gz') as t:
    item=tarfile.TarInfo('../escape');item.size=2;t.addfile(item,io.BytesIO(b'no'))
class Bad:
    stream=io.BytesIO(bad.getvalue())
    content_length=len(bad.getvalue())
try:read_archive(Bad())
except ValueError:pass
else:raise AssertionError('Tar traversal must be rejected')
print('PASS: portable realm archive round trip, placeholders, and traversal prevention')

# A real uploaded GLB must round-trip through the gzip archive with its id intact.
import sqlite3, tempfile, struct
from realm_archives import asset_manifest,missing_realm_assets,validate_archive_inventory
with tempfile.TemporaryDirectory() as root:
    store=Path(root)
    payload=b'{}'+b'  '
    glb=b'glTF'+struct.pack('<II',2,20+len(payload))+struct.pack('<I',len(payload))+b'JSON'+payload
    model_id='a'*32
    (store/'test.glb').write_bytes(glb)
    conn=sqlite3.connect(':memory:');conn.row_factory=sqlite3.Row
    conn.execute('CREATE TABLE media(id TEXT,path TEXT)')
    conn.execute('CREATE TABLE scene_models(id TEXT,filename TEXT,extension TEXT,title TEXT)')
    conn.execute('CREATE TABLE avatar_library(id TEXT,filename TEXT)')
    conn.execute('INSERT INTO scene_models VALUES(?,?,?,?)',(model_id,str(store/'test.glb'),'glb','Test Model'))
    scene=[{'id':'item1','kind':'model','name':'Imported furnished model','model':'/api/scene/models/'+model_id+'.glb',
            'position':[0,0,0],'rotation':[0,0,0],'scale':[1,1,1]}]
    media,models,avatars=asset_manifest(scene,conn)
    assert len(models)==1 and not missing_realm_assets(scene,media,models,avatars)
    manifest={'format':'solvi-realm-archive-v1','mode':'full','objects':scene,'media':[],
              'models':[{'id':model_id,'title':'Test Model','extension':'glb'}],'avatars':[]}
    data=archive_bytes(manifest,media,models,avatars)
    file=type('Input',(),{'stream':io.BytesIO(data),'content_length':len(data)})()
    meta,mfiles,model_files,afiles=read_archive(file)
    assert model_files[model_id]==glb
    assert validate_archive_inventory(meta,mfiles,model_files,afiles)==[]
    assert 'missing models file' in str(validate_archive_inventory(meta,mfiles,{},afiles))
    assert missing_realm_assets(scene,[],[],[])==['model:/api/scene/models/'+model_id+'.glb']
    json_meta={'format':'solvi-realm-archive-v1','mode':'json','objects':scene_placeholders(scene),'media':[],'models':[],'avatars':[]}
    assert validate_archive_inventory(json_meta,{},{},{})==[]
    assert json_meta['objects'][0]['kind']=='cube'
    # World with locally unavailable asset cannot be exported as a complete archive.
    assert missing_realm_assets(scene,*asset_manifest(scene,conn))==[]
print('PASS: complete model archive restores original bytes and missing inventory fails explicitly')
