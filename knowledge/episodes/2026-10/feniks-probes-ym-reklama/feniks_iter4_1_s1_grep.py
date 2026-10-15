# ФЕНИКС, итерация 4, проба 1 (S1, B4): снятая механика «дневного кошелька» по всем поверхностям.
# Приёмка итерации 3: единственное попадание - цитата снятого объяснения в З7 артефакта.
# Только чтение. Запуск: python3 -I feniks_iter4_1_s1_grep.py
import re
F = {
    'артефакт': '/home/user/t1/knowledge/episodes/2026-10/ym-reklama-analiz-20261014.md',
    'скрипт': '/home/user/t1/knowledge/episodes/2026-10/ym-reklama-scripts/analiz.py',
    'выдача': '/home/user/t1/knowledge/episodes/2026-10/ym-reklama-scripts/analiz-output.md',
    'self-check': '/home/user/t1/knowledge/episodes/2026-10/selfcheck-ym-reklama-analiz-20261014.md',
}
P = [r'баллов на день нет', r'баланса баллов', r'баллы кончаются', r'баллы закончи', r'баллов не хват',
     r'сначала баллами', r'когда баллов', r'на день нет', r'дневн\w* кошел', r'кошел\w* дня', r'баллов нет']
rx = re.compile('|'.join(P), re.I)
total = 0
for lab, path in F.items():
    for i, l in enumerate(open(path, encoding='utf-8'), 1):
        for m in rx.finditer(l):
            total += 1
            s = max(0, m.start() - 80); e = min(len(l), m.end() + 40)
            print(f'{lab}:{i}: ...{l[s:e].strip()}...')
print('всего попаданий:', total)
