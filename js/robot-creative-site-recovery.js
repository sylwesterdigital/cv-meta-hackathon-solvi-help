// Bounded, realm-local recovery from unavailable procedural build sites.
// A blocked position is not evidence that the robot should repeat the same
// failed placement every 8 seconds. No relocation is ever simulated here:
// an actual collision-checked recover_route tool must confirm arrival.
export function creativeSiteRecovery({y=0,scouts=0,failures=0,now=Date.now()}={}){
 const count=Math.max(0,Math.min(10,Math.trunc(Number(failures)||0)));
 const attempts=Math.max(0,Math.min(2,Math.trunc(Number(scouts)||0)));
 if(!Number.isFinite(y)||Math.abs(y)>.85)return {
  action:'defer',retryAt:now+120000,
  reason:'Robot is on an upper level or its floor is unverified; do not build on a different level or teleport. A verified ground-floor route is required.'
 };
 if(attempts<2)return {action:'scout',retryAt:now+1500,
  reason:'Try a different physically reachable location with collision-checked navigation before repeating the same build site.'};
 return {action:'defer',retryAt:now+Math.min(180000,45000*2**Math.min(2,count)),
  reason:'Two verified relocation attempts did not provide a clear site. Wait for a changed scene or a new operator destination.'};
}
