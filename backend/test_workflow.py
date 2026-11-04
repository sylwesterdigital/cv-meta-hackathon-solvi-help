"""v0.2.189: no Flask needed; functional review routing and step planning."""
import ast,re
from pathlib import Path
source=ast.parse((Path(__file__).resolve().parent/'server.py').read_text())
functions=[node for node in source.body if isinstance(node,ast.FunctionDef) and node.name in ('work_review_requested','discussion_step_plan')]
assert len(functions)==2
namespace={'re':re,'DISCUSSION_LIMIT_ROBOTS':4}
exec(compile(ast.fix_missing_locations(ast.Module(body=functions,type_ignores=[])),'discussion policy','exec'),namespace)
review=namespace['work_review_requested'];steps=namespace['discussion_step_plan']
assert review('can you discuss your recent achievements and issues and next steps plan?')
assert review('your recent achievements and issues and next steps plan')
assert not review('debate whether vitamin C helps hair loss')
assert not review('research papers about house insulation')
participants=[{'id':'j','name':'Jess'},{'id':'z','name':'Zuck'}]
assert len(steps(participants,'work-review'))==2
assert [step['phase'] for step in steps(participants,'work-review')]==['update','update']
assert [step['phase'] for step in steps(participants)]==['opening','opening','challenge','challenge','synthesis']
print('PASS: Work review is casual and finite; structured research debate retained for genuine evidence requests')
