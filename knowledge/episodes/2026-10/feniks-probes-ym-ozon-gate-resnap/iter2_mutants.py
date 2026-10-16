#!/usr/bin/env python3
"""FENIKS iter2 probes for PR #483: mutants of ym-snapshots.yml (bec7a87) against
(a) the author's structural vitest (run as-is, cwd trick: the test reads ../.github/workflows/ym-snapshots.yml
    relative to process.cwd()), and (b) behaviour via the FENIKS harness (real YAML steps, GitHub bash -eo pipefail).
Nothing in the repo is modified: mutants live in the scratchpad.
usage (repo root): python3 knowledge/episodes/2026-10/feniks-probes-ym-ozon-gate-resnap/iter2_mutants.py test|behave|all
Sandboxes: $PROBE_OUT or a fresh temp dir (never inside the repo).
"""
import importlib.util, json, os, re, subprocess, sys, tempfile, yaml

REPO = "/home/user/t1"
SP = os.environ.get("PROBE_OUT") or tempfile.mkdtemp(prefix="feniks-iter2-mutants-")
MUT = os.path.join(SP, "mut")
VITEST = f"{REPO}/analytics-mvp/node_modules/.bin/vitest"
TEST = f"{REPO}/analytics-mvp/src/scripts/ym/validate-facts.test.ts"

src = subprocess.run(["git", "-C", REPO, "show", "bec7a87:.github/workflows/ym-snapshots.yml"],
                     capture_output=True, text=True, check=True).stdout
L = src.split("\n")

def idx(pred, start=0):
    for i in range(start, len(L)):
        if pred(L[i]):
            return i
    raise SystemExit(f"anchor not found from {start}")

R0 = idx(lambda l: l.startswith("            ( cd analytics-mvp && md5sum public/*.html > /tmp/ozon-before/public.md5"))
RESNAP = L[R0:R0 + 4]
assert RESNAP[3].lstrip().startswith("|| echo \"::warning::"), RESNAP[3]
RESET = idx(lambda l: l.strip() == 'git reset --hard "origin/$GITHUB_REF_NAME"')
DONE = idx(lambda l: l == "          done", R0)
COMMIT_IN_LOOP = idx(lambda l: l.strip().startswith('git commit -m "data-ym: заказы и каталог Маркета'), R0)
EXIT0 = idx(lambda l: l.strip() == "git diff --staged --quiet && exit 0", R0)
GATE = idx(lambda l: "Гейт: OZON байт-в-байт" in l)
assert RESET < R0 < EXIT0 < COMMIT_IN_LOOP < DONE < GATE

def without_resnap():
    return L[:R0] + L[R0 + 4:]

def insert_after(lines, anchor_line_text, block, start_text=None):
    # insert block after the first line equal to anchor_line_text that follows the start anchor
    s = 0
    if start_text:
        s = next(i for i, l in enumerate(lines) if l.strip() == start_text)
    i = next(i for i in range(s, len(lines)) if lines[i] == anchor_line_text)
    return lines[:i + 1] + block + lines[i + 1:]

M = {}
M["M0_control"] = L[:]
M["M1_deleted"] = without_resnap()
M["M2_commented"] = L[:R0] + [re.sub(r"^(\s*)", r"\1# ", x) for x in RESNAP] + L[R0 + 4:]
M["M3a_echo_no_gt"] = L[:R0] + ['            echo "переснять /tmp/ozon-before/public.md5 и /tmp/ozon-before/data.md5"'] + L[R0 + 4:]
M["M3b_echo_with_gt"] = L[:R0] + ['            echo "пересъём: md5sum > /tmp/ozon-before/public.md5, > /tmp/ozon-before/data.md5"'] + L[R0 + 4:]
M["M4_after_done"] = insert_after(without_resnap(), "          done", RESNAP, start_text='git reset --hard "origin/$GITHUB_REF_NAME"')
M["M5_after_exit0"] = insert_after(without_resnap(), L[COMMIT_IN_LOOP], RESNAP, start_text='git reset --hard "origin/$GITHUB_REF_NAME"')
no_cd = [RESNAP[0].replace("( cd analytics-mvp && md5sum public/*.html", "( md5sum analytics-mvp/public/*.html"),
         RESNAP[1].replace("md5sum data/*", "md5sum analytics-mvp/data/*"), RESNAP[2], RESNAP[3]]
M["M6_no_cd"] = L[:R0] + no_cd + L[R0 + 4:]
app = [RESNAP[0].replace("> /tmp/ozon-before/public.md5", ">> /tmp/ozon-before/public.md5"),
       RESNAP[1].replace("> /tmp/ozon-before/data.md5", ">> /tmp/ozon-before/data.md5"), RESNAP[2], RESNAP[3]]
M["M7_append"] = L[:R0] + app + L[R0 + 4:]
pull_step = ["      - name: Подтянуть свежий main перед гейтом (мутант M8)",
             "        working-directory: .",
             "        run: |",
             "          set -euo pipefail",
             '          git pull --rebase origin "$GITHUB_REF_NAME"']
