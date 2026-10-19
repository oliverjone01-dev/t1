# ФЕНИКС iter2 «Рост показов», версия c539167: календарь «Цель по месяцам» - строка с АДМ и учёт правила 29.10 (ноябрь)
# python3 -I -B probe_iter2c.py
import sys, io, contextlib
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
with contextlib.redirect_stdout(io.StringIO()):
    import cards7 as K, forecast as F
LV = 20000; DM = 30.3; top = K.cards[:10]
for sc in F.SCN:
    T = K.total(LV, sc, 10)
    for nm, part, spp in (('октябрь', 14 / DM, 17 / DM), ('ноябрь', 30 / DM, 30 / DM)):
        prof = (T['prof'] + T['spend']) * part - T['spend'] * spp; pay = T['pay'] * part
        print(f'  {sc:8} {nm:8} прибыль без АДМ {prof/1e3:+6.0f} тыс., с АДМ 30% {(prof - F.ADM * pay)/1e3:+6.0f} тыс.')
print('== ноябрь с правилом 29.10 (карточка работает весь ноябрь с вероятностью пройти порог в своём сценарии)')
for sc in F.SCN:
    u = pay = prof = 0
    for c in top:
        p = K.pass_prob(c, LV, sc); _, du, sp, pr = K.main_effect(c, LV, sc); n, du2, sp2, pr2 = K.min_effect(c, sc)
        tc = K.total.__wrapped__ if hasattr(K.total, '__wrapped__') else None
        units = (du + du2) * 30 / 7; u += p * units; prof += p * (pr + pr2) * 30 / 7
        pay += p * (du * K.price(c['main']) * K.keep(c['main']) + sum(K.UP_MIN[sc] * K.price(s) * K.keep(s) for s, *_ in c['others'])) * 30 / 7
    base_u = round(sum(F.U_all.values()) / F.WEEKS * 4.33) * 30 / DM
    print(f'  {sc:8} заказов {base_u + u:5.0f} (+{u:4.0f})  К выплате {8.0 * 30 / DM + pay / 1e6:5.1f} млн  прибыль без АДМ {prof/1e3:+6.0f} тыс., с АДМ {(prof - F.ADM * pay)/1e3:+6.0f} тыс.')
