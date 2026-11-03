// Shared, side-effect-free schema for reproducible procedural-object presets.
const TYPES=new Set(['furniture','cube','sphere','cylinder','plane','torus','surface','curve','text','ladder','stairs']);
const NATURE=new Set(['tree','shrub','vegetationArea','groundPlot','cropBed']);
const PROPS=new Set(['plate','mug','glass','bowl','bottle','can','flowerpot','box']);
export function canPreset(entry){return !!entry&&TYPES.has(entry.kind)&&!(entry.kind==='stairs'&&entry.stairs?.variant==='lift')&&entry.texture!=='custom';}
export function presetCategory(entry){return entry.kind==='furniture'?(NATURE.has(entry.furniture?.variant)?'Nature':PROPS.has(entry.furniture?.variant)?'Props':'Furniture'):['ladder','stairs'].includes(entry.kind)?'Architecture':'Geometry';}
export function presetEntry(entry){
 if(!canPreset(entry))return null;
 const keys=['kind','name','rotation','scale','color','texture','physics','pickable','inventory','followHandRotation','climbable','primitive','curve','text','openings','stairs','ladder','furniture'];
 const copy={};for(const key of keys)if(entry[key]!==undefined)copy[key]=structuredClone(entry[key]);
 return copy;
}
