// v0.2.184: bounded, deterministic recovery strategy. A model can propose
// tools, but the runtime owns actual state, retries and completion evidence.
import {houseGoal} from './robot-construction-api.js';
export const META_RECOVERY_MIN_MS=180000;
export const META_RECOVERY_MAX_MS=1800000;
export function metaRetryDelay(failures=1){
 return Math.min(META_RECOVERY_MAX_MS,META_RECOVERY_MIN_MS*2**Math.min(4,Math.max(0,Math.floor(failures)-1)));
}
export function workRecoveryPlan({goal='',allowChanges=false,house=null,existingHouse=false,peerId='',attempts={},hasSeat=false}={}){
 const construction=houseGoal(goal);
 const count=action=>Math.max(0,Number(attempts[action])||0);
 if(construction&&allowChanges&&!house&&!existingHouse&&count('build_house')===0)
  return {action:'build_house',reason:'Explicit unfinished house objective; one verified construction attempt'};
 if(construction&&house?.missing?.length&&count('build_house')<3)
  return {action:'build_house',reason:'Resume missing furniture in the same house, never create a duplicate'};
 if(construction&&house?.inspectionFailed&&count('site_check')<2)
  return {action:'site_check',reason:'Retry inspecting the same construction site once before changing jobs'};
 if(construction&&count('research')===0)
  return {action:'research',reason:'Study relevant construction background before choosing another useful step'};
 if(peerId&&count('ask')===0)
  return {action:'ask',target_id:peerId,message:'What practical help do you need? I can share my construction progress and unfinished work.',reason:'Ask a colleague about another concrete task'};
 if(count('rest')===0&&(hasSeat||allowChanges))
  return {action:'rest',reason:'Use an existing seat for a short rest after work or an unresolved blocker'};
 return {action:'idle',reason:'No safe untried tool available. Pause repeated actions, record blockers and retry planning later.'};
}
export function projectOutcome({house=null,goal=''}={}){
 if(!house)return {done:false,blockers:['No verified project has been created']};
 const blockers=[];
 if(house.missing?.length)blockers.push('missing: '+house.missing.join(', '));
 if(house.inspectionFailed)blockers.push('site inspection: '+house.inspectionFailed);
 if(/\b(hospital|clinic|medicine|medication|sick)\b/i.test(goal))
  blockers.push('hospital services, patient care and medicine are not implemented as robot tools');
 return {done:!blockers.length,blockers};
}
