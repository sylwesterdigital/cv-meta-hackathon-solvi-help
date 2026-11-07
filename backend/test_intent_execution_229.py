"""Standalone regression: saved intent/colour state works without Flask imports."""
import ast, json, math, re
from pathlib import Path
src=ast.parse(Path(__file__).with_name('server.py').read_text())
func=next(n for n in src.body if isinstance(n,ast.FunctionDef) and n.name=='valid_robot_work_order')
ns={'json':json,'math':math,'re':re}
exec(compile(ast.Module(body=[func],type_ignores=[]), 'work-order-validator','exec'),ns)
valid=ns['valid_robot_work_order']
order={'mode':'local_project','robotId':'robot-123','room':'nowhere','goal':'@Lea add a bed and table to this room','allowChanges':True,'vision':False,'interval':180}
state={'step':0,'completed':0,'projectPlaced':[],'furnishingColors':{'bed':'#f4d44d'},'intentMessageId':'message-567'}
assert valid(order,state)[1]['furnishingColors']=={'bed':'#f4d44d'}
assert valid(order,{**state,'furnishingColors':{'bed':'javascript:alert(1)'}}) is None
assert valid(order,{**state,'furnishingColors':{'delete_other_users_objects':'#ffffff'}}) is None
assert valid(order,{**state,'intentMessageId':123}) is None
assert valid(order,{**state,'intentMessageId':'z'*101}) is None
assert valid({**order,'allowChanges':False},state)[0]['allowChanges'] is False
print('PASS: bounded saved task preferences and source-message references verified')
