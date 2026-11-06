// v0.2.192: bounded, deterministic recovery strategy. A model can propose
// tools, but the runtime owns actual state, retries and completion evidence.
import {houseGoal} from './robot-construction-api.js';
// Per-account settings are fetched from the authenticated server, not buried in a retry loop.
// Defaults are intentionally short; only the failing model call backs off.
export const META_RECOVERY_MIN_MS=30000;
export const META_RECOVERY_MAX_MS=120000;
export function metaRetryDelay(failures=1,settings={}){
 const base=Math.max(15000,Math.min(600000,Number(settings.retrySeconds)||30)*1000);
 const cap=Math.max(base,Math.min(600000,Number(settings.maxRetrySeconds)||120)*1000);
 return Math.min(cap,base*2**Math.min(5,Math.max(0,Math.floor(failures)-1)));
}
export function canCleanupGoal(text=''){
 return /\b(?:can|cans)\b/i.test(text)&&/\b(?:clear|clean|empty|dispose|pick\s*up|drink|recycl|bin)\b/i.test(text)&&/\b(?:table|home|house|bin)\b/i.test(text);
}
export function chatCanCleanupInstruction(text='',robotName=''){
 const message=String(text||'').trim().slice(0,1800);
 if(!robotName||!message.toLowerCase().startsWith('@'+robotName.toLowerCase()+' '))return null;
 return canCleanupGoal(message)?message:null;
}
// Small, grounded construction sequences when planning is offline. These are
// proposals only: the editor still validates the worksite and every scene edit.
export function localProjectSequence(goal=''){
 if(/\b(picnic|party area|outdoor dining)\b/i.test(goal))return ['table','chair','chair','bottle'];
 if(/\b(park|parks|garden|playground|playgrounds|public square)\b/i.test(goal))return ['table','chair','chair','stool'];
 return [];
}
export function requestedHomeCount(goal=''){
 return /\b(houses|homes|cabins)\b/i.test(goal)&&houseGoal(goal)?2:houseGoal(goal)?1:0;
}
// Chat may *start* a local work order only for an unambiguous, direct @all
// construction instruction from the person who just submitted the message.
// Broad creative conversation and robot replies must never trigger mutation.
export function chatConstructionInstruction(text=''){
 const message=String(text||'').slice(0,1800);
 if(!/(?<![\p{L}\p{N}_])@all\b/iu.test(message))return null;
 if(!houseGoal(message)&&!localProjectSequence(message).length)return null;
 const direct=/\b(?:start|begin|please|now)\s+(?:[\w-]+\s+){0,4}(?:build|building|construct|constructing|create|creating)\b/i.test(message)||
   /\b(?:build|construct|create|make)\s+(?:some\s+|new\s+|more\s+|a\s+|an\s+)?(?:homes?|houses?|cabins?|parks?|picnic\s+(?:area|spot))\b/i.test(message);
 return direct?message:null;
}
export function workRecoveryPlan({goal='',allowChanges=false,house=null,existingHouse=false,peerId='',attempts={},hasSeat=false,invitationTargets=[],contactTargets=[],placedSupplies=0,projectPlaced=[],completedHouses=[]}={}){
 if(canCleanupGoal(goal))return {action:'cleanup_cans',reason:'Perform the assigned can collection using the existing inventory and bin tools'};
 const construction=houseGoal(goal);
 const hospital=/\b(hospital|clinic)\b/i.test(goal);
 const party=/\b(invite|invitation|opening party|celebrat)\b/i.test(goal);
 const supplies=/\b(bottles?|cans?|drinks?|refreshments?)\b/i.test(goal);
 const count=action=>Math.max(0,Number(attempts[action])||0);
 const homeTarget=requestedHomeCount(goal);
 const installed=new Set(projectPlaced.map(entry=>entry?.id).filter(Boolean));
 const sequence=localProjectSequence(goal);
 const counts=new Map();
 for(const entry of projectPlaced)if(entry?.id&&entry?.variant)counts.set(entry.variant,(counts.get(entry.variant)||0)+1);
 const remainingProject=[];
 for(const variant of sequence){const n=counts.get(variant)||0;
  if(n)counts.set(variant,n-1);else remainingProject.push(variant);
 }

 // Multi-stage instructions like 'find @Elox and build with him' require
 // a verified visit/contact BEFORE the construction stage. Party invitations
 // are different: they happen after the building exists.
 if(contactTargets.length&&count('ask')<Math.max(3,contactTargets.length+1))
  return {action:'ask',target_id:contactTargets[0].id,
   message:'I was asked to meet you about a shared project. Here is the goal: '+goal.slice(0,150)+'. Can you take a concrete next step in your own authorised work order?',
   reason:'Meet the named colleague and communicate the assigned project before building'};
 // Reuse an existing house first; run the same tool to rehydrate its scene IDs.
 if(construction&&allowChanges&&!house&&completedHouses.length<homeTarget&&count('build_house')<8)
  return {action:'build_house',reason:existingHouse?'Resume the existing building before doing more work':'Construct the explicitly requested building before optional research or chat'};
 if(construction&&allowChanges&&house?.missing?.length&&count('build_house')<8)
  return {action:'build_house',reason:'Finish missing furniture inside the existing structure'};
 if(construction&&house?.inspectionFailed&&count('site_check')<3)
  return {action:'site_check',reason:'Make one alternative exterior visit before reporting the navigation blocker'};
 if(construction&&house&&supplies&&allowChanges&&placedSupplies<4&&count('build')<4)
  return {action:'build',variant:placedSupplies%2?'can':'bottle',reason:'Place the requested drink props; they are cosmetic, not medical supplies'};
 if(construction&&house&&party&&invitationTargets.length&&count('ask')<Math.max(2,invitationTargets.length+1))
  return {action:'ask',target_id:invitationTargets[0].id,message:'The building is ready for inspection. Would you like to visit the opening? Here is what remains unfinished.',reason:'Invite the next named colleague to see the work'};
 // Build small community areas in verified, bounded steps even when Meta
 // cannot answer. No playground equipment or landscaping is fabricated.
 if(!construction&&allowChanges&&remainingProject.length&&count('build')<8)
  return {action:'build',variant:remainingProject[0],project:true,
   reason:`Place ${remainingProject[0]} (${installed.size+1}/${sequence.length}) for the requested community area`};
 // Research is optional and never replaces an authorized build. Lookups do
 // not advance any construction milestone. Avoid repeated low-value articles.
 if(construction&&count('research')===0&&(!allowChanges||(!house&&count('build_house')>0)))
  return {action:'research',reason:'Check a relevant reference once because direct construction is unavailable'};
 if(peerId&&!construction&&!sequence.length&&count('ask')===0)
  return {action:'ask',target_id:peerId,message:'Can you help with a specific unresolved scene task? My current blocker is recorded in the work order.',reason:'Ask a colleague about a concrete blocker'};
 if(!construction&&!sequence.length&&count('rest')===0&&(hasSeat||allowChanges))
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
