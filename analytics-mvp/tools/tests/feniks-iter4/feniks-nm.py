#!/usr/bin/env python3
"""Private node_modules for a sandbox: symlink each entry of repo node_modules except .vite (vitest cache stays in /tmp)."""
import os, sys
S = "/tmp/claude-0/-home-user-t1/ab784862-23d6-55b0-ac5d-13cc753c25dd/scratchpad"
box = S + "/" + sys.argv[1] + "/analytics-mvp"
src = "/home/user/t1/analytics-mvp/node_modules"
nm = box + "/node_modules"
if os.path.islink(nm):
    os.unlink(nm)  # the link itself lives in /tmp; target untouched
os.makedirs(nm, exist_ok=True)
n = 0
for e in os.listdir(src):
    if e == ".vite":
        continue
    dst = os.path.join(nm, e)
    if not os.path.exists(dst):
        os.symlink(os.path.join(src, e), dst)
        n += 1
print("linked", n, "entries into", nm)
