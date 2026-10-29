"""Private expected registry from current all-status catalog and recent history."""
import argparse
import csv
import datetime as dt
import json
from pathlib import Path
import re
from import_report import price_records, read_xlsx


def registry(prices, expected_catalog_count, legacy, day, previous=None):
    records, _, _ = price_records(read_xlsx(prices), expected_catalog_count)
    result = {r['sku'] for r in records}
    floor = (dt.date.fromisoformat(day) - dt.timedelta(days=14)).isoformat()
    files = sorted(Path(legacy).glob('analytics_sku_daily_*.psv'),
                   key=lambda p: re.findall(r'\d{4}-\d{2}-\d{2}', p.name)[-1])
    recent = [p for p in files if re.findall(r'\d{4}-\d{2}-\d{2}', p.name)[-1] >= floor]
    if files and not recent:
        recent = files[-1:]
    for p in recent:
        with p.open(encoding='utf-8-sig') as f:
            for r in csv.DictReader(f, delimiter='|'):
                if floor <= r['date'] <= day:
                    if not r['sku'].isdigit():
                        raise ValueError('Invalid SKU in prior registry')
                    result.add(r['sku'])
    if previous:
        for snapshot in previous.get('snapshots', []):
            if floor <= snapshot['day'] <= day:
                result.update(r['sku'] for r in snapshot['items'])
    return sorted(result)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--prices', required=True)
    p.add_argument('--catalog-count', required=True, type=int)
    p.add_argument('--legacy', required=True)
    p.add_argument('--day', required=True)
    p.add_argument('--previous')
    p.add_argument('--out', required=True)
    a = p.parse_args()
    previous = json.loads(Path(a.previous).read_text()) if a.previous and Path(a.previous).exists() else None
    result = registry(a.prices, a.catalog_count, a.legacy, a.day, previous)
    Path(a.out).write_text(json.dumps(result) + '\n')
    print('Expected SKU:', len(result))
