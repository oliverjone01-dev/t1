# iter3, R1: дубли id и em dash на пересобранной странице «Тесты» (scratch), размер.
import re, collections, os
p = '/tmp/claude-0/-home-user-t1/39ce78b8-29b6-551f-9a34-e54649462146/scratchpad/it3/out/katya-tests.html'
s = open(p, encoding='utf-8').read()
ids = collections.Counter(re.findall(r'\sid="([^"]+)"', s))
d = {k: v for k, v in ids.items() if v > 1}
print('размер', round(os.path.getsize(p) / 1024), 'KB | id всего', len(ids), '| дублей', len(d), list(d.items())[:5], '| em dash', s.count('\u2014'))
