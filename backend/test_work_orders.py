"""v0.2.192 isolated bounded work-order checks without importing Flask."""
import ast
import json
import math
from pathlib import Path
root=Path(__file__).parent
source=ast.parse((root/'server.py').read_text())
func=next(node for node in source.body if isinstance(node,ast.FunctionDef) and node.name=='valid_robot_work_order')
scope={'json':json,'math':math}
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
# v0.2.214: a team role and public-road scene IDs are persistable, bounded data.
team={'id':'team-42','role':'road','anchor':{'x':25,'z':-48},'label':'City builders'}
road_state={**state,'team':team,'teamBuilt':[{'id':'road-object-1','variant':'road'}]}
assert validate({**order,'mode':'local_project'},road_state)[1]['team']==team
assert validate(order,{**road_state,'team':{**team,'role':'delete_all'}}) is None
assert validate(order,{**road_state,'team':{**team,'anchor':{'x':float('nan'),'z':5}}}) is None
assert validate(order,{**road_state,'teamBuilt':[{'id':'fake','variant':'explosive'}]}) is None
assert validate(order,{**road_state,'teamBuilt':[{'id':str(i),'variant':'road'} for i in range(9)]}) is None
print('PASS: bounded SQLite mission schema rejects unsafe values and retains recovery state')
