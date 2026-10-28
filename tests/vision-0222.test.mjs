import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('robot eye panel exposes independent Muse scene description and SAM object segmentation',()=>{
 const ui=get('index.html'),js=get('js/robot-brains.js'),server=get('backend/server.py');
 for(const id of ['describeBrainsEye','analyzeBrainsEye','brainsVisionQuestion','brainsEyeOverlay','brainsEyeImage'])
  assert.ok(ui.includes('id="'+id+'"'));
 assert.match(js,/inspect\('describe'\)/);
 assert.match(js,/inspect\('segment'\)/);
 assert.match(js,/showBoxes\(response\.result\?\.boxes/);
 assert.match(server,/def sam_object_boxes/);
 assert.match(server,/def meta_output_text/);
 assert.match(server,/model='muse-spark-1\.3'/);
 assert.match(server,/model='sam-3\.1'/);
 assert.match(server,/image_url':image/);
 assert.match(server,/store':False/);
});
