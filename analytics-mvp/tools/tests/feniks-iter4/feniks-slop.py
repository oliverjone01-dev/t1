#!/usr/bin/env python3
"""Feed rendered tab text to the repo's anti-slop checker (hook event format) and count em dashes."""
import json, subprocess, sys
txt = open(sys.argv[1], encoding="utf-8").read()
ev = json.dumps({"tool_name": "Write", "tool_input": {"file_path": "/tmp/x.html", "content": txt}})
r = subprocess.run(["bash", "/home/user/t1/.claude/hooks/anti-slop-checker.sh"], input=ev, capture_output=True, text=True, cwd="/home/user/t1")
print("anti-slop rc", r.returncode, "stdout:", r.stdout[:1500], "stderr:", r.stderr[:300])
print("chars", len(txt), "em dash U+2014:", txt.count("—"))
for line in txt.split("\n"):
    if "—" in line:
        print("   EM:", line[:160])
