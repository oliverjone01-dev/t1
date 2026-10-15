# P7: деньги «Цели» при честном «сейчас» у TRUBIS 160 и OZEVIS.
# TRUBIS 160: в «сейчас» 15 974 сидят остановленная 08.10 кампания 37239106 (4 417 ₽/нед по одному дню) и 10 311 ₽/нед групповой 44989441,
# которую тот же план режет до 2 000 (и считает эту экономию отдельно). Своя 44988949 идёт с 1 246 до 20 000.
# OZEVIS: кампания 43629255 на общий артикул GGM-20, на главного 74% её расхода; бюджет кампании 20 000 -> на главного ~14 800.
import sys
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import cards7 as K, forecast as F, plan7 as P
LVL = 20000
cards = K.cards[:10]
tr = next(c for c in cards if c['main_art'] == 'GGT-03-3-3-E-16080'); oz = next(c for c in cards if c['main_art'] == 'GGM-20-2')
sh441 = 0.71; t441 = P.tempo('44989441'); own949 = 1246; part441 = 10311; sh255 = 0.74; t255 = P.tempo('43629255')
def eff(c, cur, new, spend, sc):
    s = K.shows(new) - K.shows(cur); du = s * c['conv'] * K.K_SH[sc]
    return du, du * K.pi(c['main']) - spend, du * F.rows[c['main']]['p0'] * F.rows[c['main']]['keep'] if c['main'] in F.rows else 0
print(f'темп 44989441 {t441:,.0f}, 43629255 {t255:,.0f} ₽/нед'.replace(',', ' '))
for sc in F.SCN:
    T = K.total(LVL, sc, 10)
    # модель: TRUBIS 15 974 -> 20 000, OZEVIS 4 412 -> 20 000
    m_tr = eff(tr, tr['main_sp_wk'], LVL, LVL - tr['main_sp_wk'], sc); m_oz = eff(oz, oz['main_sp_wk'], LVL, LVL - oz['main_sp_wk'], sc)
    # честно: TRUBIS 1 246 + 10 311 = 11 557 -> 20 000 + 0,71 x 2 000; расход строки: своя +18 754 минус часть уреза 44989441 на TRUBIS
    cur_tr = own949 + part441; new_tr = LVL + sh441 * F.MIN_WK
    sp_tr = (LVL - own949) - part441 * (1 - F.MIN_WK / t441)
    c_tr = eff(tr, cur_tr, new_tr, sp_tr, sc)
    # OZEVIS: кампания 5 987 -> 20 000, главному 74%
    c_oz = eff(oz, oz['main_sp_wk'], sh255 * LVL, LVL - t255, sc)
    d_prof = (c_tr[1] - m_tr[1] + c_oz[1] - m_oz[1]) * K.MO
    d_sp = ((sp_tr - (LVL - tr['main_sp_wk'])) + ((LVL - t255) - (LVL - oz['main_sp_wk']))) * K.MO
    d_units = (c_tr[0] - m_tr[0] + c_oz[0] - m_oz[0]) * K.MO
    print(f'{sc:8}: прибыль книги {T["prof"] / 1e3:+6.0f} тыс., поправка {d_prof / 1e3:+5.0f} тыс. -> {(T["prof"] + d_prof) / 1e3:+6.0f}; '
          f'расход строки {T["spend"] / 1e3:5.0f} -> {(T["spend"] + d_sp) / 1e3:5.0f} тыс.; заказов {d_units:+.1f}; '
          f'экономия уреза без доли TRUBIS: {(K.cut_saving(LVL)[1] - part441 * (1 - F.MIN_WK / t441) * K.MO) / 1e6:.2f} млн (в книге {K.cut_saving(LVL)[1] / 1e6:.2f})')
# суммарно (строки + экономия уреза), расход в месяц: модель против честного
m_net = ((LVL - tr['main_sp_wk']) - (t441 - F.MIN_WK)) * K.MO; c_net = ((LVL - own949) - (t441 - F.MIN_WK)) * K.MO
print(f'TRUBIS 160 вместе с урезом 44989441, расход в месяц: модель {m_net / 1e3:+.0f} тыс., по кампаниям {c_net / 1e3:+.0f} тыс., разница {(c_net - m_net) / 1e3:+.0f} тыс.')
