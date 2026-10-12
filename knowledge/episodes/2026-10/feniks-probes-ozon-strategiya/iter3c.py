"""ФЕНИКС, итерация 3: есть ли товары теста 4 в карточках пилота цены (тест 4 идёт до 28.10).
Запуск из корня репо: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-strategiya/iter3c.py
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[4]
cg = json.load(open(ROOT / 'analytics-mvp/data/card_groups.json', encoding='utf-8'))
t4 = set(json.load(open(ROOT / 'analytics-mvp/tools/tests/tests.json', encoding='utf-8'))['тесты_цены'][0]['тест'])
cards = ['4756836485', '4681610246', '4756832758', '4714207903', '4756831262', '6218562206', '4681616626', '4681610507']
found = {g['main']: [x['offer'] for x in g['skus'] if x['offer'] in t4] for g in cg['groups'] if g['main'] in cards}
print({k: v for k, v in found.items() if v} or 'товаров теста 4 в карточках пилота цены нет')
