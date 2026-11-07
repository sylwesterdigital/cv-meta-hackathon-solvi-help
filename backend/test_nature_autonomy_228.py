"""Self-contained regression for malformed Meta plan JSON (no Flask required)."""
import ast
import json
import math
from pathlib import Path
source=ast.parse(Path(__file__).with_name('server.py').read_text())
functions=[n for n in source.body if isinstance(n,ast.FunctionDef) and n.name in ('validate_autonomy_decision','parse_autonomy_decision')]
ns={'json':json,'math':math,'AUTONOMY_ACTIONS':{'visit','deliver','build','build_house','furnish_room','use_preset','remove','rest','ask','inspect','idle'},'AUTONOMY_BUILD_VARIANTS':{'chair','bed','sofa','table','tv','fridge'}}
exec(compile(ast.Module(body=functions,type_ignores=[]),'autonomy-plan-functions','exec'),ns)
parse=ns['parse_autonomy_decision']
for bad in ({'action':'build_house','variant':{}},{'action':'build','variant':[]},{'action':'idle','variant':{'name':'chair'}},{'action':'furnish_room','variant':{'name':'tv'}}):
    result=parse(json.dumps(bad),[], 'robot1',True)
    assert result is None or isinstance(result['variant'],str),repr(result)
assert parse('{"action":"furnish_room","variant":"tv"}',[], 'robot1',True)['variant']=='tv'
assert parse('Not JSON',[], 'robot1',True) is None
print('PASS: malformed Meta action arguments safely rejected without a TypeError')
