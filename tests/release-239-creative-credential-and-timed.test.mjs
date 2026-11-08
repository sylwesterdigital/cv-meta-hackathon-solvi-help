import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {addressedCreativeRobot} from '../js/robot-creative-design.js';
const base=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(base,file),'utf8');
const workers=[{id:'robot-id-A',name:'Albert',kind:'robot'},{id:'robot-id-V',name:'Viola',kind:'robot'}];
test('human combined walk plus build instruction stays an executable named creative project',()=>{
 const input='@Albert walk around for 15 minutes and build some abstract figures from the cubes';
 const selected=addressedCreativeRobot(input,workers);
 assert.equal(selected?.robotId,'robot-id-A');assert.equal(selected?.goal,input);
 assert.equal(addressedCreativeRobot('@Viola please create a pink sphere',workers)?.robotId,'robot-id-V');
 assert.equal(addressedCreativeRobot('@Albert do not build anything while walking',workers),null);
 assert.equal(addressedCreativeRobot('Albert says I will build something later',workers),null);
});
test('the protected design endpoint receives the same tab-specific Meta key as conversations',()=>{
 const studio=read('js/studio.js');
 const section=studio.match(/if\(\[(.*?)\]\.includes\(url\.split\('\?'\)\[0\]\)\)\{/s)?.[1];
 assert.ok(section,'session-key route allowlist exists');
 assert.ok(section.includes("'/api/robots/autonomy/design'"));
 assert.ok(section.includes("'/api/robots/autonomy/plan'"));
 assert.match(studio,/headers\['X-Solvi-Model-Key'\]=key/);
 const server=read('backend/server.py');
 assert.match(server,/@app\.post\('\/api\/robots\/autonomy\/design'\)/);
 assert.match(server,/if not active_model_key\(\):return jsonify\(error='Muse design requires/);
});
test('missing Muse key/backoff does not release a creative group worker or recreate shapes',()=>{
 const source=read('js/robot-autonomy.js');
 assert.match(source,/run\.pendingAction==='creative_build'&&!run\.creativePlan&&run\.nextMetaAt>Date\.now\(\)/);
 assert.match(source,/run\.groupNoProgress=0/);
 assert.match(source,/run\.creativeSeriesIndex\+\+/);
 assert.match(source,/seriesTag=run\.creativeSeriesIndex\?':series'/);
 assert.match(source,/run\.creativeDeadline=creativeSessionDeadline\(goal,Date\.now\(\)\)/);
 const backend=read('backend/server.py');
 assert.match(backend,/creativeSeriesIndex','creativeDeadline'/);
 assert.match(backend,/series_index/);
});
