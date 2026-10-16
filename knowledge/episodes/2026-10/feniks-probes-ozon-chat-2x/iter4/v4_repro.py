# ФЕНИКС iter4 @ da0a36b. Проба V3c: воспроизводимость заморозки plan_2026-10-15_v3.json.
# Скрипт автора (v8/withdraw_base_1510.py из коммита) исполняется из scratch: вход - data/ коммита и correct_plan_1510.py
# из коммита, выход - в scratch (не в data/). Сравниваю байты с закоммиченным v3. Код автора не меняется, только пути.
# python3 -I v4_repro.py
import subprocess, os, io, contextlib, hashlib

R = '/home/user/t1'
SP = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/repro/'
os.makedirs(SP, exist_ok=True)
show = lambda p: subprocess.run(['git', '-C', R, 'show', f'da0a36b:{p}'], capture_output=True, text=True, check=True).stdout
src = show('knowledge/episodes/2026-10/ozon-testy-scripts/v8/withdraw_base_1510.py')
open(SP + 'correct_plan_1510.py', 'w', encoding='utf-8').write(show('knowledge/episodes/2026-10/ozon-testy-scripts/v8/correct_plan_1510.py'))
DATA = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/data_753bf11/analytics-mvp/data/'
subs = [('DD = "analytics-mvp/data/"', f'DD = "{DATA}"'),
        ('SRC, DST = DD + "plan_2026-10-15_v2.json", DD + "plan_2026-10-15_v3.json"', f'SRC, DST = DD + "plan_2026-10-15_v2.json", "{SP}plan_v3_repro.json"'),
        ('open("knowledge/episodes/2026-10/ozon-testy-scripts/v8/correct_plan_1510.py"', f'open("{SP}correct_plan_1510.py"')]
for a, b in subs:
    assert src.count(a) == 1, a
    src = src.replace(a, b)
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    exec(compile(src, 'withdraw_base_1510.py', 'exec'), {'__name__': '__main__'})
print(buf.getvalue().strip())
mine = open(SP + 'plan_v3_repro.json', 'rb').read()
theirs = subprocess.run(['git', '-C', R, 'show', 'da0a36b:analytics-mvp/data/plan_2026-10-15_v3.json'], capture_output=True, check=True).stdout
print('sha256 повтор', hashlib.sha256(mine).hexdigest()[:16], '| в коммите', hashlib.sha256(theirs).hexdigest()[:16], '| совпадает байт-в-байт:', mine == theirs)
