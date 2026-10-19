# ФЕНИКС iter3, @ 754cf5c. Проба C3/C4: добавленный текст диффа 51f24d2..754cf5c (строки «+»), строка «день не закрыт»
# со сборки ветки на фикстуре eve и строки сверки с фикстур cab3 -> событие для .claude/hooks/anti-slop-checker.sh.
# Контроль живости чекера: вариант с заведомой фразой из его списка. python3 -I c4_slop.py <out_event.json> [control]
import json, subprocess, sys, re, html

R = '/home/user/t1'
SP = '/tmp/claude-0/-home-user-t1/f57f6776-149c-58f9-8707-d73e74e89ad9/scratchpad/c3/'
diff = subprocess.run(['git', '-C', R, 'diff', '51f24d2', '754cf5c'], capture_output=True, text=True).stdout
added = '\n'.join(l[1:] for l in diff.splitlines() if l.startswith('+') and not l.startswith('+++'))
page = open(SP + 'out_eve/katya-tests.html', encoding='utf-8').read()
m = re.search(r'<p class="sub">(\d{2}\.\d{2} день не закрыт[^<]*)</p>', page)
txt = added + '\n' + (html.unescape(m.group(1)) if m else '')
if len(sys.argv) > 2:
    txt += '\nУ нас индивидуальный подход к каждому.'
json.dump({'tool_input': {'file_path': 'pr478-added.md', 'content': txt}}, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
print('символов', len(txt), '| em dash', txt.count(chr(0x2014)), '| строка «день не закрыт» найдена', bool(m))
