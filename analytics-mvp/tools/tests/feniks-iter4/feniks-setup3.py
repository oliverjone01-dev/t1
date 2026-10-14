#!/usr/bin/env python3
"""Sandbox of the pre-merge branch head e071ce8 (to see whether the Реклама/Прочие shift predates the merge)."""
import os, subprocess
REPO = "/home/user/t1"
S = "/tmp/claude-0/-home-user-t1/ab784862-23d6-55b0-ac5d-13cc753c25dd/scratchpad"
dest = S + "/feniks-pre"
os.makedirs(dest, exist_ok=True)
a = subprocess.Popen(["git", "-C", REPO, "archive", "e071ce82b3c15d6186f8d41737496f0b6e464e56", "analytics-mvp"], stdout=subprocess.PIPE)
t = subprocess.run(["tar", "-x", "-C", dest], stdin=a.stdout)
a.wait()
assert a.returncode == 0 and t.returncode == 0
os.symlink(REPO + "/analytics-mvp/node_modules", dest + "/analytics-mvp/node_modules")
print("ok", dest)
