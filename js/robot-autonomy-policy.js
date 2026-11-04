// v0.2.189: bounded, deterministic recovery strategy. A model can propose
// tools, but the runtime owns actual state, retries and completion evidence.
import {houseGoal} from './robot-construction-api.js';
export const META_RECOVERY_MIN_MS=180000;
export const META_RECOVERY_MAX_MS=1800000;
export function metaRetryDelay(failures=1){
 return Math.min(META_RECOVERY_MAX_MS,META_RECOVERY_MIN_MS*2**Math.min(4,Math.max(0,Math.floor(failures)-1)));
}
export function workRecoveryPlan({goal='',allowChanges=false,house=null,existingHouse=false,peerId='',attempts={},hasSeat=false,invitationTargets=[],contactTargets=[],placedSupplies=0}={}){
 const construction=houseGoal(goal);
 const hospital=/\b(hospital|clinic)\b/i.test(goal);
 const party=/\b(invite|invitation|opening party|celebrat)\b/i.test(goal);
 const supplies=/\b(bottles?|cans?|drinks?|refreshments?)\b/i.test(goal);
 const count=action=>Math.max(0,Number(attempts[action])||0);
 // Multi-stage instructions like 'find @Elox and build with him' require
 // a verified visit/contact BEFORE the construction stage. Party invitations
 // are different: they happen after the building exists.
 if(contactTargets.length&&count('ask')<Math.max(3,contactTargets.length+1))
  return {action:'ask',target_id:contactTargets[0].id,
   message:'I was asked to meet you about a shared project. Here is the goal: '+goal.slice(0,150)+'. Can you take a concrete next step in your own authorised work order?',
   reason:'Meet the named colleague and communicate the assigned project before building'};
 // Reuse an existing house first; run the same tool to rehydrate its scene IDs.
 if(construction&&allowChanges&&!house&&count('build_house')===0)
  return {action:'build_house',reason:existingHouse?'Resume the existing building before doing more work':'Construct the explicitly requested building before optional research or chat'};
 if(construction&&house?.missing?.length&&count('build_house')<4)
  return {action:'build_house',reason:'Finish missing furniture inside the existing structure'};
 if(construction&&house?.inspectionFailed&&count('site_check')<2)
  return {action:'site_check',reason:'Make one alternative exterior visit before reporting the navigation blocker'};
 if(construction&&house&&supplies&&allowChanges&&placedSupplies<4&&count('build')<4)
  return {action:'build',variant:placedSupplies%2?'can':'bottle',reason:'Place the requested drink props; they are cosmetic, not medical supplies'};
 if(construction&&house&&party&&invitationTargets.length&&count('ask')<Math.max(2,invitationTargets.length+1))
  return {action:'ask',target_id:invitationTargets[0].id,message:'The building is ready for inspection. Would you like to visit the opening? Here is what remains unfinished.',reason:'Invite the next named colleague to see the work'};
 // Research is optional and never replaces an authorized build. Lookups do
 // not advance any construction milestone. Avoid repeated low-value articles.
 if(construction&&count('research')===0&&(!allowChanges||(!house&&count('build_house')>0)))
  return {action:'research',reason:'Check a relevant reference once because direct construction is unavailable'};
 if(peerId&&count('ask')===0)
  return {action:'ask',target_id:peerId,message:'Can you help with a specific unresolved scene task? My current blocker is recorded in the work order.',reason:'Ask a colleague about a concrete blocker'};
 if(count('rest')===0&&(hasSeat||allowChanges))
  return {action:'rest',reason:'Take a bounded rest while a blocked operation waits for a new capability'};
 return {action:'idle',reason:'No safe useful step available; preserve blockers and wait for change instead of looping on research'};
}
export function projectOutcome({house=null,goal='',invitations=[],invitationsRequired=[],contacts=[],contactsRequired=[],placedSupplies=0,suppliesRequired=0}={}){
 if(!house)return {done:false,blockers:['No verified project has been created']};
 const blockers=[];
 if(house.missing?.length)blockers.push('missing: '+house.missing.join(', '));
 if(house.inspectionFailed)blockers.push('site inspection: '+house.inspectionFailed);
 if(suppliesRequired>placedSupplies)blockers.push('party supplies: '+(suppliesRequired-placedSupplies)+' drink props not placed');
 const missingContacts=contactsRequired.filter(id=>!contacts.includes(id));
 if(missingContacts.length)blockers.push('project collaboration: '+missingContacts.length+' named colleagues not contacted');
 const pending=invitationsRequired.filter(id=>!invitations.includes(id));
 if(pending.length)blockers.push('invitations: '+pending.length+' colleagues not contacted');
 if(/\b(hospital|clinic|medicine|medication|sick)\b/i.test(goal))
  blockers.push('hospital services, patient care and medicine are not implemented as robot tools');
 return {done:!blockers.length,blockers};
}
