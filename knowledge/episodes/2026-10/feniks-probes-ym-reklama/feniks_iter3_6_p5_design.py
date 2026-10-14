# ФЕНИКС, итерация 3, проба 6 (R3/R4, X5-повтор): пилот П5 - порог стопа, зрелость недельного счёта, 11.11, безубыточность, «100 тыс. за 4 недели».
# Только чтение analytics-mvp/data-ym. Запуск: python3 -I feniks_iter3_6_p5_design.py
import json, collections, statistics, datetime
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
o = rd('orders.ndjson')
F = '74986385'
p = [r for r in o if not r['service'] and r['business'] == F]
dt = datetime.date.fromisoformat
wk = lambda s: dt(s) - datetime.timedelta(days=dt(s).weekday())
canc = lambda r: r['status'].startswith('CANCELLED')
# 1) ряд недель (заказы без отмен, финальный статус на снимок), база вне провала
fin = collections.Counter(); tot = collections.Counter()
for r in p:
    if '2026-06-29' <= r['created'] <= '2026-10-12':
        tot[wk(r['created'])] += 1
        if not canc(r):
            fin[wk(r['created'])] += 1
ks = sorted(tot)
base = [fin[k] for k in ks if dt('2026-06-29') <= k <= dt('2026-09-21') and not (dt('2026-07-20') <= k <= dt('2026-08-10'))]
mu, sd = statistics.mean(base), statistics.stdev(base)
print(f'1) база вне провала: {base}, среднее {mu:.1f}, SD {sd:.2f}, порог среднее - 2 SD = {mu - 2 * sd:.1f}')
print('   недели с 14.09 (финальный статус на снимок 12.10): ' + ', '.join(f'{k.isoformat()[5:]} {fin[k]} из {tot[k]}' for k in ks if k >= dt('2026-09-14')))
# 2) зрелость: сколько заказов недели числились «без отмены» через k дней после конца недели, против финального счёта
print('2) зрелость счёта: недели базы, счёт «без отмен» на день конец недели + k против финального (лишние = отменены позже)')
for kd in (1, 3, 7, 14):
    extra = []
    for k in ks:
        if not (dt('2026-06-29') <= k <= dt('2026-09-14')):
            continue
        T = k + datetime.timedelta(days=6 + kd)
        at_T = sum(1 for r in p if wk(r['created']) == k and (not canc(r) or dt(r['statusDate']) > T))
        extra.append(at_T - fin[k])
    print(f'   k = {kd} дн: лишних в среднем {statistics.mean(extra):.1f} заказа на неделю (мин {min(extra)}, макс {max(extra)}), это {statistics.mean(extra) / mu:.0%} от среднего базы')
# 3) правило стопа на последних неделях без всякого пилота (финальный счёт и поправка на позднюю зрелость)
late = [fin[k] for k in ks if k >= dt('2026-09-14')]
print(f'3) правило «две недели подряд меньше {mu - 2 * sd:.0f}»: последние недели {late[:-1]} (неделя 12.10 неполная) - ниже порога уже сейчас: {[x for x in late[:-1] if x < round(mu - 2 * sd)]}')
# 4) 11.11 и чередование 4 + 4 со старта вторник 20.10
start = dt('2026-10-20')
weeks = [(start + datetime.timedelta(days=7 * i), start + datetime.timedelta(days=7 * i + 6)) for i in range(8)]
for i, (a, z) in enumerate(weeks):
    tag = ' <- 11.11' if a <= dt('2026-11-11') <= z else ''
    print(f'4) неделя {i + 1}: {a.isoformat()[5:]}-{z.isoformat()[5:]}, плечо {"6%" if i % 2 == 0 else "8,8%"} (если начать с 6%){tag}')
print(f'   всплеск одной недели как максимум базы ({max(base)} против среднего {mu:.1f}) сдвигает среднее своего плеча на {(max(base) - mu) / 4:.1f} заказа в неделю = {(max(base) - mu) / 4 / 11:.0%} от MDE 11')
# 5) безубыточность: экономия буста в неделю 6% против маржи в деньгах на заказ мебели (проба 5: 13 926 на единицу)
boost_sep = 641325; red = 1 - 6 / 8.8
wk_save = boost_sep * 7 / 30 * red
print(f'5) снижение 8,8 -> 6%: -{red:.1%}; экономия буста (деньги + баллы) в неделю 6% = {wk_save:,.0f}; за 4 такие недели {4 * wk_save:,.0f} (в артефакте «около 100 тыс.»)')
mpu = 13926
for share, lab in ((0.25, 'деньгами 25%'), (1.0, 'деньгами 100%')):
    be = wk_save * share / mpu
    print(f'   безубыточная потеря заказов в неделю ({lab} экономии / маржа в деньгах {mpu:,} на заказ): {be:.1f} заказа = {be / mu:.0%} от {mu:.1f}; MDE 11 больше в {11 / be:.0f} раз')
print(f'   нижняя граница артефакта: 0,3 × 25% × 100 тыс. = 7,5 тыс.; от пересчёта 0,3 × 25% × {4 * wk_save:,.0f} = {0.3 * 0.25 * 4 * wk_save:,.0f}')
