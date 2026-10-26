// Clip aliases tolerate Mixamo names, suffixes and case differences.
export const MOTION_ALIASES = Object.freeze({
  idle: [/^idle\b/i, /idle/i, /breathing/i, /standing/i, /rest/i],
  walk: [/^walk/i, /walking/i, /stroll/i],
  run: [/^run/i, /running/i, /sprint/i, /jog/i],
  wave: [/waving/i, /wave/i],
});
export function findClip(clips, kind) {
  const patterns = MOTION_ALIASES[kind] || [new RegExp(kind,'i')];
  return patterns.map((re) => clips.find((clip) => re.test(clip.name))).find(Boolean) || null;
}
export function computeMode(speed) {
  if (speed < 0.05) return 'idle';
  return speed < 2.0 ? 'walk' : 'run';
}
export class MotionController {
  constructor(THREE, root, clips) {
    this.THREE = THREE; this.root = root;
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = new Map(); this.current = null;
    for (const kind of Object.keys(MOTION_ALIASES)) {
      const clip = findClip(clips, kind);
      if (clip) this.actions.set(kind, this.mixer.clipAction(clip));
    }
    this.play('idle', 0);
  }
  play(kind, fade=0.28) {
    const next = this.actions.get(kind) || this.actions.get('idle');
    if (!next || next === this.current) return;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
    if (kind === 'wave') { next.setLoop(this.THREE.LoopOnce,1); next.clampWhenFinished = false; }
    else { next.setLoop(this.THREE.LoopRepeat,Infinity); next.clampWhenFinished = false; }
    if (this.current && fade) next.crossFadeFrom(this.current,fade,true);
    else if (this.current) this.current.stop();
    this.current=next;
  }
  update(delta) {this.mixer.update(delta);}
}
