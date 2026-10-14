# ФЕНИКС, итерация 2, проба 4 (B1): каждое число текста артефакта ищется в выдаче analiz-output.md
# Нечёткое совпадение: число текста с d знаками после запятой считается найденным, если в выдаче есть w,
# для которого round(w, d), round(w/1e3, d) или round(w/1e6, d) равно ему. Даты, номера кампаний, разделов и SKU исключаются.
import re, sys
A = '/home/user/t1/knowledge/episodes/2026-10/ym-reklama-analiz-20261014.md'
O = '/home/user/t1/knowledge/episodes/2026-10/ym-reklama-scripts/analiz-output.md'
art = open(A, encoding='utf-8').read()
out = open(O, encoding='utf-8').read()
# числа выдачи: 1,234,567.89 / 7.3% / 0.64%
ow = set()
for t in re.findall(r'-?\d[\d,]*(?:\.\d+)?', out):
    try:
        ow.add(float(t.replace(',', '')))
    except ValueError:
        pass
def found(v, d):
    for w in ow:
        for s in (1, 1e3, 1e6):
            if round(abs(w) / s, d) == round(v, d):
                return True
    return False
lines = art.split('\n')
skip_line = lambda l: l.startswith('- `analytics-mvp') or l.startswith('- **Скрипт') or l.startswith('- **Дата')
miss = []
for i, l in enumerate(lines, 1):
    if skip_line(l):
        continue
    # убрать даты, номера кампаний (7+ цифр подряд), SKU-коды, ссылки на разделы в скобках, П1-П8, З1-З8, G1-G10
    s = re.sub(r'\b\d{1,2}\.\d{2}(\.\d{4})?\b', ' ', l)
    s = re.sub(r'\b\d{7,}\b', ' ', s)
    s = re.sub(r'\b[A-Z]{2,}[A-Z0-9-]*\d[\w-]*', ' ', s)
    s = re.sub(r'\b[ПЗGК]\d+\b', ' ', s)
    s = re.sub(r'\((\d{1,2}(, ?\d{1,2})*)\)', ' ', s)
    s = re.sub(r'D\d+/\d+|\d+х\d+|\d+\*\d+', ' ', s)
    for m in re.finditer(r'(?<![\w.])(\d{1,3}(?:[  ]\d{3})+|\d+)(?:,(\d+))?', s):
        ip = m.group(1).replace(' ', '').replace(' ', ''); fp = m.group(2)
        v = float(ip + ('.' + fp if fp else '')); d = len(fp) if fp else 0
        if v in (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10) and d == 0:
            continue
        if not found(v, d):
            miss.append((i, m.group(0), l.strip()[:110]))
print('numbers in artifact not found in output (line, token, context):', len(miss))
for x in miss:
    print('  ', x)
