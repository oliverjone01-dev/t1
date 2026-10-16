#!/usr/bin/env python3
"""FENIKS probe: execute the REAL steps of .github/workflows/ym-snapshots.yml at a given revision.

Steps "Snimok OZON DO" (~86), "Promezhutochny kommit" (~120) and "Gate OZON bait-v-bait" (~266) are
extracted with yaml.safe_load (not re-typed) and run exactly like GitHub runs `shell: bash`:
    bash --noprofile --norc -eo pipefail <script>
with working-directory per step (defaults.run = analytics-mvp, step override '.').
The only transformation of the step text: the prefix "/tmp/" -> "<sandbox>/tmp/" (isolation).
Sandbox: bare remote + runner clone (CI checkout) + other clone (OZON workflow pushing foreign commits).
Shims in PATH: git (counts push/fetch/reset, can inject a foreign commit before push #n or fail fetch #n),
sleep (no-op). Producers between steps are modelled by writing files.

usage: python3 -I yml_gate_harness.py <rev> <scenario|all> [--shell=github|nobang-e]
"""
import json, os, shutil, subprocess, sys, tempfile, filecmp
import yaml

REPO = "/home/user/t1"
SP = os.environ.get("HARNESS_DIR") or tempfile.mkdtemp(prefix="ozon-gate-harness-")
REAL_GIT = shutil.which("git")
ID = ["-c", "user.email=o@o", "-c", "user.name=ozon-bot"]

def load_steps(rev):
    y = subprocess.run([REAL_GIT, "-C", REPO, "show", f"{rev}:.github/workflows/ym-snapshots.yml"],
                       capture_output=True, text=True, check=True).stdout
    job = yaml.safe_load(y)["jobs"]["snapshots"]
    dflt = job.get("defaults", {}).get("run", {})
    def find(prefix):
        hits = [s for s in job["steps"] if s.get("name", "").startswith(prefix)]
        assert len(hits) == 1, (prefix, len(hits))
        s = hits[0]
        return {"name": s["name"], "run": s["run"],
                "wd": s.get("working-directory", dflt.get("working-directory", ".")),
                "shell": s.get("shell", dflt.get("shell"))}
    return (find("Снимок OZON-страниц ДО"), find("Промежуточный коммит факт-слоя"),
            find("Гейт: OZON байт-в-байт"))

def run(cmd, cwd, env=None, check=True):
    r = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True)
    if check and r.returncode:
        raise RuntimeError(f"{cmd} rc={r.returncode}\n{r.stdout}\n{r.stderr}")
    return r

def wfile(base, path, content):
    p = os.path.join(base, path)
    if content is None:
        os.remove(p); return
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w") as fh:
        fh.write(content)

BASE_TREE = {
    "analytics-mvp/public/index.html": "ozon index v1\n",
    "analytics-mvp/public/tests.html": "ozon tests v1\n",
    "analytics-mvp/public/market/index.html": "ym market v1\n",
    "analytics-mvp/data/orders_daily.ndjson": "o1\n",
    "analytics-mvp/data/x.json": "x1\n",
    "analytics-mvp/data/competitors/c.json": "c1\n",
    "analytics-mvp/data/raw/deep.json": "r1\n",
    "analytics-mvp/data-ym/orders.ndjson": "y1\n",
    "README.md": "readme v1\n",
}

def setup(W):
    for d in ("tmp", "bin", "hooks", "cnt", "home", "snap0"):
        os.makedirs(f"{W}/{d}")
    run([REAL_GIT, "init", "-q", "--bare", "-b", "main", "remote.git"], W)
    run([REAL_GIT, "init", "-q", "-b", "main", "seed"], W)
    for p, c in BASE_TREE.items():
        wfile(f"{W}/seed", p, c)
    run([REAL_GIT, *ID, "add", "-A"], f"{W}/seed")
    run([REAL_GIT, *ID, "commit", "-qm", "base"], f"{W}/seed")
    run([REAL_GIT, "push", "-q", f"{W}/remote.git", "HEAD:main"], f"{W}/seed")
    run([REAL_GIT, "clone", "-q", "remote.git", "runner"], W)
    run([REAL_GIT, "clone", "-q", "remote.git", "other"], W)
    with open(f"{W}/bin/git", "w") as fh:
        fh.write(f"""#!/bin/bash
W="{W}"; REAL="{REAL_GIT}"
case "$1" in
  push)  n=$(( $(cat "$W/cnt/push" 2>/dev/null || echo 0) + 1 )); echo $n > "$W/cnt/push"
         if [ -f "$W/hooks/push_$n.sh" ]; then bash "$W/hooks/push_$n.sh" >>"$W/hooks/log" 2>&1; fi ;;
  fetch) n=$(( $(cat "$W/cnt/fetch" 2>/dev/null || echo 0) + 1 )); echo $n > "$W/cnt/fetch"
         if [ -f "$W/hooks/fetchfail_$n" ]; then echo "shim: fetch #$n failed (simulated)" >&2; exit 1; fi ;;
  reset) n=$(( $(cat "$W/cnt/reset" 2>/dev/null || echo 0) + 1 )); echo $n > "$W/cnt/reset" ;;
esac
exec "$REAL" "$@"
""")
    with open(f"{W}/bin/sleep", "w") as fh:
        fh.write("#!/bin/bash\nexit 0\n")
    os.chmod(f"{W}/bin/git", 0o755); os.chmod(f"{W}/bin/sleep", 0o755)

