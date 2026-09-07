#!/usr/bin/env bash
# feniks-write-scope.sh - гейт записи ФЕНИКСА (Hard Rule 4), первый эшелон: PreToolUse Write|Edit|MultiEdit|NotebookEdit.
# Разрешённые зоны: knowledge/episodes/**, knowledge/reflexion/**, traces/**, .claude/agent-memory/feniks/**, /tmp/**.
# Путь нормализуется (realpath) ДО сравнения префиксов: обход через `..` и симлинки закрыт (проба A5, аудит 2026-09-06).
# Регистрация: (1) project-level в settings.json - срабатывает, когда stdin несёт agent_type=feniks;
#              (2) agent-scoped в frontmatter feniks.md с флагом --force - срабатывает без agent_type.
# Каждое решение пишется в traces/YYYY-MM-DD/agents.jsonl (event=gate) для проверки живой работы гейта.

set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
FORCE="${1:-}"
EVENT="$(cat)"

python3 - "$ROOT" "$FORCE" "$EVENT" <<'PY'
import sys, json, os, datetime

root = os.path.realpath(sys.argv[1])
force = sys.argv[2] == "--force"
try:
    d = json.loads(sys.argv[3])
except Exception:
    sys.exit(0)

agent = str(d.get("agent_type") or d.get("agent_name") or "").strip().lower()
if not force and agent != "feniks":
    sys.exit(0)  # гейт только для ФЕНИКСА

tool = str(d.get("tool_name") or "")
inp = d.get("tool_input") or {}
fp = str(inp.get("file_path") or inp.get("notebook_path") or "")

PROJECT_ZONES = [os.path.realpath(os.path.join(root, x)) for x in
                 ("knowledge/episodes", "knowledge/reflexion", "traces", ".claude/agent-memory/feniks")]

def allowed(real):
    """Внутри проекта - только зоны ФЕНИКСА; вне проекта - только /tmp (черновики).
    Проект, лежащий под /tmp, не получает «всё разрешено»: проверка внутри корня идёт первой."""
    inside = real == root or real.startswith(root + os.sep)
    if inside:
        return any(real == z or real.startswith(z + os.sep) for z in PROJECT_ZONES)
    return real == "/tmp" or real.startswith("/tmp" + os.sep)

def trace(decision, path):
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        out = os.path.join(root, "traces", now.strftime("%Y-%m-%d"))
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, "agents.jsonl"), "a", encoding="utf-8") as f:
            f.write(json.dumps({"ts": now.isoformat(timespec="seconds"), "event": "gate", "agent": "feniks",
                                "tier": "0", "outcome": "blocked" if decision == "block" else "success",
                                "note": f"write-scope {decision} {tool} {path}"[:500]}, ensure_ascii=False) + "\n")
    except Exception:
        pass

if not fp:
    if tool in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
        trace("block", "<empty file_path>")
        print("BLOCKED (ФЕНИКС Hard Rule 4 / feniks-write-scope): пишущий инструмент без file_path.", file=sys.stderr)
        sys.exit(2)
    sys.exit(0)

p = fp if os.path.isabs(fp) else os.path.join(root, fp)
real = os.path.realpath(p)
if allowed(real):
    trace("allow", real)
    sys.exit(0)

trace("block", real)
print(f"BLOCKED (ФЕНИКС Hard Rule 4 / feniks-write-scope): запись в '{real}' запрещена. ФЕНИКС пишет только отчёты и диспуты (knowledge/episodes/**, knowledge/reflexion/**), трейсы (traces/**), свою память (.claude/agent-memory/feniks/**) и черновики в /tmp. Правки продукта делает автор по rework_tz.", file=sys.stderr)
sys.exit(2)
PY
exit $?
