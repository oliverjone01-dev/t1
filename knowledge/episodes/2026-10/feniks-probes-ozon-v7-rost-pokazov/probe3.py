import sys
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import cards7 as K, forecast as F
for lvl in (10000, 20000):
    t10 = K.total(lvl, 'низкий', 10); t20 = K.total(lvl, 'низкий', 20)
    print(f'W2 lvl {lvl}: wave-2 (cards 11-20) spend/month {(t20["spend"] - t10["spend"])/1e3:.0f}K; mains cur=0 in wave 2:',
          sum(1 for c in K.cards[10:20] if c['main_sp_wk'] == 0))
# главный эффект при 20 000 против 10 000 (средний): прибыль добавки
for sc in F.SCN:
    a = K.total(10000, sc, 10, with_min=False); b = K.total(20000, sc, 10, with_min=False)
    print(f'M {sc:8}: main-only 10K prof {a["prof"]/1e3:+.0f}K units {a["units"]:.1f}; 20K prof {b["prof"]/1e3:+.0f}K units {b["units"]:.1f}; step 10->20K prof {(b["prof"]-a["prof"])/1e3:+.0f}K')
