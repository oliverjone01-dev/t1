# ФЕНИКС iter3, ветка claude/amazing-hawking-0trncq @ 754cf5c. Проба M1: ловит ли новый assert plan-tab.test.ts
# именно случай iter2 (выгрузка неполная, расхождений нет -> строка читалась как зелёная).
# Дерево analytics-mvp из git archive в scratch (запись только в /tmp), node_modules - ссылка на рабочую копию.
#   main - plan-tab.ts из 51f24d2 (до правки) + тест ветки: ожидаю FAIL (assert различает новую формулировку)
#   M1   - код ветки, но «неполная без расхождений» снова даёт старую зелёную строку: если тест PASS - assert этот случай не держит
#   M2   - код ветки, но «неполная С расхождениями» снова даёт старую строку «расхождение по ...»: ожидаю FAIL
# python3 -I m1_mutants.py
import os, shutil, subprocess, tarfile, io

SP = '/tmp/claude-0/-home-user-t1/f57f6776-149c-58f9-8707-d73e74e89ad9/scratchpad/c3/'
REPO = '/home/user/t1'
NM = REPO + '/analytics-mvp/node_modules'
BR = '754cf5c'

NEW = ('      + (!cab.full ? `<b>выгрузка неполная - сверка не пройдена</b>${off.length ? `; расхождения: ${esc(off.join("; "))}` : ""}`\n'
       '        : off.length ? `<b>расхождение по ${off.length} из ${cards.length} карточек</b> - ${esc(off.join("; "))}` : `все ${cards.length} карточек в допуске (2%, не меньше 1 шт)`)\n'
       '      + `.</li>`;\n')
M1 = ('      + (!cab.full && off.length ? `<b>выгрузка неполная - сверка не пройдена</b>; расхождения: ${esc(off.join("; "))}`\n'
      '        : off.length ? `<b>расхождение по ${off.length} из ${cards.length} карточек</b> - ${esc(off.join("; "))}` : `все ${cards.length} карточек в допуске (2%, не меньше 1 шт)`)\n'
      '      + (cab.full ? "" : ", <b>выгрузка неполная</b>") + `.</li>`;\n')
M2 = ('      + (!cab.full && !off.length ? `<b>выгрузка неполная - сверка не пройдена</b>`\n'
      '        : off.length ? `<b>расхождение по ${off.length} из ${cards.length} карточек</b> - ${esc(off.join("; "))}` : `все ${cards.length} карточек в допуске (2%, не меньше 1 шт)`)\n'
      '      + `.</li>`;\n')


def tree(name, plan_rev):
    d = SP + 'mut_' + name + '/'
    if os.path.isdir(d):
        shutil.rmtree(d)
    os.makedirs(d)
    raw = subprocess.run(['git', '-C', REPO, 'archive', BR, 'analytics-mvp/src', 'analytics-mvp/package.json', 'analytics-mvp/tsconfig.json'],
                         capture_output=True, check=True).stdout
    tarfile.open(fileobj=io.BytesIO(raw)).extractall(d)
    root = d + 'analytics-mvp/'
    os.symlink(NM, root + 'node_modules')
    if plan_rev:
        src = subprocess.run(['git', '-C', REPO, 'show', plan_rev + ':analytics-mvp/src/scripts/plan-tab.ts'], capture_output=True, check=True).stdout
        open(root + 'src/scripts/plan-tab.ts', 'wb').write(src)
    return root


def run(root):
    p = subprocess.run(['npx', 'vitest', 'run', 'src/scripts/plan-tab.test.ts'], cwd=root, capture_output=True, text=True, timeout=240)
    out = p.stdout + p.stderr
    tests = [l.strip() for l in out.splitlines() if 'Tests ' in l]
    fails = [l.strip() for l in out.splitlines() if 'AssertionError' in l or 'expected' in l.lower() and 'to contain' in l.lower()]
    return p.returncode, (tests[-1] if tests else '?'), fails[:2]


for name, rev, mut in (('main', '51f24d2', None), ('M1', None, M1), ('M2', None, M2)):
    root = tree(name, rev)
    if mut:
        f = root + 'src/scripts/plan-tab.ts'
        s = open(f, encoding='utf-8').read()
        assert s.count(NEW) == 1, 'якорь мутанта не найден'
        open(f, 'w', encoding='utf-8').write(s.replace(NEW, mut))
    rc, tests, fails = run(root)
    print(f'{name}: exit {rc} | {tests} | {fails}')
