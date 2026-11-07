"""v0.2.226 standalone security/persistence contract for indoor furnishing work orders."""
import ast,json,math
from pathlib import Path
source=ast.parse((Path(__file__).parent/'server.py').read_text())
fn=next(n for n in source.body if isinstance(n,ast.FunctionDef) and n.name=='valid_robot_work_order')
ns={'json':json,'math':math}
exec(compile(ast.fix_missing_locations(ast.Module(body=[fn],type_ignores=[])),'furnishing-workorder','exec'),ns)
validate=ns['valid_robot_work_order']
order={'mode':'local_project','robotId':'ania-1','room':'nowhere','goal':'@Ania add a fridge and TV to this room','interval':180,'vision':False,'allowChanges':True}
state={'completed':1,'step':2,'projectPlaced':[{'id':'fridge-1','variant':'fridge'}],
 'projectPending':[{'id':'tv-1','variant':'tv'}],
 'projectDeferred':[{'variant':'tv','attempts':1,'retryAt':1794000000000,'reason':'scene save unavailable'}]}
clean=validate(order,state)
assert clean is not None and clean[1]['projectPending'][0]['id']=='tv-1'
assert clean[1]['projectPlaced'][0]['variant']=='fridge'
assert validate(order,{**state,'projectPending':[{'id':'tv-1','variant':'script'}]}) is None
assert validate(order,{**state,'projectPending':[{'id':str(i),'variant':'tv'} for i in range(7)]}) is None
assert validate(order,{**state,'projectDeferred':[{'variant':'tv','attempts':1,'retryAt':float('nan'),'reason':'bad'}]}) is None
assert validate(order,{**state,'projectDeferred':[{'variant':'tv','attempts':6,'retryAt':123,'reason':'bad'}]}) is None
assert validate(order,{**state,'projectPlaced':[{'id':'fridge-1','variant':'eval'}]}) is None
assert validate(order,{**state,'projectPlaced':[{'id':str(i),'variant':'fridge'} for i in range(7)]}) is None
print('PASS: furnished-room work order persists bounded verified/pending/deferred scene IDs')
