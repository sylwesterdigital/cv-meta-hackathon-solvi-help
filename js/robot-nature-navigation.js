// v0.2.228 — Procedural ground is support, not a single giant wall.
// The forest owns an instanced planting area, but its individual stems are the
// only reasonable planar walking obstructions. Construction remains stricter.
import {scatterVegetationPositions,cleanVegetation} from './procedural-vegetation.js';
export const WALKABLE_NATURE_AREAS=Object.freeze(['vegetationArea','groundPlot','cropBed']);
export function natureNavigationFootprints(config={},toWorld=(x,z)=>({x,z}),identity={},height=0){
 if(!WALKABLE_NATURE_AREAS.includes(config?.variant))return null;
 if(config.variant!=='vegetationArea')return [];
 const p=cleanVegetation(config),obstacles=[];
 for(const plant of scatterVegetationPositions(p)){
  if(plant.kind!=='tree')continue; // low brush and grass remain walkable
  const center=toWorld(plant.x,plant.z);
  if(![center?.x,center?.z].every(Number.isFinite))continue;
  // Only trunks near the feet plane block travel; leafy canopies do not.
  const scale=Number.isFinite(center.scale)?Math.abs(center.scale):1;
  const radius=Math.min(.65,Math.max(.13,(p.trunkRadius||.18)*plant.scale*scale+.08));
  obstacles.push({minX:center.x-radius,maxX:center.x+radius,
   minZ:center.z-radius,maxZ:center.z+radius,kind:'tree-trunk',
   name:(identity.name||'Forest')+' tree',id:identity.id});
 }
 return obstacles;
}
