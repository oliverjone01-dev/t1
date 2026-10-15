# ФЕНИКС iter3 (e063381). M5: 10 серверных мутантов, живых в iter2 (m5_mutants.py), против plan-tab.test.ts головы (77 тестов).
# Убил ли их новый describe в jsdom. Копия src дерева e063381 в scratch/p6/mut2. python3 -I m6b_iter2_alive.py
import os, shutil, subprocess
SP = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/p6/'
SRC = SP + 'tree_e063381/analytics-mvp/'
MUT = SP + 'mut2/analytics-mvp/'
if os.path.isdir(SP + 'mut2'): shutil.rmtree(SP + 'mut2')
shutil.copytree(SRC + 'src', MUT + 'src')
for f in ('package.json', 'tsconfig.json'): shutil.copy(SRC + f, MUT + f)
os.symlink(os.path.realpath(SRC + 'node_modules'), MUT + 'node_modules')
os.symlink(os.path.realpath(SRC + 'data'), MUT + 'data')
TS = 'src/scripts/plan-tab.ts'
M = [
    ('P2 порог «частично» 0,5% убран', 'if (now < priceNow * 0.995)', 'if (now < priceNow)'),
    ('P5 чип «частично» серым', 'ps.key === "частично" ? "chip-mid"', 'ps.key === "частично" ? "chip-off"'),
    ('P6 «нет цены» отдельным ключом плашек', 'key = ps.key === "нет цены" ? "не снижена" : ps.key', 'key = ps.key'),
    ('P7 фильтр пустой gap_pct снят', 'if (!Number.isFinite(Number(r.gap_pct)) || r.gap_pct == null) continue;', ''),
    ('P9 цвета п.п. перепутаны', 'gdd > 0 ? "#34D399" : "#FF7A7E"', 'gdd > 0 ? "#FF7A7E" : "#34D399"'),
    ('S3 темп прочих / 14 дней вместо 13', 'Math.max(0, otherSp) / 13 * 7', 'Math.max(0, otherSp) / 14 * 7'),
    ('S7 прочие без вычета 11 кампаний', '- P.to_min.reduce((t, k) => t + sumMap(campDaily.get(String(k.cid)) ?? new Map(), ...OTHER_WIN), 0);', ';'),
    ('S8 «месяц» карточек = план на дату', 'month: cards.map((c) => Math.round(drange(CMW.from, monthEnd(CMW.from))', 'month: cards.map((c) => Math.round(drange(CMW.from, CMW.to)'),
    ('S12 нет предупреждения о неполной рекламе по товарам', 'if (ADS_FULL < OTHER_WIN[1]) warnings.push', 'if (false) warnings.push'),
    ('S14 «Оплата за заказ» в расходе', "    if (String(a.id) === CPO_ID) continue;\n", ''),
]
orig = open(MUT + TS, encoding='utf-8').read()
alive = []
for name, a, b in M:
    if orig.count(a) != 1:
        print('нет строки |', name, orig.count(a)); continue
    open(MUT + TS, 'w', encoding='utf-8').write(orig.replace(a, b))
    r = subprocess.run(['npx', 'vitest', 'run', TS.replace('.ts', '.test.ts')], cwd=MUT, capture_output=True, text=True, timeout=300)
    open(MUT + TS, 'w', encoding='utf-8').write(orig)
    ok = r.returncode == 0
    if ok: alive.append(name.split()[0])
    print(f"{'ЖИВ ' if ok else 'убит'} | {name}", flush=True)
print(f'живых {len(alive)} из {len(M)}:', ' '.join(alive))
