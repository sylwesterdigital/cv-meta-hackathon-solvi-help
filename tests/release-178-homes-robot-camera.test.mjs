import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {sanitiseWall,wallSegments} from '../js/office-wall-math.js';
import {canPreset,presetEntry,presetCategory} from '../js/object-preset-data.js';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('wall door and roof settings default safely and round-trip when saved',()=>{
 const wall=sanitiseWall({points:[[0,0],[9,0],[9,7],[0,7]],closed:true,doors:{enabled:true,width:1.15,height:2.12,segments:[0,2,2,900]},roof:{enabled:true,style:'shed',direction:'west',rise:1.9,overhang:.35,chimney:true,solarPanels:true,skylight:true}});
 assert.equal(wall.doors.enabled,true);assert.deepEqual(wall.doors.segments,[0,2]);
 assert.equal(wall.roof.style,'shed');assert.equal(wall.roof.direction,'west');assert.equal(wall.roof.overhang,.35);
 assert.equal(wall.roof.skylight,true);assert.equal(wallSegments(wall).length,4);
 assert.deepEqual(sanitiseWall(wall),wall);
});

test('closed room walls can be saved as architecture presets retaining doors and roofs',()=>{
 const data={kind:'wall',name:'House with doors',texture:'none',rotation:[0,0,0],scale:[1,1,1],wall:sanitiseWall({points:[[0,0],[5,0],[5,5],[0,5]],closed:true,doors:{enabled:true,segments:[1]},roof:{enabled:true,style:'pyramid'}})};
 assert.equal(canPreset(data),true);
 assert.equal(presetCategory(data),'Architecture');
 assert.deepEqual(presetEntry(data).wall.doors.segments,[1]);
 assert.match(read('js/object-presets.js'),/makeOfficeWall\(data\.wall\|\|\{\}\)/);
});

test('new wall and roof fields pass backend validation, malformed fields rejected',()=>{
 const src=`import ast,sys,math,re,json\ns=open(sys.argv[1]).read();a=ast.parse(s);f=next(n for n in a.body if isinstance(n,ast.FunctionDef) and n.name=='valid_office_wall');n={'math':math,'re':re};exec(compile(ast.Module(body=[f],type_ignores=[]),'<test>','exec'),n);v=n['valid_office_wall'];w=json.loads(sys.stdin.read());assert v(w);w['doors']['segments']=[-1];assert not v(w);w['doors']['segments']=[0];w['roof']['style']='broken';assert not v(w);print('ok')`;
 const wall=sanitiseWall({points:[[0,0],[6,0],[6,6],[0,6]],closed:true,doors:{enabled:true,segments:[0]},roof:{enabled:true,style:'flat',skylight:true}});
 const result=spawnSync('python3',['-c',src,new URL('../backend/server.py',import.meta.url).pathname],{input:JSON.stringify(wall),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.stdout);
});

test('wall geometry contains a real floor-level doorway and three roof styles with optional skylight',()=>{
 const src=read('js/office-walls.js');
 assert.match(src,/const doorOn=s\.doors\.enabled/);
 assert.match(src,/s\.height-height/);
 assert.match(src,/if\(r\.style==='flat'\)/);
 assert.match(src,/else if\(r\.style==='pyramid'\)/);
 assert.match(src,/r\.style==='shed'/);
 assert.match(src,/outline\.holes\.push\(opening\)/);
 assert.match(src,/roofMesh\.userData\.wallCeiling=true/);
});

test('wall inspector uses one slider below focused numeric row, with door and roof controls',()=>{
 const html=read('index.html'),editor=read('js/editor.js');
 for(const id of ['wallDoorOptions','wallRoofShapeOptions','wallDoorAdd','wallDoorRemove','wallDoorSegment','wallHouseRoofStyle','wallHouseSolar','wallHouseSkylight'])assert.ok(html.includes(`id="${id}"`));
 assert.match(editor,/row\.after\(wrapper\)/);
 assert.match(editor,/wallHouseRoofRise:\[\.15,6/);
 assert.match(editor,/this\.wallDoorSegments/);
});

test('seated robots restore only after room objects are ready and stand outside furniture',()=>{
 const editor=read('js/editor.js'),seating=read('js/robot-seating.js'),robots=read('js/robots.js');
 assert.match(editor,/endSceneReplacement\(\)\{[^\n]*restoreSeatedRobots\(this\);repairLoadedRobotElevation\(this\)/);
 assert.match(seating,/footprint\.min\.z-clearance/);
 assert.match(seating,/floorSupportY\(editor,robot\.position,target\)/);
 assert.match(robots,/if\(!group\.userData\.robotSeated\)group\.userData\.robotMode='idle'/);
 assert.match(robots,/The animation mixer now owns walking bones/);
});

test('saved camera position is per room, offers entry last and saved, warns about not saving scene',()=>{
 const src=read('js/world.js'),css=read('styles.css');
 assert.match(src,/solvi-camera-\$\{type\}-\$\{window\.solviRoom\|\|'main'\}/);
 assert.match(src,/\['entry','Entry','scene'/);
 assert.match(src,/\['last','Last','orbit-follow'/);
 assert.match(src,/\['saved','Here','camera-free'/);
 assert.match(src,/This saves only your camera position, not the game or scene/);
 assert.match(css,/#controlSwitcher \.camera-position-controls/);
 assert.match(src,/drawing-save\.svg/);
 assert.match(src,/event\.code!=='KeyP'/);
});

test('comic bubbles are configured for each robot, using local font fallbacks and CSS shapes',()=>{
 const src=read('js/robot-comic-bubbles.js'),backend=read('backend/server.py'),editor=read('js/editor.js'),html=read('index.html');
 assert.match(src,/cfg\.comicEnabled==='off'/);
 assert.match(src,/comic-shape-/);
 assert.match(src,/comic-font-/);
 assert.match(editor,/\['robotComicFont','comicFont'/);
 assert.match(backend,/'comicEnabled','comicShape','comicFont','comicThought','comicCaps'/);
 assert.match(html,/id="robotComicConfig"/);
 assert.ok(!read('styles.css').includes('@font-face{font-family:Digital Strip'));
});
