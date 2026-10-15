# P5: 26 артикулов «Цены вниз»: цена в окне базы заказов (14.09-11.10, путь цены с 23.09) против «Наша цена сейчас» (p0 = цена 14.10)
# и «Новая наша цена» (p1). Модель v5 считает, что базовые заказы U получены при p0; если цена в базе была другой, прирост от шага смещён.
import sys, json, collections as C, datetime as dt
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import plan7 as P, forecast as F
pr = C.defaultdict(dict)
for l in open(F.D + 'prices_daily.ndjson'):
    x = json.loads(l)
    if x['d'] >= '2026-09-23': pr[x['offer']][x['d']] = x['price']
days = [(dt.date.fromisoformat(F.A) + dt.timedelta(days=i)).isoformat() for i in range(28)]
def base_avg(off):
    p = pr[off]; ds = sorted(p); out = []
    for d in days:
        prev = [x for x in ds if x <= d]; out.append(p[prev[-1]] if prev else p[ds[0]])
    return sum(out) / len(out), out
n_diff = 0; bias = C.Counter(); rows = []
for sku, o in F.lst.items():
    r = F.rows[sku]; off = o['art']; avg, path = base_avg(off); p0 = r['p0']; st = o['step'] / 100; p1 = p0 * (1 - st)
    u = F.U[sku] / F.WEEKS
    when = '15.10' if sku in P.NOW else '22.10'
    for sc in F.SCN:
        eps = F.EPS[sc]
        model = u * ((1 - st) ** eps - 1)                                    # прирост модели: шаг от p0 к базе U
        u0 = u / (sum((pd / p0) ** eps for pd in path) / len(path))          # заказы при p0 с учётом пути цены
        true = u0 * (1 - st) ** eps - u                                      # прирост к базе U при p1
        bias[sc] += (true - model) * 4.33
    if abs(p0 / avg - 1) > 0.02:
        n_diff += 1
        rows.append(f'  {when} {off:20} заказов/нед {u:4.2f}  цена базы ср. {avg:9,.0f}  сейчас {p0:9,.0f} ({p0 / avg - 1:+.0%})  новая {p1:9,.0f} ({p1 / avg - 1:+.0%} к базе)'.replace(',', ' '))
print(f'из 26 у {n_diff} цена 14.10 отличается от средней цены окна базы больше чем на 2%:')
print('\n'.join(rows))
print('смещение прироста заказов от шага цены (модель минус путь цены), шт в месяц: ' + ', '.join(f'{sc} {-v:+.1f}' for sc, v in bias.items()) +
      '  (плюс - модель завышает)')
