import re
SP = '/tmp/claude-0/-home-user-t1/39ce78b8-29b6-551f-9a34-e54649462146/scratchpad/'
h = open(SP + 'out/katya-tests.html', encoding='utf-8').read()
a = h.index('<details class="card tcard" open id="pt-plan">'); b = h.index('<section class="card"', a)
scripts = [(m.start(), m.group(1)) for m in re.finditer(r'<script>([\s\S]*?)</script>', h)]
plan_js = scripts[-1][1]
other = [s for p, s in scripts[:-1]]
markup_rest = re.sub(r'<script>[\s\S]*?</script>', '', h[:a] + h[b:])
print('wk-col в разметке вне блока:', markup_rest.count('wk-col'), '| в скриптах страницы:', sum(s.count('wk-col') for s in other))
sels = set()
for s in other:
    sels |= set(re.findall(r"querySelectorAll\(\s*['\"]([^'\"]+)['\"]", s)) | set(re.findall(r"querySelector\(\s*['\"]([^'\"]+)['\"]", s))
    sels |= set(re.findall(r"getElementsByClassName\(\s*['\"]([^'\"]+)['\"]", s)) | set(re.findall(r"getElementsByTagName\(\s*['\"]([^'\"]+)['\"]", s))
print('селекторы в JS страницы:', sorted(sels))
cls_blk = set(c for m in re.findall(r'class="([^"]+)"', h[a:b]) for c in m.split())
risky = sorted(s for s in sels if any(re.search(r'\.' + re.escape(c) + r'(?![\w-])', s) for c in cls_blk) or re.match(r'^(details|summary|table|tr|td|th|button|span)\b', s))
print('могут задеть блок:', risky)
print('window.* в JS страницы:', sorted(set(re.findall(r'window\.([A-Za-z_]\w*)\s*=', ''.join(other)))))
print('глобальные объявления в начале JS блока:', plan_js[:200].replace('\n', ' '))