def foreign_now(W, files, msg):
    O = f"{W}/other"
    run([REAL_GIT, "pull", "-q", "--ff-only", "origin", "main"], O)
    for p, c in files.items():
        wfile(O, p, c)
    run([REAL_GIT, *ID, "add", "-A"], O)
    run([REAL_GIT, *ID, "commit", "-qm", msg], O)
    run([REAL_GIT, "push", "-q", "origin", "HEAD:main"], O)

def foreign_at_push(W, n, files, msg):
    lines = ["set -e", f'cd "{W}/other"', f'"{REAL_GIT}" pull -q --ff-only origin main']
    for p, c in files.items():
        if c is None:
            lines.append(f"rm -f '{p}'")
        else:
            lines.append(f"mkdir -p \"$(dirname '{p}')\"; printf '%s' '{c}' > '{p}'")
    lines += [f'"{REAL_GIT}" {" ".join(ID)} add -A', f'"{REAL_GIT}" {" ".join(ID)} commit -qm "{msg}"',
              f'"{REAL_GIT}" push -q origin HEAD:main']
    with open(f"{W}/hooks/push_{n}.sh", "w") as fh:
        fh.write("\n".join(lines) + "\n")

def run_step(W, step, tag, shell_mode):
    script = step["run"].replace("/tmp/", f"{W}/tmp/")
    f = f"{W}/step_{tag}.sh"
    with open(f, "w") as fh:
        fh.write(script)
    wd = f"{W}/runner" if step["wd"] in (".", None) else f"{W}/runner/{step['wd']}"
    env = dict(os.environ, PATH=f"{W}/bin:" + os.environ["PATH"], GITHUB_REF_NAME="main",
               YM_API_KEY="", YM_API_KEY_2="", HOME=f"{W}/home", GIT_CONFIG_NOSYSTEM="1")
    argv = ["bash", "--noprofile", "--norc", "-eo", "pipefail", f] if shell_mode == "github" \
        else ["bash", "--noprofile", "--norc", f]
    return subprocess.run(argv, cwd=wd, env=env, capture_output=True, text=True)

def cnt(W, k):
    try:
        return int(open(f"{W}/cnt/{k}").read().strip())
    except FileNotFoundError:
        return 0

def remote_file(W, path):
    r = run([REAL_GIT, "--git-dir", f"{W}/remote.git", "show", f"main:{path}"], W, check=False)
    return r.stdout.strip() if r.returncode == 0 else "<absent>"

OZ_A = {"analytics-mvp/data/x.json": "x2-ozon\n", "analytics-mvp/data/orders_daily.ndjson": "o2-ozon\n"}
SCEN = {
    # 15.10 race: foreign OZON commit lands before the intermediate push
    "race":                 {"foreign_before": OZ_A},
    "race+own_after_html":  {"foreign_before": OZ_A, "own_after": {"analytics-mvp/public/index.html": "hacked\n"}},
    "race+own_after_data":  {"foreign_before": OZ_A, "own_after": {"analytics-mvp/data/orders_daily.ndjson": "o-ours\n"}},
    "race+own_after_del":   {"foreign_before": OZ_A, "own_after": {"analytics-mvp/data/x.json": None}},
    "race+own_after_new":   {"foreign_before": OZ_A, "own_after": {"analytics-mvp/data/new.json": "n\n", "analytics-mvp/public/new.html": "n\n"}},
    "norace+own_after_new": {"own_after": {"analytics-mvp/data/new.json": "n\n", "analytics-mvp/public/new.html": "n\n"}},
    "race+own_after_subdir": {"foreign_before": OZ_A, "own_after": {"analytics-mvp/data/raw/deep.json": "r-ours\n"}},
    # own OZON edit BEFORE the reset (window ym:orders/ym:catalog), push rejected by a NON-OZON foreign commit
    "readme_race+own_before_tracked": {"foreign_before": {"README.md": "readme v2\n"}, "own_before": {"analytics-mvp/data/x.json": "x-ours\n"}},
    "readme_race+own_before_new":     {"foreign_before": {"README.md": "readme v2\n"}, "own_before": {"analytics-mvp/data/new.json": "n\n"}},
    "race+own_before_tracked":        {"foreign_before": {"analytics-mvp/data/orders_daily.ndjson": "o2-ozon\n"}, "own_before": {"analytics-mvp/data/x.json": "x-ours\n"}},
    # no race: push passes at once, no reset - gate must catch own edit
    "norace+own_before_tracked":      {"own_before": {"analytics-mvp/data/x.json": "x-ours\n"}},
    # retry loop: second foreign commit lands right before push #2 -> second reset
    "retry2":    {"foreign_before": OZ_A, "foreign_at_push": {2: {"analytics-mvp/data/orders_daily.ndjson": "o3-ozon"}}},
    "retry2+own_after_html": {"foreign_before": OZ_A, "foreign_at_push": {2: {"analytics-mvp/data/orders_daily.ndjson": "o3-ozon"}}, "own_after": {"analytics-mvp/public/index.html": "hacked\n"}},
    # fetch #1 fails -> continue without reset; push #2 rejected again; fetch #2 ok -> reset
    "fetchfail": {"foreign_before": OZ_A, "fetch_fail": [1]},
    # foreign commit lands AFTER our first successful push (before the gate): tree must not change
    "late_foreign": {"foreign_at_push": {99: {}}, "foreign_after_inter": OZ_A},
    # path format: non-OZON race -> reset -> re-snap must be byte-identical to step-86 snapshot
    "pathequiv": {"foreign_before": {"README.md": "readme v2\n"}},
    # re-snap failure: foreign commit removes every public/*.html -> glob is literal -> md5sum fails
    "resnap_fail": {"foreign_before": {"analytics-mvp/public/index.html": None, "analytics-mvp/public/tests.html": None}},
}

