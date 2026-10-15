#!/usr/bin/env python3
"""FENIKS iter10 mutants of the audited code (sandbox 'mu', git archive of a06dcd948, private node_modules - no cache in the repo).
Each mutant: one textual change, run the test file of that module; killed = test file fails."""
import os, re, subprocess

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f10"
D = S + "/mu/analytics-mvp"
NM = "/home/user/t1/analytics-mvp/node_modules"
if not os.path.isdir(D):
    os.makedirs(S + "/mu")
    a = subprocess.Popen(["git", "-C", "/home/user/t1", "archive", "a06dcd94896cd6582191a00086e97673271008c2", "analytics-mvp"], stdout=subprocess.PIPE)
    subprocess.run(["tar", "-x", "-C", S + "/mu"], stdin=a.stdout)
    a.wait()
    os.makedirs(D + "/node_modules")
    for e in os.listdir(NM):
        if e == ".vite":
            continue
        os.symlink(os.path.join(NM, e), os.path.join(D, "node_modules", e))
CPO, REP = "src/scripts/cpo-orders-rev.ts", "src/scripts/report-page.ts"
MUT = [
    ("M0 none", CPO, None, None),
    ("MA miss hides ALL months (pre-15.10 radius)", CPO,
     'const missMonths = Object.keys(co.missBy).includes("?") ? months : Object.keys(co.missBy).sort();', "const missMonths = co.miss ? months : [];"),
    ("MB missing order month = LATEST row month", CPO, "m < monOf[o]", "m > monOf[o]"),
    ("MC no invariant (N3)", CPO, "if (Math.abs(total - co.skuSp) > 1) return fail(", "if (false) return fail("),
    ("MD no «coverage without charges» (N7)", CPO, "if (!Math.round(total)) return fail(", "if (false) return fail("),
    ("ME legacy row without day ignored", CPO, 'Object.keys(co.missBy).includes("?") ? months :', "false ? months :"),
    ("RA cpoCov under error = iter9 (N1)", REP, "s.cpoCov=(REP.cpoErr||missHit)?(!Math.round(s.cpoApiSp)&&!Math.round(s.cpoSp)):",
     "s.cpoCov=(REP.cpoErr||missHit)?(!Math.round(s.cpoApiSp)):"),
    ("RB month of missing orders not hidden", REP, "var missHit=(REP.cpoMissM||[])", "var missHit=false&&(REP.cpoMissM||[])"),
    ("RC readNd: whole file dropped on a bad line (N2 back)", REP,
     "try { out.push(JSON.parse(l)); } catch { rdBad.push(", "try { out.push(JSON.parse(l)); } catch (e) { out.length = 0; return; rdBad.push("),
]
orig = {f: open(os.path.join(D, f), encoding="utf-8").read() for f in (CPO, REP)}
for name, f, a, b in MUT:
    for g, t in orig.items():
        open(os.path.join(D, g), "w", encoding="utf-8").write(t)
    if a:
        assert a in orig[f], name
        open(os.path.join(D, f), "w", encoding="utf-8").write(orig[f].replace(a, b, 1))
    tf = f.replace(".ts", ".test.ts")
    r = subprocess.run(["node", "node_modules/vitest/vitest.mjs", "run", tf], cwd=D, capture_output=True, text=True)
    out = re.sub(r"\x1b\[[0-9;]*m", "", r.stdout + r.stderr)
    tl = [l.strip() for l in out.splitlines() if l.strip().startswith("Tests")]
    print(f"{name:55s} {tf.split('/')[-1]:25s} rc={r.returncode} {'KILLED' if r.returncode else 'survived'} {tl[:1]}")
for g, t in orig.items():
    open(os.path.join(D, g), "w", encoding="utf-8").write(t)
