#!/usr/bin/env python3
"""Регрессионные тесты хуков data-guard. Запуск: python3 .claude/hooks/tests/data-guard-tests.py [-v]
Создаёт временный git-репо с копией конфига, скилла и реестра, гоняет события и проверяет вывод. Exit 0 = всё прошло."""
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


def sh(cwd, *cmd):
    subprocess.run(cmd, cwd=cwd, check=True, capture_output=True, text=True)


def setup():
    fx = tempfile.mkdtemp(prefix="dg-test-")
    for rel in (".claude/data-guard.json", ".claude/skills/data-guard", "knowledge/errors/registry.jsonl"):
        src, dst = os.path.join(REPO, rel), os.path.join(fx, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        (shutil.copytree if os.path.isdir(src) else shutil.copy)(src, dst)
    sh(fx, "git", "init", "-q", "-b", "main")
    sh(fx, "git", "add", "-A")
    sh(fx, "git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "init")
    return fx


def run(fx, mode, ev, state):
    env = dict(os.environ, CLAUDE_PROJECT_DIR=fx, TMPDIR=state)
    p = subprocess.run([sys.executable, HOOK, mode], input=json.dumps(ev), capture_output=True, text=True, env=env, cwd=fx, timeout=30)
    assert p.returncode == 0, f"exit {p.returncode}: {p.stderr}"
    return json.loads(p.stdout) if p.stdout.strip() else {}


def main():
    fx = setup()
    state = tempfile.mkdtemp(prefix="dg-state-")
    cases = []

    def case(name, mode, ev, check):
        cases.append((name, mode, ev, check))

    hso = lambda o: o.get("hookSpecificOutput", {})
    case("session-start даёт памятку", "session-start", {"source": "startup"}, lambda o: "К11" in hso(o).get("additionalContext", ""))
    case("prompt с цифрами: скилл и прошлые ошибки", "prompt", {"session_id": "s1", "prompt": "сверь деньги озон за сентябрь по дате доставки"},
         lambda o: "data-guard" in hso(o).get("additionalContext", "") and "E0" in hso(o).get("additionalContext", ""))
    case("prompt без цифр молчит", "prompt", {"session_id": "s1", "prompt": "поменяй цвет кнопки на синий"}, lambda o: o == {})
    case("merge без go: ask", "pre-bash", {"session_id": "s1", "tool_input": {"command": "gh pr merge 12 --squash"}},
         lambda o: hso(o).get("permissionDecision") == "ask")
    case("merge с DG_OVERRIDE: без ask, systemMessage", "pre-bash", {"session_id": "s1", "tool_input": {"command": 'DG_OVERRIDE="решение Ивана" gh pr merge 12'}},
         lambda o: "permissionDecision" not in hso(o) and "решение Ивана" in o.get("systemMessage", ""))
    case("обычная команда молчит", "pre-bash", {"tool_input": {"command": "ls -la"}}, lambda o: o == {})
    case("сборка на main: ask", "pre-bash", {"tool_input": {"command": "cd analytics-mvp && npx tsx src/scripts/build-katya.ts"}},
         lambda o: hso(o).get("permissionDecision") == "ask")
    case("правка сгенерированного HTML: предупреждение", "pre-edit", {"tool_input": {"file_path": os.path.join(fx, "analytics-mvp/public/katya-money.html")}},
         lambda o: "К9" in hso(o).get("additionalContext", ""))
    case("правка билдера молчит", "pre-edit", {"tool_input": {"file_path": os.path.join(fx, "analytics-mvp/src/scripts/build-katya.ts")}}, lambda o: o == {})
    case("MCP merge без go: ask", "pre-mcp-merge", {"tool_input": {"pullNumber": 7, "commit_title": "x"}}, lambda o: hso(o).get("permissionDecision") == "ask")
    case("stop: «сошлось» без двух источников", "stop", {"session_id": "s2", "last_assistant_message": "Готово, выручка сошлась, 1 234 567 ₽."},
         lambda o: "сверке" in hso(o).get("additionalContext", ""))
    case("stop: «сошлось» с двумя цифрами и источниками молчит", "stop",
         {"session_id": "s3", "last_assistant_message": "Сверка выручки за август: отчёт о реализации 1 234 567 ₽, выписка банка 1 234 567 ₽, разница 0. Сошлось."},
         lambda o: o == {})
    case("stop: stop_hook_active молчит", "stop", {"session_id": "s2", "stop_hook_active": True, "last_assistant_message": "сошлось 5"}, lambda o: o == {})

    ok = fail = 0
    for name, mode, ev, check in cases:
        o = run(fx, mode, ev, state)
        good = False
        try:
            good = bool(check(o))
        except Exception:
            good = False
        if good:
            ok += 1
            VERBOSE and print(f"ok   {name}")
        else:
            fail += 1
            print(f"FAIL {name}: {json.dumps(o, ensure_ascii=False)[:300]}")

    # go ФЕНИКСА после коммита снимает ask
    day = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    os.makedirs(os.path.join(fx, "traces", day), exist_ok=True)
    ts = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=5)).isoformat(timespec="seconds")
    with open(os.path.join(fx, "traces", day, "agents.jsonl"), "a") as f:
        f.write(json.dumps({"ts": ts, "event": "subagent_stop", "agent": "feniks", "verdict": "go"}) + "\n")
    o = run(fx, "pre-bash", {"tool_input": {"command": "gh pr merge 12"}}, state)
    if o == {}:
        ok += 1
        VERBOSE and print("ok   merge после go молчит")
    else:
        fail += 1
        print(f"FAIL merge после go: {o}")

    # коммит только трейсов на рабочей ветке
    sh(fx, "git", "checkout", "-q", "-b", "work")
    sh(fx, "git", "add", "traces")
    o = run(fx, "pre-bash", {"tool_input": {"command": "git commit -m 'traces'"}}, state)
    if "только из трейсов" in hso(o).get("additionalContext", ""):
        ok += 1
        VERBOSE and print("ok   коммит только трейсов")
    else:
        fail += 1
        print(f"FAIL коммит только трейсов: {o}")

    shutil.rmtree(fx, ignore_errors=True)
    shutil.rmtree(state, ignore_errors=True)
    print(f"data-guard hooks: {ok} ok, {fail} fail")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
