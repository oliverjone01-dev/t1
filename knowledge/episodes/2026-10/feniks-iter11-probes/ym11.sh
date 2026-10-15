#!/bin/bash
# FENIKS iter11: Market build (DATA_DIR=data-ym PLATFORM=ym OUT_DIR=public/market, as npm ym:build) inside sandboxes, then byte comparison p11 vs pm.
# usage: ym11.sh   (no writes to the repo; the build writes only into the sandboxes)
S=/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11
for sb in p11 pm; do
  ( cd "$S/$sb/analytics-mvp" && DATA_DIR=data-ym PLATFORM=ym OUT_DIR=public/market node node_modules/tsx/dist/cli.mjs src/scripts/build-katya.ts > "$S/$sb.ym.log" 2>&1; echo "$sb rc_ym=$?" >> "$S/$sb.ym.log" ) &
done
wait
for sb in p11 pm; do tail -1 "$S/$sb.ym.log"; grep -c "::error::" "$S/$sb.ym.log"; done
python3 - "$S" <<'PY'
import filecmp, os, re, sys
S = sys.argv[1]
a, b = S + "/pm/analytics-mvp/public/market", S + "/p11/analytics-mvp/public/market"
fa = sorted(f for f in os.listdir(a)) if os.path.isdir(a) else []
fb = sorted(f for f in os.listdir(b)) if os.path.isdir(b) else []
TS = re.compile(r"\d\d\.\d\d\.\d{4} \d\d:\d\d МСК")
same, diff = [], []
for f in sorted(set(fa) & set(fb)):
    pa, pb = os.path.join(a, f), os.path.join(b, f)
    if os.path.isdir(pa):
        continue
    x, y = open(pa, encoding="utf-8", errors="replace").read(), open(pb, encoding="utf-8", errors="replace").read()
    (same if TS.sub("TS", x) == TS.sub("TS", y) else diff).append(f)
print("ym public/market: files pm", len(fa), "p11", len(fb), "| equal (build time masked)", len(same), "| differ", diff)
PY
