#!/usr/bin/env python3
"""Offline, conservative SOLVI scene inspection/export/recovery.

Run against a COPY of /var/lib/solvi-help/solvi.sqlite3 where possible.
Restoration requires SOLVI to be stopped, two explicit flags, and creates a
consistent SQLite backup before making one atomic room_scenes update.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import uuid
import zlib


def list_rows(con, room):
    cur=con.execute('SELECT revision,payload FROM room_scenes WHERE room_id=?',(room,)).fetchone()
    if not cur:raise ValueError('Unknown room: '+room)
    print(f'CURRENT room={room} revision={cur[0]} objects={len(json.loads(cur[1]))}')
    legacy=con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scene'").fetchone()
    if legacy:
        old=con.execute('SELECT revision,payload FROM scene WHERE id=1').fetchone()
        if old:print(f'LEGACY scene revision={old[0]} objects={len(json.loads(old[1]))}')
    available=con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scene_snapshots'").fetchone()
    snapshots=con.execute('SELECT id,revision,payload,sha256,object_count,reason,created FROM scene_snapshots WHERE room_id=? ORDER BY created DESC,rowid DESC',(room,)).fetchall() if available else []
    for row in snapshots:
        date=dt.datetime.fromtimestamp(row['created'],dt.timezone.utc).isoformat()
        print(f'SNAPSHOT {row["id"]} revision={row["revision"]} objects={row["object_count"]} reason={row["reason"]} date={date}')
    if not snapshots:print('No new-format scene snapshots: examine an older SQLite backup or the legacy scene table.')
    return cur,snapshots


def scene_from_backup(row):
    data=zlib.decompress(row['payload'])
    if hashlib.sha256(data).hexdigest()!=row['sha256']:raise ValueError('Snapshot checksum mismatch: refusing restore')
    return json.loads(data)


def main(argv=None):
    ap=argparse.ArgumentParser(description='Inspect, export, and carefully restore existing SOLVI SQLite scene revisions')
    ap.add_argument('--db',type=Path,required=True,help='Existing SQLite database (prefer an offline copy)')
    ap.add_argument('--room',default='main')
    ap.add_argument('--export',type=Path,help='Export every available snapshot and legacy/current scenes into this directory')
    ap.add_argument('--restore',help='Exact snapshot UUID to restore to this room')
    ap.add_argument('--confirm',help='Must equal RESTORE:<room> to make changes')
    ap.add_argument('--service-stopped',action='store_true',help='Explicitly acknowledge the server has been stopped')
    args=ap.parse_args(argv)
    if not args.db.is_file():ap.error('Database file does not exist')
    con=sqlite3.connect(f'file:{args.db.resolve()}?mode=ro',uri=True)
    con.row_factory=sqlite3.Row
    current,rows=list_rows(con,args.room)
    if args.export:
        args.export.mkdir(parents=True,exist_ok=True)
        (args.export/f'{args.room}-current.json').write_text(json.dumps({'room':args.room,'revision':current['revision'],'objects':json.loads(current['payload'])},indent=2))
        for r in rows:
            payload={'room':args.room,'revision':r['revision'],'objects':scene_from_backup(r),'snapshotId':r['id']}
            (args.export/f'{args.room}-snapshot-{r["revision"]}-{r["id"]}.json').write_text(json.dumps(payload,indent=2))
        legacy=con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scene'").fetchone()
        if legacy:
            row=con.execute('SELECT revision,payload FROM scene WHERE id=1').fetchone()
            if row:(args.export/'legacy-scene.json').write_text(json.dumps({'revision':row['revision'],'objects':json.loads(row['payload'])},indent=2))
        print('Exported to '+str(args.export))
    if not args.restore:return 0
    if args.confirm!='RESTORE:'+args.room or not args.service_stopped:
        ap.error('Restoring requires --confirm RESTORE:<room> and --service-stopped; stop SOLVI first')
    selected=next((r for r in rows if r['id']==args.restore),None)
    if selected is None:ap.error('Snapshot ID not present; no changes made')
    restored=scene_from_backup(selected)
    if not isinstance(restored,list):ap.error('Invalid object list')
    con.close()
    # Save a transactionally consistent copy BEFORE changing the existing DB.
    stamp=dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup=args.db.with_name(args.db.name+'.before-restore-'+stamp+'.sqlite3')
    source=sqlite3.connect(str(args.db));source.row_factory=sqlite3.Row
    try:
        with sqlite3.connect(str(backup)) as dest:source.backup(dest)
        source.execute('BEGIN IMMEDIATE')
        actual=source.execute('SELECT revision FROM room_scenes WHERE room_id=?',(args.room,)).fetchone()
        if not actual:raise ValueError('Room disappeared; no changes made')
        source.execute('UPDATE room_scenes SET revision=?,payload=? WHERE room_id=?',
                       (actual['revision']+1,json.dumps(restored,separators=(',',':')),args.room))
        source.commit()
    except BaseException:
        source.rollback()
        raise
    finally:source.close()
    print(f'RESTORED {len(restored)} objects to room={args.room}; previous SQLite database preserved at {backup}')
    return 0


if __name__=='__main__':sys.exit(main())
