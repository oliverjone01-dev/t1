# ФЕНИКС, итерация 4, проба 3 (S3, X5-повтор): относительное правило стопа П5 своим кодом.
# Правило артефакта:135: «неделя 6% ниже 65% среднего двух соседних недель 8,8%, два раза подряд»; «на истории квартала
# это правило сработало бы 2 раза из 6». Проверяю: обе фазы чередования, одиночные срабатывания против «два раза подряд»,
# недели 14.09-11.10 (приёмка S3: цель 0), MDE чередования. Ряд: товарные строки мебели без отмен по неделе создания
# (пн-вс), 29.06-27.09. Только чтение. Запуск: python3 -I feniks_iter4_3_stop_rule.py
import json, collections, statistics, datetime
D = '/home/user/t1/analytics-mvp/data-ym/'
o = [json.loads(l) for l in open(D + 'orders.ndjson')]
F = '74986385'
dt = datetime.date.fromisoformat
wk = lambda s: dt(s) - datetime.timedelta(days=dt(s).weekday())
p = [r for r in o if not r['service'] and r['business'] == F and not r['status'].startswith('CANCELLED')]
cnt = collections.Counter(wk(r['created']) for r in p if '2026-06-29' <= r['created'] <= '2026-10-11')
weeks = [dt('2026-06-29') + datetime.timedelta(days=7 * i) for i in range(15)]
xs = [cnt.get(w, 0) for w in weeks[:13]]
print('недели 29.06-21.09 (13):', xs)
base = xs[:3] + xs[7:]
mb, sb = statistics.mean(base), statistics.stdev(base)
print(f'база вне провала: среднее {mb:.1f}, SD {sb:.2f}; MDE чередования 4 + 4 = 2,8 × SD × √(2/4) = {2.8 * sb * 0.5 ** 0.5:.2f}')


def hits(series, phase, k=0.65):
    return [i for i in range(phase, len(series) - 1, 2) if i >= 1 and series[i] < k * (series[i - 1] + series[i + 1]) / 2]


for ph, lab in ((1, 'фаза А: «6%» = недели 2, 4, 6 ... (как в скрипте автора)'), (2, 'фаза Б: «6%» = недели 3, 5, 7 ...')):
    h = hits(xs, ph)
    tested = [i for i in range(ph, len(xs) - 1, 2) if i >= 1]
    pairs = [(a, b2) for a, b2 in zip(tested, tested[1:]) if a in h and b2 in h]
    print(f'{lab}: проверяемых недель {len(tested)}, одиночных срабатываний {len(h)} (недели {[weeks[i].isoformat()[5:] for i in h]}), '
          f'срабатываний «два раза подряд» {len(pairs)}')
recent = [cnt.get(w, 0) for w in weeks[11:15]]
print('недели 14.09, 21.09, 28.09, 05.10 (на снимок, две последние незрелые):', recent)
for ph in (1, 2):
    h = [i for i in range(ph, len(recent) - 1, 2) if i >= 1 and recent[i] < 0.65 * (recent[i - 1] + recent[i + 1]) / 2]
    print(f'   чередование с фазой {ph}: срабатываний {len(h)}')
# задержка правила: неделя 6% считается на 14-й день после конца правой соседней недели (артефакт:135, «обе недели на 14-й день»)
start = dt('2026-10-20')
cal = [(start + datetime.timedelta(days=7 * i), start + datetime.timedelta(days=7 * i + 6)) for i in range(10)]
print('календарь пилота по артефакту (10 недель с 20.10):', ', '.join(f'W{i + 1} {a.strftime("%d.%m")}-{b2.strftime("%d.%m")}' for i, (a, b2) in enumerate(cal)))
for first in (0, 1):
    six = [i for i in range(10) if i % 2 == first]
    out = []
    for i in six:
        if i + 1 < 10:
            out.append(f'W{i + 1}: проверка не раньше {(cal[i + 1][1] + datetime.timedelta(days=14)).strftime("%d.%m")}')
    print(f'   «6%» с W{first + 1}: ' + '; '.join(out))
