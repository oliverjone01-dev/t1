# ФЕНИКС iter6 (db5ede19). C3/C4/D1 на дельте 381f11d5..db5ede19 (строки «+» кода и тестов) и тексте блока на сборке головы.
# Контроль живости чекера - заведомая фраза, собранная escape-кодами. python3 -I c10_slop.py <out_event.json> [control]
import json, subprocess, sys, re, html
R = '/home/user/t1-wt'
SP = '/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/p9/'
diff = subprocess.run(['git', '-C', R, 'diff', '381f11d5', 'db5ede19', '--', 'analytics-mvp/src'], capture_output=True, text=True).stdout
added = '\n'.join(l[1:] for l in diff.splitlines() if l.startswith('+') and not l.startswith('+++'))
page = open(SP + 'out_db5ede19/katya-tests.html', encoding='utf-8').read()
i0 = page.find('id="pt-plan"'); i1 = page.find('Как считаем', i0); i2 = page.find('</ul>', i1)
block = html.unescape(re.sub(r'<[^>]+>', ' ', page[i0:i2]))
txt = added + '\n' + block
if len(sys.argv) > 2:
    txt += '\nУ нас индивидуальный подход.'
json.dump({'tool_input': {'file_path': 'db5ede19-added.md', 'content': txt}}, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
print('файлы', re.findall(r'^\+\+\+ b/(.+)$', diff, re.M), '| символов', len(txt), '| em dash в дельте', added.count(chr(0x2014)), '| в блоке', block.count(chr(0x2014)),
      '| D1 X/10', len(re.findall(r'\d+[.,]\d+ ?/ ?10\b', added)))
