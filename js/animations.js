// Exact Mixamo action matching: "Idle__117780901" != "Falling Idle__118120901".
export const MOTION_ALIASES=Object.freeze({
  idle:['idle','breathing idle','standing idle','standing'],
  walk:['walking','walk','stroll'],
  run:['running','run','sprint','jogging','jog'],
  wave:['waving','wave']
});
export function clipBase(name){return String(name||'').split('__')[0].trim().toLowerCase().replace(/[\s_-]+/g,' ');}
export function findClip(clips,kind){
  const aliases=MOTION_ALIASES[kind]||[kind.toLowerCase()];
  for(const name of aliases){const match=clips.find(clip=>clipBase(clip.name)===name);if(match)return match;}
  // Only accept label prefixes, never a substring (e.g. "Falling Idle").
  for(const name of aliases){const match=clips.find(clip=>clipBase(clip.name).startsWith(name+' '));if(match)return match;}
  return null;
}
export function computeMode(speed){return speed<.05?'idle':speed<2?'walk':'run';}
export class MotionController{
  constructor(THREE,root,clips){
    this.THREE=THREE;this.mixer=new THREE.AnimationMixer(root);
    this.actions=new Map();this.current=null;this.currentKind=null;
    for(const kind of Object.keys(MOTION_ALIASES)){
      const clip=findClip(clips,kind);
      if(clip)this.actions.set(kind,this.mixer.clipAction(clip));
    }
    this.play('idle',0);
  }
  play(kind,fade=.25){
    const action=this.actions.get(kind)||this.actions.get('idle');
    if(!action||action===this.current)return;
    action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
    action.setLoop(kind==='wave'?this.THREE.LoopOnce:this.THREE.LoopRepeat,kind==='wave'?1:Infinity);
    action.clampWhenFinished=kind==='wave';
    if(this.current&&fade)action.crossFadeFrom(this.current,fade,true);
    else if(this.current)this.current.stop();
    this.current=action;this.currentKind=kind;
  }
  update(dt){this.mixer.update(dt);}
}
