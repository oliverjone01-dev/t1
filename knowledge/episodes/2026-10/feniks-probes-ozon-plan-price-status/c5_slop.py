# ФЕНИКС iter2 (3810a26). C3/C4: добавленный текст диффа c540277..3810a26 (строки «+», без data/ и моих путей) и текст
# блока «План» на сборке головы (r_gate.sh) -> событие для .claude/hooks/anti-slop-checker.sh. Контроль живости чекера -
# вариант с заведомой фразой из его списка. python3 -I c5_slop.py <out_event.json> [control]
import json, subprocess, sys, re, html
R = '/home/user/t1'
SP = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/p5/'
diff = subprocess.run(['git', '-C', R, 'diff', 'c540277', '3810a26', '--', '.', ':(exclude)analytics-mvp/data', ':(exclude)traces', ':(exclude)knowledge/episodes'],
                      capture_output=True, text=True).stdout
added = '\n'.join(l[1:] for l in diff.splitlines() if l.startswith('+') and not l.startswith('+++'))
page = open(SP + 'out_3810a26/katya-tests.html', encoding='utf-8').read()
i0 = page.find('id="pt-plan"'); i1 = page.find('</details>\n</details>', i0)
block = html.unescape(re.sub(r'<[^>]+>', ' ', page[i0:i1]))
txt = added + '\n' + block
if len(sys.argv) > 2:
    txt += '\nУ нас индивидуальный подход к каждому.'
json.dump({'tool_input': {'file_path': 'pr480-added.md', 'content': txt}}, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
print('символов', len(txt), '| em dash в диффе', added.count(chr(0x2014)), '| в блоке', block.count(chr(0x2014)), '| в странице', page.count(chr(0x2014)))
