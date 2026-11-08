import {validCreativeBuild} from './creative-build-preset.js';
import {validPortalPairPreset} from './portal-preset-data.js';
// Shared, side-effect-free schema for reproducible procedural-object presets.
const TYPES=new Set(['portalPair','furniture','cube','sphere','cylinder','plane','torus','amorphous','surface','curve','text','ladder','stairs','wall']);
const NATURE=new Set(['tree','shrub','vegetationArea','groundPlot','cropBed','waterPatch']);
const INFRASTRUCTURE=new Set(['infrastructure']);
const TOOLS=new Set(['shovel','axe','rake','stick','broom','mop','saw']);
const PROPS=new Set(['plate','mug','glass','bowl','bottle','can','flowerpot','box']);
export function canPreset(entry){if(entry?.kind==='creativeBuild')return validCreativeBuild(entry);return !!entry&&TYPES.has(entry.kind)&&(entry.kind!=='portalPair'||validPortalPairPreset(entry))&&!(entry.kind==='stairs'&&entry.stairs?.variant==='lift')&&entry.texture!=='custom';}
export function presetCategory(entry){if(entry.kind==='creativeBuild')return 'Creative Builds';return entry.kind==='portalPair'?'Architecture':entry.kind==='furniture'?(TOOLS.has(entry.furniture?.variant)?'Tools':NATURE.has(entry.furniture?.variant)?'Nature':INFRASTRUCTURE.has(entry.furniture?.variant)?'Architecture':PROPS.has(entry.furniture?.variant)?'Props':'Furniture'):['ladder','stairs','wall'].includes(entry.kind)?'Architecture':'Geometry';}
export function presetEntry(entry){
 if(!canPreset(entry))return null;
 if(entry.kind==='creativeBuild')return {kind:'creativeBuild',parts:structuredClone(entry.parts)};
 const keys=['kind','name','rotation','scale','color','texture','physics','pickable','inventory','followHandRotation','climbable','primitive','curve','text','openings','stairs','ladder','furniture','wall','entry','exit'];
 const copy={};for(const key of keys)if(entry[key]!==undefined)copy[key]=structuredClone(entry[key]);
 return copy;
}
