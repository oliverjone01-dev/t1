import difflib, re, sys
S = "/tmp/claude-0/-home-user-t1/feadf20c-8819-5ff1-a553-d442fce0f391/scratchpad/pb"
code, a, b = sys.argv[1], sys.argv[2], sys.argv[3]
A = open(f"{S}/{a}/out_{code}/katya-tests.html", encoding="utf-8").read()
B = open(f"{S}/{b}/out_{code}/katya-tests.html", encoding="utf-8").read()
# tokenise on tags/commas so diffs are local
tok = lambda s: re.split(r"(?<=[>,;\]])", s)
ta, tb = tok(A), tok(B)
sm = difflib.SequenceMatcher(None, ta, tb, autojunk=False)
n = 0
for op, i1, i2, j1, j2 in sm.get_opcodes():
    if op == "equal":
        continue
    n += 1
    ctx = "".join(ta[max(0, i1 - 6):i1])[-160:]
    print(f"[{n}] {op} ...{ctx!r}\n   - {''.join(ta[i1:i2])[:200]!r}\n   + {''.join(tb[j1:j2])[:200]!r}")
    if n >= int(sys.argv[4] if len(sys.argv) > 4 else 30):
        break
print("total change blocks:", sum(1 for o in sm.get_opcodes() if o[0] != "equal"))
