# Проба ФЕНИКСА: ослабление шаблона телефона в no-pii.test.ts (8452e7d). Публичный репозиторий и Pages.
# 1) форматы номеров, которые старый шаблон ловил, а новый нет; 2) прогон обоих по data/, data-ym/, public/ (как тест) и sessions/*.docx.
import re, os, zipfile
OLD = re.compile(r'\+7[\s(-]*\d{3}|\b\d{3}-\d{3}-\d{2}-\d{2}\b')
NEW = re.compile(r'\+7[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}\b|\b\d{3}-\d{3}-\d{2}-\d{2}\b')
samples = ['+7 (916) 123-45-67', '+79161234567', '+7 916 123 45 67', '+7-916-123-45-67', '916-123-45-67',
           '89161234567', '8 (916) 123-45-67', '8-916-123-45-67', '+7 916 123-4567', '+7(916)1234567', '+7 916 12 34 567',
           '+7.916.123.45.67', 'тел. 7 916 123 45 67', '+7 740 ₽', '+72 732 ₽']
print('формат | старый | новый')
for s in samples:
    print('  %-24s %s %s' % (s, 'ловит' if OLD.search(s) else '-', 'ловит' if NEW.search(s) else '-'))
root = '/home/user/t1-v4/analytics-mvp/'
lost, kept = [], 0
for d, exts in (('data', ('.json', '.ndjson')), ('data-ym', ('.json', '.ndjson')), ('public', ('.html',))):
    base = root + d
    if not os.path.isdir(base):
        continue
    for dp, _, fs in os.walk(base):
        for f in fs:
            if not f.endswith(exts):
                continue
            p = os.path.join(dp, f)
            try:
                t = open(p, encoding='utf-8', errors='ignore').read()
            except Exception:
                continue
            for m in OLD.finditer(t):
                ctx = t[max(0, m.start() - 30): m.end() + 30]
                if NEW.search(t[m.start(): m.start() + 40]):
                    kept += 1
                else:
                    lost.append((p.replace(root, ''), ctx.replace('\n', ' ')))
print('совпадений старого шаблона, которые новый тоже ловит: %d; которые новый пропускает: %d' % (kept, len(lost)))
seen = set()
for p, c in lost:
    k = (p, c[25:60])
    if k in seen:
        continue
    seen.add(k)
    if len(seen) <= 15:
        print('   ', p, '|', c)
# Word в sessions/ (публичный репозиторий): номера и e-mail
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
for f in sorted(os.listdir('/home/user/t1-v4/sessions')):
    if f.endswith('.docx'):
        z = zipfile.ZipFile('/home/user/t1-v4/sessions/' + f)
        t = re.sub(r'<[^>]+>', ' ', z.read('word/document.xml').decode('utf-8', 'ignore'))
        hits = NEW.findall(t) + OLD.findall(t) + re.findall(r'[\w.+-]+@[\w-]+\.\w+', t)
        if hits:
            print('docx', f, hits[:5])
