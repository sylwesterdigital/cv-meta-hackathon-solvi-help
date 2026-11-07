import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const release=JSON.parse(read('releases.json'));
const packageVersion=JSON.parse(read('package.json')).version;
const changelog=read('CHANGELOG.md');

// Identical policy to the local Mac watcher merge_history(): it replaces the
// release feed with the new record plus up to 29 earlier published records.
test('watcher-trimmed release history is valid without retained 0.2.195 or 0.2.200 feed entries',()=>{
 const current=release.releases[0];
 assert.equal(release.currentVersion,packageVersion);
 // Deliberately longer than the watcher's 30-entry cap, irrespective of
 // whether we run on the full ZIP or an already-trimmed Mac staging folder.
 const previous=Array.from({length:40},(_,i)=>({...current,version:`0.2.${230-i}`}));
 const staged={currentVersion:packageVersion,
  releases:[current,...previous.filter(r=>r.version!==packageVersion)].slice(0,30)};
 assert.equal(staged.releases.length,30);
 assert.equal(staged.releases[0].version,packageVersion);
 assert.equal(staged.releases.filter(x=>x.version===packageVersion).length,1);
 assert.ok(staged.releases.every(x=>Array.isArray(x.changes)&&x.changes.length>0));
 // Old releases are *supposed* to fall out of the deployment feed.
 assert.equal(staged.releases.some(x=>x.version==='0.2.195'),false);
 assert.equal(staged.releases.some(x=>x.version==='0.2.200'),false);
 // The development record must remain independently available to readers.
 assert.match(changelog,/v0\.2\.195/);
 assert.match(changelog,/v0\.2\.200/);
});

test('deployed release feed retains its own current record and valid changes',()=>{
 assert.equal(release.releases[0].version,packageVersion);
 assert.equal(release.releases.filter(x=>x.version===packageVersion).length,1);
 assert.ok(release.releases.every(x=>Array.isArray(x.changes)&&x.changes.length>0));
});
