"""Run in a temporary data directory, never the production SQLite directory."""
import json
from server import app

c=app.test_client()
# Regression: do not collide with Flask's built-in static endpoint.
assert 'static' in app.view_functions and 'public_asset' in app.view_functions
assert c.get('/').status_code == 200
assert c.get('/styles.css').status_code == 200
r=c.get('/api/health')
assert r.status_code==200,r.data
health=r.get_json();assert health['service']=='solvi-help-api' and health['version']==__import__('os').environ.get('SOLVI_EXPECTED_VERSION','0.2.1')
assert c.get('/api/messages').status_code==401
name='Solvi test user'
r=c.post('/api/onboard',json={'name':name,'tab':'test-tab-unique-001'},headers={'Origin':'http://localhost'})
assert r.status_code==200,(r.status_code,r.data)
data=r.get_json();assert data['user']['name']==name and data['token'] and data['recovery']
headers={'Authorization':'Bearer '+data['token'],'X-Solvi-Tab':'test-tab-unique-001','Origin':'http://localhost'}
assert c.get('/api/me',headers=headers).status_code==200
r=c.post('/api/message',json={'text':'Hello SOLVI world','media':[]},headers=headers)
assert r.status_code==200,(r.status_code,r.data)
assert r.get_json()['message']['text']=='Hello SOLVI world'
r=c.get('/api/messages',headers=headers)
assert r.status_code==200 and len(r.get_json()['messages'])==1
assert c.get('/api/scene',headers=headers).status_code==200
r=c.get('/api/models',headers=headers)
assert r.status_code in (200,502),r.data
assert c.post('/api/admin/login',headers=headers,json={'password':'guess'}).status_code in (403,429)
print('PASS: Flask health, SQLite profile, auth, human chat, messages, scene and admin protection')
