#!/usr/bin/env python3
"""FENIKS iter9 mutants of cpo-orders-rev.ts in sandbox 'mu' (git archive of p9 code, private node_modules);
runs vitest on cpo-orders-rev.test.ts per mutant. Killed = test file fails."""
import os, shutil, subprocess

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i9"
D = S + "/mu/analytics-mvp"
F = D + "/src/scripts/cpo-orders-rev.ts"
NM = "/home/user/t1/analytics-mvp/node_modules"
if not os.path.isdir(D):
    os.makedirs(S + "/mu")
    a = subprocess.Popen(["git", "-C", "/home/user/t1", "archive", "9ef5e2d3e69023bd1932a16825b43fa622209f16", "analytics-mvp"], stdout=subprocess.PIPE)
    subprocess.run(["tar", "-x", "-C", S + "/mu"], stdin=a.stdout)
    a.wait()
    os.makedirs(D + "/node_modules")
    for e in os.listdir(NM):
        if e == ".vite":
            continue
        os.symlink(os.path.join(NM, e), os.path.join(D, "node_modules", e))
orig = open(F, encoding="utf-8").read()
MUT = {
    "M0 none": (None, None),
    "M1 drop miss check (G1)": ("  if (co.miss) return fail(", "  if (false) return fail("),
    "M2 drop empty-coverage check (G2)": ("  if (!co.from) return fail(", "  if (false) return fail("),
    "M3 ignore bad lines (G2)": ("  if (co.bad.length) return fail(", "  if (false) return fail("),
    "M4 last row of an order wins (G5 read side)": ("spBy[o] = (spBy[o] || 0) + (Number(r.sp) || 0);", "spBy[o] = (Number(r.sp) || 0);"),
    "M5 found-only total (iter8 G1)": ("const total = co.spAll,", "const total = Object.values(co.day).reduce((x, v) => x + v.sp, 0),"),
    "M6 throw instead of err (pre-G3)": ("catch (e) { return fail(", "catch (e) { throw e; return fail("),
}
for name, (a, b) in MUT.items():
    src = orig
    if a:
        assert a in src, name
        src = src.replace(a, b, 1)
    open(F, "w", encoding="utf-8").write(src)
    r = subprocess.run(["node", "node_modules/vitest/vitest.mjs", "run", "src/scripts/cpo-orders-rev.test.ts"], cwd=D, capture_output=True, text=True)
    out = (r.stdout + r.stderr)
    import re
    out = re.sub(r"\x1b\[[0-9;]*m", "", out)
    tl = [l.strip() for l in out.splitlines() if l.strip().startswith("Tests")]
    print(f"{name:45s} rc={r.returncode} {'KILLED' if r.returncode else 'survived'} {tl[:1]}")
open(F, "w", encoding="utf-8").write(orig)
