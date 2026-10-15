# ФЕНИКС iter4 @ da0a36b. Проба M4: мутанты нового кода (B1c, спидометр за месяц, выводимые, клиент) против plan-tab.test.ts.
# Копия дерева da0a36b в scratch/mut, на каждый мутант одна замена строки, прогон vitest plan-tab.test.ts.
# «жив» = тесты зелёные при сломанном коде. Код автора не трогается. python3 -I m4_mutants.py
import os, shutil, subprocess

SP = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/'
SRC = SP + 'tree_da0a36b/analytics-mvp/'
MUT = SP + 'mut/analytics-mvp/'
if os.path.isdir(SP + 'mut'):
    shutil.rmtree(SP + 'mut')
shutil.copytree(SRC + 'src', MUT + 'src')
for f in ('package.json', 'tsconfig.json'):
    shutil.copy(SRC + f, MUT + f)
os.symlink(SP + 'tree_753bf11/analytics-mvp/node_modules', MUT + 'node_modules')
os.symlink(SP + 'data_753bf11/analytics-mvp/data', MUT + 'data')
TS, JS = 'src/scripts/plan-tab.ts', 'src/scripts/plan-tab/plan-tab.client.js'
M = [
    ('M1 конец выгрузки по UTC, а не МСК', TS, 'addDays(iso(t + 3 * 3600e3), -1)', 'addDays(iso(t), -1)'),
    ('M2 день съёма считается закрытым', TS, 'addDays(iso(t + 3 * 3600e3), -1)', 'iso(t + 3 * 3600e3)'),
    ('M3 конец не ограничен днём заказов', TS, 'drange(from, end < to ? end : to)', 'drange(from, end)'),
    ('M4 конец по первой строке, не по максимуму', TS, 'if (e > end) end = e;', 'if (!end) end = e;'),
    ('M5 охват по дням выгрузки (как до B1c)', TS, 'const days = drange(from, end < to ? end : to);', 'const days = [...new Set([...last.values()].map((r) => r.date))].sort();'),
    ('M6 пустой список дней не null', TS, 'if (!days.length) return null;', ''),
    ('M7 окно рекламы всегда со старта плана', TS, 'return { from: m1 > start ? m1 : start, to: adLast, pre: false };', 'return { from: start, to: adLast, pre: false };'),
    ('M8 день старта считается «до плана»', TS, 'if (adLast < start) return', 'if (adLast <= start) return'),
    ('M9 факт без клика главного', TS, 'if (a) { amF += a[0]; amP', 'if (a) { amP'),
    ('M10 факт без минимального клика', TS, 'if (b && c.n_min) { amF += b[0]; amP', 'if (b && c.n_min) { amP'),
    ('M11 факт по всей рекламе карточки, а не по клику главного', TS, 'const a = weekSum(spm[i]!, AMW.from', 'const a = weekSum(sp[i]!, AMW.from'),
    ('M12 план без поправки на дни', TS, 'amP += c.click_new * a[1] / 7;', 'amP += c.click_new;'),
    ('M13 выводимые остаются в карточке', TS, '.filter((s) => !OUT.has(s))', ''),
    ('M14 нет предупреждения «главный в списке выводимых»', TS, 'if (ms && OUT.has(ms)) warnings.push', 'if (false) warnings.push'),
    ('M15 нет предупреждения «выводимого нет в card_groups»', TS, 'if (!off2sku.has(a)) warnings.push', 'if (false) warnings.push'),
    ('M16 «до плана» теряется в данных страницы', TS, 'fact: Math.round(amF), plan: Math.round(amP) }', 'fact: Math.round(amF), plan: Math.round(amP), pre: false }'),
    ('M17 клиент: ссылка на удалённую переменную (баг 753bf11)', JS, 'var cur={c:0,m:0};', 'var cur={c:0,m:0,w:wkLast};'),
    ('M18 клиент: «до плана» не серым', JS, 'pre:AM&&AM.pre', 'pre:false'),
    ('M19 клиент: стрелка показывает план, а не факт', JS, 'val:AM?AM.fact:null', 'val:AM?AM.plan:null'),
]
orig = {p: open(MUT + p, encoding='utf-8').read() for p in (TS, JS)}
alive = 0
for name, p, a, b in M:
    src = orig[p]
    assert src.count(a) == 1, (name, src.count(a))
    open(MUT + p, 'w', encoding='utf-8').write(src.replace(a, b))
    r = subprocess.run(['npx', 'vitest', 'run', TS.replace('.ts', '.test.ts')], cwd=MUT, capture_output=True, text=True, timeout=300)
    open(MUT + p, 'w', encoding='utf-8').write(src)
    ok = r.returncode == 0
    alive += ok
    print(f"{'ЖИВ ' if ok else 'убит'} | {name}")
print(f'живых {alive} из {len(M)}')
