"""Standalone no-Flask regression for v0.2.224 planner/persistence safety."""
import ast
import json
import math
import re
from pathlib import Path

source = (Path(__file__).parent/'server.py').read_text()
functions = {node.name: node for node in ast.parse(source).body if isinstance(node,ast.FunctionDef)}
ctx = {'json':json,'math':math,'re':re,
       'AUTONOMY_ACTIONS':{'build_house','visit','deliver','build','remove','idle','rest','inspect','ask','use_preset'},
       'AUTONOMY_BUILD_VARIANTS':{'chair','table'}}
for name in ('validate_autonomy_decision','parse_autonomy_decision','valid_robot_work_order'):
    exec(compile(ast.Module(body=[functions[name]],type_ignores=[]),'server.py','exec'),ctx)

order={'mode':'local_project','robotId':'ania-operator','room':'nowhere',
       'goal':'@Ania build a cosy house','interval':180,'allowChanges':True}
state={'completedHouses':['house-1'], 'recoveryAttempts':{'build_house':0},
       'askedPreferences':True,'roofPreference':'shed'}
assert ctx['valid_robot_work_order'](order,state)
for bad in ({**state,'roofPreference':'unsupported'}, {**state,'askedPreferences':'yes'}):
    assert ctx['valid_robot_work_order'](order,bad) is None
sample={'action':'build_house','house':{'roof':'shed','width':4},'reason':'Build verified home'}
assert ctx['parse_autonomy_decision'](json.dumps(sample),[], 'ania-operator',True)['house']['roof']=='shed'
for content in ('not JSON','[1,2,3]','{"action":"arbitrary_code"}','{}'):
    assert ctx['parse_autonomy_decision'](content,[],'ania-operator',True) is None
assert 'if not model_ready and ack is None:' in source
assert "audit_event('robot-autonomy-plan-parser-rejected'" in source
assert 'if not model_ready and ack is None:' in source.split("@app.post('/api/robots/react')",1)[1]
assert "@app.post('/api/robots/autonomy/ask-human')" in source
assert 'robot_work_order_robot(user,room_id,rid)' in source
print('PASS: missing-key deterministic vision command, safe model-plan parsing, bounded roof preference state and authenticated question')
