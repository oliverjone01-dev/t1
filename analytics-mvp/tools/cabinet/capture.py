"""Prepare a sanitized cabinet snapshot; never overwrite API/history datasets.

All validation precedes the single atomic output write. This tool has no network
or publishing code. The scheduler performs browser collection and a reviewed Git
publication separately.
"""
import argparse
import datetime as dt
from decimal import Decimal
import hashlib
import json
import os
from pathlib import Path
import tempfile
from zoneinfo import ZoneInfo
from import_report import analytics_records, read_xlsx

MSK = ZoneInfo('Europe/Moscow')
FIELDS = {'views': 'Q', 'search_views': 'S', 'pdp_views': 'W',
          'cart': 'AA', 'ordered_units': 'AC', 'search_position': 'P'}


def number(value, integer=False):
    if value is None or value == '' or value == '–':
        return None
    n = Decimal(value)
    if not n.is_finite() or n < 0 or (integer and n != n.to_integral_value()):
        raise ValueError('Invalid nonnegative source metric')
    return int(n) if integer else float(n)


def make_capture(source, expected_skus, captured_at, phase, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    observed = dt.datetime.fromisoformat(captured_at)
    if observed.tzinfo is None or observed > now + dt.timedelta(minutes=5):
        raise ValueError('Capture timestamp must have a zone and not be in the future')
    if now - observed > dt.timedelta(hours=3):
        raise ValueError('Capture is older than three hours; collect again')
    expected = {str(s) for s in expected_skus}
    if not expected or any(not s.isdigit() for s in expected):
        raise ValueError('Expected SKU registry is empty or invalid')
    records, _, checks = analytics_records(read_xlsx(source))
    if checks['source_company'] != 'Продавец: GENGLASS':
        raise ValueError('Source company is not GENGLASS')
    if checks['period_from'] != checks['period_to']:
        raise ValueError('One source day per snapshot required')
    day = checks['period_from']
    today = observed.astimezone(MSK).date()
    age = (today - dt.date.fromisoformat(day)).days
    if not 0 <= age <= 14:
        raise ValueError('Source day outside allowed lookback')
    items = []
    for r in records:
        v = r['source_values']
        item = {'sku': r['sku'], 'scheme': r['scheme'] or None}
        for field, col in FIELDS.items():
            item[field] = number(v[col], integer=field != 'search_position')
        items.append(item)
    received = {r['sku'] for r in items}
    totals = {field: sum(r[field] for r in items) if all(r[field] is not None for r in items) else None
              for field in FIELDS if field != 'search_position'}
    for field, col in FIELDS.items():
        if field != 'search_position' and Decimal(str(totals[field])) != Decimal(checks['internal_controls'][col]['reported']):
            raise ValueError('Snapshot/source total mismatch')
    return {'version': 1, 'company': 'GENGLASS', 'day': day,
            'captured_at': observed.astimezone(dt.timezone.utc).isoformat(),
            'phase': phase, 'day_in_progress': age == 0,
            'scope': {'expected': len(expected), 'received': len(received),
                      'matched': len(received & expected), 'missing': len(expected - received),
                      'extra': len(received - expected),
                      'status': 'partial' if expected - received else 'complete'},
            'totals': totals, 'items': items,
            'source': 'ozon-native-daily-product-report',
            'not_refreshed': ['card_price', 'coinvest', 'boosting_components', 'fbs_tariff',
                              'cpo_settings', 'card_groups', 'competitor_watchlist']}


def merge_capture(old, fresh):
    if old and (old.get('version') != 1 or old.get('company') != 'GENGLASS'):
        raise ValueError('Stored cabinet snapshot contract mismatch')
    rows = list((old or {}).get('snapshots', []))
    key = (fresh['day'], fresh['phase'])
    previous = next((r for r in rows if (r['day'], r['phase']) == key), None)
    if previous:
        if fresh['captured_at'] < previous['captured_at']:
            raise ValueError('Older capture cannot replace a newer capture')
        old_keys = {(r['sku'], r['scheme']) for r in previous['items']}
        new_keys = {(r['sku'], r['scheme']) for r in fresh['items']}
        if old_keys - new_keys:
            raise ValueError('Incoming snapshot loses previously measured SKU/scheme rows')
    rows = [r for r in rows if (r['day'], r['phase']) != key] + [fresh]
    rows.sort(key=lambda r: (r['day'], r['captured_at']))
    return {'version': 1, 'company': 'GENGLASS', 'snapshots': rows}


def atomic_json(path, value):
    path = Path(path)
    text = json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n'
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as f:
            temporary = f.name
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temporary, path)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', required=True)
    p.add_argument('--expected-skus', required=True, help='Private JSON array of expected SKU strings')
    p.add_argument('--captured-at', required=True)
    p.add_argument('--phase', required=True, choices=['утро', 'вечер', 'once'])
    p.add_argument('--previous', help='Previous sanitized cabinet_capture.json from main')
    p.add_argument('--out', required=True, help='Staged output; not a live data directory')
    args = p.parse_args()
    live_data = Path(__file__).resolve().parents[2] / 'data'
    destination = Path(args.out).resolve()
    if destination == live_data or live_data in destination.parents:
        raise ValueError('Prepare a staged result outside the repository data directory')
    fresh = make_capture(args.source, json.loads(Path(args.expected_skus).read_text()), args.captured_at, args.phase)
    old = json.loads(Path(args.previous).read_text()) if args.previous and Path(args.previous).exists() else None
    result = merge_capture(old, fresh)
    atomic_json(args.out, result)
    print(json.dumps({'day': fresh['day'], 'scope': fresh['scope'], 'partial_day': fresh['day_in_progress'],
                      'sha256': hashlib.sha256(Path(args.out).read_bytes()).hexdigest()}, ensure_ascii=False))


if __name__ == '__main__':
    main()
