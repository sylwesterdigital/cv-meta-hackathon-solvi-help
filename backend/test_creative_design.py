from creative_design import validate_design, parse_design
import json
p={'name':'yellow submarine','site_distance':30,'parts':[
 {'kind':'sphere','label':'pressure hull','color':'#f4d44d','offset':{'x':0,'y':0,'z':0},'size':{'width':5,'height':1.4,'depth':1.4}},
 {'kind':'cylinder','label':'conning tower','color':'#f4d44d','offset':{'x':0,'y':1.2,'z':0},'size':{'width':1,'height':1.2,'depth':1}}]}
assert validate_design(p)['parts'][0]['kind']=='sphere'
assert parse_design(json.dumps(p))['site_distance']==30
assert not validate_design({**p,'js':'eval(x)'})
assert not validate_design({**p,'parts':[dict(p['parts'][0],kind='script')]})
assert not validate_design({**p,'parts':[dict(p['parts'][0],size={'width':40,'height':1,'depth':1})]})
assert not validate_design({**p,'parts':p['parts']*7})
assert not validate_design({**p,'site_distance':100})
assert not parse_design('Sure! Here is the object: '+json.dumps(p))
print('PASS: Python model-generated geometry schema, numeric bounds, prose/script rejection')
