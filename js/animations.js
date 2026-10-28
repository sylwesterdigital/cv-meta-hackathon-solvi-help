// Exact Mixamo action matching: "Idle__117780901" != "Falling Idle__118120901".
export const MOTION_ALIASES=Object.freeze({
  idle:['idle','breathing idle','standing idle','standing'],
  walk:['walking','walk','stroll'],
  run:['running','run','sprint','jogging','jog'],
  strafeLeft:['strafe left','left strafe','walk left','side step left'],
  strafeRight:['strafe right','right strafe','walk right','side step right'],
  walkBackward:['walk backwards','walking backwards','backward walk','walk backward'],
  wave:['waving','wave'],
  jump:['jump','jumping']
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
    // Reverse walking means running the *same forward walk clip* backwards,
    // so leg/foot positions rewind instead of playing a separate forward-timed
    // action. Only use a dedicated backward clip when no walk clip exists.
    const reverseWalk=kind==='walkBackward'&&this.actions.has('walk');
    const action=(reverseWalk?this.actions.get('walk'):this.actions.get(kind))||
      (kind.startsWith('strafe')?this.actions.get('walk'):null)||this.actions.get('idle');
    if(!action)return;
    if(action===this.current){
      if(this.currentKind!==kind){
        action.setEffectiveTimeScale(reverseWalk?-1:1);
        action.time=reverseWalk?Math.max(0,action.getClip().duration-.001):0;
        this.currentKind=kind;
      }
      return;
    }
    action.reset().setEffectiveWeight(1).setEffectiveTimeScale(reverseWalk?-1:1).play();
    if(reverseWalk)action.time=Math.max(0,action.getClip().duration-.001);
    action.setLoop(['wave','jump'].includes(kind)?this.THREE.LoopOnce:this.THREE.LoopRepeat,['wave','jump'].includes(kind)?1:Infinity);
    action.clampWhenFinished=['wave','jump'].includes(kind);
    if(this.current&&fade)action.crossFadeFrom(this.current,fade,false);
    else if(this.current)this.current.stop();
    this.current=action;this.currentKind=kind;
  }
  update(dt){this.mixer.update(dt);}
}
