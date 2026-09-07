#!/usr/bin/env bash
# feniks-bash-scope.sh - гейт записи ФЕНИКСА, второй эшелон: PreToolUse Bash.
# Закрывает вектор ATTACK B (проба A2, аудит 2026-09-06): `echo > .claude/agents/marco.md` из Bash.
# Блокирует (exit 2), если команда (а) содержит git-операции записи (add/commit/push/checkout/reset/...),
# или (б) содержит признак записи (перенаправление, tee/cp/mv/rm/sed -i/touch/chmod/mkdir/..., write-API python/node)
# и хотя бы одна path-подобная цель лежит вне разрешённых зон (knowledge/episodes, knowledge/reflexion, traces,
# .claude/agent-memory/feniks, /tmp, /dev/null). Пути нормализуются realpath.
# Честное ограничение: это string-эвристика; скрипт-посредник (`bash /tmp/x.sh`, который пишет куда угодно)
# она не видит. Поэтому третий эшелон - Stop-хук approvals-state-monitor и git status в отчёте ФЕНИКСА.
# Регистрация: project-level (по agent_type=feniks) и agent-scoped (--force).

set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
FORCE="${1:-}"
EVENT="$(cat)"

python3 - "$ROOT" "$FORCE" "$EVENT" <<'PY'
import sys, json, os, re, datetime

root = os.path.realpath(sys.argv[1])
force = sys.argv[2] == "--force"
try:
    d = json.loads(sys.argv[3])
except Exception:
    sys.exit(0)
agent = str(d.get("agent_type") or d.get("agent_name") or "").strip().lower()
if not force and agent != "feniks":
    sys.exit(0)
cmd = str((d.get("tool_input") or {}).get("command") or "")
if not cmd.strip():
    sys.exit(0)

PROJECT_ZONES = [os.path.realpath(os.path.join(root, x)) for x in
                 ("knowledge/episodes", "knowledge/reflexion", "traces", ".claude/agent-memory/feniks")]
OUTSIDE_OK = ["/tmp", "/dev/null", "/dev/stdout", "/dev/stderr"]

def trace(decision, why):
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        out = os.path.join(root, "traces", now.strftime("%Y-%m-%d"))
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, "agents.jsonl"), "a", encoding="utf-8") as f:
            f.write(json.dumps({"ts": now.isoformat(timespec="seconds"), "event": "gate", "agent": "feniks",
                                "tier": "0", "outcome": "blocked" if decision == "block" else "success",
                                "note": f"bash-scope {decision} {why}"[:500]}, ensure_ascii=False) + "\n")
    except Exception:
        pass

def block(msg):
    trace("block", msg)
    print(f"BLOCKED (ФЕНИКС Hard Rule 4 / feniks-bash-scope): {msg}. Разрешённые зоны записи: knowledge/episodes/**, knowledge/reflexion/**, traces/**, .claude/agent-memory/feniks/**, /tmp/**.", file=sys.stderr)
    sys.exit(2)

GIT_WRITE = re.compile(r"(^|[^A-Za-z0-9_/.-])([^\s'\"]*/)?git(\s+(-[^\s]+|-C\s+[^\s]+))*\s+(add|commit|push|checkout|switch|reset|rm|mv|stash|apply|am|rebase|merge|cherry-pick|clean|restore|tag|notes|filter-branch|update-ref|worktree)\b")
if GIT_WRITE.search(cmd):
    block("git-операции записи ФЕНИКСУ запрещены (коммит делает автор)")

REDIRECT = re.compile(r"(?<![0-9&<])>{1,2}(?!&)\s*([^\s;&|)]+)")
WRITE_CMD = re.compile(r"(^|[\s;|&(])(tee|cp|mv|rm|touch|chmod|chown|ln|dd|patch|install|truncate|shred|mkdir|rmdir|unzip|wget|rsync)\b|\bsed\s+(-[a-zA-Z]*i|--in-place)|\btar\s+[a-z-]*x|\bcurl\b[^|;]*\s-[oO]\b")
WRITE_API = re.compile(r"write_text\(|write_bytes\(|\.write\(|open\([^)]*['\"][wax]|shutil\.|os\.(remove|unlink|rename|replace|makedirs|mkdir|rmdir)|Path\([^)]*\)\.(unlink|rename|touch|mkdir|write)|fs\.(write|append|unlink|rename|mkdir|rm)|writeFileSync|copyFileSync")
PATH_TOKEN = re.compile(r"(?<![A-Za-z0-9_@])((?:\.{1,2}/|/|~/|[A-Za-z0-9_.-]+/)[A-Za-z0-9_./{}%:-]*)")

def resolve(tok):
    tok = tok.strip("'\"`")
    if "://" in tok or tok.startswith("-"):
        return None
    if tok.startswith("~/"):
        tok = os.path.expanduser(tok)
    tok = re.split(r"[{%]", tok)[0] or tok  # `traces/{d:%Y}` -> `traces/`
    p = tok if os.path.isabs(tok) else os.path.join(root, tok)
    return os.path.realpath(p)

def allowed(real):
    inside = real == root or real.startswith(root + os.sep)
    if inside:
        return any(real == z or real.startswith(z + os.sep) for z in PROJECT_ZONES)
    return any(real == a or real.startswith(a + os.sep) for a in OUTSIDE_OK)

FILE_TOKEN = re.compile(r"(?<![A-Za-z0-9_@/.=-])([A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+)(?![A-Za-z0-9_/])")  # CLAUDE.md, v2.py (без слэша)
COPY_LIKE = re.compile(r"(^|[\s;|&(])(cp|mv|install|rsync)\b")
TEE = re.compile(r"(^|[\s;|&(])tee\b(.*)$")

def seg_tokens(seg):
    """Кандидаты в цели записи для сегмента с командой записи."""
    toks = [t for t in PATH_TOKEN.findall(seg)] + [t for t in FILE_TOKEN.findall(seg)]
    if COPY_LIKE.search(seg):
        # cp/mv/install/rsync: цель - последний не-опциональный аргумент; источник читается, не пишется
        words = [w for w in re.split(r"\s+", seg.strip()) if w and not w.startswith("-")]
        return [words[-1]] if len(words) >= 3 else toks
    m = TEE.search(seg)
    if m:
        return [w for w in re.split(r"\s+", m.group(2).strip()) if w and not w.startswith("-") and w not in ("<", ">")]
    return toks

targets = []
segments = re.split(r"\|\||&&|[;|\n]", cmd)
for seg in segments:
    for m in REDIRECT.finditer(seg):
        targets.append(m.group(1))
    if WRITE_CMD.search(seg):
        targets += seg_tokens(seg)
if WRITE_API.search(cmd):
    targets += [t for t in PATH_TOKEN.findall(cmd)] + [t for t in FILE_TOKEN.findall(cmd)]

bad = []
for t in targets:
    r = resolve(t)
    if r and not allowed(r):
        bad.append(r)
if bad:
    block("запись вне разрешённых зон: " + ", ".join(sorted(set(bad))[:5]))
if targets:
    trace("allow", "targets " + ", ".join(sorted(set(targets))[:5]))
sys.exit(0)
PY
exit $?
