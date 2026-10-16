# ФЕНИКС iter5 (381f11d5). C3/C4: добавленный текст диффа 9a3a212..381f11d5 (строки «+», без data/, traces/, knowledge/episodes/)
# и текст блока «План» на сборке головы (r_gate5.sh) -> событие для .claude/hooks/anti-slop-checker.sh. Контроль живости - вариант
# с заведомой фразой. D1: самопровозглашённая оценка X/10 в добавленном тексте. python3 -I c8_slop.py <out_event.json> [control]
import json, subprocess, sys, re, html
R = '/home/user/t1-wt'
SP = '/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/p8/'
diff = subprocess.run(['git', '-C', R, 'diff', '9a3a212', '381f11d5', '--', '.', ':(exclude)analytics-mvp/data', ':(exclude)traces', ':(exclude)knowledge/episodes'],
                      capture_output=True, text=True).stdout
files = re.findall(r'^\+\+\+ b/(.+)$', diff, re.M)
added = '\n'.join(l[1:] for l in diff.splitlines() if l.startswith('+') and not l.startswith('+++'))
page = open(SP + 'out_381f11d5/katya-tests.html', encoding='utf-8').read()
i0 = page.find('id="pt-plan"'); i1 = page.find('Как считаем', i0); i2 = page.find('</ul>', i1)
block = html.unescape(re.sub(r'<[^>]+>', ' ', page[i0:i2 if i2 > 0 else i0 + 200000]))
txt = added + '\n' + block
if len(sys.argv) > 2:
    txt += '\nУ нас индивидуальный подход к каждому.'
json.dump({'tool_input': {'file_path': '381f11d5-added.md', 'content': txt}}, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
d1 = re.findall(r'\d+[.,]\d+ ?/ ?10\b', added)
print('файлы диффа', files, '| символов', len(txt), '| em dash в диффе', added.count(chr(0x2014)), '| в блоке', block.count(chr(0x2014)),
      '| в странице', page.count(chr(0x2014)), '| D1 оценок X/10 в добавленном тексте', len(d1), d1[:3])
