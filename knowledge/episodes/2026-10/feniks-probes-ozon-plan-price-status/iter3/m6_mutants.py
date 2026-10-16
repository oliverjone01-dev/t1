# ФЕНИКС iter3 (e063381). T4 / M5: мутанты против plan-tab.test.ts головы (77 тестов, из них 4 новых в jsdom).
# Приёмка T4 из iter2: «мои 7 мутантов клиента убиты» (S15, P11, P12, S1, S9, S10, S11). S1 и S10 в iter2 били по cmOn
# (месяц), строки больше нет - перенесены на новую логику окна (CW). Плюс мутанты W5 / W6 (что закрывают новые тесты).
# Копия src дерева e063381 в scratch/p6/mut, на мутант одна замена, прогон vitest plan-tab.test.ts. «ЖИВ» = тесты зелёные.
# python3 -I m6_mutants.py
import os, re, shutil, subprocess
SP = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/p6/'
SRC = SP + 'tree_e063381/analytics-mvp/'
MUT = SP + 'mut/analytics-mvp/'
if os.path.isdir(SP + 'mut'): shutil.rmtree(SP + 'mut')
shutil.copytree(SRC + 'src', MUT + 'src')
for f in ('package.json', 'tsconfig.json'): shutil.copy(SRC + f, MUT + f)
os.symlink(os.path.realpath(SRC + 'node_modules'), MUT + 'node_modules')
os.symlink(os.path.realpath(SRC + 'data'), MUT + 'data')
TS, JS = 'src/scripts/plan-tab.ts', 'src/scripts/plan-tab/plan-tab.client.js'
M = [
    # 7 мутантов клиента из приёмки T4 (iter2)
    ('S15 клиент: ссылка на неопределённую переменную (класс 753bf11)', JS, "l1:CM?fmt(cmF)+' из '", "l1:CM?fmt(cmFX)+' из '"),
    ('P11 клиент: ключ плашки «частично» с опечаткой', JS, "['частично','Снижена частично'", "['частичн','Снижена частично'"),
    ('P12 клиент: ключ «по плану» старый («ждём»)', JS, "['по плану','Срок сегодня или позже'", "['ждём','Срок сегодня или позже'"),
    ("S1' клиент: «на пути» строго больше нужного", JS, 'return x>=CW.need[i]', 'return x>CW.need[i]'),
    ('S9 клиент: стрелка «Заказы 10 карточек» - план, а не факт', JS, 'val:cmF,plan:cmP', 'val:cmP,plan:cmF'),
    ("S10' клиент: «на пути» по плану месяца, а не окна (откат W5)", JS, 'return x>=CW.need[i]', 'return x>=(CM?CM.plan[i]:0)'),
    ('S11 клиент: реклама «до плана» не серым', JS, 'pre:AM&&AM.pre', 'pre:false'),
    # автор: zz=wkLast (ReferenceError) - тот же класс, что S15, другое место
    ('A1 клиент: zz=wkLast в начале скрипта (мутант автора)', JS, 'var D=window.PD, DAYS=D.days;', 'var D=window.PD, DAYS=D.days; var zz=wkLast;'),
    # W6 (сервер)
    ('W6a план до 15.10 по ставке плана (откат W6)', TS, 'd < START ? (stSp.get(d) ?? 0) : (PLAN_WK + OTHER_WK) / 7', '(PLAN_WK + OTHER_WK) / 7'),
    ('W6b месяц без факта до 15.10 (ставка на все дни)', TS, 'month: Math.round(drange(AMW.from, monthEnd(AMW.from)).reduce((t, d) => t + adsPlanDay(d), 0))',
     'month: Math.round(drange(AMW.from, monthEnd(AMW.from)).length * (PLAN_WK + OTHER_WK) / 7)'),
    ('W6c план до 15.10 = 0', TS, 'd < START ? (stSp.get(d) ?? 0) :', 'd < START ? 0 :'),
    # W5 (сервер и клиент)
    ('W5a нужно = порог целиком (без n_in / 14)', TS, 'Math.round(c.threshold * nIn / 14 * 10) / 10', 'c.threshold'),
    ('W5b факт окна с 1-го числа месяца', TS, 'sumMap(od[i]!, START, W1 < OD_LAST ? W1 : OD_LAST)', 'sumMap(od[i]!, "2026-10-01", W1 < OD_LAST ? W1 : OD_LAST)'),
    ('W5c факт окна не обрезан 28.10', TS, 'sumMap(od[i]!, START, W1 < OD_LAST ? W1 : OD_LAST)', 'sumMap(od[i]!, START, OD_LAST)'),
    ('W5d клиент: «рано» только 1 день', JS, 'cwEarly=CW.n_in>0&&CW.n_in<3', 'cwEarly=CW.n_in>0&&CW.n_in<2'),
    ('W5e клиент: «рано» снято', JS, 'cwEarly=CW.n_in>0&&CW.n_in<3', 'cwEarly=false'),
    ('W5f клиент: подпись окна - месяц', JS, "l2:'окно решения '+dm(D.start)+'-'+dm(D.w1)+', нужно 5'", "l2:mlab(CM)+', нужно 5'"),
    ('W5g клиент: при n_in 0 значение 0, а не «нет данных»', JS, 'val:CW.n_in&&!cwEarly?cwOn:null', 'val:!cwEarly?(cwOn||0):null'),
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
    m = re.search(r'Tests\s+(.*?)\(', r.stdout)
    fails = sorted(set(re.findall(r'(?:FAIL|×)\s+.*?>\s*(.+?)(?:\s+\d+ms)?$', r.stdout, re.M)))
    if ok: alive.append(name.split()[0])
    print(f"{'ЖИВ ' if ok else 'убит'} | {name} | {m.group(1).strip() if m else '?'}", flush=True)
    for f in fails[:6]: print('       -', f[:150])
print(f'живых {len(alive)} из {len(M)}:', ' '.join(alive))
