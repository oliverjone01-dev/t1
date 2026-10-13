# Проба ФЕНИКСА B6: страница в коммите против пересборки из кода и данных того же коммита.
# Сравнение по видимому тексту (теги сняты), время сборки нормализуется.
import re, sys, difflib
a = open(sys.argv[1], encoding='utf-8').read()
b = open(sys.argv[2], encoding='utf-8').read()
norm = lambda s: re.sub(r'\d{2}\.\d{2}\.\d{4} \d{2}:\d{2} МСК', 'TS', s)
print('байт: коммит %d, пересборка %d, равны после нормализации времени: %s' % (len(a), len(b), norm(a) == norm(b)))


def text(s):
    s = re.sub(r'<script.*?</script>', ' ', s, flags=re.S)
    s = re.sub(r'<style.*?</style>', ' ', s, flags=re.S)
    s = re.sub(r'<[^>]+>', '\n', s)
    return [x.strip() for x in s.split('\n') if x.strip()]


ta, tb = text(norm(a)), text(norm(b))
d = [l for l in difflib.unified_diff(ta, tb, lineterm='', n=0) if not l.startswith('@@')]
print('строк видимого текста: коммит %d, пересборка %d, расхождений %d' % (len(ta), len(tb), len(d)))
for l in d[:40]:
    print(l[:300])
