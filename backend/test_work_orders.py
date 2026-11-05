"""v0.2.191 isolated bounded work-order checks without importing Flask."""
import ast
import json
from pathlib import Path
root=Path(__file__).parent
source=ast.parse((root/'server.py').read_text())
func=next(node for node in source.body if isinstance(node,ast.FunctionDef) and node.name=='valid_robot_work_order')
scope={'json':json}
exec(compile(ast.fix_missing_locations(ast.Module(body=[func],type_ignores=[])),'isolated-work-order','exec'),scope)
validate=scope['valid_robot_work_order']
order={'mode':'agent','robotId':'bot-001','room':'main','goal':'Build a hospital','interval':300,'vision':True,'allowChanges':True}
state={'completed':3,'step':5,'recoveryAttempts':{'build_house':1},'house':{'wallId':'wall-1','floorId':'floor-1','missing':['bed']},'nextMetaAt':1740000000000}
clean=validate(order,state)
assert clean is not None
assert clean[0]['goal']=='Build a hospital' and clean[1]['house']['wallId']=='wall-1'
assert validate({**order,'mode':'eval'},state) is None
assert validate({**order,'interval':59},state) is None
assert validate({**order,'interval':3601},state) is None
assert validate({**order,'goal':'x'*1801},state) is None
assert validate(order,{'huge':'x'*12001}) is None
assert validate(order,{'invitations':['a']*21}) is None
assert validate(order,{'recoveryAttempts':[]}) is None
assert validate(order,{'completed':float('nan')}) is None
assert clean[1]['house']==state['house']
print('PASS: bounded SQLite mission schema rejects unsafe values and retains recovery state')
