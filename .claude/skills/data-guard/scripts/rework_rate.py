#!/usr/bin/env python3
"""rework_rate.py - доля коммитов-переделок (метрика успеха data-guard).

Использование:
  rework_rate.py --branch <ветка> [--base origin/main]   # коммиты ветки, которых нет в base
  rework_rate.py --session <id>                          # коммиты с трейлером Claude-Session: .../session_<id>
  rework_rate.py --since 2026-10-01 [--until 2026-10-31] # все коммиты за период
Добавь --list, чтобы увидеть классификацию каждого коммита.
Служебные (трейсы, мержи, пересборки данных) не входят в знаменатель.
"""
import re
import subprocess
import sys

REWORK = re.compile(r"(^|\W)(fix|hotfix|revert|исправ|откат|вернул|верн[уё]л|переделк|правк[аи] (ивана|заказчика|кати)|по замечани|по правке|ошибк[аи] в|не учел|не учёл|регресс)", re.I)
SERVICE = re.compile(r"^(chore\(traces\)|traces?:|trace\b|data(-ym)?:|chore\(data\)|merge |merge:|пересбор|rebuild|снимок|snapshot|служебная запись)", re.I)


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, check=True).stdout


def commits(argv):
    fmt = "%H%x1f%P%x1f%s%x1f%b%x1e"
    if "--branch" in argv:
        b = argv[argv.index("--branch") + 1]
        base = argv[argv.index("--base") + 1] if "--base" in argv else "origin/main"
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
    for rec in out.split("\x1e"):
        rec = rec.strip("\n")
        if not rec:
            continue
        h, parents, subj, body = (rec.split("\x1f") + ["", "", "", ""])[:4]
        yield h, parents.split(), subj, body


def main(argv):
    total = rework = service = 0
    rows = []
    for h, parents, subj, body in commits(argv):
        if len(parents) > 1 or SERVICE.search(subj):
            service += 1
            kind = "служебный"
        elif REWORK.search(subj) or REWORK.search(body.split("\n")[0] if body else ""):
            total += 1
            rework += 1
            kind = "переделка"
        else:
            total += 1
            kind = "работа"
        rows.append((h[:8], kind, subj[:90]))
    if "--list" in argv:
        for r in rows:
            print(" | ".join(r))
    share = (rework / total * 100) if total else 0.0
    print(f"Содержательных коммитов: {total}, переделок: {rework} ({share:.0f}%), служебных: {service}")
    print("Цель data-guard: ниже 15% переделок по правкам заказчика на чат.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
