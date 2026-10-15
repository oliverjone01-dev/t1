# ФЕНИКС iter3 (e063381). C3/C4: добавленный текст диффа b55e514..e063381 (строки «+») и текст блока «План» на сборке головы
# (r_gate3.sh) -> событие для .claude/hooks/anti-slop-checker.sh. Контроль живости чекера - вариант с заведомой фразой.
# D1: самопровозглашённая оценка в добавленном тексте. python3 -I c6_slop.py <out_event.json> [control]
import json, subprocess, sys, re, html
R = '/home/user/t1'
SP = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/p6/'
diff = subprocess.run(['git', '-C', R, 'diff', 'b55e514', 'e063381'], capture_output=True, text=True).stdout
added = '\n'.join(l[1:] for l in diff.splitlines() if l.startswith('+') and not l.startswith('+++'))
page = open(SP + 'out_e063381/katya-tests.html', encoding='utf-8').read()
i0 = page.find('id="pt-plan"'); i1 = page.find('</details>\n</details>', i0)
block = html.unescape(re.sub(r'<[^>]+>', ' ', page[i0:i1]))
txt = added + '\n' + block
if len(sys.argv) > 2:
    txt += '\nУ нас индивидуальный подход к каждому.'
json.dump({'tool_input': {'file_path': 'e063381-added.md', 'content': txt}}, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
d1 = re.findall(r'\d+[.,]\d+ ?/ ?10\b', added)
print('символов', len(txt), '| em dash в диффе', added.count(chr(0x2014)), '| в блоке', block.count(chr(0x2014)), '| в странице', page.count(chr(0x2014)),
      '| D1 оценок X/10 в добавленном тексте', len(d1), d1[:3])
