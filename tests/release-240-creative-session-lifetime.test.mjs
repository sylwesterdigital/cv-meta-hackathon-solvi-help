import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {CREATIVE_SESSION_MAX_DESIGNS,creativeSessionDurationMs,
 creativeSessionDeadline,nextCreativeSlot,creativeSessionStatus} from '../js/robot-creative-session.js';
const app=path.resolve(import.meta.dirname,'..');
const read=rel=>fs.readFileSync(path.join(app,rel),'utf8');
test('human time duration is parsed from both standard and observed misspelling',()=>{
 assert.equal(creativeSessionDurationMs('@all walk around for 15 mintues and build surreal sculptures'),900000);
 assert.equal(creativeSessionDurationMs('@Albert walk for 15 minutes and create art'),900000);
 assert.equal(creativeSessionDurationMs('@Albert construct for 2 hours'),3600000);
 assert.equal(creativeSessionDurationMs('Build a cube 15 metres ahead'),0);
 assert.equal(creativeSessionDurationMs('Just make one pink limo'),0);
 assert.equal(creativeSessionDurationMs('Build for 0 minutes'),0);
});
test('creative session is bound to absolute start and expires regardless of number of completed designs',()=>{
 const goal='@all build sculptures for 15 mintues';
 const start=1_000_000;
 const until=creativeSessionDeadline(goal,start);
 assert.equal(until,1_900_000);
 assert.equal(CREATIVE_SESSION_MAX_DESIGNS,9);
 assert.equal(nextCreativeSlot(goal,until,1,start+25_000),start+100_000);
 assert.equal(nextCreativeSlot(goal,until,2,start+120_000),start+200_000);
 assert.equal(creativeSessionStatus({deadline:until,nextAt:start+100_000,seriesIndex:0,now:start+25_000}),'slot-wait');
 assert.equal(creativeSessionStatus({deadline:until,nextAt:start+100_000,seriesIndex:0,now:start+101_000}),'ready');
 assert.equal(creativeSessionStatus({deadline:until,nextAt:until,seriesIndex:8,now:start+800_000}),'budget-wait');
 assert.equal(creativeSessionStatus({deadline:until,nextAt:until,seriesIndex:8,now:until}),'expired');
 assert.equal(creativeSessionStatus({deadline:0,seriesIndex:0}),'single');
});
test('a completed design checkpoint remains active, persistence retains the last design until next slot',()=>{
 const src=read('js/robot-autonomy.js');
 assert.match(src,/run\.creativeNextAt=nextCreativeSlot\(run\.order\.goal,run\.creativeDeadline,run\.creativeSeriesIndex\+1\)/);
 assert.match(src,/run\.creativeHistory\.push\(\{index:run\.creativeSeriesIndex,ids:run\.creativeBuilt\.map\(p=>p\.id\)\}\)/);
 assert.match(src,/if\(state==='slot-wait'\|\|state==='budget-wait'\)/);
 assert.match(src,/run\.creativeSeriesIndex\+\+;run\.creativePlan=null/);
 assert.match(src,/creativeDeadline:run\.creativeDeadline,creativeNextAt:run\.creativeNextAt,creativeHistory:run\.creativeHistory/);
 assert.match(src,/plan\.action==='creative_build'\|\|run\.localBurst</);
 assert.match(src,/if\(showConstructionGesture\)\{robotAction\(bot,'pickUp'\)/);
 assert.match(src,/TIMED EXPLORATION VERIFIED/);
 assert.match(src,/creativeRoamedIndex:run\.creativeRoamedIndex/);
 assert.match(src,/run\.creativeDeadline=creativeSessionDeadline\(task\.source_text,Date\.parse\(task\.created\|\|''\)\)/);
 assert.match(src,/if\(creativeSessionDurationMs\(goal\)\)run\.creativeDeadline=creativeSessionDeadline\(goal,Date\.now\(\)\)/);
});
test('the backend independently checks group deadline, series tag and actual saved prior parts',()=>{
 const src=read('backend/server.py');
 assert.match(src,/def group_creative_deadline\(task\):/);
 assert.match(src,/Timed group work session is not yet finished/);
 assert.match(src,/if outcome=='completed' and task\['kind'\] in \('creative_build','named_creative_build'\):\n\s+deadline=group_creative_deadline\(task\)/);
 assert.match(src,/if deadline and series and len\(history\)!=series/);
 assert.match(src,/suffix=':series'\+str\(series\) if series else ''/);
 assert.match(src,/if type\(stored\.get\('creativeSeriesIndex',0\)\) is not int or not 0<=stored\.get\('creativeSeriesIndex',0\)<=8/);
});
