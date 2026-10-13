import re, sys
D = "/tmp/claude-0/-home-user-t1/ab784862-23d6-55b0-ac5d-13cc753c25dd/scratchpad/"
def line(f):
    for l in open(D + f, encoding="utf-8"):
        if l.startswith("const AN_ACCT="):
            return l.rstrip("\n")
b, m, p = line("fx-bk-branch.ts"), line("fx-bk-main.ts"), line("fx-bk-pre.ts")
print("len branch/main/pre", len(b), len(m), len(p))
print("branch startswith main line:", b.startswith(m))
print("suffix after main line:", repr(b[len(m):][:400]))
names = lambda s: re.findall(r"const (AN_[A-Z0-9_]+)=", s)
nb, nm, np_ = names(b), names(m), names(p)
print("consts main", len(nm), "branch", len(nb), "pre", len(np_))
print("in main not in branch:", [x for x in nm if x not in nb])
print("in pre not in branch:", [x for x in np_ if x not in nb])
print("in branch not in main:", [x for x in nb if x not in nm])
print("pre suffix vs pre main-part:")
# what did the pre-merge branch line have after its own consts
i = p.find("${card")
print("pre has card suffix at", i, repr(p[i:i+300]) if i >= 0 else None)
