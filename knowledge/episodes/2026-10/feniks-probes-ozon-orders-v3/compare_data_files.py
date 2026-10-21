#!/usr/bin/env python3
"""ФЕНИКС, аудит PR #492 (2026-10-20): охват всех файлов данных ветки (бот-коммит 43cd2db).

Для каждого analytics-mvp/data/* из диффа ветки: main против головы. ndjson - строки, ключи,
сколько строк изменено/добавлено/удалено, диапазон дат затронутых строк, суммы числовых полей
по месяцам у строк с датой до 2026-10-01 (история не должна меняться от смены транспорта цен).
json - верхнеуровневые ключи и изменённые пути. Также проверка, что 99149e2 (выручка 0) не оставил
следов: каждый файл головы = версия 43cd2db.

Запуск из корня репо: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-orders-v3/compare_data_files.py
"""
import collections
import json
import subprocess

REV = "5af708906c20474c82c5429080ad5ae6bb7c9160"
BASE = "origin/main"


def git(*a, check=True):
    return subprocess.run(["git", *a], capture_output=True, text=True, check=check).stdout


mb = git("merge-base", BASE, REV).strip()
files = [p for p in git("diff", "--name-only", mb, REV).split("\n") if p.startswith("analytics-mvp/data/")]
print(f"файлов данных в диффе ветки: {len(files)}")

for p in files:
    head_blob = git("rev-parse", f"{REV}:{p}").strip()
    bot_blob = git("rev-parse", f"43cd2db:{p}", check=False).strip()
    print(f"\n== {p}\n   голова = 43cd2db: {head_blob == bot_blob}")
    old = git("show", f"{BASE}:{p}", check=False)
    new = git("show", f"{REV}:{p}")
    if p.endswith(".ndjson"):
        ol = [l for l in old.split("\n") if l.strip()]
        nl = [l for l in new.split("\n") if l.strip()]
        so, sn = collections.Counter(ol), collections.Counter(nl)
        removed = list((so - sn).elements()); added = list((sn - so).elements())
        def dates(lines):
            ds = []
            for l in lines:
                try:
                    r = json.loads(l)
                except Exception:
                    continue
                d = r.get("d") or r.get("date") or r.get("day")
                if isinstance(d, str):
                    ds.append(d[:10])
            return ds
        dr, da = dates(removed), dates(added)
        print(f"   строк {len(ol)} -> {len(nl)}; исчезло {len(removed)}, появилось {len(added)}")
        if dr or da:
            print(f"   даты исчезнувших: {min(dr) if dr else '-'}..{max(dr) if dr else '-'}; появившихся: {min(da) if da else '-'}..{max(da) if da else '-'}")
        # история до 2026-10-01: суммы числовых полей по месяцам, main против головы
        def hist(lines):
            m = collections.defaultdict(lambda: collections.Counter())
            for l in lines:
                r = json.loads(l)
                d = r.get("d") or r.get("date") or r.get("day")
                if not isinstance(d, str) or d[:10] >= "2026-10-01":
                    continue
                for k, v in r.items():
                    if isinstance(v, (int, float)) and not isinstance(v, bool):
                        m[d[:7]][k] += v
            return m
        ho, hn = hist(ol), hist(nl)
        diffs = []
        for mon in sorted(set(ho) | set(hn)):
            for k in sorted(set(ho[mon]) | set(hn[mon])):
                if round(ho[mon][k], 2) != round(hn[mon][k], 2):
                    diffs.append(f"{mon}.{k}: {round(ho[mon][k], 2)} -> {round(hn[mon][k], 2)}")
        print(f"   история до 10.2026, расхождений сумм по месяцам: {len(diffs)}" + (": " + "; ".join(diffs[:8]) if diffs else ""))
    else:
        try:
            jo, jn = json.loads(old or "null"), json.loads(new)
        except Exception as e:
            print("   не json:", e); continue
        def flat(x, pre=""):
            out = {}
            if isinstance(x, dict):
                for k, v in x.items():
                    out.update(flat(v, f"{pre}.{k}" if pre else str(k)))
            elif isinstance(x, list):
                for i, v in enumerate(x):
                    out.update(flat(v, f"{pre}[{i}]"))
            else:
                out[pre] = x
            return out
        fo, fn = flat(jo), flat(jn)
        ch = [k for k in sorted(set(fo) | set(fn)) if fo.get(k) != fn.get(k)]
        print(f"   листьев {len(fo)} -> {len(fn)}, изменено {len(ch)}: " + "; ".join(f"{k}: {fo.get(k)} -> {fn.get(k)}" for k in ch[:6]))
