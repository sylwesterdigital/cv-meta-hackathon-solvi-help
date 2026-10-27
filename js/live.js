// Realtime backend is optional until /ws is deployed. No retry storm.
const randomId=()=>globalThis.crypto?.randomUUID?.()||`guest-${Math.random().toString(36).slice(2,10)}`;
export class LiveRoom{
  constructor(onPresence,onState,onSignal){
    this.id=randomId();this.peers=new Map();this.onPresence=onPresence;
    this.onState=onState;this.onSignal=onSignal;this.ws=null;this.lastSent=0;
    this.stopped=false;this.attempts=0;this.timer=null;
    this.updateStatus(false,'Solo mode · multiplayer not enabled');
  }
  connect(){
    if(this.stopped||this.ws&&[WebSocket.CONNECTING,WebSocket.OPEN].includes(this.ws.readyState))return;
    if(!('WebSocket' in window)){this.updateStatus(false,'WebSocket unavailable');return;}
    const auth=window.solviAPI?.auth();if(!auth)return;this.id=auth.profile.id;
    this.attempts++;
    const protocol=location.protocol==='https:'?'wss:':'ws:';
    const ws=this.ws=new WebSocket(`${protocol}//${location.host}/ws`);
    ws.onopen=()=>{this.attempts=0;this.send({type:'join',token:auth.token,tab:auth.tab,room:'main'});this.updateStatus(true,'Shared room connected');};
    ws.onmessage=(event)=>{
      try {const m=JSON.parse(event.data);
        if(m.type==='snapshot'){this.peers=new Map((m.peers||[]).map(p=>[p.id,p.state||{}]));this.onPresence(this.peers);}
        if(m.type==='presence'){if(m.event==='left')this.peers.delete(m.id);else if(m.id!==this.id)this.peers.set(m.id,m.state||{});this.onPresence(this.peers);}
        if(m.type==='state'&&m.id!==this.id){this.peers.set(m.id,m.state);this.onState(m.id,m.state);}
        if(m.type==='signal'&&m.to===this.id)this.onSignal?.(m);
        if(m.type==='chat-created')window.dispatchEvent(new CustomEvent('solvi:chat-updated'));
        if(m.type==='scene-changed')window.dispatchEvent(new CustomEvent('solvi:scene-changed',{detail:m}));
      }catch(e){console.warn('Invalid room message',e);}
    };
    ws.onclose=()=>{
      this.updateStatus(false,'Solo mode · backend offline');
      this.peers.clear();this.onPresence(this.peers);
      // Two attempts total, then stop. Re-enable explicitly with ?live=1.
      if(!this.stopped&&this.attempts<2)this.timer=setTimeout(()=>this.connect(),8000);
    };
    ws.onerror=()=>{ /* Browser already logs connection errors; wait for onclose. */ };
  }
  updateStatus(online,text){
    document.querySelector('.signal')?.classList.toggle('online',online);
    const status=document.getElementById('networkStatus');if(status)status.textContent=text;
  }
  send(obj){if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(obj));}
  state(pose){const now=performance.now();if(now-this.lastSent<120)return;this.lastSent=now;this.send({type:'state',state:pose});}
  signal(to,payload){this.send({type:'signal',to,payload});}
  close(){this.stopped=true;clearTimeout(this.timer);this.ws?.close();}
}
