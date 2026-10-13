# v5: список снижения цены для варианта 1 (ответ Ивана 13.10 «1а»): артикулы из его файла «на вывод»
# (OZON-snizhenie-ceny-2026-10-12.xlsx, лежит вне репозитория), шаг = min(шаг файла, запас до 10% рентабельности)
# по ИСПРАВЛЕННОЙ модели пола цены (правки R1-R9 ФЕНИКСА, проба P20 после вето 4,7); запас < 5% - цену не трогаем.
# Запуск: python3 -I list26.py <путь к xlsx>   -> /tmp/ozon-v5/list26.json (вне репозитория: репо публичный, в файле запас рентабельности)
import json, sys, subprocess, os, math
import openpyxl
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = HERE.split('knowledge/')[0]
subprocess.run(['python3', '-I', ROOT + 'knowledge/episodes/2026-10/feniks-probes-ozon-price-floor/p20_patch_check.py'],
               check=True, capture_output=True)
rows = {r['art']: r for r in json.load(open('/tmp/feniks-floor/floor_rows_patched.json'))}
F = [r for r in openpyxl.load_workbook(sys.argv[1], data_only=True).worksheets[0].iter_rows(min_row=2, values_only=True) if r[0]]
assert len(F) == 51 and len({r[0] for r in F}) == 51, 'в файле Ивана 51 уникальный артикул'
out = []
for r in F:
    m = rows[r[0]]
    h10 = (1 - m['p_10'] / m['p0']) * 100 if m['p_10'] else None
    step = min(r[10], math.floor(h10)) if h10 is not None and h10 >= 5 else 0
    out.append(dict(art=r[0], sku=m['sku'], file_step=r[10], h10=round(h10, 1) if h10 is not None else None, step=step))
os.makedirs('/tmp/ozon-v5', exist_ok=True)
json.dump(out, open('/tmp/ozon-v5/list26.json', 'w'), ensure_ascii=False, indent=0)
n = sum(o['step'] > 0 for o in out)
print('артикулов в файле', len(out), '; снижаем', n, '; шаг 10%:', sum(o['step'] == 10 for o in out),
      '; шаг меньше 10%:', sum(0 < o['step'] < 10 for o in out), '; не трогаем', len(out) - n)
