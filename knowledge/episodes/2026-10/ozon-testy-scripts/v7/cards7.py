# v7: «показы через объединённые карточки» (Иван 14.10: «цель не протестить, а получить прибыль и увеличить заказы; нужны показы -
# увеличиваем основную карточку с показами на объединённую, минимальный клик для скидки»).
# Механика: в каждой объединённой карточке (card_groups.json) главный товар = больше всех показов в поиске за 14.09-11.10
# (sku_views.vsearch) получает повышенный клик; остальные товары карточки с продажами за 60 дней и без рекламы - минимальный клик
# 8 ₽ (тест 1: доля цены на сайте 0,4619 против 0,5371 без рекламы - скидка за счёт OZON).
# Допущения [ГИПОТЕЗА], по сценариям плохо / средне / хорошо:
#  показы клика = 1,63 на 1 ₽ (ads_daily 14.09-11.10), сверх текущего бюджета - степень 0,81 (v5 E_SP);
#  заказы с показа клика = доля K_SH от конверсии карточки (заказы / показы поиска): 0 (тест 3: KONUX показы x18, заказы нет) /
#  0,3 (ниже доли по отчёту рекламы: KONUX 0,041 / 0,095 = 0,43, KUVINO 0,112 / 0,296 = 0,38 - часть заказов рекламы перетянута) / 1,0 (как обычный показ карточки);
#  минимальный клик на остальных: + заказов в неделю на товар 0 / 0,3 / 0,55 (тест 1: 12,6 шт на 7 товаров за 23 дня = 0,55;
#  середина - половина с поправкой на перетягивание, как в KONUX), расход 1 523 ₽/нед на товар (факт теста 1).
# Прибыль заказа - модель v5 (без АДМ), у товара без модели - медиана. Выход: /tmp/ozon-v7/cards7.json
import sys, os, json, collections as C
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, HERE + '/../v5')
import plan7 as P, forecast as F
A, B = F.A, F.B; WK = F.WEEKS; MO = 4.33
SHOW_PER_RUB = 1.63; MIN_WK_SKU = 1523
K_SH = {'низкий': 0.0, 'средний': 0.3, 'высокий': 1.0}
UP_MIN = {'низкий': 0.0, 'средний': 0.3, 'высокий': 0.55}
LEVELS = (10000, 20000, 30000)
vs = C.Counter(); un = C.Counter(); name = {}
for l in open(F.D + 'sku_views.ndjson'):
    x = json.loads(l)
    if A <= x['date'] <= B: vs[x['sku']] += x['vsearch']; un[x['sku']] += x['units']
    name[x['sku']] = x.get('name', '')
o60 = C.Counter(); o4 = C.Counter()
for o in F.L('orders_daily.ndjson'):
    if o['status'] == 'cancelled': continue
    if '2026-08-13' <= o['d'] <= B: o60[o['sku']] += o['units']
    if A <= o['d'] <= B: o4[o['sku']] += o['units']
sku_sp = C.Counter(); sku_t = C.Counter()                       # клик по товару: 4 недели и темп 08-11.10 (без ставки за заказ)
for a in F.L('ads_sku_daily.ndjson'):
    if a['cid'] != F.CPO_ID and A <= a['d'] <= B: sku_sp[a['sku']] += a['sp']
    if a['cid'] != F.CPO_ID and '2026-10-08' <= a['d'] <= B: sku_t[a['sku']] += a['sp'] / 4 * 7
MED = F.med_pi
def pi(sku):
    r = F.rows.get(sku)
    return F.pi(r, r['p0'], 0.05, r['s']) if r else MED
def price(sku):
    r = F.rows.get(sku); return r['p0'] if r else F.AVG_P
def keep(sku):
    r = F.rows.get(sku); return r['keep'] if r else F.AVG_KEEP
