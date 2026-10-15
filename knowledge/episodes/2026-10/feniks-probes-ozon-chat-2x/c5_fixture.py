# ФЕНИКС, PR #477 @ 889c35b. Фикстуры каталога данных для пересборки страницы «Тесты» в scratch.
# Все файлы - симлинки на живые analytics-mvp/data, кроме funnel_tests.ndjson.
#   eve   - строки за 15.10 помечены full:false, ts 2026-10-15T20:10:00+03:00, snap «вечер» (как будет после мержа и вечернего съёма)
#   contra - строки за 15.10 помечены full:true, но ts 2026-10-15T13:05:00+03:00 (ошибка продьюсера: день не закрыт)
#   eve2  - как eve, плюс 14.10 тоже full:false (утро 15.10 не прошло, «застрявший» день)
# python3 -I c5_fixture.py <eve|contra|eve2>
import json, os, sys, shutil

SP = '/tmp/claude-0/-home-user-t1/f57f6776-149c-58f9-8707-d73e74e89ad9/scratchpad/'
DD = '/home/user/t1/analytics-mvp/data/'
sc = sys.argv[1]
OUT = SP + 'fx_' + sc + '/'
if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)
for f in os.listdir(DD):
    if f != 'funnel_tests.ndjson':
        os.symlink(DD + f, OUT + f)
n = 0
with open(OUT + 'funnel_tests.ndjson', 'w', encoding='utf-8') as w:
    for l in open(DD + 'funnel_tests.ndjson', encoding='utf-8'):
        if not l.strip():
            continue
        r = json.loads(l)
        d = str(r.get('date', ''))[:10]
        if d == '2026-10-15' or (sc == 'eve2' and d == '2026-10-14'):
            n += 1
            if sc in ('eve', 'eve2'):
                r.update(full=False, ts=f'{d}T20:10:00+03:00', snap='вечер')
            else:
                r.update(full=True, ts=f'{d}T13:05:00+03:00', snap='утро')
        w.write(json.dumps(r, ensure_ascii=False) + '\n')
print('fixture', sc, 'помечено строк', n, '->', OUT)
