"""Join the current CPO window against refreshed orders without persisting API rows."""
import collections
import csv
import hashlib
import io
import json
import re
import sys
from pathlib import Path

from cpo_capture import join_orders, money, _date

COLUMNS = ('Дата', 'ID заказа', 'Номер заказа', 'SKU', 'Артикул', 'Расход, ₽')


def reconcile(report, capture, data):
    for separator in (';', ','):
        try:
            rows = list(csv.reader(io.StringIO(report.lstrip('\ufeff')), delimiter=separator, strict=True))
        except csv.Error:
            continue
        header_index = next((i for i, row in enumerate(rows[:5]) if set(COLUMNS) <= set(row)), None)
        if header_index is not None:
            break
    else:
        raise ValueError('CPO API CSV header mismatch')

    header = rows[header_index]
    if len(header) != len(set(header)):
        raise ValueError('Duplicate CPO API CSV columns')
    daily = collections.defaultdict(lambda: [0, 0])
    sku = collections.defaultdict(lambda: [0, 0])
    by_order = collections.defaultdict(list)
    seen = set()
    for cells in rows[header_index + 1:]:
        if not any(cells):
            continue
        if len(cells) != len(header):
            raise ValueError('Invalid CPO API CSV row width')
        row = dict(zip(header, cells))
        day = _date(row['Дата'])
        if day is None and re.fullmatch(r'\d{4}-\d{2}-\d{2}', row['Дата']):
            day = row['Дата']
        order = row['Номер заказа'].strip()
        product = row['SKU'].strip()
        key = (day, row['ID заказа'], product)
        if (not day or not capture['from'] <= day <= capture['to'] or not key[1]
                or not re.fullmatch(r'\d+-\d+', order) or key in seen):
            raise ValueError('Invalid or duplicate CPO API order row')
        seen.add(key)
        amount = money(row['Расход, ₽'])
        daily[day][0] += amount
        daily[day][1] += 1
        if product and product != '0':
            totals = sku[day, product, row['Артикул'].strip()]
            totals[0] += amount
            totals[1] += 1
        by_order[order].append({'d': day, 'sp': amount / 100})

    expected_days = {r['d']: [money(r['sp']), r['n']] for r in capture['report_days']}
    expected_sku = {(r['d'], r['sku'], r['offer']): [money(r['sp']), r['n']] for r in capture['sku']}
    if any(daily[day] != totals for day, totals in expected_days.items()) or sku != expected_sku:
        raise ValueError('CPO API totals differ from validated cabinet export')
    legacy = {json.loads(line)['order'] for line in (data / 'cpo_orders.ndjson').read_text().splitlines() if line.strip()}
    if legacy.intersection(by_order):
        raise ValueError('CPO API orders overlap legacy reports')
    order_days, miss = join_orders(by_order, data)
    return {
        'source_sha256': capture['source_sha256'],
        'orders_sha256': hashlib.sha256((data / 'orders_daily.ndjson').read_bytes()).hexdigest(),
        'report_sha256': hashlib.sha256(report.encode()).hexdigest(),
        'order_days': order_days,
        'miss': miss,
    }


def main():
    data = Path('data')
    capture = json.loads((data / 'cabinet_capture.json').read_text())['cpo']
    result = reconcile(sys.stdin.read(), capture, data)
    pending = data / 'cpo_orders_reconciled.json.tmp'
    pending.write_text(json.dumps(result, separators=(',', ':'), allow_nan=False) + '\n')
    pending.replace(data / 'cpo_orders_reconciled.json')
    print(f"CPO: {len(result['order_days'])} order days, {sum(r['n'] for r in result['miss'])} unmatched orders")


if __name__ == '__main__':
    try:
        main()
    except (KeyError, OSError, ValueError, csv.Error):
        sys.exit('CPO reconciliation refused: API schema, totals or inputs failed validation')
