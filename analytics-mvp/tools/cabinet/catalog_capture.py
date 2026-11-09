"""Price/stock/tariff observations from the same catalog already downloaded daily.

No order totals from the catalog: those columns have no verified reporting window.
Column positions are resolved from labels, including the November schema shift.
"""
import datetime as dt
import hashlib
from decimal import Decimal
from zoneinfo import ZoneInfo
from import_report import read_xlsx, price_records

FIELDS = {
    'cap': 'Предельная цена, руб.', 'buyer': 'Цена реализации, руб.',
    'stock_ozon': 'На складе Ozon', 'stock_seller': 'На моих складах',
    'commission_fbo': 'Вознаграждение Ozon, FBO, %',
    'commission_fbs': 'Вознаграждение Ozon, FBS, %',
    'logistics_fbo_min': 'Логистика Ozon, минимум, FBO',
    'logistics_fbo_max': 'Логистика Ozon, максимум, FBO',
    'logistics_fbs_min': 'Логистика Ozon, минимум, FBS',
    'logistics_fbs_max': 'Логистика Ozon, максимум, FBS',
    'acquiring': 'Эквайринг',
}
TEXT = {'name': 'Название товара', 'status': 'Статус', 'price_index': 'Индекс цен',
        'auto_promo': 'Автодобавление товара в акции'}


def catalog_capture(path, captured_at, phase, expected_count=None):
    stamp = dt.datetime.fromisoformat(captured_at.replace('Z', '+00:00'))
    if stamp.tzinfo is None or phase not in ['утро', 'вечер', 'once']:
        raise ValueError('Catalog requires zoned source timestamp and phase')
    records, schema, checks = price_records(read_xlsx(path), expected_count)
    labels = {v['label']: k for k, v in schema.items()}
    if len(labels) != len(schema):
        raise ValueError('Duplicate catalog labels')
    items = []
    for r in records:
        row = {'sku': r['sku'], 'art': r['offer_id']}
        for key, label in FIELDS.items():
            v = r['source_values'].get(labels.get(label))
            if v in [None, '', '–', '-', 'Нет данных']:
                row[key] = None
            else:
                n = Decimal(v)
                if not n.is_finite() or n < 0:
                    raise ValueError('Invalid catalog numeric value: ' + key)
                row[key] = float(n)
        for key, label in TEXT.items():
            row[key] = r['source_values'].get(labels.get(label))
        # Do not invent a percent when a price is absent/zero or above the cap.
        row['gap_pct'] = (1-row['buyer']/row['cap'])*100 if row['cap'] and row['buyer'] is not None and row['buyer'] <= row['cap'] else None
        items.append(row)
    return {'day': stamp.astimezone(ZoneInfo('Europe/Moscow')).date().isoformat(),
            'captured_at': stamp.isoformat(), 'phase': phase,
            'source': 'ozon-catalog-xlsx', 'source_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'expected': expected_count, 'items': items}


def merge_catalogs(previous, incoming, now=None, backfill_since=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    rows = {(r['day'], r['phase']): r for r in previous}
    for r in incoming:
        key = r['day'], r['phase']
        if rows.get(key) == r:
            continue
        stamp = dt.datetime.fromisoformat(r['captured_at'].replace('Z', '+00:00'))
        if stamp.tzinfo is None or stamp > now+dt.timedelta(minutes=5):
            raise ValueError('Catalog observation in future or without timezone')
        if stamp.astimezone(ZoneInfo('Europe/Moscow')).date().isoformat() != r['day']:
            raise ValueError('Catalog day must be Moscow observation day')
        if backfill_since is None and now-stamp > dt.timedelta(hours=3):
            raise ValueError('Changed catalog older than three hours; explicit backfill window required')
        if backfill_since and not backfill_since <= r['day'] <= now.astimezone(ZoneInfo('Europe/Moscow')).date().isoformat():
            raise ValueError('Catalog outside backfill window')
        if key in rows and stamp <= dt.datetime.fromisoformat(rows[key]['captured_at'].replace('Z', '+00:00')):
            raise ValueError('Cannot replace catalog with older/conflicting observation')
        rows[key] = r
    return sorted(rows.values(), key=lambda r: (r['day'], r['captured_at']))
