# ФЕНИКС iter4. Проба R3: регресс страницы «Тесты» целиком на одних и тех же data/ (копия коммита 753bf11).
# Собираю кодом main (5c4f053) и кодом головы (da0a36b) в scratch (OUT_DIR), сравниваю HTML без времени сборки.
# Ожидаю отличия только в блоке «План»: пороги 5 карточек, карточки без выводимых, спидометр рекламы за месяц, строка «Данные:».
# python3 -I r4_build.py [база] [голова]
import os, re, shutil, subprocess, difflib, glob, sys

SP = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/'
DATA = SP + 'data_753bf11/analytics-mvp/data'
REVS = sys.argv[1:3] or ['5c4f053', 'da0a36b']
res = {}
for rev in REVS:
    root = SP + 'tree_' + rev + '/analytics-mvp/'
    out = SP + 'out_' + rev + '/'
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)
    p = subprocess.run(['npx', 'tsx', 'src/scripts/build-tests.ts'], cwd=root, env=dict(os.environ, DATA_DIR=DATA, OUT_DIR=out),
                       capture_output=True, text=True, timeout=500)
    open(SP + 'build_' + rev + '.log', 'w', encoding='utf-8').write(p.stdout + p.stderr)
    files = sorted(glob.glob(out + '**/*.html', recursive=True))
    res[rev] = (p.returncode, out, files)
    print(rev, 'exit', p.returncode, 'html', [f[len(out):] for f in files])
norm = lambda s: re.sub(r'\d{2}\.\d{2}\.\d{4},? \d{2}:\d{2}(:\d{2})?( МСК)?|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?', '<TS>', s)
a_out, b_out = res[REVS[0]][1], res[REVS[1]][1]
for fa in res[REVS[0]][2]:
    rel = fa[len(a_out):]
    A = norm(open(fa, encoding='utf-8').read()); B = norm(open(b_out + rel, encoding='utf-8').read())
    sa = re.split(r'(?<=>)', A); sb = re.split(r'(?<=>)', B)
    d = [l for l in difflib.unified_diff(sa, sb, lineterm='', n=0) if l.startswith(('+', '-')) and not l.startswith(('+++', '---'))]
    # где отличия: внутри блока «План» (#pt-plan ... window.PD) или вне его
    i0, i1 = B.find('id="pt-plan"'), B.find('plan-tab.client') if 'plan-tab.client' in B else len(B)
    outside = [l for l in d if l[1:] and l[1:] in (A if l[0] == '-' else B) and not (B.find(l[1:]) >= i0 if l[0] == '+' else A.find(l[1:]) >= A.find('id="pt-plan"'))]
    print(f'{rel}: длина {len(A)} -> {len(B)}, отличающихся фрагментов {len(d)}, из них до начала блока «План» {len(outside)}; em dash в новой {B.count(chr(0x2014))}')
    for l in d[:int(os.environ.get('NDIFF', '40'))]:
        print('   ', l[:240])
