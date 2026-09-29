#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Собирает витрину в один файл: токены, кит, графики и скрипт витрины внутри.
  specimen.html          полный документ, открывается с диска и на Pages
  specimen.artifact.html то же без doctype и html/body: для публикации артефактом Claude"""
import json
from pathlib import Path
H = Path(__file__).resolve().parents[1]
rd = lambda p: (H / p).read_text(encoding='utf-8')
head = ('<title>Контур DS</title>\n'
  '<meta name="description" content="Дизайн-система рабочих интерфейсов: токены, компоненты, графики, две темы">\n'
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&display=swap">\n'
  '<style>\n' + rd('tokens/tokens.css') + '\n' + rd('kit/kit.css') + '\n' + rd('specimen/specimen.css') + '\n</style>\n'
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/apexcharts/3.54.1/apexcharts.min.js"></script>\n')
scripts = '<script>\n' + rd('kit/brand.js') + '\n' + rd('kit/icons.js') + '\n' + rd('kit/kit.js') + '\n' + rd('kit/charts.js') + '\n' + rd('kit/motion.riv.js') + '\n</script>\n'
body = rd('specimen/body.html')
# стартер целиком, со вшитыми токенами и китом: его показывают рамки устройств
st = rd('templates/starter.html')
st = st.replace('<link rel="stylesheet" href="../tokens/tokens.css">', '<style>\n' + rd('tokens/tokens.css') + '\n</style>')
st = st.replace('<link rel="stylesheet" href="../kit/kit.css">', '<style>\n' + rd('kit/kit.css') + '\n</style>')
for js in ('brand', 'icons', 'kit', 'charts', 'motion.riv'):
    st = st.replace('<script src="../kit/' + js + '.js"></script>', '<script>\n' + rd('kit/' + js + '.js') + '\n</script>')
assert '../' not in st, 'в стартере остались ссылки на файлы'
# все «<» кодом: так в строке нет ни </script>, ни <!--, и тег script не закроется раньше времени
starter = '<script>window.SP_STARTER = ' + json.dumps(st, ensure_ascii=False).replace('<', '\\u003c') + ';</script>\n'
tail = starter + '<script>\n' + rd('specimen/specimen.js') + '\n</script>\n'
art = head + scripts + body + tail
(H / 'specimen.artifact.html').write_text(art, encoding='utf-8')
full = '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + head + scripts + '</head>\n<body>\n' + body + tail + '</body>\n</html>\n'
(H / 'specimen.html').write_text(full, encoding='utf-8')
print(f'specimen.html {len(full)//1024} КБ, specimen.artifact.html {len(art)//1024} КБ')
