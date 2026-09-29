#!/usr/bin/env python3
"""rework_rate.py - доля коммитов-переделок (метрика успеха data-guard).

Использование:
  rework_rate.py --branch <ветка> [--base origin/main]   # коммиты ветки, которых нет в base
  rework_rate.py --session <id>                          # коммиты с трейлером Claude-Session: .../session_<id>
  rework_rate.py --since 2026-10-01 [--until 2026-11-01] # все коммиты за период (--until = первый день следующего месяца)
  --list   показать классификацию каждого коммита
Нужна полная история (в shallow-клоне: git fetch --unshallow или git fetch --depth=2000).

Два режима счёта:
1. Трейлер (основной, с 29.09.2026): у коммита-переделки строка `Rework: customer|self|feniks`
   (customer = правка заказчика на сданное; self = нашёл сам после коммита; feniks = return/veto ФЕНИКСА).
   Цель data-guard считается только по customer.
2. Эвристика по заголовку (для истории до трейлеров): fix/revert/исправ/откат/правка/регресс.
   Пропускает переделки без слов fix/исправ в заголовке (ретро: 0% эвристикой против 45% ручной разметки в ОЗОН v2)
   и не отличает правки заказчика от своих фиксов. Это грубый индикатор, не цель.
Служебные коммиты (трейсы, мержи, пересборки данных) не входят в знаменатель.
"""
import re
import subprocess
import sys

REWORK = re.compile(r"(^|\W)(fix|hotfix|revert|исправ|откат|вернул|верн[уё]л|переделк|правк[аи] (ивана|заказчика|кати)|по замечани|по правке|ошибк[аи] в|не учел|не учёл|регресс)", re.I)
SERVICE = re.compile(r"^(chore\(traces\)|traces?:|trace\b|data(-ym)?:|chore\(data\)|merge |merge:|пересбор|rebuild|снимок|snapshot|служебная запись)", re.I)
TRAILER = re.compile(r"^Rework:\s*(customer|self|feniks)\s*$", re.I | re.M)


def git(*args):
    p = subprocess.run(["git", *args], capture_output=True, text=True)
    if p.returncode:
        raise SystemExit(f"rework_rate: git {' '.join(args[:3])} ... : {p.stderr.strip() or 'ошибка'}")
    return p.stdout


def commits(argv):
    fmt = "%H%x1f%P%x1f%s%x1f%b%x1e"
    if "--branch" in argv:
        b = argv[argv.index("--branch") + 1]
        base = argv[argv.index("--base") + 1] if "--base" in argv else "origin/main"
        for ref in (b, base):
            if subprocess.run(["git", "rev-parse", "--verify", "-q", ref], capture_output=True).returncode:
                raise SystemExit(f"rework_rate: ветка или ref '{ref}' не найдена (git fetch origin {ref}?)")
        out = git("log", f"{base}..{b}", f"--format={fmt}")
    elif "--session" in argv:
        s = argv[argv.index("--session") + 1]
        out = git("log", "--all", f"--grep=session_{s}", f"--format={fmt}")
    else:
        rng = []
        if "--since" in argv:
            rng.append(f"--since={argv[argv.index('--since') + 1]}")
        if "--until" in argv:
            rng.append(f"--until={argv[argv.index('--until') + 1]}")
        out = git("log", "--all", *rng, f"--format={fmt}")
    seen = set()
    for rec in out.split("\x1e"):
        rec = rec.strip("\n")
        if not rec:
            continue
        h, parents, subj, body = (rec.split("\x1f") + ["", "", "", ""])[:4]
        if h in seen:
            continue
        seen.add(h)
        yield h, parents.split(), subj, body


def classify(parents, subj, body):
    if len(parents) > 1 or SERVICE.search(subj):
        return "service", None
    t = TRAILER.search(body or "")
    if t:
        return "rework", t.group(1).lower()
    if REWORK.search(subj):
        return "rework", "heuristic"
    return "work", None


def main(argv):
    total = service = 0
    kinds = {"customer": 0, "self": 0, "feniks": 0, "heuristic": 0}
    rows = []
    for h, parents, subj, body in commits(argv):
        k, who = classify(parents, subj, body)
        if k == "service":
            service += 1
        else:
            total += 1
            if who:
                kinds[who] += 1
        rows.append((h[:8], k + (f":{who}" if who else ""), subj[:90]))
    if "--list" in argv:
        for r in rows:
            print(" | ".join(r))
    pct = lambda n: f"{(n / total * 100):.0f}%" if total else "н/д"
    tagged = kinds["customer"] + kinds["self"] + kinds["feniks"]
    print(f"Содержательных коммитов: {total}, служебных: {service}")
    print(f"По трейлеру Rework: customer {kinds['customer']} ({pct(kinds['customer'])}), self {kinds['self']}, feniks {kinds['feniks']}")
    print(f"По эвристике заголовка (без трейлера, грубый индикатор, занижает): {kinds['heuristic']} ({pct(kinds['heuristic'])})")
    if tagged == 0:
        print("Трейлеров Rework нет: цель по правкам заказчика не измерена, доступна только эвристика.")
    print("Цель data-guard [ГИПОТЕЗА до замеров на 3+ задачах]: customer ниже 15% содержательных коммитов.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
