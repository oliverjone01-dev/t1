# ФЕНИКС 14.10, предпроверка разбора падения заказов: повтор razbor.py и сравнение с закоммиченным razbor_out.txt.
import subprocess, difflib
R = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7/razbor/'
p = subprocess.run(['python3', '-I', '-B', R + 'razbor.py', '/home/user/t1/analytics-mvp/data'], capture_output=True, text=True, timeout=300)
new = p.stdout.splitlines(); old = open(R + 'razbor_out.txt', encoding='utf-8').read().splitlines()
d = [l for l in difflib.unified_diff(old, new, lineterm='', n=0) if l.startswith(('+', '-')) and not l.startswith(('+++', '---'))]
print('rc', p.returncode, 'строк', len(old), len(new), 'расхождений', len(d)); print('\n'.join(d[:10])); print(p.stderr[-300:])
open('/tmp/feniks-v6/razbor_out_rerun.txt', 'w', encoding='utf-8').write(p.stdout)
