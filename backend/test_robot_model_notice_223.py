"""Standalone no-Flask regression for user-facing, model-free notices."""
import ast
from pathlib import Path

source = (Path(__file__).parent/'server.py').read_text()
module = ast.parse(source)
function = next(n for n in module.body if isinstance(n,ast.FunctionDef) and n.name=='robot_model_access_notice_text')
namespace = {}
exec(compile(ast.Module(body=[function],type_ignores=[]),'<robot-notice>','exec'),namespace)
notice = namespace['robot_model_access_notice_text']
for reason,fragment in [('missing','no Meta API key'),('invalid-session','invalid format'),('rejected','Meta rejected')]:
    message=notice(reason)
    assert fragment in message, (reason,message)
    assert 'your own Meta API key' in message
    assert 'Settings → Meta AI' in message
    assert 'subscription' in message and 'may be offered later' in message
    assert 'Automatic SOLVI status notice' in message
    assert 'no model reply was generated' in message
assert source.index("if not model_ready and ack is None:") < source.index('if tagged and not from_robot and (has_image')
assert 'model_access_required=True' in source
assert 'model_ready=model_ready,discussion=' in source
print('PASS: Meta access status notices are truthful and emitted before camera routing')
