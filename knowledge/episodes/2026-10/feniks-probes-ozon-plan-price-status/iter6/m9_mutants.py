# ФЕНИКС iter6 (db5ede19). Мутанты против plan-tab.test.ts головы (83 теста): список iter5 (m8_mutants.py) с G1b, перенесённым
# на новую строку дуг, плюс новые: G1g (зазор iter5 .7 - Codex P2 обратно), G1n (стрелка нарисована по % к плану на дату, data-pct
# прежний), G1p (data-pct не равен нарисованной стрелке). «ЖИВ» = тесты зелёные при сломанном коде. python3 -I m9_mutants.py
import os, re, shutil, subprocess, sys
SP = '/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/p9/'
SRC = SP + 'tree_db5ede19/analytics-mvp/'
MUT = SP + 'mut/analytics-mvp/'
if os.path.isdir(SP + 'mut'): shutil.rmtree(SP + 'mut')
shutil.copytree(SRC + 'src', MUT + 'src')
for f in ('package.json', 'tsconfig.json'): shutil.copy(SRC + f, MUT + f)
os.symlink(os.path.realpath(SRC + 'node_modules'), MUT + 'node_modules')
os.symlink(os.path.realpath(SRC + 'data'), MUT + 'data')
TS, JS = 'src/scripts/plan-tab.ts', 'src/scripts/plan-tab/plan-tab.client.js'
DRAW = 's+=arc(z[0]+g,z[1]-g,z[2],z)'
G1 = [
    ('G1a клиент: k=1 - зоны от 100% плана периода (баг iter4)', JS, 'k=mk>0?mk/100:1', 'k=1'),
    ('G1b клиент: дуги нарисованы от 100% плана периода, data-z0/z1 от метки', JS, DRAW, 's+=arc(z[0]/k+g,Math.min(MAX,z[1]/k)-g,z[2],z)'),
    ('G1c клиент: data-zone списан со статуса', JS, 'zc=z[2]})}', 'zc=st.c})}'),
    ('G1d клиент: граница зоны заказов строго больше', JS, '(pc>=z[0]&&(pc<z[1]||top))', '(pc>z[0]&&(pc<z[1]||top))'),
    ('G1e клиент: у рекламы зоны без масштаба', JS, 'k=mk>0?mk/100:1', 'k=o.hiBad?1:mk>0?mk/100:1'),
    ('G1f клиент: у заказов зоны без масштаба', JS, 'k=mk>0?mk/100:1', 'k=!o.hiBad?1:mk>0?mk/100:1'),
    ('G1g клиент: зазор .7 с обоих концов (iter5, Codex P2)', JS, 'var g=Math.min(.7,(z[1]-z[0])/4);' + DRAW, 's+=arc(z[0]+.7,Math.max(z[0]+.7,z[1]-.7),z[2],z)'),
    ('G1n клиент: стрелка нарисована по % к плану на дату, data-pct прежний', JS, 'var n=pt(pct,r-24)', 'var n=pt(o.stPct!=null?o.stPct:pct,r-24)'),
    ('G1p клиент: data-pct - % к плану на дату, стрелка прежняя', JS, "data-pct=\"'+(pct==null?'':pct)+'\"", "data-pct=\"'+(pct==null?'':(o.stPct!=null?o.stPct:pct))+'\""),
    ('V5c клиент: реклама как заказы («больше - зеленее»)', JS, "pg('Реклама, все клики',G.ads,' тыс. ₽',0,1e3,true)", "pg('Реклама, все клики',G.ads,' тыс. ₽',0,1e3,false)"),
]
sys.path.insert(0, '/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/out/iter5')
src8 = open('/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/out/iter5/m8_mutants.py', encoding='utf-8').read()
M8 = eval(src8[src8.index('M = [') + 4: src8.index('\n]\n', src8.index('M = [')) + 2])   # список iter5 как есть
M = G1 + [m for m in M8 if not m[0].startswith(('G1', 'V5c'))]
orig = {p: open(MUT + p, encoding='utf-8').read() for p in (TS, JS)}
alive, missing, killed = [], [], []
for name, p, a, b in M:
    src = orig[p]
    if src.count(a) != 1:
        missing.append(name.split()[0]); print(f'нет строки ({src.count(a)}) | {name}', flush=True); continue
    open(MUT + p, 'w', encoding='utf-8').write(src.replace(a, b))
    r = subprocess.run(['npx', 'vitest', 'run', TS.replace('.ts', '.test.ts')], cwd=MUT, capture_output=True, text=True, timeout=300)
    open(MUT + p, 'w', encoding='utf-8').write(src)
    ok = r.returncode == 0
    m = re.search(r'Tests\s+(.*?)\(', r.stdout)
    (alive if ok else killed).append(name.split()[0])
    print(f"{'ЖИВ ' if ok else 'убит'} | {name} | {m.group(1).strip() if m else '?'}", flush=True)
print(f'убито {len(killed)}:', ' '.join(killed))
print(f'живых {len(alive)} из {len(M) - len(missing)}:', ' '.join(alive), '| нет строки:', ' '.join(missing) or '-')
