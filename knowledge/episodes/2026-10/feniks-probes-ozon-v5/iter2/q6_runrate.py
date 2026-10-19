# ФЕНИКС итерация 2 (OZON v5 @ 6a8dd1c): «как сейчас» = идущие кампании на СРЕДНЕМ бюджете 4 недель. Кампании, запущенные
# в октябре (08.10: «четыре кампании по 33-52 ₽», v4 make3.js:133), этим средним разбавлены. Темп = расход и заказы отчёта
# с даты запуска / дней работы x 7 (для октябрьских); остальные - как в модели. Пересчёт клика «сейчас» и «клик до минимума».
import sys
sys.path.insert(0, '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v5')
import forecast as F
first = {}
for a in F.ads:
    if a['id'] != F.CPO_ID and F.A <= a['d'] <= F.B and a['sp'] > 0: first[a['id']] = min(first.get(a['id'], '9'), a['d'])
def wk(cid, c):
    f = first.get(cid, '')
    if f >= '2026-10-01':
        days = int(F.B[-2:]) - int(f[-2:]) + 1
        return c['sp'] / days * 7, c['o'] / days * 7
    return c['sp'] / F.WEEKS, c['o'] / F.WEEKS
new = [(cid, c) for cid, c in F.camp.items() if F.active(c) and first.get(cid, '') >= '2026-10-01']
print(f'запущены в октябре: {len(new)} кампаний; среднее 4 нед {sum(c["sp"] for _, c in new) / F.WEEKS:,.0f} ₽/нед, '
      f'темп {sum(wk(cid, c)[0] for cid, c in new):,.0f} ₽/нед'.replace(',', ' '))
for sc in F.SCN:
    k = F.K_CLK[sc]; save = lost = now = 0
    for cid, c in F.camp.items():
        if not F.active(c): continue
        w, o = wk(cid, c); m = min(w, F.MIN_WK); now += w; save += w - m
        lost += o * (1 - (m / w) ** F.E_SP) * k * F.camp_pi(c)[0] if w > 0 else 0
    model = F.run('Вк', sc)['prof'] - F.run('В0', sc)['prof']
    print(f'{sc:8}: клик «сейчас» {now * 2 / 1e3:.0f} тыс. за 2 нед (модель {F.run("В0", sc)["clk"] / 1e3:.0f}); '
          f'клик до минимума {(save - lost) * 2 / 1e3:+.0f} тыс. (модель {model / 1e3:+.0f})')
