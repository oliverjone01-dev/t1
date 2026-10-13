#!/usr/bin/env python3
"""Pure sandbox of current origin/main 7837fbf (for byte comparison with simulated PR result feniks-new)."""
import os, subprocess
REPO = "/home/user/t1"
S = "/tmp/claude-0/-home-user-t1/ab784862-23d6-55b0-ac5d-13cc753c25dd/scratchpad"
dest = S + "/feniks-main2"
os.makedirs(dest, exist_ok=True)
a = subprocess.Popen(["git", "-C", REPO, "archive", "7837fbf0ae8a55e411c78510a65fbf5851e0fa77", "analytics-mvp"], stdout=subprocess.PIPE)
t = subprocess.run(["tar", "-x", "-C", dest], stdin=a.stdout)
a.wait()
assert a.returncode == 0 and t.returncode == 0
os.symlink(REPO + "/analytics-mvp/node_modules", dest + "/analytics-mvp/node_modules")
print("ok", dest)
