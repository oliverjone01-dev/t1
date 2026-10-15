import sys
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import cards7 as K, forecast as F
for lvl in (10000, 20000):
    for sc in F.SCN:
        a = K.total(lvl, sc, 10); b = K.total(lvl, sc, 20)
        print(f'W2 lvl {lvl} {sc:8}: wave-2 units/mo {b["units"]-a["units"]:+.1f} prof {(b["prof"]-a["prof"])/1e3:+.0f}K spend {(b["spend"]-a["spend"])/1e3:.0f}K  | with ADM {((b["prof"]-a["prof"]) - F.ADM*(b["pay"]-a["pay"]))/1e3:+.0f}K')
