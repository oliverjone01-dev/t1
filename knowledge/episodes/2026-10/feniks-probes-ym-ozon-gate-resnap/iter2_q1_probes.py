#!/usr/bin/env python3
"""FENIKS iter2, question 1: what does `( resnap ) || echo ::warning::` swallow? Real YAML step at bec7a87,
GitHub bash -eo pipefail, harness sandbox. Probes:
  P1 reset_fail  - git reset fails -> step must fail (not swallowed by the || below it)
  P2 cp_fail     - overlay cp after the resnap fails -> step must fail
  P3 resnap_fail - no public/*.html in fresh main -> warning, push goes, gate fails (full texts)
  P5 race        - success log line: tree hash equals fetched main head
usage (repo root): python3 knowledge/episodes/2026-10/feniks-probes-ym-ozon-gate-resnap/iter2_q1_probes.py
"""
import importlib.util, json, os, subprocess, sys, tempfile

REPO = "/home/user/t1"
SP = os.environ.get("PROBE_OUT") or tempfile.mkdtemp(prefix="feniks-iter2-q1-")
spec = importlib.util.spec_from_file_location(
    "h", f"{REPO}/knowledge/episodes/2026-10/feniks-probes-ym-ozon-gate-resnap/yml_gate_harness.py")
h = importlib.util.module_from_spec(spec)
os.environ["HARNESS_DIR"] = os.path.join(SP, "harness_q1")
os.makedirs(os.environ["HARNESS_DIR"], exist_ok=True)
spec.loader.exec_module(h)

MODE = {}
orig_setup, orig_run_step = h.setup, h.run_step

def setup2(W):
    orig_setup(W)
    if MODE.get("reset_fail"):
        p = f"{W}/bin/git"
        txt = open(p).read().replace(
            'echo $n > "$W/cnt/reset" ;;',
            'echo $n > "$W/cnt/reset"; echo "shim: reset #$n failed (simulated)" >&2; exit 128 ;;')
        open(p, "w").write(txt)
    if MODE.get("cp_fail"):
        real = subprocess.run(["bash", "-c", "command -v cp"], capture_output=True, text=True).stdout.strip()
        with open(f"{W}/bin/cp", "w") as fh:
            fh.write(f"""#!/bin/bash
for a in "$@"; do case "$a" in *ym-keep/data-ym/.) echo "shim: overlay cp failed (simulated)" >&2; exit 1;; esac; done
exec {real} "$@"
""")
        os.chmod(f"{W}/bin/cp", 0o755)

def run_step2(W, step, tag, shell_mode):
    r = orig_run_step(W, step, tag, shell_mode)
    with open(f"{W}/out_{tag}.txt", "w") as fh:
        fh.write(f"rc={r.returncode}\n--stdout--\n{r.stdout}\n--stderr--\n{r.stderr}\n")
    return r

h.setup, h.run_step = setup2, run_step2

def show(tag, d):
    W = d["sandbox"]
    inter = open(f"{W}/out_inter.txt").read()
    gate = open(f"{W}/out_gate.txt").read() if os.path.exists(f"{W}/out_gate.txt") else "(gate not run)"
    keep = [l for l in inter.splitlines() if any(k in l for k in ("rc=", "слепок OZON", "::warning::", "shim:", "md5sum", "::error::"))]
    head = subprocess.run([h.REAL_GIT, "--git-dir", f"{W}/remote.git", "log", "--format=%h %s", "-4", "main"],
                          capture_output=True, text=True).stdout.strip().splitlines()
    print(json.dumps({"probe": tag, "inter_rc": d["inter_rc"], "push/fetch/reset": f"{d['push_calls']}/{d['fetch_calls']}/{d['reset_calls']}",
                      "gate": d["gate"][:8], "remote_ym": d["remote_main"]["data-ym/orders.ndjson"],
                      "inter_lines": keep, "gate_lines": [l for l in gate.splitlines() if l.strip()][:6],
                      "remote_log": head}, ensure_ascii=False, indent=1))

for tag, sc, mode in (("P1_reset_fail", "race", {"reset_fail": 1}),
                      ("P2_cp_fail", "race", {"cp_fail": 1}),
                      ("P3_resnap_fail", "resnap_fail", {}),
                      ("P5_race_log", "race", {})):
    MODE.clear(); MODE.update(mode)
    show(tag, h.scenario("bec7a87", sc, "github"))
