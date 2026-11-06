"""Execute real scene-storage validators without Flask, SQLite, or network."""
import ast
import re
from pathlib import Path
source=ast.parse((Path(__file__).resolve().parent/'server.py').read_text())
names={'valid_inventory_storage','valid_held_scene'}
functions=[node for node in source.body if isinstance(node,ast.FunctionDef) and node.name in names]
assert len(functions)==2
namespace={'re':re}
exec(compile(ast.fix_missing_locations(ast.Module(body=functions,type_ignores=[])),'scene storage validation','exec'),namespace)
validate=namespace['valid_held_scene']
bin={'id':'bin-a123','kind':'furniture','furniture':{'variant':'bin'}}
can={'id':'can-a123','kind':'furniture','furniture':{'variant':'can'},'inventory':{'category':'food','size':'pocket','consumable':False},'storage':{'type':'container','containerId':bin['id'],'slot':0}}
assert validate([bin,can])
assert not validate([can])
assert not validate([bin,can,dict(can,id='can-b123')]) # duplicate slot
assert not validate([bin,dict(can,storage={**can['storage'],'slot':24})])
assert not validate([bin,dict(can,inventory={**can['inventory'],'consumable':True})])
assert not validate([dict(bin,furniture={'variant':'table'}),can])
assert not validate([bin,dict(can,furniture={'variant':'shovel'})])
fridge=dict(bin,id='fridge-abc',furniture={'variant':'fridge'})
assert validate([fridge,dict(can,storage={**can['storage'],'containerId':fridge['id'],'slot':24})])
print('PASS: empty-can bin storage, unique slots, object references, fridge compatibility')
