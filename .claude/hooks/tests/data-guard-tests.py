#!/usr/bin/env python3
"""Регрессионные тесты хуков data-guard. Запуск: python3 .claude/hooks/tests/data-guard-tests.py [-v]
Временный git-репо с копией конфига, скилла, реестра и decisions.md; события гоняются через хук, вывод проверяется.
Включает негативные кейсы из аудита ФЕНИКСА 29.09.2026 (ложные срабатывания). Exit 0 = всё прошло."""
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
HOOK = os.path.join(REPO, ".claude", "hooks", "data-guard.py")
VERBOSE = "-v" in sys.argv
G = ["-c", "user.email=t@t", "-c", "user.name=t"]


def sh(cwd, *cmd):
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if p.returncode:
        raise SystemExit(f"{cmd}: {p.stderr}")
    return p.stdout.strip()


def setup():
    fx = tempfile.mkdtemp(prefix="dg-test-")
    for rel in (".claude/data-guard.json", ".claude/skills/data-guard", "knowledge/errors/registry.jsonl"):
        src, dst = os.path.join(REPO, rel), os.path.join(fx, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        (shutil.copytree if os.path.isdir(src) else shutil.copy)(src, dst)
    with open(os.path.join(fx, "knowledge", "decisions.md"), "w") as f:
        f.write("# Решения\n\n## 2026-09-29 слияние data-guard без повторного аудита\nтест\n")
    sh(fx, "git", "init", "-q", "-b", "main")
    sh(fx, "git", "add", "-A")
    sh(fx, "git", *G, "commit", "-q", "-m", "init")
    origin = fx + "-origin.git"
    sh(fx, "git", "init", "-q", "--bare", origin)
    sh(fx, "git", "remote", "add", "origin", origin)
    sh(fx, "git", "push", "-q", "origin", "main")
    sh(fx, "git", "fetch", "-q", "origin")
    return fx


def run(fx, mode, ev, state, env_extra=None):
    env = dict(os.environ, CLAUDE_PROJECT_DIR=fx, TMPDIR=state, **(env_extra or {}))
    env.pop("DATA_GUARD_OFF", None) if not env_extra else None
    p = subprocess.run([sys.executable, HOOK, mode], input=json.dumps(ev), capture_output=True, text=True, env=env, cwd=fx, timeout=30)
    assert p.returncode == 0, f"exit {p.returncode}: {p.stderr}"
    return json.loads(p.stdout) if p.stdout.strip() else {}


hso = lambda o: o.get("hookSpecificOutput", {})
bash = lambda c, sid="s": {"session_id": sid, "tool_input": {"command": c}}


def main():
    fx = setup()
    state = tempfile.mkdtemp(prefix="dg-state-")
    ok = fail = 0

    def check(name, cond, o):
        nonlocal ok, fail
        if cond:
            ok += 1
            VERBOSE and print(f"ok   {name}")
        else:
            fail += 1
            print(f"FAIL {name}: {json.dumps(o, ensure_ascii=False)[:300]}")

    def case(name, mode, ev, pred, env_extra=None):
        o = run(fx, mode, ev, state, env_extra)
        try:
            good = bool(pred(o))
        except Exception:
            good = False
        check(name, good, o)

    silent = lambda o: o == {}
    is_ask = lambda o: hso(o).get("permissionDecision") == "ask"

    # --- на main, до изменений ---
    case("session-start: памятка", "session-start", {"source": "startup"}, lambda o: "К11" in hso(o).get("additionalContext", ""))
    case("prompt с цифрами: скилл и прошлые ошибки", "prompt", {"session_id": "s1", "prompt": "сверь деньги озон за сентябрь по дате доставки"},
         lambda o: "data-guard" in hso(o).get("additionalContext", "") and "E0" in hso(o).get("additionalContext", ""))
    for p in ("поменяй цвет кнопки на синий", "создай директорию для логов", "напиши пост для маркетинга", "обнови чеклист онбординга",
              "добавь unittest", "поправь рубрики блога", "нужен маркетолог", "сделай снимок экрана", "новая директива", "это оборот речи"):
        case(f"prompt без цифр молчит: {p}", "prompt", {"session_id": "s1", "prompt": p}, silent)
    case("prompt: Директ ловится", "prompt", {"session_id": "s9", "prompt": "выгрузи расход Директа за неделю"}, lambda o: "data-guard" in hso(o).get("additionalContext", ""))
    case("сборка на main: ask", "pre-bash", bash("cd analytics-mvp && npx tsx src/scripts/build-katya.ts"), is_ask)
    case("npm run build на main: ask", "pre-bash", bash("npm run build"), is_ask)
    for c in ("cat analytics-mvp/src/scripts/build-katya.ts", "grep -n x analytics-mvp/src/scripts/build-katya.ts",
              "git log -- analytics-mvp/src/scripts/build-katya.ts", "git diff build-katya.ts", "node --check analytics-mvp/src/scripts/build.js",
              "rg build_ src", "ls -la"):
        case(f"чтение на main молчит: {c}", "pre-bash", bash(c), silent)
    case("timeout + сборка на main: ask (m-b)", "pre-bash", bash("timeout 600 npx tsx src/scripts/build-katya.ts"), is_ask)
    case("npm --prefix run build на main: ask (m-b)", "pre-bash", bash("npm --prefix analytics-mvp run build"), is_ask)
    case("git merge --ff-only origin/main на main молчит (A5)", "pre-bash", bash("git merge --ff-only origin/main"), silent)
    case("gh pr merge с чистого main без изменений: молчит", "pre-bash", bash("gh pr merge"), silent)
    case("сборка на main с DG_OVERRIDE: молчит", "pre-bash", bash('DG_OVERRIDE="ночной фикс" npx tsx src/scripts/build-katya.ts'), silent)
    case("правка сгенерированного HTML: предупреждение", "pre-edit", {"tool_input": {"file_path": os.path.join(fx, "analytics-mvp/public/katya-money.html")}},
         lambda o: "К9" in hso(o).get("additionalContext", ""))
    case("правка билдера молчит", "pre-edit", {"tool_input": {"file_path": os.path.join(fx, "analytics-mvp/src/scripts/build-katya.ts")}}, silent)

    # --- рабочая ветка с изменением цифр ---
    sh(fx, "git", "checkout", "-q", "-b", "work")
    os.makedirs(os.path.join(fx, "analytics-mvp/src/scripts"), exist_ok=True)
    with open(os.path.join(fx, "analytics-mvp/src/scripts/build-katya.ts"), "w") as f:
        f.write("export const x = 1;\n")
    sh(fx, "git", "add", "analytics-mvp")
    sh(fx, "git", *G, "commit", "-q", "-m", "numbers")
    case("gh pr merge без go: ask", "pre-bash", bash("gh pr merge 12 --squash"), is_ask)
    case("git -C dir push origin HEAD:main: ask", "pre-bash", bash(f"git -C {fx} push origin HEAD:main"), is_ask)
    case("git push origin main с рабочей ветки (шлёт локальный main без изменений): молчит", "pre-bash", bash("git push origin main"), silent)
    case("git push origin HEAD:main: ask", "pre-bash", bash("git push origin HEAD:main"), is_ask)
    for c in ("git push -u origin claude/main-fix", "git push -u origin claude/ozon-main-page", "git merge origin/main --no-ff",
              "git push -u origin work"):
        case(f"не слияние в main молчит: {c}", "pre-bash", bash(c), silent)
    case("DG_OVERRIDE при слиянии не снимает ask (A1b)", "pre-bash", bash('DG_OVERRIDE="мелочь" gh pr merge'), is_ask)
    case("DG_OVERRIDE со ссылкой на дату тоже ask (A1b)", "pre-bash", bash('DG_OVERRIDE="decisions.md#2026-09-29: срочно" gh pr merge'), is_ask)
    for c in ("env X=1 git push origin HEAD:main", "timeout 60 git push origin HEAD:main", "command git push origin HEAD:main",
              "bash -c 'git push origin HEAD:main'", "(git push origin HEAD:main)", "sudo -E git push origin HEAD:main"):
        case(f"обёртка не прячет push в main: {c}", "pre-bash", bash(c), is_ask)
    case("сборка на рабочей ветке молчит", "pre-bash", bash("timeout 600 npx tsx src/scripts/build-katya.ts"), silent)
    # PR по номеру: голова PR из origin, а не локальный HEAD (N3)
    sh(fx, "git", "push", "-q", "origin", "HEAD:refs/pull/44/head")
    case("MCP merge PR с цифрами без go: ask", "pre-mcp-merge", {"tool_input": {"pullNumber": 44, "commit_title": "x"}}, is_ask)
    case("gh api merge PR с цифрами: ask", "pre-bash", bash("gh api -X PUT repos/o/r/pulls/44/merge"), is_ask)
    case("PR, которого нет в origin: ask (не удалось проверить)", "pre-mcp-merge", {"tool_input": {"pullNumber": 999}}, is_ask)

    # go без хеша не засчитывается, с верным хешем засчитывается, поздний return отменяет go (m-e)
    day = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    tdir = os.path.join(fx, "traces", day)
    os.makedirs(tdir, exist_ok=True)
    now = dt.datetime.now(dt.timezone.utc)
    tr = lambda rec: open(os.path.join(tdir, "agents.jsonl"), "a").write(json.dumps(rec) + "\n")
    tr({"ts": now.isoformat(timespec="seconds"), "event": "audit", "agent": "feniks", "verdict": "go"})
    case("go без audited_hash не снимает ask (A1)", "pre-bash", bash("git push origin HEAD:main"), is_ask)
    h = sh(fx, sys.executable, os.path.join(fx, ".claude/skills/data-guard/scripts/audit_hash.py"))
    tr({"ts": (now + dt.timedelta(seconds=1)).isoformat(timespec="seconds"), "event": "audit", "agent": "feniks", "verdict": "go", "audited_hash": h})
    case("go (event audit) с хешем изменений: молчит", "pre-bash", bash("git push origin HEAD:main"), silent)
    case("go действует и для PR с той же головой", "pre-mcp-merge", {"tool_input": {"pullNumber": 44}}, silent)
    hw = sh(fx, sys.executable, os.path.join(fx, ".claude/skills/data-guard/scripts/audit_hash.py"), "--worktree")
    check("хеш рабочего дерева = хеш HEAD при чистом дереве (трейсы исключены)", h == hw, {"head": h, "worktree": hw})
    tr({"ts": (now + dt.timedelta(seconds=2)).isoformat(timespec="seconds"), "event": "subagent_stop", "agent": "feniks", "verdict": "return", "audited_hash": h})
    case("поздний return на тот же хеш отменяет go (m-e)", "pre-bash", bash("git push origin HEAD:main"), is_ask)
    tr({"ts": (now + dt.timedelta(seconds=3)).isoformat(timespec="seconds"), "event": "audit", "agent": "feniks", "verdict": "go", "audited_hash": h})
    # слияние main в ветку не меняет хеш изменений ветки (N4)
    sh(fx, "git", "checkout", "-q", "main")
    open(os.path.join(fx, "README.md"), "w").write("main moved\n")
    sh(fx, "git", "add", "README.md")
    sh(fx, "git", *G, "commit", "-q", "-m", "main moved")
    sh(fx, "git", "push", "-q", "origin", "main")
    sh(fx, "git", "fetch", "-q", "origin")
    sh(fx, "git", "checkout", "-q", "work")
    sh(fx, "git", *G, "merge", "-q", "--no-edit", "origin/main")
    h2 = sh(fx, sys.executable, os.path.join(fx, ".claude/skills/data-guard/scripts/audit_hash.py"))
    check("слияние main в ветку не меняет хеш (N4)", h == h2, {"before": h, "after": h2})
    case("после слияния main go остаётся в силе", "pre-bash", bash("git push origin HEAD:main"), silent)
    with open(os.path.join(fx, "analytics-mvp/src/scripts/build-katya.ts"), "a") as f:
        f.write("export const y = 2;\n")
    sh(fx, "git", "add", "-A", "analytics-mvp")
    sh(fx, "git", *G, "commit", "-q", "-m", "after go")
    case("коммит после go: снова ask", "pre-bash", bash("git push origin HEAD:main"), is_ask)
    sh(fx, "git", "push", "-q", "origin", "HEAD:refs/pull/45/head")

    # ветка без файлов с цифрами: слияние молчит
    sh(fx, "git", "checkout", "-q", "-b", "docs", "main")
    with open(os.path.join(fx, "knowledge", "note.md"), "w") as f:
        f.write("x\n")
    sh(fx, "git", "add", "knowledge/note.md")
    sh(fx, "git", *G, "commit", "-q", "-m", "docs")
    sh(fx, "git", "push", "-q", "origin", "HEAD:refs/pull/13/head")
    case("PR без цифр (только knowledge): молчит (М3)", "pre-bash", bash("gh pr merge 13"), silent)
    case("из ветки без цифр слияние PR 45 (цифры, без go): ask (N3)", "pre-mcp-merge", {"tool_input": {"pullNumber": 45}}, is_ask)
    case("из ветки без цифр слияние PR 44 (цифры, go на его голову): молчит (N3)", "pre-mcp-merge", {"tool_input": {"pullNumber": 44}}, silent)

    # коммит только трейсов и снимков на рабочей ветке
    sh(fx, "git", "add", "traces")
    case("коммит только трейсов: предупреждение", "pre-bash", bash("git commit -m traces"), lambda o: "только из трейсов" in hso(o).get("additionalContext", ""))
    sh(fx, "git", "reset", "-q")
    os.makedirs(os.path.join(fx, "analytics-mvp/data-ym"), exist_ok=True)
    with open(os.path.join(fx, "analytics-mvp/data-ym/svod.json"), "w") as f:
        f.write("{}\n")
    sh(fx, "git", "add", "analytics-mvp/data-ym/svod.json")
    case("снимок в коммите рабочей ветки: предупреждение", "pre-bash", bash("git commit -m data"), lambda o: "снимки" in hso(o).get("additionalContext", ""))
    case("workflow на рабочей ветке: предупреждение", "pre-bash", bash("gh workflow run ym-snapshots.yml --ref docs"), lambda o: "self-merge" in hso(o).get("additionalContext", ""))

    # составные команды на main и слияние чужого содержимого (R1, R3)
    sh(fx, "git", "push", "-q", "origin", "work:work")
    after_go = sh(fx, "git", "rev-parse", "work")
    sh(fx, "git", "checkout", "-q", "main")
    os.makedirs(os.path.join(fx, "analytics-mvp/src"), exist_ok=True)
    open(os.path.join(fx, "analytics-mvp/src/metric.ts"), "w").write("export const m = 1;\n")
    sh(fx, "git", "add", "analytics-mvp/src/metric.ts")
    sh(fx, "git", *G, "commit", "-q", "-m", "metric on main")
    sh(fx, "git", "push", "-q", "origin", "main")
    sh(fx, "git", "fetch", "-q", "origin")
    open(os.path.join(fx, "analytics-mvp/src/metric.ts"), "a").write("export const n = 2;\n")
    for c in ("git add -A && git commit -m x && git push origin main", "git commit -am x && git push origin main",
              "git commit -am x && git push"):
        case(f"составная команда на main с цифрами: ask (R1): {c}", "pre-bash", bash(c), is_ask)
    sh(fx, "git", "checkout", "-q", "--", "analytics-mvp/src/metric.ts")
    # итерация 5: локальный коммит с цифрами на main, push внутри конструкций оболочки (R1), перенаправление (R2), fetch (R3), @:main (R4)
    open(os.path.join(fx, "analytics-mvp/src/metric.ts"), "a").write("export const k = 3;\n")
    sh(fx, "git", *G, "commit", "-q", "-am", "local numbers")
    for c in ("for i in 1 2 3 4; do git push && break || sleep $((2**i)); done", "until git push origin main; do sleep 2; done",
              "while ! git push origin main; do sleep 1; done", "if git merge work; then git push origin main; fi",
              "if true; then git push origin main; fi", "git push origin @:main", "git push origin HEAD~0:main",
              "git show work:tools/x.json > tools/x.json && git add -A && git commit -m x && git push origin main",
              "echo x >| tools/a.json && git push", "git fetch . work:main && git push origin main"):
        case(f"push в main через конструкции оболочки и запись файлов: ask (R1-R4): {c}", "pre-bash", bash(c), is_ask)
    sh(fx, "git", "reset", "-q", "--hard", "origin/main")
    for c in ("git merge work && git push origin main", f"git cherry-pick {after_go} && git push origin main", "git merge work"):
        case(f"слияние ветки с цифрами в main: ask (R1): {c}", "pre-bash", bash(c), is_ask)
    case("git pull на main и push без своих изменений: молчит", "pre-bash", bash("git pull --ff-only && git push origin main"), silent)
    # итерация 4: смена ветки, непредсказуемые операции, правка после go, bash -c с составной командой (G1, G2, G4, G5)
    for c in ("git am fix.patch && git push origin main", "git apply fix.patch && git add -A && git commit -m x && git push origin main",
              "git reset --hard work && git push -f origin main", "git checkout work -- . && git commit -m x && git push origin main",
              "git restore --source work analytics-mvp && git commit -am x && git push", "git stash pop && git commit -am x && git push",
              "echo 1 > tools/y.json && git add -A && git commit -m x && git push origin main", "python3 tools/sync.py && git commit -am x && git push",
              "sed -i s/1/2/ tools/x.json && git add -A && git commit -m x && git push origin main",
              "bash -c 'git merge work && git push origin main'", "sh -c \"git merge work; git push origin HEAD:main\""):
        case(f"итог не определить до выполнения: ask (G2/G4): {c}", "pre-bash", bash(c), is_ask)
    case("git merge --no-ff -m 'сообщение' docs на main: молчит (G3)", "pre-bash", bash("git merge --no-ff -m 'Merge docs' docs"), silent)
    case("gh pr merge -t 'title' 13 (docs): молчит (G3)", "pre-bash", bash("gh pr merge -t 'title' 13"), silent)
    sh(fx, "git", "branch", "-f", "goodbr", "work~1")
    case("git merge -m 'x' ветки с go на её изменения: молчит (G3, путь go)", "pre-bash", bash("git merge --no-ff -m 'Merge: goodbr' goodbr"), silent)
    for c in ("git checkout work && git push origin HEAD:main", "git switch work && git push origin main",
              "git checkout main && git merge --no-ff work -m 'Merge: x' && git push origin main"):
        case(f"смена ветки внутри команды: ask (G1): {c}", "pre-bash", bash(c), is_ask)
    case("switch main, pull, merge, push одной командой: ask", "pre-bash",
         bash("git switch main && git pull && git merge --no-ff work && git push origin main"), is_ask)
    sh(fx, "git", "checkout", "-q", "work")
    open(os.path.join(fx, "analytics-mvp/src/scripts/build-katya.ts"), "a").write("export const z = 9;\n")
    case("коммит и push текущей ветки как ветка:main без checkout: оценивается рабочее дерево (G5)", "pre-bash",
         bash("git add -A && git commit -m x && git push origin work:main"), is_ask)
    case("git pull без аргументов на рабочей ветке не считается pull из main", "pre-bash",
         bash("git pull && git push origin HEAD:main"), is_ask)
    sh(fx, "git", "checkout", "-q", "--", "analytics-mvp/src/scripts/build-katya.ts")
    sh(fx, "git", "checkout", "-q", "docs")
    for c in ("git push origin work:main", "gh pr merge work", "gh pr merge https://github.com/o/r/pull/45", "gh -R o/r pr merge 45"):
        case(f"слияние чужого содержимого с другой ветки: ask (R3): {c}", "pre-bash", bash(c), is_ask)
    h45 = sh(fx, sys.executable, os.path.join(fx, ".claude/skills/data-guard/scripts/audit_hash.py"), "--rev", after_go)
    fut = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=1)
    tr({"ts": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "event": "audit", "agent": "feniks", "verdict": "return", "audited_hash": h45})
    tr({"ts": fut.isoformat(timespec="seconds"), "event": "audit", "agent": "feniks", "verdict": "go", "audited_hash": h45})
    case("go с датой из будущего не перекрывает return (R6)", "pre-mcp-merge", {"tool_input": {"pullNumber": 45}}, is_ask)

    # Stop
    case("stop: «сошлось» с деньгами без двух источников", "stop", {"session_id": "s2", "last_assistant_message": "Готово, выручка сошлась, 1 234 567 ₽."},
         lambda o: "сверке" in hso(o).get("additionalContext", ""))
    case("stop: повтор того же сообщения молчит (once)", "stop", {"session_id": "s2", "last_assistant_message": "Готово, выручка сошлась, 1 234 567 ₽."}, silent)
    case("stop: сверка с двумя цифрами и источниками молчит", "stop",
         {"session_id": "s3", "last_assistant_message": "Сверка выручки за август: отчёт о реализации 1 234 567 ₽, выписка банка 1 234 567 ₽, разница 0. Сошлось."}, silent)
    case("stop: «Проверено: тесты 15/15, api отвечает» молчит", "stop", {"session_id": "s4", "last_assistant_message": "Проверено: тесты 15/15, api отвечает."}, silent)
    case("stop: «Итог: 49 тестов, всё сходится» молчит (m-c)", "stop", {"session_id": "s7", "last_assistant_message": "Итог: 49 тестов, всё сходится."}, silent)
    case("stop: «Сумма тестов сошлась: 49 из 49» молчит (m-c)", "stop", {"session_id": "s8", "last_assistant_message": "Сумма тестов сошлась: 49 из 49."}, silent)
    case("stop: «совпадает с документацией» молчит", "stop", {"session_id": "s5", "last_assistant_message": "Формат хука совпадает с документацией, 2 из 2 кейсов."}, silent)
    case("stop: stop_hook_active молчит", "stop", {"session_id": "s6", "stop_hook_active": True, "last_assistant_message": "выручка сошлась 5 ₽"}, silent)

    # сбой хука на команде слияния: ask, а не молча (fail-closed для К11)
    cfgp = os.path.join(fx, ".claude/data-guard.json")
    good = open(cfgp).read()
    open(cfgp, "w").write("{ битый json")
    case("сбой хука на слиянии: ask", "pre-bash", bash("gh pr merge 45"), is_ask)
    case("сбой хука на обычной команде: молчит", "pre-bash", bash("ls"), silent)
    open(cfgp, "w").write(good)

    # выключатели
    case("DATA_GUARD_OFF=1 молчит", "pre-bash", bash("gh pr merge 12"), silent, {"DATA_GUARD_OFF": "1"})
    os.rename(os.path.join(fx, ".claude/data-guard.json"), os.path.join(fx, ".claude/data-guard.json.off"))
    case("нет .claude/data-guard.json (чужой репо): молчит (М6)", "pre-bash", bash("gh pr merge 12"), silent)

    shutil.rmtree(fx, ignore_errors=True)
    shutil.rmtree(fx + "-origin.git", ignore_errors=True)
    shutil.rmtree(state, ignore_errors=True)
    print(f"data-guard hooks: {ok} ok, {fail} fail")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
