"""Проба iter3: слияние origin/main в ветку не потеряло и не испортило журнал решений и трейс.
decisions.md: голова = новый main + ровно одна строка ветки (та же, что в iter2); строки, которые main добавил после старой базы, на месте;
маркеров конфликта нет. traces/2026-10-20/agents.jsonl: объединение строк обеих сторон, без лишних, без дублей, каждая строка - JSON.
Запуск из корня репозитория: python3 -I p_merge_iter3.py <head> <old_base> <new_base> <code_rev_iter2>
ФЕНИКС 2026-10-20, PR #490 iter3."""
import sys, json, subprocess

HEAD, OLD, NEW, CODE = sys.argv[1:5]


def git(*a):
    return subprocess.run(["git", *a], capture_output=True, text=True, check=True).stdout


def show(rev, path):
    p = subprocess.run(["git", "show", f"{rev}:{path}"], capture_output=True, text=True)
    return p.stdout.splitlines() if p.returncode == 0 else []


def markers(lines):
    return sum(1 for l in lines if l[:7] in ("<" * 7, "=" * 7, ">" * 7))


p1, p2 = git("rev-parse", f"{HEAD}^1", f"{HEAD}^2").split()
print(f"голова {git('rev-parse', '--short', HEAD).strip()}: родители {p1[:7]} (ветка) и {p2[:7]} (main)")

D = "knowledge/decisions.md"
h, n, o, c = show(HEAD, D), show(NEW, D), show(OLD, D), show(CODE, D)
added_branch = [l for l in h if l not in set(n)]
removed_vs_main = [l for l in n if l not in set(h)]
main_added = [l for l in n if l not in set(o)]
iter2_added = [l for l in c if l not in set(o)]
print(f"\n{D}: строк голова {len(h)}, новый main {len(n)}")
print(f"  строк головы, которых нет в main: {len(added_branch)}; строк main, которых нет в голове: {len(removed_vs_main)}")
print(f"  добавленная строка = строке ветки из iter2 ({OLD[:7]}..{CODE[:7]}): {added_branch == iter2_added}")
for l in added_branch:
    print(f"    {l[:150]}")
print(f"  строк, которые main добавил после {OLD[:7]}: {len(main_added)}, на месте в голове: {sum(1 for l in main_added if l in set(h))}")
for l in main_added:
    print(f"    {l[:110]}")
print(f"  маркеров конфликта в голове: {markers(h)}")
print(f"  порядок: строка ветки стоит выше записи #491 (новые сверху): "
      f"{h.index(added_branch[0]) < h.index(main_added[0]) if added_branch and main_added else 'н/п'}")

T = "traces/2026-10-20/agents.jsonl"
th, tb, tm = show(HEAD, T), show(p1, T), show(p2, T)
H = set(th)
bad = 0
for l in th:
    try:
        json.loads(l)
    except Exception:
        bad += 1
print(f"\n{T}: строк голова {len(th)}, сторона ветки {len(tb)}, сторона main {len(tm)}, общий предок {len(show(git('merge-base', p1, p2).strip(), T))}")
print(f"  строк ветки в голове: {sum(l in H for l in tb)} из {len(tb)}; строк main в голове: {sum(l in H for l in tm)} из {len(tm)}")
print(f"  строк головы ни с одной стороны: {sum(1 for l in th if l not in set(tb) | set(tm))}; дублей: {len(th) - len(H)}; "
      f"не JSON: {bad}; маркеров конфликта: {markers(th)}")
