"""Flask-free backend validation smoke test for portable linked portal presets."""
import ast
import math
import re
from pathlib import Path
source=Path(__file__).with_name('server.py').read_text()
tree=ast.parse(source)
needed={'_preset_finite','valid_portal_geometry','valid_portal_pair_preset'}
found=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in needed]
assert {n.name for n in found}==needed
scope={'math':math,'re':re}
exec(compile(ast.Module(body=found,type_ignores=[]),'server-extracted','exec'),scope)
portal=lambda role,partner:{'role':role,'partner':partner,'mode':'auto','delay':0,'width':2.2,'height':2.7,'depth':.3,'openingWidth':1.45,'openingHeight':2.1,'opacity':1,'sound':True,'color':'#499fe3','shape':'square','effect':'rainbow','texture':'none'}
part=lambda role,partner,pos:{'kind':'portal','name':'Portal '+role,'position':pos,'rotation':[0,0,0],'scale':[1,1,1],'portal':portal(role,partner)}
good={'kind':'portalPair','entry':part('entry','preset_exit',[0,0,0]),'exit':part('exit','preset_entry',[5,0,1])}
assert scope['valid_portal_pair_preset'](good)
import copy
for case in ('brokenLink','extraField','foreignOwner','badNumber','invalidShape','missingEntry'):
 bad=copy.deepcopy(good)
 if case=='brokenLink':bad['exit']['portal']['partner']='real_source_id'
 if case=='extraField':bad['entry']['payload']={'unsafe':True}
 if case=='foreignOwner':bad['owner']='another-account'
 if case=='badNumber':bad['exit']['position'][0]=float('nan')
 if case=='invalidShape':bad['entry']['portal']['shape']='custom'
 if case=='missingEntry':del bad['entry']
 assert not scope['valid_portal_pair_preset'](bad),case
print('PASS: linked portal-pair preset validator rejects broken and unsafe records')
