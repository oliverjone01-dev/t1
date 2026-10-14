# ФЕНИКС, итерация 2, проба 11: положительный контроль anti-slop-checker.sh (заведомо плохой текст должен дать предупреждение)
import json, subprocess
H = '/home/user/t1/.claude/hooks/anti-slop-checker.sh'
bad = 'Это уникальный актив и индивидуальный подход, выглядит хорошо — выстрелит.'
ev = {'tool_name': 'Write', 'tool_input': {'file_path': '/tmp/x.md', 'content': bad}}
r = subprocess.run(['bash', H], input=json.dumps(ev, ensure_ascii=False), capture_output=True, text=True, cwd='/home/user/t1')
print('exit', r.returncode, 'stdout_len', len(r.stdout))
print(r.stdout[:600])
