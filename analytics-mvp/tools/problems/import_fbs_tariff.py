"""Import allowlisted cabinet tariff fields; no API calls, no inferred actual rates."""
import argparse
import csv
import datetime as dt
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import io
import json
import os
from pathlib import Path
import re
import tempfile

COLUMNS = 'posting status art qty price created cutoff log_cutoff fact_transferred delivering_date fact_type fact_rate step1_deadline step2_deadline step3_deadline step4_deadline cur_type cur_rate'.split()
TIMES = ['created', 'cutoff', 'log_cutoff', 'fact_transferred', 'delivering_date'] + [f'step{i}_deadline' for i in range(1, 5)]
TYPES = {'discount', 'commission', 'no_discount'}


def number(value, scale=1):
    try:
        n = Decimal(value)
        if not n.is_finite() or n < 0:
            raise ValueError()
        return int((n * scale).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    except Exception:
        raise ValueError('Invalid numeric field') from None


def parse(text, date):
    dt.date.fromisoformat(date)
    reader = csv.DictReader(io.StringIO(text), delimiter='|')
    if reader.fieldnames != COLUMNS:
        raise ValueError('Unexpected tariff columns')
    rows = []
    seen = set()
    for raw in reader:
        if None in raw or any(v is None for v in raw.values()):
            raise ValueError('Truncated tariff row')
        order = raw['posting']
        if not re.fullmatch(r'\d+-\d+-\d+', order) or order in seen:
            raise ValueError('Invalid or duplicate posting')
        seen.add(order)
        r = {k: raw[k] or None for k in TIMES}
        for key, value in r.items():
            if value:
                stamp = dt.datetime.fromisoformat(re.sub(r'\.(\d+)(?=Z|[+-]\d\d:)', lambda m: '.' + m[1].ljust(6, '0'), value).replace('Z', '+00:00'))
                if stamp.tzinfo is None:
                    raise ValueError('Timestamp must include timezone')
        if not r['created']:
            raise ValueError('Missing creation date')
        steps = [r[f'step{i}_deadline'] for i in range(1, 5)]
        if any(steps) and (not all(steps) or any(dt.datetime.fromisoformat(a.replace('Z','+00:00')) >= dt.datetime.fromisoformat(b.replace('Z','+00:00')) for a, b in zip(steps, steps[1:]))):
            raise ValueError('Incomplete or unordered tariff deadlines')
        qty = number(raw['qty'])
        if qty <= 0 or Decimal(raw['qty']) != qty:
            raise ValueError('Invalid quantity')
        amount = number(raw['price'], 100)  # source price is already the total posting value
        kind = raw['fact_type'] or None
        if kind not in TYPES | {None} or (kind is None and raw['fact_rate']):
            raise ValueError('Unknown actual tariff')
        rate = number(raw['fact_rate'], 10000) if raw['fact_rate'] else 0 if kind == 'no_discount' else None
        if kind == 'no_discount' and rate != 0 or kind in {'discount', 'commission'} and (rate is None or rate <= 0 or rate > 1000):
            raise ValueError('Invalid actual tariff rate')
        current = raw['cur_type'] or None
        current_rate = number(raw['cur_rate'], 100) if raw['cur_rate'] else 0 if current == 'no_discount' else None
        if current not in TYPES | {None} or (current is None and raw['cur_rate']) or (current in {'discount','commission'} and (current_rate is None or not 0 < current_rate <= 1000)) or (current == 'no_discount' and current_rate != 0):
            raise ValueError('Invalid current tariff')
        effect = None if rate is None else int((Decimal(amount) * rate / 10000).quantize(Decimal('1'), rounding=ROUND_HALF_UP)) * (-1 if kind == 'discount' else 1)
        r.update(order=order, status=raw['status'], offer=raw['art'], qty=qty, amount_cents=amount,
                 fact_type=kind, rate_bps=rate, effect_cents=effect, fact_observed=date if kind else None,
                 current_type=current, current_rate_bps=current_rate, observed=date)
        rows.append(r)
    if not rows:
        raise ValueError('Empty tariff snapshot')
    return rows


def merge(previous, rows, date, digest):
    if previous.get('version', 1) != 1:
        raise ValueError('Unsupported tariff state')
    sources = {s['date']: s for s in previous.get('sources', [])}
    old_source = sources.get(date)
    if old_source and old_source['sha256'] == digest:
        return previous
    if previous.get('source_date', '') > date:
        raise ValueError('Cannot replace latest data with older snapshot')
    merged = {r['order']: r for r in previous.get('rows', [])}
    for r in rows:
        old = merged.get(r['order'])
        # A disappearing fact is not proof of reversal: keep its own dated evidence.
        if old and old.get('fact_type') and not r['fact_type']:
            r = dict(r)
            for k in ('fact_type', 'rate_bps', 'effect_cents', 'fact_observed'):
                r[k] = old[k]
            r['fact_amount_cents'] = old.get('fact_amount_cents', old['amount_cents'])
        elif r['fact_type']:
            r['fact_amount_cents'] = r['amount_cents']
        merged[r['order']] = r
    sources[date] = {'date': date, 'sha256': digest, 'rows': len(rows)}
    return {'version': 1, 'source_date': date, 'sources': sorted(sources.values(), key=lambda s:s['date']),
            'rows': sorted(merged.values(), key=lambda r:r['order'])}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--source-dir', required=True)
    p.add_argument('--data-dir', default=os.environ.get('DATA_DIR', 'data'))
    args = p.parse_args()
    target = Path(args.data_dir) / 'fbs_tariff.json'
    state = json.loads(target.read_text()) if target.exists() else {'version':1, 'rows':[], 'sources':[]}
    files = sorted(Path(args.source_dir).glob('fbs_tariff_????-??-??.psv'))
    if not files:
        print('FBS tariff: source absent; previous snapshot retained')
        return
    for source in files:
        date = source.stem.removeprefix('fbs_tariff_')
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        known = next((s for s in state.get('sources', []) if s['date'] == date), None)
        if known and known['sha256'] == digest:
            continue
        # Older already-imported files cannot silently rewrite newer posting facts.
        if date < state.get('source_date', ''):
            if known:
                raise ValueError('Historical tariff source changed; review required')
            continue
        state = merge(state, parse(source.read_text(encoding='utf-8-sig'), date), date, digest)
    target.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(state, ensure_ascii=False, separators=(',', ':')) + '\n'
    if not target.exists() or target.read_text() != content:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=target.parent, delete=False) as f:
            f.write(content); f.flush(); os.fsync(f.fileno()); temp = f.name
        os.replace(temp, target)
    print(f'FBS tariff: {state.get("source_date")}; {len(state["rows"])} postings; actual rates {sum(bool(r["fact_type"]) for r in state["rows"])}')


if __name__ == '__main__':
    main()
