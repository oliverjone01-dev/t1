#!/usr/bin/env python3
"""merge_hooks.py - дописывает хуки data-guard в .claude/settings.json целевого репо без дублей.
Usage: python3 merge_hooks.py <settings.json> <data-guard.hooks.json>
Существующие хуки не трогает; добавляет только команды, которых ещё нет."""
import json
import os
import sys

path, add_path = sys.argv[1], sys.argv[2]
add = json.load(open(add_path, encoding="utf-8"))["hooks"]
s = json.load(open(path, encoding="utf-8")) if os.path.isfile(path) else {}
hooks = s.setdefault("hooks", {})
added = 0
for ev, groups in add.items():
    arr = hooks.setdefault(ev, [])
    have = {h.get("command") for m in arr for h in m.get("hooks", [])}
    for g in groups:
        new = [h for h in g["hooks"] if h.get("command") not in have]
        if new:
            entry = {k: v for k, v in g.items() if k != "hooks"}
            entry["hooks"] = new
            arr.append(entry)
            added += len(new)
os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
with open(path, "w", encoding="utf-8") as f:
    json.dump(s, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"settings.json: добавлено хуков {added}")
