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
