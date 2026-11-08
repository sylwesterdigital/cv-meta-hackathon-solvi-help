"""Release 250: a valid autonomy proposal must not 502 in the audit logger.

This narrow test runs without Flask and does not contact Meta or a database.
"""
import ast
from collections import deque
from pathlib import Path
source=Path(__file__).with_name('server.py').read_text()
assert "audit_event('robot-autonomy-proposed',room=room_id,robot_id=rid,proposed_action=plan['action'],images=used_images)" in source
module=ast.parse(source)
function=next(node for node in module.body if isinstance(node,ast.FunctionDef) and node.name=='audit_event')
context={'EVENTS':deque(maxlen=10),'now':lambda:'test'}
exec(compile(ast.Module(body=[function],type_ignores=[]),'<audit-event-test>','exec'),context)
context['audit_event']('robot-autonomy-proposed',room='test',robot_id='robot-1',proposed_action='visit',images=6)
record=context['EVENTS'][-1]
assert record['event']=='robot-autonomy-proposed' and record['proposed_action']=='visit'
print('PASS: valid Meta autonomy proposal audit does not bind action twice')
