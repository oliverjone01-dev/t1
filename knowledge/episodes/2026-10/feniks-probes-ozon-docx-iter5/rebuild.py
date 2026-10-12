"""ФЕНИКС iter5, проба R1: пересобрать make2.js с выходом в /tmp (рабочий docx не трогается).
Запуск: python3 -I rebuild.py && NODE_PATH=/opt/node22/lib/node_modules node /tmp/feniks-iter5-make2.js
        && python3 -I dtext.py /tmp/feniks-iter5-rebuilt.docx | diff - <(python3 -I dtext.py <docx из коммита>)"""
import pathlib
src = pathlib.Path('/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/make2.js').read_text()
target = '/home/user/t1/sessions/OZON-testy-itogi-2026-10-12.docx'
assert src.count(target) == 1, src.count(target)
assert src.count("const O=__dirname+'/';") == 1
src = src.replace(target, '/tmp/feniks-iter5-rebuilt.docx').replace(
    "const O=__dirname+'/';", "const O='/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/';")
pathlib.Path('/tmp/feniks-iter5-make2.js').write_text(src)
print('ok')
