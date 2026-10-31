// Per-avatar gait tuning. Deliberately independent from physical movement speed.
export const DEFAULT_ANIMATION_SPEED=Object.freeze({walk:1,run:1,jump:1});
export function animationSpeedSettings(raw){
 const result={};
 for(const name of Object.keys(DEFAULT_ANIMATION_SPEED)){
  const value=Number(raw?.[name]);
  result[name]=Number.isFinite(value)&&value>=.35&&value<=2?value:1;
 }
 return result;
}
export function jumpAnimationKind({moving=false,available=[]}={}){
 // The default GLB has Jump but not Jumping; use that as a safe fallback.
 return moving&&available.includes('jump')?'jump':available.includes('jumping')?'jumping':'jump';
}
export function landingClipFor(kind,available=[]){
 if(kind!=='landing'&&kind!=='hardLanding')return kind;
 if(available.includes(kind))return kind;
 if(kind==='landing')return available.includes('jump')?'jump':available.includes('fallingLanding')?'fallingLanding':'idle';
 return available.includes('fallingImpact')?'fallingImpact':available.includes('dying')?'dying':'idle';
}
export function landingAnimationKind(fallHeight){
 return Number(fallHeight)>2.5?'hardLanding':'landing';
}
// Native Mixamo walk/run clips already loop at an authored, seamless cadence.
// Adjust only slightly for movement differences: never 1.5x-2.3x by default.
export function gaitCadence(speed,mode,walkPhysicalSpeed=2.16){
 const normal=mode==='run'?Math.max(2,walkPhysicalSpeed*2.8):Math.max(.4,walkPhysicalSpeed);
 const ratio=Math.max(.65,Math.min(1.35,(Number(speed)||0)/normal));
 return .85+.15*ratio;
}
// A Rapier autostep is an instant collider rise. Offset only the rendered
// skeleton while it eases up, retaining the precise physical collision pose.
export function easedStepOffset(previousOffset,rise,grounded,jumping,dt){
 let offset=Number(previousOffset)||0;
 if(grounded&&!jumping&&rise>.018&&rise<.38)offset-=rise;
 return Math.max(-.35,Math.min(0,offset))*Math.exp(-Math.max(0,Math.min(dt,.06))*12);
}
