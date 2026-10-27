"""Test HTTPS-only Nginx vhost edits against representative configurations."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import runpy
class Config: pass
mod=Config()
mod.configure=runpy.run_path(str(Path(__file__).resolve().parent/'configure-nginx.py'))['configure']
source='''server {\n listen 80;\n server_name solvi.help;\n location / { try_files $uri =404; }\n}\nserver {\n listen 443 ssl http2;\n server_name solvi.help;\n ssl_certificate /etc/letsencrypt/live/solvi.help/fullchain.pem;\n location / { try_files $uri =404; }\n}\n'''
result=mod.configure(source)
assert result.count('include /etc/nginx/snippets/solvi-help-api.conf')==1
assert 'ssl_certificate /etc/letsencrypt/live/solvi.help/fullchain.pem' in result
assert result.count('location / {')==2
assert result.split('server {')[1].count('solvi-help-api.conf')==0
assert mod.configure(result)==result
try:mod.configure('server { listen 80; server_name solvi.help; }')
except RuntimeError:pass
else:raise AssertionError('Must refuse missing HTTPS vhost')
try:mod.configure(source.replace('location / { try_files $uri =404; }','location /api/ { proxy_pass http://localhost:1234; }',1).replace('listen 443 ssl http2;','listen 443 ssl http2;\n location /ws { proxy_pass http://localhost:1234; }'))
except RuntimeError:pass
else:raise AssertionError('Must refuse duplicate WebSocket location')
print('PASS: Nginx HTTPS include idempotency, TLS preservation and collision detection')
