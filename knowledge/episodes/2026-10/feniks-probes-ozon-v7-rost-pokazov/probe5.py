import sys
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import cards7 as K, forecast as F
P = K.P
for k in sorted(P.EXP - P.LAD_IDS):
    c = F.camp[k]
    days = sorted({a['d'] for a in F.ads if a['id'] == k and a['sp'] > 0})
    print(f"C {k} {c['off']:22} first spend {c['first']} last {c['last']} days with spend in window {len([d for d in days if F.A <= d <= F.B])} orders(report) {c['o']}")