def scenario(rev, name, shell_mode):
    spec = SCEN[name]
    snap, inter, gate = load_steps(rev)
    W = tempfile.mkdtemp(prefix=f"{name}_{rev[:7]}_", dir=SP)
    setup(W)
    out = {"rev": rev[:7], "scenario": name, "shell": shell_mode}
    r = run_step(W, snap, "snap", shell_mode); out["snap_rc"] = r.returncode
    for f in ("public.md5", "data.md5"):
        shutil.copy(f"{W}/tmp/ozon-before/{f}", f"{W}/snap0/{f}")
    R = f"{W}/runner"
    wfile(R, "analytics-mvp/data-ym/orders.ndjson", "y2\n")          # ym:orders always writes
    for p, c in spec.get("own_before", {}).items():
        wfile(R, p, c)
    if spec.get("foreign_before"):
        foreign_now(W, spec["foreign_before"], "ozon A")
    for n, files in spec.get("foreign_at_push", {}).items():
        if files:
            foreign_at_push(W, n, files, f"ozon at push {n}")
    for n in spec.get("fetch_fail", []):
        open(f"{W}/hooks/fetchfail_{n}", "w").close()
    r = run_step(W, inter, "inter", shell_mode)
    out["inter_rc"] = r.returncode
    out["inter_tail"] = (r.stdout + r.stderr).strip().splitlines()[-3:]
    out["push_calls"], out["fetch_calls"], out["reset_calls"] = cnt(W, "push"), cnt(W, "fetch"), cnt(W, "reset")
    if spec.get("foreign_after_inter"):
        foreign_now(W, spec["foreign_after_inter"], "ozon late")
    for p, c in spec.get("own_after", {}).items():
        wfile(R, p, c)
    if out["inter_rc"] == 0 or shell_mode != "github":
        r = run_step(W, gate, "gate", shell_mode)
        out["gate_rc"] = r.returncode
        txt = (r.stdout + r.stderr)
        out["gate_failed_lines"] = [l for l in txt.splitlines() if "FAILED" in l or "WARNING" in l or "no properly" in l]
        out["gate"] = "PASS" if r.returncode == 0 else "FAIL"
    else:
        out["gate"] = "not reached (step 'Promezhutochny kommit' failed, job stops)"
    out["resnap_equals_snap0"] = all(
        filecmp.cmp(f"{W}/tmp/ozon-before/{f}", f"{W}/snap0/{f}", shallow=False) for f in ("public.md5", "data.md5"))
    out["data_md5_lines"] = open(f"{W}/tmp/ozon-before/data.md5").read().split("\n")[:4]
    out["remote_main"] = {k: remote_file(W, f"analytics-mvp/{k}") for k in
                          ("data/x.json", "data/orders_daily.ndjson", "data-ym/orders.ndjson", "public/index.html")}
    out["sandbox"] = W
    return out

if __name__ == "__main__":
    rev, which = sys.argv[1], sys.argv[2]
    shell_mode = "github"
    for a in sys.argv[3:]:
        if a.startswith("--shell="):
            shell_mode = a.split("=", 1)[1]
    names = list(SCEN) if which == "all" else [which]
    for nm in names:
        print(json.dumps(scenario(rev, nm, shell_mode), ensure_ascii=False))
