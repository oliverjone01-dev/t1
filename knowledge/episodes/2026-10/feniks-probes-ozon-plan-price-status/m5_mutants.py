# ФЕНИКС iter2 (3810a26). M5: мутанты нового кода (раздел 5 «Цена» 4f2409c, спидометры за месяц ab2997f, клиент) против
# plan-tab.test.ts. Копия src дерева 3810a26 в scratch/p5/mut, на мутант одна замена, прогон vitest plan-tab.test.ts.
# «ЖИВ» = тесты зелёные при сломанном коде. Код автора не трогается. python3 -I m5_mutants.py
import os, shutil, subprocess
SP = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/p5/'
SRC = SP + 'tree_3810a26/analytics-mvp/'
MUT = SP + 'mut/analytics-mvp/'
if os.path.isdir(SP + 'mut'): shutil.rmtree(SP + 'mut')
shutil.copytree(SRC + 'src', MUT + 'src')
for f in ('package.json', 'tsconfig.json'): shutil.copy(SRC + f, MUT + f)
os.symlink(os.path.realpath(SRC + 'node_modules'), MUT + 'node_modules')
os.symlink(os.path.realpath(SRC + 'data'), MUT + 'data')
TS, JS = 'src/scripts/plan-tab.ts', 'src/scripts/plan-tab/plan-tab.client.js'
M = [
    # раздел 5 «Цена»
    ('P1 допуск «снижена» 0,5% убран', TS, 'if (now <= target * 1.005)', 'if (now <= target)'),
    ('P2 порог «частично» 0,5% убран', TS, 'if (now < priceNow * 0.995)', 'if (now < priceNow)'),
    ('P3 день смены = «по плану с»', TS, 'if (today < when) return', 'if (today <= when) return'),
    ('P4 ветки «сегодня» нет', TS, 'if (today === when) return', 'if (false) return'),
    ('P5 чип «частично» серым', TS, 'ps.key === "частично" ? "chip-mid"', 'ps.key === "частично" ? "chip-off"'),
    ('P6 «нет цены» отдельным ключом плашек', TS, 'key = ps.key === "нет цены" ? "не снижена" : ps.key', 'key = ps.key'),
    ('P7 фильтр пустой gap_pct снят', TS, 'if (!Number.isFinite(Number(r.gap_pct)) || r.gap_pct == null) continue;', ''),
    ('P8 «было» скидки на сегодня, а не 14.10', TS, 'priceAt(gapHist.get(p.art), PRICE_BASE)', 'priceAt(gapHist.get(p.art), today)'),
    ('P9 цвета п.п. перепутаны', TS, 'gdd > 0 ? "#34D399" : "#FF7A7E"', 'gdd > 0 ? "#FF7A7E" : "#34D399"'),
    ('P10 «выпали из бустинга» по 14.10', TS, 'if (gp != null && gp < 10) pst.eb', 'if (g0 != null && g0 < 10) pst.eb'),
    ('P11 клиент: ключ плашки «частично» с опечаткой', JS, "['частично','Снижена частично'", "['частичн','Снижена частично'"),
    ('P12 клиент: ключ «по плану» старый («ждём»)', JS, "['по плану','Срок сегодня или позже'", "['ждём','Срок сегодня или позже'"),
    # спидометры за месяц
    ('S1 клиент: «на пути» строго больше плана', JS, 'return x>=CM.plan[i]', 'return x>CM.plan[i]'),
    ('S2 день старта по плану базы', TS, 'return d < start ? c.u_wk_base / 7', 'return d <= start ? c.u_wk_base / 7'),
    ('S3 темп прочих / 14 дней вместо 13', TS, 'Math.max(0, otherSp) / 13 * 7', 'Math.max(0, otherSp) / 14 * 7'),
    ('S4 окно рекламы по ADS_FULL', TS, 'const AMW = monthWindow(AD_CAMP_LAST, START);', 'const AMW = monthWindow(ADS_FULL, START);'),
    ('S5 дни рекламы без проверки наличия', TS, 'drange(AMW.from, AMW.to).filter((d) => stSp.has(d)).length', 'drange(AMW.from, AMW.to).length'),
    ('S6 план без 11 кампаний', TS, ' + P.to_min.length * P.min_campaign_budget;', ';'),
    ('S7 прочие без вычета 11 кампаний', TS, '- P.to_min.reduce((t, k) => t + sumMap(campDaily.get(String(k.cid)) ?? new Map(), ...OTHER_WIN), 0);', ';'),
    ('S8 «месяц» карточек = план на дату', TS, 'month: cards.map((c) => Math.round(drange(CMW.from, monthEnd(CMW.from))', 'month: cards.map((c) => Math.round(drange(CMW.from, CMW.to)'),
    ('S9 клиент: стрелка «Заказы 10 карточек» - план, а не факт', JS, 'val:cmF,plan:cmP', 'val:cmP,plan:cmF'),
    ('S10 клиент: «на пути» против плана на весь месяц', JS, 'return x>=CM.plan[i]', 'return x>=CM.month[i]'),
    ('S11 клиент: реклама «до плана» не серым', JS, 'pre:AM&&AM.pre', 'pre:false'),
    ('S12 нет предупреждения о неполной рекламе по товарам', TS, 'if (ADS_FULL < OTHER_WIN[1]) warnings.push', 'if (false) warnings.push'),
    ('S13 конец месяца - 1-е следующего', TS, 'return iso(Date.UTC(y, m, 0));', 'return iso(Date.UTC(y, m, 1));'),
    ('S14 «Оплата за заказ» в расходе', TS, "    if (String(a.id) === CPO_ID) continue;\n", ''),
    ('S15 клиент: ссылка на неопределённую переменную (класс 753bf11)', JS, "l1:CM?fmt(cmF)+' из '", "l1:CM?fmt(cmFX)+' из '"),
]
orig = {p: open(MUT + p, encoding='utf-8').read() for p in (TS, JS)}
alive = []
for name, p, a, b in M:
    src = orig[p]
    assert src.count(a) == 1, (name, src.count(a))
    open(MUT + p, 'w', encoding='utf-8').write(src.replace(a, b))
    r = subprocess.run(['npx', 'vitest', 'run', TS.replace('.ts', '.test.ts')], cwd=MUT, capture_output=True, text=True, timeout=300)
    open(MUT + p, 'w', encoding='utf-8').write(src)
    ok = r.returncode == 0
    if ok: alive.append(name.split()[0])
    print(f"{'ЖИВ ' if ok else 'убит'} | {name}", flush=True)
print(f'живых {len(alive)} из {len(M)}:', ' '.join(alive))
