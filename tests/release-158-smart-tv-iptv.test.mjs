import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import {spawnSync} from './helpers/subprocess-test.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const api=()=>vm.runInNewContext(read('js/smart-media-playlist.js').replace(/^import .*?;\s*$/gm,'').replaceAll('export ','')+'\n({parseIPTVPlaylist,safeIPTVPlaylistURL,cleanSmartOptions,safeChannelUrl,cleanChannels})',{URL,WeakMap,Map,Object,Array,Math,Number,String});
test('IPTV parser reads named stream entries but not non-HTTPS, script, or unsupported formats',()=>{
 const {parseIPTVPlaylist,safeIPTVPlaylistURL}=api();
 assert.equal(safeIPTVPlaylistURL('https://iptv-org.github.io/iptv/index.m3u'),true);
 assert.equal(safeIPTVPlaylistURL('http://iptv-org.github.io/iptv/index.m3u'),false);
 const playlist='#EXTM3U\n#EXTINF:-1 tvg-name="Demo News" group-title="News",Demo\nhttps://example.org/live/index.m3u8\n#EXTINF:-1,Unsafe\nhttp://foo/live.m3u8\n#EXTINF:-1,Video\nhttps://cdn.example.org/movie.mp4?auth=1\n';
 const entries=parseIPTVPlaylist(playlist);
 assert.equal(entries.length,2);assert.equal(entries[0].title,'Demo News');assert.equal(entries[0].group,'News');assert.equal(entries[1].title,'Video');
});
test('Smart TV options keep safe defaults and named menu startup choice',()=>{
 const {cleanSmartOptions}=api();const a=cleanSmartOptions();assert.equal(a.smartAudio,true);assert.equal(a.smartMuted,false);assert.equal(a.smartAutoPlay,false);assert.equal(a.smartStartChannel,-1);assert.equal(a.smartPreserveAspect,true);
 const b=cleanSmartOptions({smartAudio:false,smartLoop:true,smartStartChannel:3,smartAutoPlay:true});assert.equal(b.smartAudio,false);assert.equal(b.smartStartChannel,3);assert.equal(b.smartLoop,true);
 assert.equal(cleanSmartOptions({smartStartChannel:999}).smartStartChannel,-1);
});
test('In-world overlay has clickable mute, persistent menu and original-aspect video mode',()=>{
 const s=read('js/smart-media-playlist.js'),e=read('js/editor.js');
 assert.match(s,/smartScreenAudio/);assert.match(s,/toggleSmartScreenAudio/);assert.match(s,/smartPreserveAspect/);assert.match(s,/requestVideoFrameCallback/);assert.match(s,/smartAutoPlay/);assert.match(s,/smartLoop/);
 assert.match(e,/smartScreenAudio/);assert.match(e,/this\.smartChannelOption/);assert.match(e,/smartStartChannel/);
});
test('Selected TV receives paste directly; IPTV catalogue is searchable and bounded',()=>{
 const e=read('js/editor.js');assert.match(e,/window\.addEventListener\('paste'/);assert.match(e,/event\.clipboardData\?\.getData\('text\/plain'\)/);
 assert.match(e,/fetchIPTVPlaylist/);assert.match(e,/smart-iptv-results/);assert.match(e,/matching\.slice\(0,60\)/);assert.match(e,/Maximum 12 channels per display/);
 const s=read('js/smart-media-playlist.js');assert.match(s,/12\*1024\*1024/);assert.match(s,/mode:'cors',credentials:'omit'/);
});
test('Backend validates new smart options with strict types and keeps existing Rantlist channels',()=>{
 const python=`import ast,math,re,sys\ntree=ast.parse(open(sys.argv[1]).read())\nneeded={'valid_smart_channels','valid_smart_options','valid_basic_furniture'}\nnamespace={'math':math,'re':re}\nexec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in needed],type_ignores=[]),'<validator>','exec'),namespace)\nvalid=namespace['valid_basic_furniture']\nu='https://rantlist.me/media/example/index.m3u8'\nassert valid({'variant':'tv','channels':[{'title':'Rantlist','url':u}],'smartAudio':True,'smartMuted':False,'smartLoop':True,'smartAutoPlay':True,'smartStartChannel':0,'smartPreserveAspect':True})\nassert not valid({'variant':'tv','smartAudio':'true'})\nassert not valid({'variant':'tv','smartStartChannel':999})
assert 'len(value)>200' in open(sys.argv[1]).read()\nprint('ok')`;
 const result=spawnSync('python3',['-c',python,new URL('../backend/server.py',import.meta.url).pathname],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);
});
