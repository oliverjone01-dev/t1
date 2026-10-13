#!/usr/bin/env python3
"""FENIKS iter7: check a text merge resolution: lines of both sides kept, deletions of either side not resurrected,
no foreign lines, order of each side preserved (as subsequence).
usage: merge7.py <path> <ours> <theirs> <merged>"""
import collections, subprocess, sys

REPO = "/home/user/t1"
path, ours, theirs, merged = sys.argv[1:5]


def lines(rev):
    r = subprocess.run(["git", "-C", REPO, "show", f"{rev}:{path}"], capture_output=True)
    return r.stdout.decode("utf-8").split("\n") if r.returncode == 0 else []


base = subprocess.run(["git", "-C", REPO, "merge-base", ours, theirs], capture_output=True, text=True).stdout.strip()
B, O, T, M = lines(base), lines(ours), lines(theirs), lines(merged)
cB, cO, cT, cM = (collections.Counter(x) for x in (B, O, T, M))
print(f"{path}: base {base[:9]} {len(B)} lines, ours {len(O)}, theirs {len(T)}, merged {len(M)}")
lost_o = [(l, n - cM[l]) for l, n in cO.items() if cM[l] < n]
lost_t = [(l, n - cM[l]) for l, n in cT.items() if cM[l] < n]
foreign = [l for l in cM if l not in cO and l not in cT]
# deletions: lines in base removed by one side (count drop), check merged count does not exceed the other side's expectation
resur = []
for l, nb in cB.items():
    if cO[l] < nb or cT[l] < nb:  # one side deleted/edited this line
        exp = max(cO[l], cT[l]) if (cO[l] >= nb) != (cT[l] >= nb) else min(cO[l], cT[l])
        exp = min(cO[l], cT[l])  # union semantics should keep the deletion
        if cM[l] > exp:
            resur.append((l[:120], nb, cO[l], cT[l], cM[l]))
added_o = sum((cO - cB).values())
added_t = sum((cT - cB).values())
print(f"  added by ours vs base {added_o}, by theirs {added_t}; merged - base {sum((cM - cB).values())}")
print(f"  lost from ours {len(lost_o)}, lost from theirs {len(lost_t)}, foreign lines {len(foreign)}, resurrected deletions {len(resur)}")
for x in lost_o[:5]:
    print("   LOST OURS", repr(x[0][:150]), x[1])
for x in lost_t[:5]:
    print("   LOST THEIRS", repr(x[0][:150]), x[1])
for x in foreign[:5]:
    print("   FOREIGN", repr(x[:150]))
for x in resur[:8]:
    print("   RESURRECTED", x)


def is_subseq(sub, full):
    it = iter(full)
    return all(any(x == y for y in it) for x in sub)


# order check on non-empty lines unique to each side's additions
print("  ours order kept:", is_subseq([l for l in O if l.strip()], [l for l in M if l.strip()]),
      " theirs order kept:", is_subseq([l for l in T if l.strip()], [l for l in M if l.strip()]))
