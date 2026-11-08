// The work-session clock belongs to the human assignment, not its individual
// Muse designs or component-save receipts. This module is pure/testable.
export const CREATIVE_SESSION_MAX_DESIGNS=9;
const MINUTE=60_000;
export function creativeSessionDurationMs(goal=''){
 const text=String(goal||'');
 const match=/\b(\d{1,2})\s*(minutes?|mintues?|mins?|hours?|hrs?)\b/i.exec(text);
 if(!match)return 0;
 const amount=Number(match[1]);
 if(!Number.isInteger(amount)||amount<1)return 0;
 const units=match[2].toLowerCase();
 return Math.min(60,amount*(units.startsWith('h')?60:1))*MINUTE;
}
export function creativeSessionDeadline(goal,startedAt){
 const duration=creativeSessionDurationMs(goal);
 return duration&&Number.isFinite(startedAt)&&startedAt>0?Math.round(startedAt+duration):0;
}
export function nextCreativeSlot(goal,deadline,nextIndex,now=Date.now()){
 const duration=creativeSessionDurationMs(goal);
 if(!duration||!Number.isFinite(deadline)||deadline<=0||!Number.isInteger(nextIndex)||nextIndex<1)return 0;
 if(nextIndex>=CREATIVE_SESSION_MAX_DESIGNS)return deadline;
 // Nine distributed designs in the available wall-clock window. Avoid a
 // 180-second scheduler fallback without doing unbounded model calls.
 const target=deadline-duration+Math.round(nextIndex*duration/CREATIVE_SESSION_MAX_DESIGNS);
 return Math.max(now+1000,Math.min(deadline,target));
}
export function creativeSessionStatus({deadline=0,nextAt=0,seriesIndex=0,now=Date.now()}={}){
 if(!deadline)return 'single';
 if(now>=deadline)return 'expired';
 if(seriesIndex>=CREATIVE_SESSION_MAX_DESIGNS-1)return 'budget-wait';
 if(nextAt>now)return 'slot-wait';
 return 'ready';
}
