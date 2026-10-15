#!/usr/bin/env python3
"""FENIKS iter11 mutants of the audited code (sandbox 'mu' = git archive of 978821206, private node_modules - no cache in
the repo). One textual change per mutant, run the test file(s) named; killed = a test fails.
iter10 survivors re-checked: MA (missing orders hide ALL months), MB (month = latest row), RC (bad line drops the file);
new: NA-ND (ndLines), MN (nosku ignored by the invariant), KS (kshell mark removed), RP (report readNd drops the file)."""
import os, re, subprocess

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11"
D = S + "/mu/analytics-mvp"
NM = "/home/user/t1/analytics-mvp/node_modules"
if not os.path.isdir(D):
    os.makedirs(S + "/mu")
    a = subprocess.Popen(["git", "-C", "/home/user/t1", "archive", "97882120601e7e4e9109fd7c5284395fb1697c30", "analytics-mvp"], stdout=subprocess.PIPE)
    subprocess.run(["tar", "-x", "-C", S + "/mu"], stdin=a.stdout)
    a.wait()
    os.makedirs(D + "/node_modules")
    for e in os.listdir(NM):
        if e == ".vite":
            continue
        os.symlink(os.path.join(NM, e), os.path.join(D, "node_modules", e))
CPO, REP, ND, BK = "src/scripts/cpo-orders-rev.ts", "src/scripts/report-page.ts", "src/scripts/nd-lines.ts", "src/scripts/build-katya.ts"
T_CPO, T_ND, T_REP = "src/scripts/cpo-orders-rev.test.ts", "src/scripts/nd-lines.test.ts", "src/scripts/report-page.test.ts"
ALL = [T_CPO, T_ND, T_REP]
MUT = [
    ("M0 none", CPO, None, None, ALL),
    ("MA miss hides ALL months (pre-15.10 radius)", CPO,
     'const missMonths = Object.keys(co.missBy).includes("?") ? months : Object.keys(co.missBy).sort();', "const missMonths = co.miss ? months : [];", [T_CPO]),
    ("MB missing order month = LATEST row month", CPO, "m < monOf[o]", "m > monOf[o]", [T_CPO]),
    ("MN invariant ignores nosku (iter10 N3c back)", CPO, "Math.abs(total - co.noSkuSp - co.skuSp) > 1", "Math.abs(total - co.skuSp) > 1", [T_CPO]),
    ("MN2 nosku not summed", CPO, "noSkuSp += Number(r.nosku) || 0;", "", [T_CPO]),
    ("RC ndLines: bad line drops the whole file (N2 back)", ND,
     "try { JSON.parse(t); out.push(t); } catch {", "try { JSON.parse(t); out.push(t); } catch { throw new Error(\"bad\");", [T_ND, T_REP]),
    ("NB ndLines: bad line skipped but NOT named", ND, "if (!ndBad.includes(k)) ndBad.push(k);", "", [T_ND, T_REP]),
    ("NC ndLines: bad line kept (no JSON check)", ND, "try { JSON.parse(t); out.push(t); }", "try { out.push(t); }", [T_ND, T_REP]),
    ("ND ndBadNote empty", ND, "export const ndBadNote = (): string => ndBad.length ?", "export const ndBadNote = (): string => false ?", [T_ND, T_REP]),
    ("RP report readNd: any bad line -> empty file", REP,
     "const readNd = (p: string): any[] => { try { return ndLines(p).map((l) => JSON.parse(l)); } catch { return []; } };",
     "const readNd = (p: string): any[] => { try { const n0 = ndBad.length; const x = ndLines(p); return ndBad.length > n0 ? [] : x.map((l) => JSON.parse(l)); } catch { return []; } };", [T_REP, T_ND]),
    ("RF report: readBad not passed to the page", REP, "return { readBad: ndBad.slice(0, 20),", "return { readBad: [],", [T_REP]),
    ("KS kshell red mark removed (all pages but «Отчет»)", BK, "${banner(activeKey)}${ndBad.length ?", "${banner(activeKey)}${false ?", ALL),
]
files = sorted({m[1] for m in MUT})
orig = {f: open(os.path.join(D, f), encoding="utf-8").read() for f in files}
for name, f, a, b, tests in MUT:
    for g, t in orig.items():
        open(os.path.join(D, g), "w", encoding="utf-8").write(t)
    if a:
        assert a in orig[f], name
        open(os.path.join(D, f), "w", encoding="utf-8").write(orig[f].replace(a, b, 1))
    r = subprocess.run(["node", "node_modules/vitest/vitest.mjs", "run", *tests], cwd=D, capture_output=True, text=True)
    out = re.sub(r"\x1b\[[0-9;]*m", "", r.stdout + r.stderr)
    tl = [l.strip() for l in out.splitlines() if l.strip().startswith("Tests")]
    print(f"{name:52s} rc={r.returncode} {'KILLED' if r.returncode else 'survived'} {tl[:1]}")
for g, t in orig.items():
    open(os.path.join(D, g), "w", encoding="utf-8").write(t)
