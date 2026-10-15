# ФЕНИКС, итерация 4, проба 7 (B1, S6): точная проверка новых чисел итерации 4 в выдаче analiz-output.md.
# Нечёткий матчер итераций 2-3 (feniks_iter2_4_b1_numbers.py) пропускает округлённые и производные числа, поэтому здесь
# список чисел, добавленных в итерации 4, ищется в выдаче точно (разделитель тысяч - запятая или пробел).
# Только чтение. Запуск: python3 -I feniks_iter4_7_b1_new.py
import re
O = open('/home/user/t1/knowledge/episodes/2026-10/ym-reklama-scripts/analiz-output.md', encoding='utf-8').read()
A = open('/home/user/t1/knowledge/episodes/2026-10/ym-reklama-analiz-20261014.md', encoding='utf-8').read()
norm = lambda s: s.replace(' ', '').replace(' ', '').replace(',', '')
on = norm(O)
NEW = ['47 614', '190 454', '11 903', '14 284', '13 926', '149 185', '4 484 038', '322', '0.9-3.4', '3%-11%', '10.71',
       '65%', 'срабатываний 2', '23.6%', '16 из 37', '5 из 60', '1.00', '1.75', '792 -> 2,494', '977 -> 866', '3,801', '0.8%',
       '466,548', '54,767', '96,580', '120,760', '85.0%', '97.5%', '76.0%']
for t in NEW:
    print(f'{"OK " if norm(t) in on else "НЕТ"} выдача: {t}')
# производные числа текста без строки в выдаче: ищу в артефакте и показываю контекст
for t, why in (('1,5 заказа в день', '16 / 11 = 1,45'), ('67 тыс', '8 × 8 324 = 66 592'), ('2 раза из 6', 'одиночные срабатывания, правило «два раза подряд» даёт 1'),
               ('10 переключений', 'в выдаче нет'), ('25-30 заказах', 'выдача 17: 25,3 и 30,4'), ('149 тыс', '149 185')):
    i = A.find(t)
    print(f'артефакт «{t}»: {"есть" if i >= 0 else "нет"}; {why}')
# D1: самопровозглашённая оценка; U+2014 по четырём файлам
for lab, path in (('артефакт', '/home/user/t1/knowledge/episodes/2026-10/ym-reklama-analiz-20261014.md'),
                  ('self-check', '/home/user/t1/knowledge/episodes/2026-10/selfcheck-ym-reklama-analiz-20261014.md'),
                  ('выдача', '/home/user/t1/knowledge/episodes/2026-10/ym-reklama-scripts/analiz-output.md'),
                  ('скрипт', '/home/user/t1/knowledge/episodes/2026-10/ym-reklama-scripts/analiz.py')):
    t = open(path, encoding='utf-8').read()
    print(f'{lab}: U+2014 {t.count(chr(0x2014))}; самооценок N/10 {len(re.findall(r"[0-9][.,][0-9]+ ?/ ?10", t))}')
