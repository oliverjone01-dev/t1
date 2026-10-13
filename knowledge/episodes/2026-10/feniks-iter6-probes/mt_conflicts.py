#!/usr/bin/env python3
"""Parse old-style `git merge-tree base ours theirs` output (read-only) and list sections with conflict markers."""
import re, subprocess, sys

REPO = "/home/user/t1"
ours, theirs = sys.argv[1], sys.argv[2]
mb = subprocess.run(["git", "-C", REPO, "merge-base", ours, theirs], capture_output=True, text=True).stdout.strip()
out = subprocess.run(["git", "-C", REPO, "merge-tree", mb, ours, theirs], capture_output=True).stdout.decode("utf-8", "replace")
sections = re.split(r"\n(?=(?:changed in both|added in both|removed in local|removed in remote|added in local|added in remote|merged)\n)", "\n" + out)
L, M, R = "<" * 7, "=" * 7, ">" * 7
for s in sections:
    s = s.strip("\n")
    if not s:
        continue
    head = s.split("\n", 1)[0]
    paths = sorted(set(re.findall(r"^  (?:base|our|their|result)\s+\d+ [0-9a-f]+ (.+)$", s, re.M)))
    n_conf = len(re.findall(r"^[+ ]?" + re.escape(L), s, re.M))
    if head.startswith("changed in both") or head.startswith("added in both") or n_conf:
        print(head, paths, "conflict_markers:", n_conf)
        if n_conf:
            lines = s.split("\n")
            for i, ln in enumerate(lines):
                if re.match(r"^[+ ]?" + re.escape(L), ln):
                    print("   ...", "\n   ".join(x[:160] for x in lines[i:i + 8]))
                    break
