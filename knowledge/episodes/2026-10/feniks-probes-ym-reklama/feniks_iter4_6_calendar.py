# ФЕНИКС, итерация 4, проба 6 (S5, X7-повтор): календарь П3, П4, П5, П9 по тексту артефакта и self-check.
# Приёмка S5: «П3, П4 и П5 разведены по времени» (артефакт:127). Проверяю даты, дни недели и пересечения окон.
# Только чтение. Запуск: python3 -I feniks_iter4_6_calendar.py
import re, datetime
A = '/home/user/t1/knowledge/episodes/2026-10/ym-reklama-analiz-20261014.md'
S = '/home/user/t1/knowledge/episodes/2026-10/selfcheck-ym-reklama-analiz-20261014.md'
art = open(A, encoding='utf-8').read().split('\n'); sc = open(S, encoding='utf-8').read().split('\n')
row = lambda tag: next((i + 1, l) for i, l in enumerate(art) if l.startswith('| ' + tag + ' |'))
for tag in ('П3', 'П4', 'П5', 'П9'):
    i, l = row(tag)
    ds = re.findall(r'\b\d{1,2}\.\d{2}(?:-\d{1,2}\.\d{2})?\b', l)
    print(f'артефакт:{i} {tag}: даты {ds}')
d = lambda s: datetime.date(2026 if s[3:5] != '01' else 2027, int(s[3:5]), int(s[:2]))
WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
for s in ('14.10', '17.10', '20.10', '21.10', '31.10', '10.11', '16.11', '14.12', '15.12', '28.12', '12.01'):
    print(f'{s} - {WD[d(s).weekday()]}')
p5 = (d('20.10'), d('28.12')); p3 = (d('15.12'), d('12.01'))
ov = (max(p5[0], p3[0]), min(p5[1], p3[1]))
print(f'П5 по дизайну {p5[0]:%d.%m}-{p5[1]:%d.%m}, П3 {p3[0]:%d.%m}-{p3[1]:%d.%m}: пересечение {ov[0]:%d.%m}-{ov[1]:%d.%m}, {(ov[1] - ov[0]).days + 1} дней')
print(f'П5 «старт не раньше ... (после 31.10)» против старта дизайна 20.10: разница {(d("31.10") - d("20.10")).days} дней; П9 (ответ Маркета) до 21.10, старт П5 20.10')
s0 = d('02.11'); print(f'если старт в первый понедельник после 31.10 ({s0:%d.%m}), 10 недель до {(s0 + datetime.timedelta(days=69)):%d.%m.%Y}; '
                      f'пересечение с П3 {max(s0, p3[0]):%d.%m}-{min(s0 + datetime.timedelta(days=69), p3[1]):%d.%m}')
print('self-check о сроках П5 и П3:')
for i, l in enumerate(sc, 1):
    for m in re.finditer(r'[^|.;]{0,60}(стоп 14\.12|15\.12|20\.10|10 недель|18 разделов)[^|;]{0,40}', l):
        print(f'   self-check:{i}: {m.group(0).strip()}')
