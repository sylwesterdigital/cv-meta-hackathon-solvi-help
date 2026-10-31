// Text settings are stored with each scene object, not in local UI state.
export const TEXT_FONTS=['helvetiker','optimer','gentilis'];
export function cleanText(input={}){
 const o=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 const num=(key,defaultValue,min,max)=>{const n=Number(o[key]);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):defaultValue;};
 return {content:typeof o.content==='string'?o.content.slice(0,180):'SOLVI',
  font:TEXT_FONTS.includes(o.font)?o.font:'helvetiker',
  size:num('size',.6,.05,12),
  extrude:num('extrude',.08,0,2),
  bevel:num('bevel',.005,0,.2)};
}
