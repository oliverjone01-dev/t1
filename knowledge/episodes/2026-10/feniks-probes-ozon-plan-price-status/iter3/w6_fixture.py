# ФЕНИКС iter3 (e063381). W6 на живом коде: перерасход рекламы x r с 15.10 при факте 01-14.10 как есть.
# Фикстура поверх закреплённых data/ (копия 4f2409c): ads_daily = копия + строки синтетической кампании FX6 (не 28753239)
# с 15.10 по last, sp = r x ставка плана в день (283 110 + 51 598) / 7 = 47 815,4 (s3_gauges.py). Окно прочих 01-13.10 и
# ADS_FULL фикстура не трогает (строки с 15.10, состояния у FX6 нет). Печатает пары <dir>:<today> для render7.mts.
# python3 -I w6_fixture.py
import json, os, shutil, datetime as dt
SC = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/'
SRC = SC + 'p5/data_4f2409c/analytics-mvp/data/'
OUTD = SC + 'p6/'
RATE = (283110 + 51598) / 7
D = lambda s: dt.date.fromisoformat(s)
rng = lambda a, b: [(D(a) + dt.timedelta(days=k)).isoformat() for k in range((D(b) - D(a)).days + 1)]
pairs = []
for r, last in ((1.5, '2026-10-15'), (1.5, '2026-10-20'), (1.5, '2026-10-21'), (1.5, '2026-10-28'), (1.3, '2026-10-28'), (1.3, '2026-10-31'), (1.0, '2026-10-28'), (0.8, '2026-10-28')):
    nm = f'w6_x{str(r).replace(".", "")}_{last[5:].replace("-", "")}'
    dst = OUTD + 'fx_' + nm + '/'
    if os.path.isdir(dst): shutil.rmtree(dst)
    os.makedirs(dst)
    for f in os.listdir(SRC):
        if f != 'ads_daily.ndjson': os.symlink(SRC + f, dst + f)
    shutil.copy(SRC + 'ads_daily.ndjson', dst + 'ads_daily.ndjson')
    with open(dst + 'ads_daily.ndjson', 'a', encoding='utf-8') as fh:
        for d in rng('2026-10-15', last):
            fh.write(json.dumps({'d': d, 'id': 'FX6', 'sp': round(r * RATE, 2), 'cl': 100}) + '\n')
    pairs.append(f'{dst.rstrip("/")}:{(D(last) + dt.timedelta(days=1)).isoformat()}')
open(OUTD + 'w6_pairs.txt', 'w', encoding='utf-8').write(' '.join(pairs))
print(len(pairs), 'пар ->', OUTD + 'w6_pairs.txt')
