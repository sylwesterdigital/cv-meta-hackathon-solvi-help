// v0.2.192: bounded, deterministic recovery strategy. A model can propose
// tools, but the runtime owns actual state, retries and completion evidence.
import {houseGoal} from './robot-construction-api.js';
import {roomFurnishingSequence,nextRoomFurnishing} from './robot-room-furnishing.js';
// Per-account settings are fetched from the authenticated server, not buried in a retry loop.
// Defaults are intentionally short; only the failing model call backs off.
export const META_RECOVERY_MIN_MS=30000;
export const META_RECOVERY_MAX_MS=120000;
export function metaRetryDelay(failures=1,settings={}){
 const base=Math.max(15000,Math.min(600000,Number(settings.retrySeconds)||30)*1000);
 const cap=Math.max(base,Math.min(600000,Number(settings.maxRetrySeconds)||120)*1000);
 return Math.min(cap,base*2**Math.min(5,Math.max(0,Math.floor(failures)-1)));
}
// Collection of loose procedural boxes into one specifically named junk bin.
// This is intentionally distinct from the drink-can/table cleanup operation.
export function boxCleanupGoal(text=''){
 const goal=String(text||'');
 return /\b(?:boxes|box\s+copies)\b/i.test(goal)&&
  /\b(?:bin|junk)\b/i.test(goal)&&
  /\b(?:put|move|store|collect|clear|sweep|tidy|pick\s*up|dispose)\b/i.test(goal);
}
export function chatBoxCleanupInstruction(text='',robotName=''){
 const message=String(text||'').trim().slice(0,1800);
 if(!robotName||!message.toLowerCase().startsWith('@'+robotName.toLowerCase()+' '))return null;
 return boxCleanupGoal(message)?message:null;
}
export function canCleanupGoal(text=''){
 return /\b(?:cans|can(?!\s+(?:you|we|i|they|he|she|it)\b))\b/i.test(text)&&/\b(?:clear|clean|empty|dispose|pick\s*up|drink|recycl|bin)\b/i.test(text)&&/\b(?:table|home|house|bin)\b/i.test(text);
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
 return !houseGoal(goal)?roomFurnishingSequence(goal):[];
}
export function requestedHomeCount(goal=''){
 if(!houseGoal(goal))return 0;
 if(/\b(?:array|row|series|three|3)\b/i.test(goal)&&/\b(?:houses?|homes?|cabins?)\b/i.test(goal))return 3;
 return /\b(houses|homes|cabins)\b/i.test(goal)?2:1;
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

// Explicit, robot-addressed construction is different from friendly discussion.
// This is used ONLY after the human's authenticated message is already saved;
// editor permission is still checked again before any scene mutation.
export function chatNamedConstructionInstruction(text='',robotName=''){
 const name=String(robotName||'').trim();
 if(!name||!/^@[\p{L}\p{N}_-]+(?:[\s,:]|$)/u.test(String(text||'')))return null;
 const message=String(text||'').trim().slice(0,1800);
 const mention=/^@([\p{L}\p{N}_-]+)(?:[\s,:]|$)/u.exec(message);
 if(!mention||mention[1].toLowerCase()!==name.toLowerCase())return null;
 const command=message.slice(mention[0].length).trim();
 if(!houseGoal(command)&&!localProjectSequence(command).length)return null;
 if(!/^(?:(?:please|hey|now|go for it|kindly|actually|just)\s+)*?(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?(?:start\s+|begin\s+|go\s+and\s+)?(?:build|construct|create|make|furnish)\b/i.test(command))return null;
 return message;
}

export function workRecoveryPlan({goal='',allowChanges=false,house=null,existingHouse=false,peerId='',attempts={},hasSeat=false,invitationTargets=[],contactTargets=[],placedSupplies=0,projectPlaced=[],projectDeferred=[],completedHouses=[],retryBudget=8}={}){
 if(boxCleanupGoal(goal))return {action:'cleanup_boxes',reason:'Collect explicitly named procedural boxes into the matching junk bin; skip blocked objects and retry them later'};
 if(canCleanupGoal(goal))return {action:'cleanup_cans',reason:'Perform the assigned can collection using the existing inventory and bin tools'};
 const construction=houseGoal(goal);
 if(construction&&!allowChanges)return {action:'idle',reason:'SCENE CHANGES DISABLED: this work order cannot create buildings. Enable Allow scene changes for the authorised robot in Work orders; Meta retries will not fix this.'};
 const hospital=/\b(hospital|clinic)\b/i.test(goal);
 const party=/\b(invite|invitation|opening party|celebrat)\b/i.test(goal);
 const supplies=/\b(bottles?|cans?|drinks?|refreshments?)\b/i.test(goal);
 const count=action=>Math.max(0,Number(attempts[action])||0);
 const homeTarget=requestedHomeCount(goal);
 const houseRetryLimit=Math.max(2,Math.min(8,retryBudget))+4*Math.min(2,count('site_scout'));
 const installed=new Set(projectPlaced.map(entry=>entry?.id).filter(Boolean));
 const sequence=localProjectSequence(goal);
 const roomSequence=!construction?roomFurnishingSequence(goal):[];
 const roomNext=nextRoomFurnishing(roomSequence,projectPlaced,projectDeferred);
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
 if(construction&&allowChanges&&!house&&completedHouses.length<homeTarget&&count('build_house')<houseRetryLimit)
  return {action:'build_house',reason:existingHouse?'Resume the existing building before doing more work':'Construct the explicitly requested building before optional research or chat'};
 if(construction&&allowChanges&&house?.missing?.length&&count('build_house')<houseRetryLimit)
  return {action:'build_house',reason:'Finish missing furniture inside the existing structure'};
 // Spend a bounded, collision-checked relocation attempt before declaring an
 // empty construction worksite impossible. Each successful scout earns at
 // most four further ordinary placement trials; no infinite reset loop.
 if(construction&&allowChanges&&!house&&completedHouses.length<homeTarget&&
    count('build_house')>=houseRetryLimit&&count('site_scout')<2)
  return {action:'site_scout',reason:`The last ${count('build_house')} house-placement attempts did not find a usable site. Try a 15 m collision-checked retreat and random reorientation, then resurvey.`};
 if(construction&&house?.inspectionFailed&&count('site_check')<3)
  return {action:'site_check',reason:'Make one alternative exterior visit before reporting the navigation blocker'};
 if(construction&&house&&supplies&&allowChanges&&placedSupplies<4&&count('build')<4)
  return {action:'build',variant:placedSupplies%2?'can':'bottle',reason:'Place the requested drink props; they are cosmetic, not medical supplies'};
 if(construction&&house&&party&&invitationTargets.length&&count('ask')<Math.max(2,invitationTargets.length+1))
  return {action:'ask',target_id:invitationTargets[0].id,message:'The building is ready for inspection. Would you like to visit the opening? Here is what remains unfinished.',reason:'Invite the next named colleague to see the work'};
 // When a single furnishing placement is blocked, try the next item and revisit
 // deferred ones. This is a separate executable tool, not a house retry.
 if(roomSequence.length&&allowChanges){
  if(roomNext.done)return {action:'idle',reason:'GOAL REACHED: all requested room furnishings have saved scene-object IDs'};
  if(roomNext.variant)return {action:'furnish_room',variant:roomNext.variant,reason:'Place the requested '+roomNext.variant+' on an inspected room floor'};
  return {action:'idle',reason:'FURNISHING DEFERRED: no free interior footprint yet; retry after '+new Date(roomNext.nextRetryAt).toISOString()};
 }
 // Build small community areas in verified, bounded steps even when Meta
 // cannot answer. No playground equipment or landscaping is fabricated.
 if(!construction&&allowChanges&&remainingProject.length&&count('build')<Math.max(2,Math.min(8,retryBudget)))
  return {action:'build',variant:remainingProject[0],project:true,
   reason:`Place ${remainingProject[0]} (${installed.size+1}/${sequence.length}) for the requested community area`};
 if(construction&&completedHouses.length>=homeTarget&&homeTarget>0&&!house?.missing?.length&&!house?.inspectionFailed)
  return {action:'idle',reason:`GOAL REACHED: ${completedHouses.length}/${homeTarget} requested house shells verified. New homes require a new direct work order.`};
 if(construction&&allowChanges&&!house&&completedHouses.length<homeTarget&&
    count('site_scout')>=2&&count('build_house')>=houseRetryLimit)
  return {action:'idle',reason:'SITE SEARCH EXHAUSTED: two collision-checked relocations and the permitted placement attempts could not find an open building footprint. The goal is preserved; choose another open region or modify the house dimensions.'};
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

// Optional user preference for a FOLLOWING house, never a blocker for work.
export function namedRoofChoice(text='',robotName=''){
 const name=String(robotName||'').trim(),message=String(text||'').trim();
 const match=/^@([\p{L}\p{N}_-]+)(?:[,\s:]+)(.+)$/u.exec(message);
 if(!match||!name||match[1].toLowerCase()!==name.toLowerCase())return null;
 const choices=[...match[2].toLowerCase().matchAll(/\b(flat|shed|pyramid)\s+(?:style\s+)?roof\b|\broof\s+(flat|shed|pyramid)\b/g)];
 return choices.length===1?choices[0][1]||choices[0][2]:null;
}
