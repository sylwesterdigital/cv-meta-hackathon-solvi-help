// Shift+Up/Down is a pure vertical camera action; it must not also move forward.
// PageUp/Down remain independent vertical controls.
export function freeCameraAxes(keys){
 const held=code=>keys.has(code);
 const shift=held('ShiftLeft')||held('ShiftRight');
 const arrowVertical=Number(held('ArrowUp'))-Number(held('ArrowDown'));
 return {
  forward:shift?0:arrowVertical,
  side:Number(held('ArrowRight'))-Number(held('ArrowLeft')),
  vertical:Number(held('PageUp'))-Number(held('PageDown'))+(shift?arrowVertical:0),
  boost:shift?2.4:1
 };
}
