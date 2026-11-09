"""Merge only fresh, validated cabinet snapshots, preserving current history.

Run the TypeScript contract validator on both inputs before this module. This
module has no network access; the workflow publishes only after build + smoke.
"""
import argparse
import datetime as dt
import json
from pathlib import Path
from zoneinfo import ZoneInfo
from capture import merge_capture
from catalog_capture import merge_catalogs


def accept(previous, incoming, now=None, backfill_since=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    old = {(r['day'], r['phase']): r for r in previous['snapshots']}
    result = previous
    changed = []
    for row in incoming['snapshots']:
        key = row['day'], row['phase']
        if old.get(key) == row:
            continue
        stamp = dt.datetime.fromisoformat(row['captured_at'].replace('Z', '+00:00'))
        if stamp.tzinfo is None or not -dt.timedelta(minutes=5) <= now-stamp <= dt.timedelta(hours=3):
            raise ValueError('Changed capture must be freshly collected (three hours)')
        age = (stamp.astimezone(ZoneInfo('Europe/Moscow')).date()-dt.date.fromisoformat(row['day'])).days
        if not 0 <= age <= 14 or row['day_in_progress'] != (age == 0):
            raise ValueError('Source day / partial-day flag mismatch')
        # An old prepared package must never roll back a concurrent correction.
        if key in old and stamp <= dt.datetime.fromisoformat(old[key]['captured_at'].replace('Z', '+00:00')):
            raise ValueError('Older or conflicting capture cannot replace current data')
        result = merge_capture(result, row)
        changed.append({'day': row['day'], 'phase': row['phase'], 'captured_at': row['captured_at']})
    # Once the extended pipeline is active, an old client must not silently
    # update only the funnel while leaving catalog prices frozen again.
    if previous.get('catalogs') and changed:
        for row in changed:
            collection = dt.datetime.fromisoformat(row['captured_at'].replace('Z', '+00:00'))
            if not any(c['phase'] == row['phase'] and
                       c['day'] == collection.astimezone(ZoneInfo('Europe/Moscow')).date().isoformat() and
                       abs(collection-dt.datetime.fromisoformat(c['captured_at'].replace('Z', '+00:00'))) <= dt.timedelta(hours=3)
                       for c in incoming.get('catalogs', [])):
                raise ValueError('Updated funnel requires catalog from the same collection session')
    result = dict(result)
    if 'catalogs' in incoming:
        result['catalogs'] = merge_catalogs(previous.get('catalogs', []), incoming['catalogs'], now, backfill_since)
    if 'competitors' in incoming:
        new = incoming['competitors']; old_comp = previous.get('competitors')
        if new != old_comp:
            stamp = dt.datetime.fromisoformat(new['captured_at'].replace('Z', '+00:00'))
            if stamp > now+dt.timedelta(minutes=5) or (not backfill_since and now-stamp > dt.timedelta(hours=36)):
                raise ValueError('Competitor collection outside freshness window')
            if old_comp and stamp <= dt.datetime.fromisoformat(old_comp['captured_at'].replace('Z', '+00:00')):
                raise ValueError('Cannot roll back competitor snapshot')
            if old_comp and dt.datetime.fromisoformat(new['source_updated_at'].replace('Z', '+00:00')) < dt.datetime.fromisoformat(old_comp['source_updated_at'].replace('Z', '+00:00')):
                raise ValueError('Cannot roll back competitor source period')
            if backfill_since and stamp.astimezone(ZoneInfo('Europe/Moscow')).date().isoformat() < backfill_since:
                raise ValueError('Competitor outside backfill window')
            result['competitors'] = new
    return result, changed


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--backfill-since'); p.add_argument('previous'); p.add_argument('incoming'); p.add_argument('out')
    a = p.parse_args()
    result, changed = accept(json.loads(Path(a.previous).read_text()), json.loads(Path(a.incoming).read_text()), backfill_since=a.backfill_since)
    Path(a.out).write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'), allow_nan=False)+'\n')
    print(json.dumps({'changed': changed}, ensure_ascii=False))
