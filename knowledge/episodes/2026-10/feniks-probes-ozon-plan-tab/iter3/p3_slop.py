# iter3: текст блока «План с 15.10» с пересобранной страницы -> событие для anti-slop-checker.sh (+ контрольная заведомая фраза).
# python3 -I p3_slop.py <page.html> <out_event.json> [control]
import json, re, sys, html
page = open(sys.argv[1], encoding='utf-8').read()
a = page.find('id="pt-plan"'); b = page.find('<script', a)
blk = page[a:b]
txt = html.unescape(re.sub(r'<[^>]+>', ' ', blk))
txt = re.sub(r'\s+', ' ', txt)
if len(sys.argv) > 3: txt += ' Это выглядит хорошо и отлично подойдёт.'
json.dump({'tool_input': {'file_path': 'plan-block.html', 'content': txt}}, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
print('символов блока', len(txt), '| em dash', txt.count('\u2014'))
