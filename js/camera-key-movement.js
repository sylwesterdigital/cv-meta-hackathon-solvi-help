// Shift + forward/backward couples the free camera's travel and altitude.
// PageUp/PageDown still provide independent altitude adjustment.
export function freeCameraAxes(keys){
 const held=code=>keys.has(code);
 const forward=Number(held('ArrowUp'))-Number(held('ArrowDown'));
 const side=Number(held('ArrowRight'))-Number(held('ArrowLeft'));
 const shift=held('ShiftLeft')||held('ShiftRight');
 const vertical=Number(held('PageUp'))-Number(held('PageDown'))+(shift?forward:0);
 return {forward,side,vertical,boost:shift?2.4:1};
}
