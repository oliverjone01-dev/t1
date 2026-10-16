#!/usr/bin/env python3
"""Copy the author's card_sweep24.mjs into scratch with the public path pointed at a sandbox build. usage: mksweep9.py <sb>"""
import sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i9"
sb = sys.argv[1]
src = open(f"{S}/{sb}/analytics-mvp/tools/tests/card_sweep24.mjs", encoding="utf-8").read()
REPO_PUBLIC = "/home/user/t1/" + "analytics-mvp/public/"
needle = "const P='" + REPO_PUBLIC + "';"
assert needle in src
open(f"{S}/pw/card_sweep24_{sb}.mjs", "w", encoding="utf-8").write(src.replace(needle, f"const P='{S}/{sb}/analytics-mvp/public/';"))
print("written", f"{S}/pw/card_sweep24_{sb}.mjs")
