"""Reapply administrator-deleted bundled-avatar tombstones after static rsync.

The release watcher refreshes /assets on every deployment. This script runs as
root during installation to keep deliberate server deletions persistent.
"""
import json
import re
import sqlite3
import sys
from pathlib import Path


def prune(database, webroot):
    root = Path(webroot).resolve()
    catalog = root / 'assets' / 'avatars' / 'catalog.json'
    if not catalog.is_file() or not Path(database).is_file():
        return 0
    with sqlite3.connect(database) as db:
        db.execute('CREATE TABLE IF NOT EXISTS deleted_bundled_avatars (id TEXT PRIMARY KEY, deleted_by TEXT NOT NULL, created TEXT NOT NULL)')
        names = {row[0] for row in db.execute('SELECT id FROM deleted_bundled_avatars')}
    if not names:
        return 0
    source = json.loads(catalog.read_text())
    retained = []
    removed = 0
    base = (root / 'assets' / 'avatars').resolve()
    for avatar in source.get('avatars', []):
        name = str(avatar.get('id', ''))
        if name not in names:
            retained.append(avatar)
            continue
        url = str(avatar.get('url', ''))
        if name == 'solvi-character' or not re.fullmatch(r'\./assets/avatars/[A-Za-z0-9_-]+\.glb', url):
            raise ValueError('Refusing unsafe bundled-avatar deletion: ' + name)
        target = (root / url[2:]).resolve()
        if target.parent != base:
            raise ValueError('Bundled-avatar path outside static avatar directory')
        target.unlink(missing_ok=True)
        removed += 1
    source['avatars'] = retained
    catalog.write_text(json.dumps(source, indent=2) + '\n')
    return removed


if __name__ == '__main__':
    print('[SOLVI] Permanently removed bundled avatars:', prune(sys.argv[1], sys.argv[2]))
