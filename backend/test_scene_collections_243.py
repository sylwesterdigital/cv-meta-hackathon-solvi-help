"""Dependency-free validation of the server's bounded scene-collection metadata."""
import ast
import re
from pathlib import Path
source=Path(__file__).with_name('server.py').read_text()
module=ast.parse(source)
func=next(node for node in module.body if isinstance(node,ast.FunctionDef) and node.name=='valid_scene_collection')
scope={'re':re}
exec(compile(ast.Module(body=[func],type_ignores=[]),'<scene-collection-validation>','exec'),scope)
valid=scope['valid_scene_collection']
assert valid({'id':'group:12345678-1234-4234-8234-123456789abc','name':'Albert - Pink Elephant 001A'})
assert valid({'id':'legacy:996ed560-3112-4d3d-9539-aa3b25949e81:0','name':'Creative build 012B'})
for rejected in (None,[],{}, {'id':'bad','name':'Something'}, {'id':'group:12345678','name':' '},
                 {'id':'group:12345678','name':'x'*81},{'id':'group:12345678','name':'safe','js':'not allowed'}):
    assert not valid(rejected),rejected
for route in ('@app.put(\'/api/scene\')','@app.post(\'/api/scene/object\')'):
    assert route in source,route
assert "'collection','collectionOptOut'" in source
assert "if 'collectionOptOut' in obj" in source
assert "if 'collectionOptOut' in o" in source
print('PASS: bounded collection metadata and both scene update paths')
