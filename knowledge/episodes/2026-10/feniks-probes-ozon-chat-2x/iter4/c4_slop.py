# ФЕНИКС iter4 @ da0a36b. Проба C3/C4: добавленный текст диффа b927d21..da0a36b (строки «+») и текст блока «План»
# на живой сборке головы (r4_build.py) -> событие для .claude/hooks/anti-slop-checker.sh. Контроль живости чекера:
# вариант с заведомой фразой из его списка. python3 -I c4_slop.py <out_event.json> [control]
import json, subprocess, sys, re, html

R = '/home/user/t1'
SP = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/'
diff = subprocess.run(['git', '-C', R, 'diff', 'b927d21', 'da0a36b', '--', '.', ':(exclude)analytics-mvp/data'], capture_output=True, text=True).stdout
added = '\n'.join(l[1:] for l in diff.splitlines() if l.startswith('+') and not l.startswith('+++'))
page = open(SP + 'out_da0a36b/katya-tests.html', encoding='utf-8').read()
i0 = page.find('id="pt-plan"'); i1 = page.find('</details>\n</details>', i0)
block = html.unescape(re.sub(r'<[^>]+>', ' ', page[i0:i1]))
txt = added + '\n' + block
if len(sys.argv) > 2:
    txt += '\nУ нас индивидуальный подход к каждому.'
json.dump({'tool_input': {'file_path': 'pr479-added.md', 'content': txt}}, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
print('символов', len(txt), '| em dash в диффе', added.count(chr(0x2014)), '| в блоке', block.count(chr(0x2014)), '| в странице', page.count(chr(0x2014)))