G = json.load(open(F.D + 'card_groups.json'))['groups']
cards = []
for g in G:
    skus = [s['sku'] for s in g['skus']]; off = {s['sku']: s['offer'] for s in g['skus']}
    v = sum(vs[s] for s in skus); u = sum(o4[s] for s in skus)
    if not v: continue
    main = max(skus, key=lambda s: vs[s])
    others = [s for s in skus if s != main and o60[s] >= 1 and sku_sp[s] == 0]
    cards.append(dict(card=g['main'], main=main, main_art=off[main], main_name=name.get(main, ''), v_wk=v / WK, u_wk=u / WK,
                      conv=u / v if v else 0, main_sp_wk=sku_t[main], main_v_wk=vs[main] / WK,
                      others=[(s, off[s], name.get(s, ''), o60[s]) for s in others]))
cards.sort(key=lambda c: -c['u_wk'])

def main_effect(c, lvl, sc):
    """в неделю: доп. показы, заказы, расход, прибыль от повышения клика главного товара до lvl ₽/нед"""
    cur = c['main_sp_wk']
    if lvl <= cur: return 0, 0, 0, 0
    base = max(cur, 1.0)
    sh = SHOW_PER_RUB * (lvl ** F.E_SP - base ** F.E_SP) * (base ** (1 - F.E_SP))   # показы при росте бюджета, степень 0,81
    du = sh * c['conv'] * K_SH[sc]
    return sh, du, lvl - cur, du * pi(c['main']) - (lvl - cur)
def min_effect(c, sc):
    n = len(c['others']); du = n * UP_MIN[sc]
    return n, du, n * MIN_WK_SKU, sum(UP_MIN[sc] * pi(s) for s, *_ in c['others']) - n * MIN_WK_SKU

def total(lvl, sc, top=None, with_min=True):
    T = C.Counter()
    for c in (cards[:top] if top else cards):
        sh, du, sp, pr = main_effect(c, lvl, sc)
        T['shows'] += sh; T['units'] += du; T['spend'] += sp; T['prof'] += pr
        T['turn'] += du * price(c['main']); T['pay'] += du * price(c['main']) * keep(c['main'])
        if with_min:
            n, du2, sp2, pr2 = min_effect(c, sc)
            T['n_min'] += n; T['units'] += du2; T['spend'] += sp2; T['prof'] += pr2
            for s, *_ in c['others']:
                T['turn'] += UP_MIN[sc] * price(s); T['pay'] += UP_MIN[sc] * price(s) * keep(s)
    return {k: v * MO for k, v in T.items()}

if __name__ == '__main__':
    out = dict(cards=cards, tot={})
    print(f'карточек с показами: {len(cards)}; заказов в неделю у них {sum(c["u_wk"] for c in cards):.1f}; '
          f'товаров под минимальный клик: {sum(len(c["others"]) for c in cards)}')
    for c in cards[:12]:
        print(f'  {c["main_art"]:22} заказов/нед {c["u_wk"]:5.2f}  показов/нед {c["v_wk"]:8,.0f}  конверсия {c["conv"]*1000:.3f}/1000  '
              f'клик главного сейчас {c["main_sp_wk"]:7,.0f}  под мин. клик {len(c["others"])}'.replace(',', ' '))
    for top in (None, 10):
        for lvl in LEVELS:
            for sc in F.SCN:
                t = total(lvl, sc, top); out['tot'][f'{top}|{lvl}|{sc}'] = t
                print(f'топ {top or "все"} уровень {lvl:6} {sc:8} заказов/мес {t["units"]:+6.1f}  оборот {t["turn"]/1e6:+5.2f} млн  '
                      f'К выплате {t["pay"]/1e6:+5.2f} млн  расход {t["spend"]/1e3:6.0f} тыс  прибыль {t["prof"]/1e3:+6.0f} тыс')
    json.dump(out, open('/tmp/ozon-v7/cards7.json', 'w'), ensure_ascii=False, indent=1, default=float)
