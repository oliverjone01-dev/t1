# ФЕНИКС iter3, ветка claude/amazing-hawking-0trncq @ 754cf5c. Проба R3: регресс страницы «Тесты» на живых данных.
# Собираю страницу кодом main (51f24d2) и кодом ветки на одних и тех же data/, вывод только в scratch (OUT_DIR),
# и сравниваю HTML после вырезания времени сборки. Ожидаю ровно правки диффа: «утром и вечером» (подпись + title),
# склонение в строке «день не закрыт» (если она есть), строку сверки (кабинета в живых data/ нет - не меняется).
# python3 -I r3_build.py
import os, re, shutil, subprocess, tarfile, io, difflib, glob, sys

SP = '/tmp/claude-0/-home-user-t1/f57f6776-149c-58f9-8707-d73e74e89ad9/scratchpad/c3/'
REPO = '/home/user/t1'
LIVE = REPO + '/analytics-mvp/data'


def tree(rev):
    d = SP + 'tree_' + rev + '/'
    if os.path.isdir(d):
        shutil.rmtree(d)
    os.makedirs(d)
    raw = subprocess.run(['git', '-C', REPO, 'archive', rev, 'analytics-mvp/src', 'analytics-mvp/tools', 'analytics-mvp/package.json', 'analytics-mvp/tsconfig.json'],
                         capture_output=True, check=True).stdout
    tarfile.open(fileobj=io.BytesIO(raw)).extractall(d, filter='data')
    os.symlink(REPO + '/analytics-mvp/node_modules', d + 'analytics-mvp/node_modules')
    return d + 'analytics-mvp/'


def build(root, tag):
    out = SP + 'out_' + tag + '/'
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)
    env = dict(os.environ, DATA_DIR=LIVE, OUT_DIR=out)
    p = subprocess.run(['npx', 'tsx', 'src/scripts/build-tests.ts'], cwd=root, env=env, capture_output=True, text=True, timeout=400)
    open(SP + 'build_' + tag + '.log', 'w', encoding='utf-8').write(p.stdout + p.stderr)
    return p.returncode, out


res = {}
REVS = sys.argv[1:3] or ['51f24d2', '754cf5c']   # python3 -I r3_build.py [база] [голова]
for rev in REVS:
    rc, out = build(tree(rev), rev)
    files = sorted(glob.glob(out + '**/*.html', recursive=True))
    res[rev] = (rc, out, files)
    print(rev, 'exit', rc, 'html', [f[len(out):] for f in files])
norm = lambda s: re.sub(r'\d{2}\.\d{2}\.\d{4},? \d{2}:\d{2}(:\d{2})?( МСК)?|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?', '<TS>', s)
a_out, b_out = res[REVS[0]][1], res[REVS[1]][1]
for fa in res[REVS[0]][2]:
    rel = fa[len(a_out):]
    fb = b_out + rel
    A = norm(open(fa, encoding='utf-8').read()); B = norm(open(fb, encoding='utf-8').read())
    sa = re.split(r'(?<=>)', A); sb = re.split(r'(?<=>)', B)
    d = [l for l in difflib.unified_diff(sa, sb, lineterm='', n=0) if l.startswith(('+', '-')) and not l.startswith(('+++', '---'))]
    print(f'{rel}: длина {len(A)} -> {len(B)}, отличающихся фрагментов {len(d)}; em dash в новой {B.count(chr(0x2014))}')
    for l in d[:int(os.environ.get('NDIFF', '12'))]:
        print('   ', l[:260])
