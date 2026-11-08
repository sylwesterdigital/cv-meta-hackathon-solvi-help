import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addressedCreativeRobot} from '../js/robot-creative-design.js';
import {creativeSessionDurationMs} from '../js/robot-creative-session.js';
import {captureRobotWideSurvey,WIDE_EYE_VIEWS} from '../js/robot-wide-eye.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const robots=[{id:'bee-id',kind:'robot',name:'Bee'},{id:'viola-id',kind:'robot',name:'Viola'}];
test('novel directly authorised creative sessions and amendments work without a noun dictionary',()=>{
 for(const phrase of [
  '@Bee please start now creative session flanking the north corner cap with two conker guards',
  '@Bee I mean you should continue to create the maze until I ask you to stop',
  '@Viola go to @Bee and help help to embellish the maze with figures of gate keepers',
  '@Viola please embellish the maze with little figures beside @Bee'
 ])assert.ok(addressedCreativeRobot(phrase,robots),phrase);
 assert.equal(creativeSessionDurationMs('@Bee please start now creative session flanking the north corner'),900000);
 assert.equal(creativeSessionDurationMs('@Bee please continue to create the maze until I ask you to stop'),900000);
 for(const phrase of ['@Bee how is your maze?','@Bee do not create anything','@Bee could you explain how to create a maze?'])
  assert.equal(addressedCreativeRobot(phrase,robots),null,phrase);
});
test('named creative instructions enter a durable authenticated queue before any model speech',()=>{
 const js=read('js/robot-autonomy.js'),py=read('backend/server.py');
 assert.match(js,/const namedCreative=addressedCreativeRobot\(/);
 assert.match(js,/NAMED CREATIVE QUEUED/);
 assert.match(js,/task\.kind==='named_creative_build'/);
 assert.match(js,/!runs\.has\(bot\.userData\.editorId\)/);
 assert.match(py,/def named_creative_request\(text,objects\):/);
 assert.match(py,/row\['role'\]!='user'/);
 assert.match(py,/task\['kind'\]=='named_creative_build'/);
 assert.match(py,/return json_error\('Named creative task belongs to another robot',403\)/);
 assert.match(py,/if outcome=='completed' and task\['kind'\] in \('creative_build','named_creative_build'\):/);
 assert.match(js,/const collaborator=\//);
});
test('autonomous camera captures real peripheral images in the same realm, without another model call',()=>{
 const studio=read('js/studio.js'),editor=read('js/editor.js');
 assert.equal(WIDE_EYE_VIEWS.length,6);
 assert.match(studio,/captureRobotWideSurvey\(view=>captureRobotView/);
 assert.match(studio,/Stitched wide eyes · 210° horizontal × 135° vertical/);
 assert.match(studio,/const wideSurveyLastAt=new Map\(\)/);
 assert.match(studio,/form\.append\('frame',photo/);
 assert.match(editor,/wideEyeFrames=new Map\(\)/);
 assert.match(editor,/const hasWide=!!/);
 assert.match(editor,/wideEyeFrames\.clear\(\)/);
});
test('wide survey never continues if the realm changes',async()=>{
 let calls=0;
 await assert.rejects(captureRobotWideSurvey(()=>{calls++;return {size:10};},{stillCurrent:()=>false}),/realm changed/);
 assert.equal(calls,0);
});
test('wide survey refuses empty pixels without inventing a panorama',async()=>{
 let calls=0;
 await assert.rejects(captureRobotWideSurvey(()=>{calls++;return {size:0};}),/empty front/);
 assert.equal(calls,1);
});
test('collection controls show a single icon row with accessible labels',()=>{
 const editor=read('js/editor.js'),styles=read('styles.css'),ui=read('js/ui-controls.js');
 for(const key of ['move','edit','ungroup','delete','drawing-save'])assert.match(editor,new RegExp("collectionIcon\\('[^']+','"+key+"'"));
 assert.match(editor,/setAttribute\('aria-label',name\+' '\+label\)/);
 assert.match(styles,/#sceneItems \.scene-collection-actions button\.scene-collection-icon/);
 assert.match(styles,/flex-wrap:nowrap!important/);
 assert.match(styles,/height:34px!important/);
 assert.match(ui,/fileIcons=new Set\('map attach opened minified reset move rotate scale drawing-save ungroup/);
 assert.match(ui,/button\.dataset\.uiIcon==='ungroup'/);
});
