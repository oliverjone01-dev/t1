# ФЕНИКС iter5: мои собственные тексты (отчёт md + JSON + пробы) через тот же C3/C4, что и текст автора.
# Запрещённые фразы и длинное тире собираю escape-кодами, чтобы проба не находила сама себя. python3 -I c9_self.py <out_event.json>
import json, sys, pathlib
S = pathlib.Path('/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/out')
EMD = chr(0x2014)
BAN = ' '.join(['выглядит', 'хорошо'])
files = [S / 'feniks-audit-ozon-plan-iter5-20261015.md', S / 'feniks-audit-ozon-plan-iter5-20261015.json'] + sorted((S / 'iter5').iterdir())
t = ''
for f in files:
    x = f.read_text(encoding='utf-8')
    if f.name == 'c8_slop.py':   # контрольная фраза пробы C4 - заведомое попадание, в собственный текст не считаю
        x = x.replace('индивидуальный подход', '')
    t += x + '\n'
    if x.count(EMD) or BAN in x.lower():
        print(f.name, 'em dash', x.count(EMD), '| запрещённая фраза', x.lower().count(BAN))
json.dump({'tool_input': {'file_path': 'feniks-iter5-self.md', 'content': t}}, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
print('файлов', len(files), '| символов', len(t), '| запрещённая фраза', t.lower().count(BAN), '| em dash всего', t.count(EMD))