M["M8_pull_before_gate"] = L[:GATE] + pull_step + L[GATE:]
M["M9_gate_renamed"] = [l.replace("Гейт: OZON байт-в-байт", "Гейт: OZON не изменился") for l in L]
M["M10_checkout_instead_of_reset"] = [l if i != RESET else l.replace('git reset --hard "origin/$GITHUB_REF_NAME"', 'git checkout -f -B "$GITHUB_REF_NAME" "origin/$GITHUB_REF_NAME"') for i, l in enumerate(L)]
M["M10_checkout_instead_of_reset"] = [l for i, l in enumerate(M["M10_checkout_instead_of_reset"]) if not (R0 <= i < R0 + 4)]
M["M11_resnap_before_reset"] = L[:RESET] + RESNAP + [L[RESET]] + L[RESET + 1:R0] + L[R0 + 4:]
M["M12_comment_mentions_reset"] = L[:2] + ["# Промежуточный коммит при уехавшем main делает git reset --hard на свежий main."] + L[2:]

def materialize(name, lines):
    d = os.path.join(MUT, name)
    os.makedirs(os.path.join(d, ".github/workflows"), exist_ok=True)
    os.makedirs(os.path.join(d, "analytics-mvp"), exist_ok=True)
    p = os.path.join(d, ".github/workflows/ym-snapshots.yml")
    with open(p, "w") as fh:
        fh.write("\n".join(lines))
    yaml.safe_load("\n".join(lines))  # mutant must stay valid YAML
    return d, p

def run_test(name, d):
    r = subprocess.run([VITEST, "run", "--root", f"{REPO}/analytics-mvp", TEST, "-t", "после каждого reset --hard"],
                       cwd=os.path.join(d, "analytics-mvp"), capture_output=True, text=True, timeout=300)
    out = r.stdout + r.stderr
    m = re.search(r"Tests\s+(.*)", out)
    bad = re.findall(r"строка \d+: после reset --hard нет записи [^\"',\]]+", out)
    return {"mutant": name, "rc": r.returncode, "tests": m.group(1).strip() if m else "?",
            "verdict": "GREEN" if r.returncode == 0 else "RED", "bad": sorted(set(bad))[:4]}

def load_harness():
    spec = importlib.util.spec_from_file_location(
        "h", f"{REPO}/knowledge/episodes/2026-10/feniks-probes-ym-ozon-gate-resnap/yml_gate_harness.py")
    h = importlib.util.module_from_spec(spec)
    os.environ["HARNESS_DIR"] = os.path.join(SP, "harness_iter2")
    os.makedirs(os.environ["HARNESS_DIR"], exist_ok=True)
    spec.loader.exec_module(h)
    return h

def behave(names, scenarios):
    h = load_harness()
    h.SCEN["queued_nodiff"] = {"foreign_before": {**h.OZ_A, "analytics-mvp/data-ym/orders.ndjson": "y2\n"}}
    orig_run_step = h.run_step
    state = {}
    def run_step2(W, step, tag, shell_mode):
        if tag == "gate" and state.get("extra"):
            r = orig_run_step(W, state["extra"], "extra", shell_mode)
            state.setdefault("extra_rc", {})[W] = r.returncode
        return orig_run_step(W, step, tag, shell_mode)
    h.run_step = run_step2
    res = []
    for name in names:
        lines = M[name]
        text = "\n".join(lines)
        job = yaml.safe_load(text)["jobs"]["snapshots"]
        dflt = job.get("defaults", {}).get("run", {})
        def find(prefix):
            hits = [s for s in job["steps"] if s.get("name", "").startswith(prefix)]
            assert len(hits) == 1, (prefix, len(hits))
            s = hits[0]
            return {"name": s["name"], "run": s["run"],
                    "wd": s.get("working-directory", dflt.get("working-directory", ".")),
                    "shell": s.get("shell", dflt.get("shell"))}
        steps = (find("Снимок OZON-страниц ДО"), find("Промежуточный коммит факт-слоя"), find("Гейт: OZON байт-в-байт"))
        h.load_steps = lambda rev, steps=steps: steps
        state.clear()
        if name == "M8_pull_before_gate":
            state["extra"] = find("Подтянуть свежий main перед гейтом")
        for sc in scenarios:
            d = h.scenario(name, sc, "github")
            res.append({"mutant": name, "scenario": sc, "inter_rc": d["inter_rc"],
                        "pfr": f"{d['push_calls']}/{d['fetch_calls']}/{d['reset_calls']}",
                        "gate": d["gate"][:4], "remote_ym": d["remote_main"]["data-ym/orders.ndjson"],
                        "gate_lines": [x.split("/tmp/ozon-before/")[-1] if "/tmp/ozon-before/" in x else x for x in d.get("gate_failed_lines", [])][:3],
                        "sandbox": d["sandbox"]})
    return res

if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    dirs = {n: materialize(n, M[n]) for n in M}
    if what in ("test", "all"):
        for n in M:
            print(json.dumps(run_test(n, dirs[n][0]), ensure_ascii=False), flush=True)
    if what in ("behave", "all"):
        names = ["M0_control", "M2_commented", "M4_after_done", "M5_after_exit0", "M6_no_cd", "M7_append", "M8_pull_before_gate"]
        scen = ["race", "pathequiv", "queued_nodiff", "late_foreign"]
        for r in behave(names, scen):
            print(json.dumps(r, ensure_ascii=False), flush=True)
