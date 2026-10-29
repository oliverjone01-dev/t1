"""Read-only Ozon XLSX intake. Originals and source values are never modified.

python3 import_report.py SOURCE --kind prices --expected-count 467 --out archive
No network, credentials, browser automation or cabinet writes.
"""
import argparse
import collections
import datetime as dt
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import posixpath
import re
import sys
import tempfile
import zipfile
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'


def read_xlsx(path):
    """Ignore presentation styles, preserving sparse cells and cached values."""
    sheets = []
    with zipfile.ZipFile(path) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(t.text or '' for t in si.findall('.//m:t', NS))
                       for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)]
        rels = {r.get('Id'): r.get('Target') for r in
                ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        for sheet in ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet', NS):
            target = rels[sheet.get(REL)]
            target = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
            rows = []
            for row in ET.fromstring(z.read(target)).findall('m:sheetData/m:row', NS):
                cells = {}
                for c in row.findall('m:c', NS):
                    address = c.get('r')
                    if not address or not re.fullmatch(r'[A-Z]+[1-9][0-9]*', address):
                        raise ValueError('Invalid cell address')
                    v = c.find('m:v', NS)
                    value = v.text if v is not None else None
                    if c.get('t') == 's' and value is not None:
                        value = strings[int(value)]
                    elif c.get('t') == 'inlineStr':
                        value = ''.join(t.text or '' for t in c.findall('.//m:t', NS))
                    f = c.find('m:f', NS)
                    cells[re.sub(r'[0-9]', '', address)] = {
                        'value': value, 'type': c.get('t', 'n'),
                        **({'formula': f.text} if f is not None else {})}
                rows.append({'row': int(row.get('r')), 'cells': cells})
            sheets.append({'sheet': sheet.get('name'), 'rows': rows})
    return sheets


def price_records(sheets, expected_count=None):
    sheet = next((s for s in sheets if s['sheet'] == 'Товары и цены'), None)
    if sheet is None:
        raise ValueError('Missing sheet Товары и цены')
    rows = {r['row']: r['cells'] for r in sheet['rows']}
    headers = {c: v['value'] for c, v in rows[2].items()}
    for col, label in {'A': 'Артикул', 'B': 'SKU', 'P': 'Предельная цена, руб.',
                       'R': 'Цена реализации, руб.'}.items():
        if headers.get(col) != label:
            raise ValueError('Unexpected schema at ' + col)
    records = []
    seen = set()
    for r in sheet['rows']:
        if r['row'] < 5 or not any(c['value'] is not None for c in r['cells'].values()):
            continue
        values = {k: v['value'] for k, v in r['cells'].items()}
        sku = values.get('B')
        if not sku or not re.fullmatch(r'[0-9]+', sku) or sku in seen:
            raise ValueError('Missing, invalid or duplicate SKU at row ' + str(r['row']))
        if not values.get('A'):
            raise ValueError('Missing offer at row ' + str(r['row']))
        seen.add(sku)
        records.append({'source_row': r['row'], 'sku': sku, 'offer_id': values['A'],
                        'source_values': {col: values.get(col) for col in headers}})
    if not records:
        raise ValueError('Empty price report')
    if expected_count is not None and len(records) != expected_count:
        raise ValueError(f'Coverage mismatch: {len(records)} != {expected_count}')
    suspicious = [headers[c] for c in ('K', 'L', 'M', 'N')
                  if all(r['source_values'].get(c) == '0' for r in records)]
    schema = {c: {'label': label, 'description': rows.get(4, {}).get(c, {}).get('value'),
                   'editable_in_source_template': rows.get(3, {}).get(c, {}).get('value') == 'Редактируемое'}
              for c, label in headers.items()}
    checks = {'rows': len(records), 'unique_sku': len(seen),
              'expected_count': expected_count,
              'coverage': 'matches_visible_count' if expected_count is not None else 'unverified',
              'status_counts': dict(collections.Counter(r['source_values'].get('D') for r in records)),
              'all_zero_analytics_columns': suspicious,
              'analytics_usable': not suspicious,
              'buyer_card_price': 'not_present',
              'dashboard_update': 'not_performed'}
    return records, schema, checks


def analytics_records(sheets, expected_count=None):
    sheet = next((s for s in sheets if s['sheet'] == 'По товарам'), None)
    if sheet is None:
        raise ValueError('Missing daily product sheet')
    rows = {r['row']: r['cells'] for r in sheet['rows']}
    headers = {c: v['value'] for c, v in rows[10].items() if c <= 'J' and len(c) == 1}
    headers.update({c: v['value'] for c, v in rows[11].items() if v['value'] is not None})
    for col, label in {'G': 'Схема работы', 'H': 'SKU', 'I': 'Артикул', 'J': 'День',
                       'P': 'Позиция в поиске\nи каталоге', 'Q': 'Показы всего',
                       'S': 'Показы в поиске и\nкаталоге', 'W': 'Посещения карточки товара',
                       'AA': 'Добавления в\nкорзину всего', 'AC': 'Заказано товаров'}.items():
        if headers.get(col) != label:
            raise ValueError('Unexpected analytics schema at ' + col)
    period = rows[1]['A']['value']
    match = re.fullmatch(r'Период: (\d{2}\.\d{2}\.\d{4}) – (\d{2}\.\d{2}\.\d{4})', period)
    if not match:
        raise ValueError('Missing source period')
    start, end = [dt.datetime.strptime(v, '%d.%m.%Y').date().isoformat() for v in match.groups()]
    records, totals, seen = [], [], set()
    for r in sheet['rows']:
        if r['row'] < 13:
            continue
        values = {c: v['value'] for c, v in r['cells'].items()}
        if values.get('A') == 'Итого и среднее':
            totals.append(values)
            continue
        sku, day = values.get('H'), values.get('J')
        if not sku or not re.fullmatch(r'[0-9]+', sku) or not values.get('I'):
            raise ValueError('Missing analytics SKU/offer')
        if not day or dt.date.fromisoformat(day).isoformat() != day or not start <= day <= end:
            raise ValueError('Analytics day outside source period')
        key = (sku, day, values.get('G'))
        if key in seen:
            raise ValueError('Duplicate analytics SKU/day/scheme')
        seen.add(key)
        records.append({'source_row': r['row'], 'sku': sku, 'offer_id': values['I'],
                        'day': day, 'scheme': values.get('G'),
                        'source_values': {c: values.get(c) for c in headers}})
    if len(totals) != 1 or not records:
        raise ValueError('Expected one total row and nonempty analytics')
    if expected_count is not None and len(records) != expected_count:
        raise ValueError('Analytics coverage mismatch')
    controls = {}
    for c in ['M', 'N', 'Q', 'S', 'U', 'W', 'Y', 'AA', 'AC', 'AD', 'AF', 'AG', 'AH']:
        actual = sum(Decimal(r['source_values'][c]) for r in records)
        reported = Decimal(totals[0][c])
        controls[c] = {'label': headers[c], 'reported': str(reported), 'detail_sum': str(actual),
                       'difference': str(actual - reported)}
        if c not in ('M', 'N') and actual != reported:
            raise ValueError('Analytics additive count mismatch in ' + c)
    checks = {'rows': len(records), 'unique_sku': len({r['sku'] for r in records}),
              'period_from': start, 'period_to': end, 'expected_count': expected_count,
              'coverage': 'unverified_against_catalog',
              'source_company': rows[8]['A']['value'],
              'source_scope': rows[5]['A']['value'], 'internal_controls': controls,
              'dashboard_update': 'not_performed'}
    schema = {c: {'label': label, 'description': rows[12].get(c, {}).get('value')}
              for c, label in headers.items()}
    return records, schema, checks


def rating_records(sheets, expected_count=None):
    sheet = next((s for s in sheets if s['sheet'] == 'Детализация отчёта для шкалы'), None)
    if sheet is None:
        raise ValueError('Missing rating details sheet')
    rows = {r['row']: r['cells'] for r in sheet['rows']}
    headers = {c: v['value'] for c, v in rows[6].items()}
    for c, label in {'A': 'Номер отправления', 'K': 'Отмена в числителе (х2)',
                      'L': 'Просрочка в числителе'}.items():
        if headers.get(c) != label:
            raise ValueError('Unexpected rating schema')
    summary = {rows[i]['A']['value']: rows[i]['B']['value'] for i in range(1, 5)}
    records, seen = [], set()
    for r in sheet['rows']:
        if r['row'] < 7:
            continue
        values = {c: v['value'] for c, v in r['cells'].items()}
        posting = values.get('A')
        if not posting or posting in seen:
            raise ValueError('Missing/duplicate rating posting')
        seen.add(posting)
        records.append({'source_row': r['row'], 'posting_number': posting,
                        'source_values': {c: values.get(c) for c in headers}})
    reported = int(summary['Все отправления к отгрузке'])
    if not records or len(records) != reported or (expected_count is not None and len(records) != expected_count):
        raise ValueError('Rating coverage mismatch')
    for col, label in [('K', 'Отмены (с коэффициентом х2)'), ('L', 'Просроченные отгрузки и доставки')]:
        if sum(Decimal(r['source_values'][col]) for r in records) != Decimal(summary[label]):
            raise ValueError('Rating numerator control failed')
    return records, {c: {'label': label} for c, label in headers.items()}, {
        'rows': len(records), 'summary': summary, 'timezone': 'Europe/Moscow',
        'coverage': 'matches_report_denominator', 'period': 'see_observation_context',
        'dashboard_update': 'not_performed'}


def competitor_records(sheets, expected_count=None):
    sheet = next((s for s in sheets if s['sheet'] == 'Конкурентная позиция'), None)
    if sheet is None:
        raise ValueError('Missing competitor sheet')
    rows = {r['row']: r['cells'] for r in sheet['rows']}
    headers = {c: v['value'] for c, v in rows[3].items()}
    for c, label in {'B': 'Название конкурента', 'F': 'Артикул Ozon',
                      'I': 'Заказано на сумму, ₽', 'J': 'Заказано товаров'}.items():
        if headers.get(c) != label:
            raise ValueError('Unexpected competitor schema')
    records, seen = [], set()
    for r in sheet['rows']:
        if r['row'] < 4:
            continue
        values = {c: v['value'] for c, v in r['cells'].items()}
        key = (values.get('B'), values.get('F'))
        if not all(key) or not re.fullmatch(r'[0-9]+', key[1]) or key in seen:
            raise ValueError('Missing/duplicate competitor SKU')
        seen.add(key)
        records.append({'source_row': r['row'], 'seller_name': key[0], 'sku': key[1],
                        'source_values': {c: values.get(c) for c in headers}})
    if not records or (expected_count is not None and len(records) != expected_count):
        raise ValueError('Competitor coverage mismatch')
    return records, {c: {'label': label} for c, label in headers.items()}, {
        'rows': len(records), 'source_period': rows[1]['A']['value'],
        'source_category': rows[2]['A']['value'],
        'seller_rows': dict(collections.Counter(r['seller_name'] for r in records)),
        'coverage': 'only_exported_sellers_in_one_category',
        'daily_sales': 'not_available_from_period_report', 'dashboard_update': 'not_performed'}


def intake(source, out, kind, expected_count=None, context=None):
    source = Path(source)
    payload = source.read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    sheets = read_xlsx(source)
    readers = {'prices': price_records, 'analytics': analytics_records,
               'rating': rating_records, 'competitors': competitor_records}
    failure = None
    try:
        records, schema, checks = readers[kind](sheets, expected_count)
    except (ValueError, KeyError) as error:
        failure = str(error)
        records, schema, checks = [], {}, {'validation_status': 'rejected', 'reason': failure,
                                          'dashboard_update': 'not_performed'}
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    destination = out / (('rejected-' if failure else '') + kind + '-' + digest)
    if destination.exists():
        if (destination / 'original.xlsx').read_bytes() != payload:
            raise ValueError('Archive integrity failure')
        prior = json.loads((destination / 'manifest.json').read_text())
        if prior['context'] != (context or {}) or prior['checks'] != checks:
            raise ValueError('Existing content has different context; use a separate archive root')
        if failure:
            raise ValueError(f'{failure}; quarantined at {destination}')
        return destination
    with tempfile.TemporaryDirectory(dir=out) as temp:
        tmp = Path(temp)
        (tmp / 'original.xlsx').write_bytes(payload)
        manifest = {'schema_version': 1, 'kind': kind, 'source_name': source.name,
                    'sha256': digest, 'loaded_at': dt.datetime.now(dt.timezone.utc).isoformat(),
                    'context': context or {}, 'checks': checks, 'columns': schema,
                    'sheets': [{'name': s['sheet'], 'physical_rows': len(s['rows'])} for s in sheets]}
        (tmp / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        (tmp / 'source-cells.json').write_text(json.dumps(sheets, ensure_ascii=False) + '\n')
        if records:
            (tmp / 'records.ndjson').write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in records))
        tmp.rename(destination)
    if failure:
        raise ValueError(f'{failure}; quarantined at {destination}')
    return destination


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source')
    parser.add_argument('--out', required=True)
    parser.add_argument('--kind', choices=['prices', 'analytics', 'rating', 'competitors'], required=True)
    parser.add_argument('--expected-count', type=int)
    parser.add_argument('--context', help='JSON context: company, period and visible filters')
    args = parser.parse_args()
    try:
        print(intake(args.source, args.out, args.kind, args.expected_count,
                     json.loads(Path(args.context).read_text()) if args.context else None))
    except ValueError as error:
        print(str(error), file=sys.stderr)
        sys.exit(2)
