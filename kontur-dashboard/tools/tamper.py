# -*- coding: utf-8 -*-
"""Подсовываем сторожу заведомо испорченные версии. Каждая обязана быть поймана."""
import subprocess, shutil, sys, re
from pathlib import Path
SRC=str(Path(__file__).resolve().parents[1]/'public'/'index.html'); BAK=SRC+'.bak'
CASES = [
 ('длинное тире', lambda s: s.replace('Обзор','Обзор — сводка',1)),
  ('ДАННЫЕ без источника', lambda s: re.sub(r'"k": "ДАННЫЕ", "s": "[^"]+"', '"k": "ДАННЫЕ", "s": ""', s, count=1)),
 # Случаи не привязаны к конкретным значениям: данные обновляются, тест должен переживать это
 ('ДАННЫЕ без даты', lambda s: re.sub(r'"at": "\d{4}-\d{2}-\d{2}"', '"at": ""', s, count=1)),
  ('пустое значение как ДАННЫЕ', lambda s: re.sub(r'\{"v": \d+, "k": "ДАННЫЕ"', '{"v": null, "k": "ДАННЫЕ"', s, count=1)),
 ('несуществующий класс', lambda s: s.replace('"k": "ГИПОТЕЗА"','"k": "ПРИМЕРНО"',1)),
 ('запрет: размер зеркала латиницей', lambda s: s.replace('Обзор','Обзор 2200x3600',1)),
 ('запрет: размер зеркала кириллицей', lambda s: s.replace('Обзор','Обзор 2200х3600',1)),
 ('запрет: знак умножения', lambda s: s.replace('Обзор','Обзор 2200×3600',1)),
 ('запрет: старое ядро', lambda s: s.replace('Обзор','Обзор 548449',1)),
 ('запрет: гарантия 5 лет', lambda s: s.replace('Обзор','гарантия на каркас 5 лет',1)),
 ('запрет: цена за м2', lambda s: s.replace('Обзор','от 25 000 ₽/м2',1)),
 ('запрет: внутреннее имя', lambda s: s.replace('Обзор','ДомГласс',1)),
 ('цвет мимо палитры', lambda s: s.replace("KS.charts.line('c-h10', {","KS.charts.line('c-h10', { colors:['#FF00AA'],",1)),
 ('запрещённая пара при дальтонизме', lambda s: s.replace("KS.charts.index('c-idx100', {","KS.charts.index('c-idx100', { colors:['#5D87FF','#49BEFF'],",1)),
 ('две оси Y', lambda s: s.replace("KS.charts.multi('c-pos', {","KS.charts.multi('c-pos', { yaxis:[{},{}],",1)),
 ('дата съёма зашита в вёрстку', lambda s: s.replace('Обзор','съём 08.09.2026',1)),
 ('график без отрисовки', lambda s: s.replace("ch('c-pos',320)","ch('c-prizrak',320)",1)),
 ('Tailwind вместо кита', lambda s: s.replace('</head>','<script src="https://cdn.tailwindcss.com"></script>\n</head>',1)),
 ('текст приглушён прозрачностью', lambda s: s.replace('class="ks-muted"','class="opacity-55"',1)),
 ('цвет в графике трёхзначным hex', lambda s: s.replace("KS.charts.line('c-h10', {","KS.charts.line('c-h10', { colors:['#f0a'],",1)),
 ('цвет в графике через rgb()', lambda s: s.replace("KS.charts.line('c-h10', {","KS.charts.line('c-h10', { colors:['rgb(240,0,170)'],",1)),
 ('именованный цвет в графике', lambda s: s.replace("KS.charts.line('c-h10', {","KS.charts.line('c-h10', { colors:['hotpink'],",1)),
 ('цвет в графике через hwb()', lambda s: s.replace("KS.charts.line('c-h10', {","KS.charts.line('c-h10', { fill:{ gradient:{ gradientToColors:[ 'hwb(330 0% 0%)' ] } },",1)),
 ('цвет в графике через foreColor', lambda s: s.replace("KS.charts.line('c-h10', {","KS.charts.line('c-h10', { chart:{ foreColor:'hotpink' },",1)),
 ('пункт меню без экрана', lambda s: s.replace("{id:'compare', t:'Сравнение проектов', i:'cmp'}","{id:'compare', t:'Сравнение проектов', i:'cmp'},{id:'nesushestvuet', t:'Пусто', i:'grid'}",1)),
]
shutil.copy(SRC, BAK)
orig = open(SRC, encoding='utf-8').read()
caught = 0
try:
    for name, f in CASES:
        broken = f(orig)
        if broken == orig:
            print(f'  ПРОПУСК подмены не произошло: {name}'); continue
        open(SRC,'w',encoding='utf-8').write(broken)
        r = subprocess.run([sys.executable,str(Path(__file__).resolve().parent/'check_dash.py')],capture_output=True,text=True)
        if r.returncode != 0:
            caught += 1
            code = [l.strip() for l in r.stdout.splitlines() if l.strip().startswith('[')]
            print(f'  поймано: {name}  ->  {code[0] if code else ""}')
        else:
            print(f'  ПРОСКОЧИЛО: {name}')
finally:
    shutil.copy(BAK, SRC)
print(f'\nитог: {caught} из {len(CASES)}')
sys.exit(0 if caught == len(CASES) else 1)
