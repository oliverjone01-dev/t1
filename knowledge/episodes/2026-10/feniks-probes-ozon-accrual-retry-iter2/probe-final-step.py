#!/usr/bin/env python3
# ФЕНИКС #485 iter2, проба W1: эмуляция шага «Отчёты о реализации получены целиком» на 54569ad и 6426b50.
# GitHub подставляет ${{ steps.X.outcome }} текстом до запуска bash, здесь то же самое.
# Запуск: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-accrual-retry-iter2/probe-final-step.py
import re
import subprocess

import yaml

REPO = "/home/user/t1"
SC = {
    "S1 всё success": dict(pnlsku="success", acq="success", pnlacc="success", realm="success", reald="success"),
    "S2 acq оборван timeout-minutes (раннер: TaskResult.Failed)": dict(pnlsku="success", acq="failure", pnlacc="success", realm="success", reald="success"),
    "S3 упал «Сбор по заказам» (как run 55): шаги ниже skipped": dict(pnlsku="skipped", acq="skipped", pnlacc="skipped", realm="skipped", reald="skipped"),
    "S4 гипотетический cancelled шага": dict(pnlsku="success", acq="cancelled", pnlacc="success", realm="success", reald="success"),
}
for rev in ("54569ad", "6426b50"):
    y = yaml.safe_load(subprocess.check_output(["git", "-C", REPO, "show", f"{rev}:.github/workflows/orders-backfill.yml"]))
    steps = y["jobs"]["orders"]["steps"]
    fin = next(s for s in steps if s.get("name") == "Отчёты о реализации получены целиком")
    commit = next(s for s in steps if s.get("name") == "Коммит данных в ветку")
    orders = next(s for s in steps if s.get("name") == "Сбор по заказам")
    for name, o in SC.items():
        body = re.sub(r"\$\{\{\s*steps\.(\w+)\.outcome\s*\}\}", lambda m: o[m.group(1)], fin["run"])
        p = subprocess.run(["bash", "-c", body], capture_output=True, text=True)
        print(f"{rev} | {name} | exit={p.returncode} | {p.stdout.strip() or '-'}")
    print(f"{rev} | финальный шаг if={fin.get('if')!r}; коммит if={commit.get('if')!r}; "
          f"«Сбор по заказам» continue-on-error={orders.get('continue-on-error')!r} timeout={orders.get('timeout-minutes')!r}")
    print(f"{rev} | timeout-minutes по шагам: " + ", ".join(f"{s.get('id') or s.get('name', s.get('uses', '?'))[:20]}={s['timeout-minutes']}" for s in steps if 'timeout-minutes' in s)
          + f"; job timeout={y['jobs']['orders'].get('timeout-minutes')!r}")
