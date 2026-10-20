"""Проба (м) iter2: мутационный тест - ловят ли тесты plan-tab.test.ts поломку проводки G1/G2 в planBlock.
Каждый мутант - одна замена в КОПИИ plan-tab.ts в scratch-дереве головы 299cc0c, затем vitest plan-tab.test.ts,
затем исходный файл возвращается. Мутант «выжил» = все тесты зелёные при сломанном коде.
Запуск: python3 -I p_m_mutants_iter2.py <scratch_head_tree>/analytics-mvp
ФЕНИКС 2026-10-20, аудит PR #490 iter2. Репозиторий не трогает: путь должен быть в scratch."""
import sys, os, shutil, subprocess, re

ROOT = sys.argv[1]
assert ROOT.startswith("/tmp/"), "только scratch"
SRC = os.path.join(ROOT, "src/scripts/plan-tab.ts")
BAK = SRC + ".orig"
shutil.copyfile(SRC, BAK)
with open(BAK, encoding="utf-8") as fh:
    orig = fh.read()

MUT = [
    ("M1 G1: сумма окна по OD_LAST вместо OW.end (возврат дефекта iter1)",
     "artUnits(p.art, START, OW.end)", "artUnits(p.art, START, OD_LAST)"),
    ("M2 G2: пометка Δ отключена (всё со знаком и цветом)",
     "const note = deltaNote(uB, uA, OW.days, chg.some((c) => c.d >= START && c.d <= OW.end));",
     "const note = null as string | null;"),
    ("M3 G5: «цена в окне менялась» всегда true",
     "chg.some((c) => c.d >= START && c.d <= OW.end)", "true"),
    ("M4 G2: строка магазина под таблицей убрана",
     "    + storeRateLine();", "    + \"\";"),
    ("M5 G1 помощник: ordWindow без обрезки концом плана",
     "const end = odLast < w1 ? odLast : w1;", "const end = odLast;"),
    ("M6 G2 пороги: 0 дней и 0 заказов",
     "DELTA_MIN_ORDERS = 5, DELTA_MIN_DAYS = 7", "DELTA_MIN_ORDERS = 0, DELTA_MIN_DAYS = 0"),
]


def vitest():
    p = subprocess.run(["npx", "vitest", "run", "src/scripts/plan-tab.test.ts"], cwd=ROOT, capture_output=True, text=True)
    out = p.stdout + p.stderr
    m = re.search(r"Tests\s+(.*)", out)
    return p.returncode, (m.group(1).strip() if m else out[-300:])


rc, summ = vitest()
print(f"исходный код: rc={rc} | {summ}")
try:
    for name, a, b in MUT:
        n = orig.count(a)
        if n != 1:
            print(f"{name}: цель найдена {n} раз - мутант не применён")
            continue
        with open(SRC, "w", encoding="utf-8") as fh:
            fh.write(orig.replace(a, b))
        rc, summ = vitest()
        print(f"{name}: {'ВЫЖИЛ (тесты зелёные)' if rc == 0 else 'убит'} | {summ}")
finally:
    shutil.copyfile(BAK, SRC)
    os.remove(BAK)
rc, summ = vitest()
print(f"исходный код после возврата: rc={rc} | {summ}")
