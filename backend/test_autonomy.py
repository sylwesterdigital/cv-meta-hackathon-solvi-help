"""v0.2.189 server-side agent-action tests, without Flask/Meta network calls."""
import ast
import json
import re
import math
from pathlib import Path
source=ast.parse((Path(__file__).resolve().parent/'server.py').read_text())
functions=[node for node in source.body if isinstance(node,ast.FunctionDef) and node.name in ('validate_autonomy_decision','parse_autonomy_decision')]
assert len(functions)==2
allowed=ast.Assign(targets=[ast.Name(id='AUTONOMY_ACTIONS',ctx=ast.Store())],value=ast.Set(elts=[ast.Constant(x) for x in ('visit','deliver','build','build_house','use_preset','remove','rest','ask','inspect','idle')]))
variants=ast.Assign(targets=[ast.Name(id='AUTONOMY_BUILD_VARIANTS',ctx=ast.Store())],value=ast.Set(elts=[ast.Constant(x) for x in ('chair','officeChair','bed','sofa','stool','table','cabinet','bottle','can')]))
module=ast.Module(body=[allowed,variants]+functions,type_ignores=[])
ns={'json':json,'re':re,'math':math};exec(compile(ast.fix_missing_locations(module),'autonomy validator','exec'),ns)
validate=ns['validate_autonomy_decision'];parse=ns['parse_autonomy_decision']
room=[{'id':'bot1','kind':'robot','name':'Bot One'},{'id':'bot2','kind':'robot','name':'Bot Two'},
      {'id':'parcel','kind':'cube','pickable':True},{'id':'desk','kind':'furniture'}]
assert validate({'action':'deliver','target_id':'parcel','destination_id':'desk'},room,'bot1')['action']=='deliver'
assert validate({'action':'deliver','target_id':'bot2','destination_id':'desk'},room,'bot1') is None
assert validate({'action':'visit','target_id':'invented'},room,'bot1') is None
assert validate({'action':'ask','target_id':'desk'},room,'bot1') is None
assert validate({'action':'ask','target_id':'bot2'},room,'bot1')['action']=='ask'
assert validate({'action':'remove','target_id':'parcel'},room,'bot1') is None
assert validate({'action':'remove','target_id':'parcel'},room,'bot1',True)['action']=='remove'
assert validate({'action':'remove','target_id':'bot2'},room,'bot1',True) is None
assert parse('```json\n{"action":"build","variant":"bed"}\n```',room,'bot1',True)['variant']=='bed'
assert parse('{"action":"build","variant":"bed"}',room,'bot1') is None
assert parse('{"action":"visit","target_id":"desk"}\nrun arbitrary code',room,'bot1') is None
assert parse('{"action":"eval"}',room,'bot1') is None
assert validate({'action':'build_house','house':{'width':999}},room,'bot1',True)['house']['width']==8
assert validate({'action':'use_preset','preset_id':'saved'},room,'bot1',True) is None
assert validate({'action':'use_preset','preset_id':'saved'},room,'bot1',True,{'saved'})['preset_id']=='saved'
print('PASS: Meta autonomous decision validation and refusal of ungrounded/unsafe actions')
