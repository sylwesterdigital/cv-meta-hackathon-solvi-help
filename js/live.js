// Realtime backend is optional until /ws is deployed. No retry storm.
const randomId=()=>globalThis.crypto?.randomUUID?.()||`guest-${Math.random().toString(36).slice(2,10)}`;
export class LiveRoom{
  constructor(onPresence,onState,onSignal){
    this.id=randomId();this.peers=new Map();this.onPresence=onPresence;
    this.onState=onState;this.onSignal=onSignal;this.ws=null;this.lastSent=0;
    this.stopped=false;this.attempts=0;this.timer=null;this.syncTimer=null;this.joined=false;this.activeRoom=null;
    this.updateStatus(false,'Solo mode · multiplayer not enabled');
  }
  connect(){
    if(this.stopped||this.ws&&[WebSocket.CONNECTING,WebSocket.OPEN].includes(this.ws.readyState))return;
    if(!('WebSocket' in window)){this.updateStatus(false,'WebSocket unavailable');return;}
    const auth=window.solviAPI?.auth();if(!auth)return;this.id=auth.profile.id;
    this.attempts++;
    const protocol=location.protocol==='https:'?'wss:':'ws:';
    const targetRoom=window.solviRoom||'main';this.activeRoom=targetRoom;this.joined=false;
    this.report('connecting',{room:targetRoom,attempt:this.attempts});
    const ws=this.ws=new WebSocket(`${protocol}//${location.host}/ws`);
    ws.onopen=()=>{if(this.ws!==ws)return;this.send({type:'join',token:auth.token,tab:auth.tab,room:targetRoom,admin:window.solviLibraryAdminToken?.()||''});this.report('socket-open',{room:targetRoom});this.updateStatus(false,'Joining shared room…');};
    ws.onmessage=(event)=>{
      try {const m=JSON.parse(event.data);
        if(m.type==='auth-required'){this.report('authentication-rejected',{reason:m.reason||'Session expired'});this.close();window.dispatchEvent(new CustomEvent('solvi:auth-required',{detail:{reason:m.reason||'Please sign in again.'}}));return;}
        if(m.type==='snapshot'){
          if(m.room!==targetRoom){this.report('room-mismatch',{expected:targetRoom,actual:m.room});this.switchRoom();return;}
          const entries=(m.peers||[]).filter(p=>p.id&&p.id!==this.id);
          this.peers=new Map(entries.map(p=>[p.id,{...p,state:p.state||{}}]));
          this.joined=true;this.attempts=0;this.onPresence(this.peers);
          this.updateStatus(true,'Shared room connected');
          this.report('presence-sync',{room:targetRoom,participants:this.peers.size+1,peers:entries.map(p=>p.name||'Guest')});
          clearInterval(this.syncTimer);this.syncTimer=setInterval(()=>{if(this.ws===ws&&this.joined&&ws.readyState===WebSocket.OPEN)this.send({type:'presence-sync'});},15000);
        }
        if(m.type==='presence'){
          const name=m.name||this.peers.get(m.id)?.name||'Guest';
          if(m.event==='left')this.peers.delete(m.id);else if(m.id!==this.id)this.peers.set(m.id,{name,state:m.state||{}});
          this.onPresence(this.peers);this.report('member-'+(m.event||'joined'),{room:targetRoom,name,participants:this.peers.size+1});
          window.dispatchEvent(new CustomEvent('solvi:presence-change',{detail:{action:m.event||'joined',id:m.id,name,room:targetRoom}}));
        }
        if(m.type==='state'&&m.id!==this.id){
          const unknown=!this.peers.has(m.id),name=m.name||this.peers.get(m.id)?.name||'Guest';
          this.peers.set(m.id,{name,state:m.state});this.onState(m.id,{...m.state,name});
          if(unknown){this.onPresence(this.peers);this.report('member-discovered',{room:targetRoom,name,participants:this.peers.size+1});}
        }
        if(m.type==='signal'&&m.to===this.id)this.onSignal?.(m);
        if(m.type==='lift-motion'&&m.room===(window.solviRoom||'main')&&m.by!==this.id)window.solviEditor?.applyRemoteLiftMotion(m);
        if(m.type==='conveyor-control'&&m.room===(window.solviRoom||'main')&&m.by!==this.id)window.solviEditor?.applyRemoteTransportControl(m);
        if(m.type==='robot-motion'&&m.room===(window.solviRoom||'main')&&m.by!==this.id)window.solviEditor?.applyRobotMotion(m);
        if(m.type==='robot-input'&&m.room===(window.solviRoom||'main')&&m.by!==this.id)window.solviEditor?.applyRobotInput(m);
        if(m.type==='object-carry'&&m.room===(window.solviRoom||'main')&&m.by!==this.id)window.solviEditor?.applyRemoteCarry(m);
        if(m.type==='throw-hit'&&m.room===(window.solviRoom||'main')&&m.by!==this.id)window.solviEditor?.physics.applyRemoteThrowHit(m);
        if(m.type==='robot-action'&&m.room===(window.solviRoom||'main')&&m.by!==this.id)window.solviEditor?.applyRemoteRobotAction(m);
        if(m.type==='robot-impact'&&m.room===(window.solviRoom||'main')&&m.by!==this.id)window.solviEditor?.applyRemoteRobotImpact(m);
        if(m.type==='physics-state'&&m.room===(window.solviRoom||'main')&&m.by!==this.id)window.solviEditor?.physics.applyRemoteState(m);
        if(m.type==='object-edit'&&m.room===(window.solviRoom||'main')&&m.by!==this.id)window.solviEditor?.showRemoteEdit(m);
        if(m.type==='room-policy'&&m.room===(window.solviRoom||'main'))window.dispatchEvent(new CustomEvent('solvi:world-policy',{detail:m}));
        if(m.type==='room-environment'&&m.room===(window.solviRoom||'main'))window.dispatchEvent(new CustomEvent('solvi:room-environment',{detail:m}));
        if(m.type==='chat-created'&&m.room===(window.solviRoom||'main'))window.dispatchEvent(new CustomEvent('solvi:chat-updated'));
        if(m.type==='chat_cleared'&&m.room===(window.solviRoom||'main'))window.dispatchEvent(new CustomEvent('solvi:room-chat-cleared',{detail:m}));
        if(m.type==='scene-changed'&&(m.by!==this.id||m.reason==='robot-preference')&&m.room===(window.solviRoom||'main'))window.dispatchEvent(new CustomEvent('solvi:scene-changed',{detail:m}));
      }catch(e){this.report('message-error',{reason:e?.message||String(e)});console.warn('Invalid room message',e);}
    };
    ws.onclose=(event)=>{
      if(this.ws!==ws)return;this.ws=null;this.joined=false;
      clearInterval(this.syncTimer);this.syncTimer=null;
      this.updateStatus(false,'Reconnecting to shared room…');
      this.peers.clear();this.onPresence(this.peers);
      this.report('disconnected',{room:targetRoom,code:event?.code||0,reason:event?.reason||'Connection closed'});
      // Reconnect indefinitely with bounded backoff, not just twice. A closed
      // socket otherwise leaves different browsers with contradictory room counts.
      if(!this.stopped){const delay=Math.min(30000,1000*2**Math.min(this.attempts,5));clearTimeout(this.timer);this.timer=setTimeout(()=>this.connect(),delay);this.report('retry-scheduled',{seconds:delay/1000});}
    };
    ws.onerror=()=>{this.report('socket-error',{room:targetRoom});};
  }
  report(event,data={}){
    window.dispatchEvent?.(new CustomEvent('solvi:room-diagnostic',{detail:{event,...data}}));
  }
  updateStatus(online,text){
    document.querySelector('.signal')?.classList.toggle('online',online);
    const status=document.getElementById('networkStatus');if(status)status.textContent=text;
  }
  send(obj){if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(obj));}
  state(pose){const now=performance.now();if(now-this.lastSent<120)return;this.lastSent=now;this.send({type:'state',state:pose});}
  switchRoom(){this.stopped=true;clearTimeout(this.timer);clearInterval(this.syncTimer);this.syncTimer=null;const old=this.ws;this.ws=null;this.joined=false;old?.close();this.peers.clear();this.onPresence(this.peers);this.stopped=false;this.attempts=0;this.report('switch-room',{room:window.solviRoom||'main'});this.timer=setTimeout(()=>this.connect(),800);}
  signal(to,payload){this.send({type:'signal',to,payload});}
  close(){this.stopped=true;this.joined=false;clearTimeout(this.timer);clearInterval(this.syncTimer);this.syncTimer=null;const previous=this.ws;this.ws=null;previous?.close();this.peers.clear();this.onPresence(this.peers);this.updateStatus(false,'Room disconnected');}
}
