const randomId=()=>globalThis.crypto?.randomUUID?.() || `guest-${Math.random().toString(36).slice(2,10)}`;
export class LiveRoom{
  constructor(onPresence,onState,onSignal){
    this.id=randomId();this.peers=new Map();this.onPresence=onPresence;
    this.onState=onState;this.onSignal=onSignal;this.ws=null;this.lastSent=0;this.stopped=false;
  }
  connect(){
    if(this.stopped)return;
    const protocol=location.protocol==='https:'?'wss:':'ws:';
    this.ws=new WebSocket(`${protocol}//${location.host}/ws`);
    this.ws.onopen=()=>{this.send({type:'join',id:this.id,room:'main'});this.updateStatus(true);};
    this.ws.onmessage=(event)=>{
      try {const m=JSON.parse(event.data);
        if(m.type==='snapshot'){this.peers=new Map((m.peers||[]).map(p=>[p.id,p.state||{}]));this.onPresence(this.peers);}
        if(m.type==='presence'){if(m.event==='left')this.peers.delete(m.id);else if(m.id!==this.id)this.peers.set(m.id,m.state||{});this.onPresence(this.peers);}
        if(m.type==='state'&&m.id!==this.id){this.peers.set(m.id,m.state);this.onState(m.id,m.state);}
        if(m.type==='signal'&&m.to===this.id)this.onSignal?.(m);
      }catch(e){console.warn('Invalid room message',e);}
    };
    this.ws.onclose=()=>{this.updateStatus(false);this.peers.clear();this.onPresence(this.peers);if(!this.stopped)setTimeout(()=>this.connect(),5000);};
    this.ws.onerror=()=>this.ws?.close();
  }
  updateStatus(online){
    const dot=document.querySelector('.signal');dot.classList.toggle('online',online);
    document.getElementById('networkStatus').textContent=online?'Shared room connected':'Solo mode · live server offline';
  }
  send(obj){if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(obj));}
  state(pose){const now=performance.now();if(now-this.lastSent<120)return;this.lastSent=now;this.send({type:'state',state:pose});}
  signal(to,payload){this.send({type:'signal',to,payload});}
  close(){this.stopped=true;this.ws?.close();}
}
