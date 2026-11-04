"""Independent regression for addressed operators, referred-to targets and malformed Meta JSON."""
import ast,json,re,math
from pathlib import Path
source=ast.parse((Path(__file__).resolve().parent/'server.py').read_text())
wanted={'meta_output_text','validate_autonomy_decision','parse_autonomy_decision','robot_recipient_queue','robot_command_clause','plan_robot_command'}
selected=[node for node in source.body if isinstance(node,ast.FunctionDef) and node.name in wanted]
assert len(selected)==len(wanted)
ns={'json':json,'re':re,'math':math,'MAX_ROBOT_TURNS':6,'AUTONOMY_ACTIONS':{'visit','deliver','build','build_house','use_preset','remove','rest','ask','inspect','idle'},'AUTONOMY_BUILD_VARIANTS':{'chair','officeChair','bed','sofa','stool','table','cabinet','bottle','can'}}
exec(compile(ast.fix_missing_locations(ast.Module(body=selected,type_ignores=[])),'safe function tests','exec'),ns)
bots=[{'id':'j','name':'Jess','kind':'robot','position':[0,0,0]},{'id':'s','name':'Suck','kind':'robot','position':[5,0,0]},{'id':'e','name':'Elox','kind':'robot','position':[10,0,0]}]
q=ns['robot_recipient_queue']
text='@Jess @Suck can you please go and find @Elox and tell him to go out, find empty area and build a hospital or small house?'
assert [r['name'] for r in q(text,bots)]==['Jess','Suck'],q(text,bots)
assert [r['name'] for r in q('@Jess please find @Elox',bots)]==['Jess']
assert [r['name'] for r in q('@Jess @Elox discuss the hospital',bots)]==['Jess','Elox']
assert [r['name'] for r in q('@All join in',bots)]==['Jess','Suck','Elox']
assert [r['name'] for r in q('Can @Jess meet @Elox?',bots)]==['Jess']
clause=re.sub(r'^\s*(?:CC\s*:\s*)?(?:@[\w-]+\s*[,;]?\s*(?:and\s+)?)+','',text,flags=re.I).strip()
command,ack=ns['plan_robot_command'](clause,bots[0],bots)
assert command['kind']=='go_to' and command['target_id']=='e', (command,ack)
assert ns['meta_output_text']({'output':[None,{'content':None},'garbage',{'content':[None,{'type':'output_text','text':'{"action":"idle"}'}]}]})=='{"action":"idle"}'
assert ns['meta_output_text']({'output':None})==''
validate=ns['validate_autonomy_decision'];parse=ns['parse_autonomy_decision']
assert validate({'action':['build_house']},bots,'j',True) is None
assert validate({'action':'build_house','house':{'roof':{'bad':1}},'variant':['bed']},bots,'j',True)['house']['roof']=='pyramid'
assert parse('{"action":{"bad":1}}',bots,'j',True) is None
assert parse('{"action":"build_house","house":{"roof":["flat"]}}',bots,'j',True)['house']['roof']=='pyramid'
print('PASS: multi-recipient operator routing, @Elox target, malformed Meta parser')
