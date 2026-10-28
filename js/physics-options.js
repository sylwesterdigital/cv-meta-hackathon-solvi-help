export const physicsTypes=['off','dynamic','static','kinematic'];
export function physicsOptions(settings={}){
 const number=(x,f,min,max)=>Number.isFinite(Number(x))?Math.min(max,Math.max(min,Number(x))):f;
 return {mode:physicsTypes.includes(settings?.mode)?settings.mode:'off',friction:number(settings?.friction,.7,0,2),restitution:number(settings?.restitution,.2,0,1)};
}
