#!/usr/bin/env python3
"""extract_hooks.py - вынимает записи хуков data-guard из .claude/settings.json в отдельный json.
Usage: python3 extract_hooks.py <settings.json> <выход.json>"""
import json
import sys

s = json.load(open(sys.argv[1], encoding="utf-8"))
out = {}
for ev, arr in s.get("hooks", {}).items():
    for m in arr:
        hooks = [h for h in m.get("hooks", []) if "data-guard" in h.get("command", "")]
        if hooks:
            entry = {k: v for k, v in m.items() if k != "hooks"}
            entry["hooks"] = hooks
            out.setdefault(ev, []).append(entry)
with open(sys.argv[2], "w", encoding="utf-8") as f:
    json.dump({"hooks": out}, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"хуков data-guard: {sum(len(h['hooks']) for v in out.values() for h in v)}")
