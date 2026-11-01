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
// Very long *real* falls can use a two-stage recovery. Check the GLB's actual
// authored clip names, not aliased fallback actions: "hard landing" might itself
// resolve to Falling Flat Impact, but must never trigger an extra Stand Up.
export const EXTREME_FALL_HEIGHT=8;
// A deliberate jump that lands back at almost the same elevation is a
// continuation of locomotion, NOT a separate Landing clip. This is independent
// of the avatar and of which Mixamo animations happen to exist in its GLB.
export const LEVEL_JUMP_LANDING_TOLERANCE=.35;
export function isLevelJumpLanding({jumpStarted=false,fallHeight=0,fallActive=false}={}){
 return Boolean(jumpStarted)&&!fallActive&&Number.isFinite(Number(fallHeight))&&
  Math.max(0,Number(fallHeight))<=LEVEL_JUMP_LANDING_TOLERANCE;
}
export function jumpResumeMode(data={}){
 const velocity=Number(data.robotVelocity)||0,lateral=Number(data.robotLateral)||0;
 if(velocity<-.35)return 'walkBackward';
 if(velocity>.35)return data.robotJumpReturnMode==='run'&&velocity>1.4?'run':'walk';
 if(lateral>.35)return 'strafeLeft';
 if(lateral<-.35)return 'strafeRight';
 return 'idle';
}
export function landingReactionFor(fallHeight,clipNames=[]){
 const height=Math.max(0,Number(fallHeight)||0);
 const names=clipNames.map(name=>String(name||'').split('__')[0].trim().toLowerCase().replace(/[\s_-]+/g,' '));
 const has=(aliases)=>names.some(name=>aliases.some(alias=>name===alias||name.startsWith(alias+' ')));
 const flat=has(['falling flat impact','fall flat impact']);
 const stand=has(['stand up','standing up','get up','getup']);
 if(height>EXTREME_FALL_HEIGHT&&flat&&stand)return {clip:'fallingImpact',duration:1.35,elapsed:0,next:'standUp'};
 const heavy=height>2.5;
 return {clip:landingAnimationKind(height),duration:heavy?1.25:.58,elapsed:0,next:null};
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

// One-frame character-controller stalls and remote network jitter must not
// reset a looping walk animation to time zero every few strides.
export function continuousGaitMode(data,mode,now){
 const moving=['walk','walkBackward','run','strafeLeft','strafeRight'].includes(mode);
 if(!moving){data.robotGaitStoppedAt=null;return mode;}
 if(Number(data.robotActualSpeed||0)>=.06||data.robotContactAction){data.robotGaitStoppedAt=null;return mode;}
 if(!Number.isFinite(data.robotGaitStoppedAt))data.robotGaitStoppedAt=now;
 // Keep only an already playing gait; never start walking against a wall.
 const playing=data.robotPlaying;
 if(now-data.robotGaitStoppedAt<220&&['walk','walkBackward','run','strafeLeft','strafeRight'].includes(playing))return playing;
 return 'idle';
}
