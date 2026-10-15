# ФЕНИКС iter3, PR #478 @ 528604a. C3/C4 по правке v2: добавленный текст диффа 754cf5c..528604a (код, decisions, без json плана)
# -> событие для .claude/hooks/anti-slop-checker.sh. python3 -I c4b_slop.py <out_event.json> [control]
import json, subprocess, sys

R = '/home/user/t1'
diff = subprocess.run(['git', '-C', R, 'diff', '754cf5c', '528604a', '--', '.', ':!analytics-mvp/data'], capture_output=True, text=True).stdout
txt = '\n'.join(l[1:] for l in diff.splitlines() if l.startswith('+') and not l.startswith('+++'))
if len(sys.argv) > 2:
    txt += '\nУ нас индивидуальный подход к каждому.'
json.dump({'tool_input': {'file_path': 'pr478-v2-added.md', 'content': txt}}, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
print('символов', len(txt), '| em dash', txt.count(chr(0x2014)))
