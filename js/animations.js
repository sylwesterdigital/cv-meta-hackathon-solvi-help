// Exact Mixamo action matching: "Idle__117780901" != "Falling Idle__118120901".
export const MOTION_ALIASES=Object.freeze({
  idle:['idle','breathing idle','standing idle','standing'],
  walk:['walking','walk','stroll'],
  run:['running','run','sprint','jogging','jog'],
  strafeLeft:['strafe left','left strafe','walk left','side step left'],
  strafeRight:['strafe right','right strafe','walk right','side step right'],
  walkBackward:['walk backwards','walking backwards','backward walk','walk backward'],
  wave:['waving','wave'],
  jump:['jump','jumping'],
  push:['pushing','push'],
  falling:['falling','fall','falling idle'],
  fallingIdle:['falling idle','fall idle','falling loop'],
  fallingLanding:['falling to landing','fall to landing','landing','land','falling idle'],
  fallingImpact:['falling flat impact','fall flat impact','hard landing','fall impact','falling back death'],
  standUp:['stand up','standing up','get up','getup'],
  hitHead:['head hit','hit head','head reaction','hit to head'],
  hitBody:['hit to body','body hit','hit body','impact','wobbling'],
  dying:['dying backwards','dying','death','falling back death']
});
export function clipBase(name){return String(name||'').split('__')[0].trim().toLowerCase().replace(/[\s_-]+/g,' ');}
export function findClip(clips,kind){
  const aliases=MOTION_ALIASES[kind]||[kind.toLowerCase()];
  for(const name of aliases){const match=clips.find(clip=>clipBase(clip.name)===name);if(match)return match;}
  // Only accept label prefixes, never a substring (e.g. "Falling Idle").
  for(const name of aliases){const match=clips.find(clip=>clipBase(clip.name).startsWith(name+' '));if(match)return match;}
  if(kind==='push')return clips.find(clip=>/\bpush(?:ing)?\b/.test(clipBase(clip.name)))||null;
  return null;
}
export function computeMode(speed){return speed<.05?'idle':speed<2?'walk':'run';}
export class MotionController{
  constructor(THREE,root,clips){
    this.THREE=THREE;this.mixer=new THREE.AnimationMixer(root);
    this.actions=new Map();this.current=null;this.currentKind=null;this.playbackSpeed=1;this.oneShotStopAt=null;this.clipNames=clips.map(c=>String(c.name||'')).filter(Boolean);
    for(const kind of Object.keys(MOTION_ALIASES)){
      const clip=findClip(clips,kind);
      if(clip)this.actions.set(kind,this.mixer.clipAction(clip));
    }
    for(const clip of clips)if(clip.name)this.actions.set('clip:'+clip.name,this.mixer.clipAction(clip));
    this.play('idle',0);
  }
  clipDuration(kind){return this.actions.get(kind)?.getClip()?.duration||0;}
  play(kind,fade=.22){
    // Prefer the avatar's authored backwards cycle. Reversing a forward walk
    // is only a fallback, not a substitute for the real inverse gait.
    const reverseWalk=kind==='walkBackward'&&!this.actions.has('walkBackward')&&this.actions.has('walk');
    const action=(reverseWalk?this.actions.get('walk'):this.actions.get(kind))||
      ((kind==='run'||kind.startsWith('strafe'))?this.actions.get('walk'):null)||this.actions.get('idle');
    if(!action)return;
    if(action===this.current){
      if(this.currentKind!==kind){
        action.setEffectiveTimeScale((reverseWalk?-1:1)*this.playbackSpeed);
        action.time=reverseWalk?Math.max(0,action.getClip().duration-.001):0;
        this.currentKind=kind;
      }
      return;
    }
    this.oneShotStopAt=null;action.paused=false;
    action.reset().setEffectiveWeight(1).setEffectiveTimeScale((reverseWalk?-1:1)*this.playbackSpeed).play();
    if(reverseWalk)action.time=Math.max(0,action.getClip().duration-.001);
    const oneShot=['wave','jump','fallingLanding','fallingImpact','standUp','hitHead','hitBody','dying'].includes(kind)||kind.startsWith('clip:');
    action.setLoop(oneShot?this.THREE.LoopOnce:this.THREE.LoopRepeat,oneShot?1:Infinity);
    action.clampWhenFinished=oneShot;
    // Crossfade between clips using AnimationMixer; avoid snapping pose on mode change.
    if(this.current&&fade)action.crossFadeFrom(this.current,fade,false);
    else if(this.current)this.current.stop();
    this.current=action;this.currentKind=kind;
  }
  playOnce(kind,{rate=1,trimStart=0,trimEnd=0}={}){
    const action=this.actions.get(kind)||this.actions.get('wave');
    if(!action){this.play('idle');return false;}
    this.playbackSpeed=Math.max(.85,Math.min(6.5,rate));
    // Replay the same clip, including alternating punches, without inheriting
    // an old crossfade or a paused/clamped playhead.
    if(action===this.current){action.stop();this.current=null;}
    this.play(kind,.09);
    const clipDuration=Math.max(.001,action.getClip().duration||1);
    action.time=clipDuration*Math.max(0,Math.min(.35,trimStart));
    this.oneShotStopAt=clipDuration*(1-Math.max(0,Math.min(.35,trimEnd)));
    action.paused=false;
    action.setLoop(this.THREE.LoopOnce,1);
    action.clampWhenFinished=true;
    this.setPlaybackSpeed(this.playbackSpeed);
    return true;
  }
  setPlaybackSpeed(value=1){this.playbackSpeed=Math.max(.85,Math.min(6.5,Number(value)||1));if(this.current)this.current.setEffectiveTimeScale((this.currentKind==='walkBackward'&&!this.actions.has('walkBackward')&&this.actions.has('walk')?-1:1)*this.playbackSpeed);}
  update(dt){
    this.mixer.update(dt);
    if(this.oneShotStopAt!==null&&this.current&&this.current.time>=this.oneShotStopAt){
      this.current.time=this.oneShotStopAt;this.current.paused=true;
    }
  }
}
