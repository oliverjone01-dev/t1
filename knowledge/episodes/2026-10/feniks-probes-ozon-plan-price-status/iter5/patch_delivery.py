# ФЕНИКС iter5: правка сроков в отчёте и JSON на момент сдачи (16.10 06:09 UTC). На main заказы и реклама по 14.10 -
# первой сборки с фактом периода ещё не было, срок G3 и G1t привязан к ней, а не к 03:00 16.10. python3 -I patch_delivery.py
import json, pathlib
S = pathlib.Path('/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/out')
MD, JS = S / 'feniks-audit-ozon-plan-iter5-20261015.md', S / 'feniks-audit-ozon-plan-iter5-20261015.json'
FIRST = 'до первой сборки с фактом периода (заказы и реклама за 15.10; на 16.10 06:09 UTC на main они по 14.10)'
md = MD.read_text(encoding='utf-8')
rep_md = [
    ('- Где лежит.', '- Сдача: 16.10 09:10 МСК. На main (710ec0d8) orders_daily и ads_daily по 14.10: сборок с фактом периода ещё не было, #482 не слит. Хеш 381f11d5 против нового main тот же (merge-base 9a3a212).\n- Где лежит.'),
    ('- G3 и G1t - до сборки 16.10 03:00 МСК: это та самая первая сборка с фактом периода, правка в одну строку плюс тест.',
     f'- G3 и G1t - {FIRST}: правка в одну строку плюс тест.'),
    ('  - G3 (фикс Codex) и G1t (тест по SVG) - до сборки 16.10 03:00 МСК.', f'  - G3 (фикс Codex) и G1t (тест по SVG) - {FIRST}.'),
    ('  - До 03:00 МСК укладывается.', '  - До первой сборки с фактом периода укладывается.'),
    ('STEP 12.5: пройден (go на 381f11d5). G3 и G1t - до сборки 16.10.', 'STEP 12.5: пройден (go на 381f11d5). G3 и G1t - до первой сборки с фактом периода.'),
]
for a, b in rep_md:
    assert md.count(a) == 1, a[:50]
    md = md.replace(a, b)
MD.write_text(md, encoding='utf-8')
d = json.loads(JS.read_text(encoding='utf-8'))
d['timestamp'] = '2026-10-16T09:10:00+03:00'
g0 = d['gaps'][0]
assert g0.startswith('G3 (Codex P2, до сборки 16.10 03:00 МСК)')
d['gaps'][0] = g0.replace('G3 (Codex P2, до сборки 16.10 03:00 МСК)', 'G3 (Codex P2, до первой сборки с фактом периода - на 16.10 06:09 UTC заказы и реклама на main по 14.10)')
d['primary_gap'] = d['primary_gap'].replace('на сборке 16.10 - первой с фактом периода -', 'на первой сборке с фактом периода (1 день данных, 15.10)')
for e in d['evidence_ledger']:
    if e['gap'].startswith('G3'):
        e['gap'] = 'G3 Codex P2: жёлтая дуга нулевой длины на первой сборке с фактом периода (1 день данных)'
JS.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('ok', MD, JS, '| em dash', md.count(chr(0x2014)), JS.read_text(encoding='utf-8').count(chr(0x2014)))
