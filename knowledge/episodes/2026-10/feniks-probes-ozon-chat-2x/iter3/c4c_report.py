# ФЕНИКС iter3: самопроверка отчёта (em dash, событие для anti-slop-checker). python3 -I c4c_report.py <out_event.json>
import json, sys

E = '/home/user/t1/knowledge/episodes/2026-10/'
md = open(E + 'feniks-audit-ozon-chat-2x-iter3-20261015.md', encoding='utf-8').read()
js = open(E + 'feniks-audit-ozon-chat-2x-iter3-20261015.json', encoding='utf-8').read()
print('em dash md', md.count(chr(0x2014)), '| json', js.count(chr(0x2014)), '| последние строки:', md.rstrip().splitlines()[-2:])
json.dump({'tool_input': {'file_path': 'report.md', 'content': md}}, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
