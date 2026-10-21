"""Remove only the proven duplicate layer from the 21 October incident.

The ordinary --check-only mode is read-only and checks affected months before Pages.
Recovery requires the exact observed input and baseline hashes; no API or secrets.
"""
import argparse
import collections
import copy
import hashlib
import json
import pathlib
import subprocess

MONTHS = {'2026-05', '2026-06', '2026-07'}
BASE_REF = 'dafa7b084b14ad87db8f5c0056c06a5351f1194c'
BASE_HASH = '2bcdfbba67e03e27665a8a79fab51d77e130db4e98a2b7fe31423a4eafaed209'
BAD_HASH = 'dcaaa86f4585cc86cf4a9f02d5e769c3c2d14d981659cfd698a14095ca455578'
FIXED_HASH = '167423043e5d4e892bd551f919ec336b8faa9bbff09eb95d1218ae6e7eac959f'
ORDER_HASH = 'ec4231c7640e5516ebee542d0037db1b6bade4b2b9f721221e996e34bd600e3c'

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def parse(raw):
    return [json.loads(line) for line in raw.splitlines() if line]

def check_counts(monthly, orders):
    actual = collections.defaultdict(lambda: [0, 0])
    expected = collections.defaultdict(lambda: [0, 0])
    seen = set()
    for row in monthly:
        if row['ym'] not in MONTHS:
            continue
        key = row['ym'], row['sku']
        if key in seen:
            raise ValueError('duplicate monthly key')
        seen.add(key)
        if row['sold'] < 0 or row['ret'] < 0:
            raise ValueError('negative units')
        actual[key] = [row['sold'], row['ret']]
    seen_orders = set()
    for row in orders:
        if row['ym'] not in MONTHS:
            continue
        key = row['ym'], row['order'], row['sku'], row['role']
        if key in seen_orders or row['role'] not in ('delivered', 'returned'):
            raise ValueError('duplicate or invalid order-level key')
        seen_orders.add(key)
        expected[row['ym'], row['sku']][row['role'] == 'returned'] += row['count']
    if any(actual[k] != expected[k] for k in actual.keys() | expected.keys()):
        raise ValueError('REALIZATION_COUNTS_CONFLICT: May-July monthly differs from order-level; publication blocked')

def subtract_layer(monthly, baseline):
    result = copy.deepcopy(monthly)
    old = {(r['ym'], r['sku']): r for r in baseline if r['ym'] in MONTHS}
    if len(old) != sum(r['ym'] in MONTHS for r in baseline):
        raise ValueError('duplicate baseline key')
    used = set()
    for row in result:
        key = row['ym'], row['sku']
        if key in old:
            for field in ('sold', 'ret', 'amount'):
                row[field] -= old[key][field]
            if row['sold'] < 0 or row['ret'] < 0:
                raise ValueError('subtraction would create negative units')
            used.add(key)
    if used != old.keys():
        raise ValueError('baseline keys missing from target')
    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check-only', action='store_true')
    parser.add_argument('--data-dir', type=pathlib.Path, default=pathlib.Path(__file__).resolve().parents[3] / 'data-ym')
    args = parser.parse_args()
    target = args.data_dir / 'realization_monthly.ndjson'
    raw = target.read_bytes()
    order_raw = (args.data_dir / 'realization_orders.ndjson').read_bytes()
    if args.check_only:
        check_counts(parse(raw), parse(order_raw))
        print('realization May-July counts: consistent (internal invariant, not external reconciliation)')
        return
    if sha(raw) == FIXED_HASH:
        check_counts(parse(raw), parse(order_raw))
        print('already repaired; no files changed')
        return
    if sha(raw) != BAD_HASH or sha(order_raw) != ORDER_HASH:
        raise ValueError('unexpected incident input hashes; no files changed')
    repo = pathlib.Path(__file__).resolve().parents[4]
    baseline_raw = subprocess.check_output(['git', 'show', f'{BASE_REF}:analytics-mvp/data-ym/realization_monthly.ndjson'], cwd=repo)
    if sha(baseline_raw) != BASE_HASH:
        raise ValueError('unexpected baseline hash; no files changed')
    rows = subtract_layer(parse(raw), parse(baseline_raw))
    check_counts(rows, parse(order_raw))
    state = json.loads((args.data_dir / 'realization_state.json').read_text())
    done = set(state['pairs'])
    for row in rows:
        if row['ym'] in MONTHS and any(f"{row['ym']}/{c}" not in done for c in row.get('from', [])):
            raise ValueError('repaired rows have unfinished campaign pairs')
    lines = raw.splitlines(keepends=True)
    if len(rows) != len(lines):
        raise ValueError('unexpected blank lines; no files changed')
    output = b''.join((json.dumps(row, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
                      if row['ym'] in MONTHS else line for row, line in zip(rows, lines))
    if sha(output) != FIXED_HASH:
        raise ValueError('unexpected repaired hash; no files changed')
    tmp = target.with_suffix('.repair-tmp')
    tmp.write_bytes(output)
    tmp.replace(target)
    print('removed exactly one duplicate layer: 3070941 RUB; other months unchanged')

if __name__ == '__main__':
    main()
