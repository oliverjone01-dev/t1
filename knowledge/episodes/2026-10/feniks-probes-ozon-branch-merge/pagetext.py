# Видимый текст страницы с фильтром по ключевым словам (для сверки трёх поверхностей).
import re, sys
s = open(sys.argv[1], encoding='utf-8').read()
s = re.sub(r'<script.*?</script>', ' ', s, flags=re.S)
s = re.sub(r'<style.*?</style>', ' ', s, flags=re.S)
s = re.sub(r'</t[dh]>', ' | ', s)
s = re.sub(r'</tr>|<br>|</div>|</p>|</summary>|</li>', '\n', s)
s = re.sub(r'<[^>]+>', '', s)
s = s.replace('&nbsp;', ' ').replace(' ', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
lines = [re.sub(r'\s+', ' ', x).strip() for x in s.split('\n')]
lines = [x for x in lines if x]
pats = sys.argv[2:]
for i, x in enumerate(lines):
    if any(p.lower() in x.lower() for p in pats):
        print('%04d %s' % (i, x[:700]))
