"""SOLVI.help prototype presence + WebRTC signaling server (no authentication)."""
import json
import os
import re
import secrets
import threading
import time
from pathlib import Path
from flask import Flask, jsonify, send_from_directory, request
from flask_sock import Sock

ROOT = Path(os.environ.get('SOLVI_STATIC_ROOT', Path(__file__).resolve().parent.parent))
app = Flask(__name__)
app.config['SOCK_SERVER_OPTIONS'] = {'ping_interval': 25, 'max_message_size': 4096}
sock = Sock(app)
room_peers = {}
lock = threading.RLock()
ALLOWED_ORIGINS = {x.strip() for x in os.environ.get('SOLVI_ALLOWED_ORIGINS', 'https://solvi.help,http://localhost:8000,http://127.0.0.1:8000').split(',') if x.strip()}

@app.get('/api/health')
def health():
    return jsonify(ok=True, service='solvi.help', version='0.1.0', peers=len(room_peers))

@app.get('/')
def index():
    return send_from_directory(ROOT,'index.html')

@app.get('/<path:name>')
def static(name):
    # Prevent exposing scripts, backend source and repository metadata.
    if name.split('/')[0] not in {'js','vendor','assets'} and name not in {'styles.css','releases.json'}:
        return ('Not found',404)
    return send_from_directory(ROOT,name)

def publish(message, except_id=None, to=None):
    raw=json.dumps(message,separators=(',',':'))
    with lock:
        peers=list(room_peers.items())
    for peer_id, info in peers:
        if peer_id == except_id or (to and peer_id!=to):continue
        try:info['ws'].send(raw)
        except Exception:pass

@sock.route('/ws')
def socket_handler(ws):
    origin=request.headers.get('Origin','')
    if origin not in ALLOWED_ORIGINS:
        ws.close();return
    peer_id=None;last_state_at=0
    try:
        while True:
            raw=ws.receive()
            if raw is None:break
            if len(raw)>4096:break
            msg=json.loads(raw)
            if not isinstance(msg,dict):continue
            typ=msg.get('type')
            if peer_id is None:
                if typ!='join' or msg.get('room')!='main':break
                candidate=msg.get('id','')
                if not isinstance(candidate,str) or not re.fullmatch(r'[A-Za-z0-9-]{4,80}',candidate):break
                with lock:
                    if len(room_peers)>=40 or candidate in room_peers:break
                    peer_id=candidate
                    snapshot=[{'id':k,'state':v.get('state',{})} for k,v in room_peers.items()]
                    room_peers[peer_id]={'ws':ws,'state':{}}
                ws.send(json.dumps({'type':'snapshot','peers':snapshot}))
                publish({'type':'presence','event':'joined','id':peer_id,'state':{}},except_id=peer_id)
                continue
            if typ=='state':
                if time.monotonic()-last_state_at<.08:continue
                last_state_at=time.monotonic()
                state=msg.get('state')
                if not isinstance(state,dict):continue
                try:
                    data={k:round(float(state[k]),2) for k in ('x','z','yaw')}
                    if any(abs(n)>1000 for n in data.values()):continue
                    data['mode']=str(state.get('mode','idle'))[:12]
                except (KeyError,TypeError,ValueError):continue
                with lock:room_peers[peer_id]['state']=data
                publish({'type':'state','id':peer_id,'state':data},except_id=peer_id)
            elif typ=='signal':
                to=msg.get('to');payload=msg.get('payload')
                if not isinstance(to,str) or not isinstance(payload,dict):continue
                if payload.get('type') not in ('offer','answer','candidate'):continue
                publish({'type':'signal','id':peer_id,'to':to,'payload':payload},to=to)
    except (ValueError,TypeError,KeyError,ConnectionError,OSError):
        pass
    finally:
        if peer_id:
            with lock:room_peers.pop(peer_id,None)
            publish({'type':'presence','event':'left','id':peer_id})

if __name__=='__main__':
    app.run(host='127.0.0.1',port=int(os.environ.get('SOLVI_PORT','8765')),threaded=True)
