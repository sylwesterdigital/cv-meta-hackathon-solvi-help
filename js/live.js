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
    ws.onopen=()=>{this.attempts=0;this.send({type:'join',token:auth.token,tab:auth.tab,room:window.solviRoom||'main'});this.updateStatus(true,'Shared room connected');};
    ws.onmessage=(event)=>{
      try {const m=JSON.parse(event.data);
        if(m.type==='snapshot'){this.peers=new Map((m.peers||[]).map(p=>[p.id,{...p,state:p.state||{}}]));this.onPresence(this.peers);}
        if(m.type==='presence'){if(m.event==='left')this.peers.delete(m.id);else if(m.id!==this.id)this.peers.set(m.id,{name:m.name||'Guest',state:m.state||{}});this.onPresence(this.peers);}
        if(m.type==='state'&&m.id!==this.id){this.peers.set(m.id,{name:m.name||this.peers.get(m.id)?.name||'Guest',state:m.state});this.onState(m.id,{...m.state,name:m.name||this.peers.get(m.id)?.name});}
        if(m.type==='signal'&&m.to===this.id)this.onSignal?.(m);
        if(m.type==='chat-created'&&m.room===(window.solviRoom||'main'))window.dispatchEvent(new CustomEvent('solvi:chat-updated'));
        if(m.type==='scene-changed'&&m.room===(window.solviRoom||'main'))window.dispatchEvent(new CustomEvent('solvi:scene-changed',{detail:m}));
      }catch(e){console.warn('Invalid room message',e);}
    };
    ws.onclose=()=>{
      if(this.ws!==ws)return;this.ws=null;
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
  switchRoom(){this.stopped=true;clearTimeout(this.timer);const old=this.ws;this.ws=null;old?.close();this.peers.clear();this.onPresence(this.peers);this.stopped=false;this.attempts=0;this.timer=setTimeout(()=>this.connect(),800);}
  signal(to,payload){this.send({type:'signal',to,payload});}
  close(){this.stopped=true;clearTimeout(this.timer);this.ws?.close();}
}
