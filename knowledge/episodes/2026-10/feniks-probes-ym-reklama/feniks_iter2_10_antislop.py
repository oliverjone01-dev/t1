# ФЕНИКС, итерация 2, проба 10 (C4): прогон anti-slop-checker.sh на содержимом артефакта и self-check (без записи файлов)
import json, subprocess
H = '/home/user/t1/.claude/hooks/anti-slop-checker.sh'
for f in ('/home/user/t1/knowledge/episodes/2026-10/ym-reklama-analiz-20261014.md',
          '/home/user/t1/knowledge/episodes/2026-10/selfcheck-ym-reklama-analiz-20261014.md'):
    ev = {'tool_name': 'Write', 'tool_input': {'file_path': f, 'content': open(f, encoding='utf-8').read()}}
    r = subprocess.run(['bash', H], input=json.dumps(ev, ensure_ascii=False), capture_output=True, text=True, cwd='/home/user/t1')
    print(f.split('/')[-1], 'exit', r.returncode, 'stdout_len', len(r.stdout), 'stderr_len', len(r.stderr))
    print('  stdout:', r.stdout[:800])
    print('  stderr:', r.stderr[:300])
# ручной список из style.md: выражения, которые нельзя
import re
txt = open('/home/user/t1/knowledge/episodes/2026-10/ym-reklama-analiz-20261014.md', encoding='utf-8').read().lower()
for w in ('выглядит хорошо', 'отлично подойдёт', 'индивидуальный подход', 'уникальный', 'выстрелит', 'идеальн', 'безусловно', 'синерги', 'революц'):
    if w in txt:
        print('  manual hit:', w)
print('manual list checked')
