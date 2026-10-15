# ФЕНИКС, итерация 4, проба 8 (B5, S7): вшитые числа в тексте выдачи analiz.py.
# Ищу цифры в литеральной части f-строк print (вне {...}) в разделах 14-19 и старые вшитые 9.4 / 25.3 / «23%» итерации 3.
# Параметры дизайна (6%, 8,8%, 25%, ×0,3, 65%, окна дат) - не находка; находка - результат расчёта, вписанный руками.
# Только чтение. Запуск: python3 -I feniks_iter4_8_constants.py
import re
P = '/home/user/t1/knowledge/episodes/2026-10/ym-reklama-scripts/analiz.py'
src = open(P, encoding='utf-8').read().split('\n')
start = next(i for i, l in enumerate(src) if '## 14.' in l)
for i, l in enumerate(src[start:], start + 1):
    for m in re.finditer(r'print\(f?"(.*)"\)', l):
        lit = re.sub(r'\{[^{}]*\}', '{}', m.group(1))
        nums = re.findall(r'(?<![\w.])\d+(?:[.,]\d+)?%?', lit)
        nums = [x for x in nums if not re.fullmatch(r'\d{1,2}', x) or x in ('18', '20')]
        if nums:
            print(f'analiz.py:{i}: {nums} | {lit[:150]}')
txt = '\n'.join(src)
for t in ('9.4', '25.3', '"23%', ' 23%'):
    print(f'«{t}» в analiz.py: {txt.count(t)}')
