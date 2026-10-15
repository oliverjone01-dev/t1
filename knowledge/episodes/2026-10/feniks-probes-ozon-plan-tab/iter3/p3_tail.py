# iter3, N1-обход: бывает ли в выгрузке заказ с d позже окна выгрузки (to = вчера UTC от времени коммита cron).
# Фильтр postings since/to может идти по created_at, а d = in_process_at: заказ, созданный в 23:5x UTC и взятый в
# обработку после полуночи, получит d = to + 1 и сам станет «последним полным днём». Проверка по истории git (только чтение).
# python3 -I p3_tail.py [N]
import subprocess, json, sys, datetime as dt, collections
N = int(sys.argv[1]) if len(sys.argv) > 1 else 60
REPO = '/home/user/t1'
P = 'analytics-mvp/data/orders_daily.ndjson'
log = subprocess.run(['git', '-C', REPO, 'log'] + (['--all'] if len(sys.argv) > 2 else []) + [f'-{N}', '--format=%H %cI %s', '--', P], capture_output=True, text=True).stdout.splitlines()
res = collections.Counter(); ex = []
for line in log:
    h, ts, *subj = line.split(' ')
    cdate = dt.datetime.fromisoformat(ts).astimezone(dt.timezone.utc).date()
    to = (cdate - dt.timedelta(days=1)).isoformat()
    raw = subprocess.run(['git', '-C', REPO, 'show', f'{h}:{P}'], capture_output=True, text=True).stdout
    ds = collections.Counter()
    for l in raw.splitlines():
        if not l.strip(): continue
        try: r = json.loads(l)
        except Exception: continue
        ds[r.get('d', '')] += 1
    mx = max(ds) if ds else ''
    tag = 'd>to' if mx > to else ('d=to' if mx == to else 'd<to')
    res[tag] += 1
    if mx > to or len(ex) < 3: ex.append((h[:8], ts, 'to', to, 'max d', mx, 'строк с max d', ds.get(mx, 0), 'строк с d>to', sum(v for k, v in ds.items() if k > to), ' '.join(subj)[:50]))
print('коммитов', len(log), dict(res))
for e in ex[:15]: print('  ', *e)
