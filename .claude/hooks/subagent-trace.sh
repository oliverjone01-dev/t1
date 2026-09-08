#!/usr/bin/env bash
# subagent-trace.sh - Protocol 14 (Observability) executable.
# Fires on SubagentStart и SubagentStop. Пишет одну строку в traces/YYYY-MM-DD/agents.jsonl
# по схеме schemas/agent-trace.json. Никогда не блокирует (exit 0).
# Содержимое сообщений агента в трейс НЕ пишется (репозиторий публичный): только производные
# поля - outcome, verdict, feniks_score, длина сообщения.
# Трассируются только 13 агентов ростера (TIER ниже). Explore, general-purpose, claude-code-guide и
# внутренние субагенты харнесса (SubagentStop без строки start, agent_type не из ростера) строк не получают:
# до 2026-09-08 они давали 72 из 276 строк журнала на origin/main 7931b61 (agent unknown) и одну строку на каждый
# ход сессии, из-за чего рабочее дерево не бывало чистым. Отладка: P14_TRACE_NONROSTER=1 пишет и их (agent unknown).
# Имя агента нормализуется: регистр, префикс плагина `gengroup-roster:feniks` (только этот префикс, аудит 2026-09-08
# проба A6: `evil-plugin:feniks` личность ростера не получает), суффиксы `@synced` / `@gengroup-roster` /
# ` (gengroup-roster)` тоже только по whitelist: `feniks@evil-plugin` - не ростер (итерация 2).
# Внутренний субагент харнесса распознаётся по признаку «ключ agent_type есть, значение пустое, строки start нет».
# Всё остальное нераспознанное (ключа нет и сшивка не удалась, имя не разбирается) пишется как `agent: unroutable`
# с payload_keys - сигнал в журнал, не тишина. Если харнесс начнёт присылать непустой agent_type у внутренних
# субагентов, они проявятся как строки unroutable (видимый сигнал, не тихий шум): это ожидаемое поведение.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || true

EVENT="$(cat)"
[ -z "$EVENT" ] && exit 0

python3 - "$EVENT" <<'PY' 2>/dev/null || true
import json, os, re, sys, datetime, pathlib

try:
    d = json.loads(sys.argv[1])
except Exception:
    sys.exit(0)

name = (d.get("hook_event_name") or "").strip()
event = {"SubagentStart": "subagent_start", "SubagentStop": "subagent_stop"}.get(name)
if not event:
    sys.exit(0)

TIER = {"feniks": "0", "spartak": "chairman", "marco": "1", "data": "1",
        "viktor": "2", "boris": "2", "emma": "2",
        "maks": "3", "semyon": "3", "timur": "3", "krea": "3",
        "roman": "4", "trener": "4"}

now = datetime.datetime.now(datetime.timezone.utc)
out = pathlib.Path("traces") / now.strftime("%Y-%m-%d")
out.mkdir(parents=True, exist_ok=True)
log = out / "agents.jsonl"

PLUGIN_PREFIX = "gengroup-roster"  # единственный префикс, дающий личность ростера (проба A6, аудит 2026-09-08)
SUFFIX_AT = {"synced", "gengroup-roster", "gengroup"}  # feniks@synced, feniks@gengroup-roster (итерация 2: whitelist)
SUFFIX_PAREN = {"gengroup-roster"}                      # feniks (gengroup-roster)
DEBUG_ALL = os.environ.get("P14_TRACE_NONROSTER") == "1"

def norm(raw):
    """Имя агента -> (agent, status). status: ok | empty | foreign_prefix | unparseable."""
    a = str(raw if raw is not None else "").strip().lower()
    if not a:
        return "", "empty"
    if ":" in a:
        pre, _, a = a.rpartition(":")
        if pre.strip() != PLUGIN_PREFIX:
            return "", "foreign_prefix"  # evil-plugin:feniks, output-style:marco - не ростер
    if "@" in a:
        a, _, suf = a.partition("@")
        if suf.strip() not in SUFFIX_AT:
            return "", "foreign_prefix"  # feniks@evil-plugin - не ростер
    if " (" in a:
        a, _, suf = a.partition(" (")
        if suf.strip().rstrip(")").strip() not in SUFFIX_PAREN:
            return "", "foreign_prefix"  # feniks (evil-plugin) - не ростер
    a = a.strip()
    return (a, "ok") if re.match(r"^[a-z][a-z0-9-]*$", a) else ("", "unparseable")

has_type_key = "agent_type" in d or "agent_name" in d
agent, status = norm(d.get("agent_type") if "agent_type" in d else d.get("agent_name"))
agent_id = str(d.get("agent_id") or "")
stitched = False
if not agent and status != "foreign_prefix" and agent_id and log.exists():
    # SubagentStop может не нести agent_type (аудит 2026-09-06): сшиваем со строкой start по agent_id за те же сутки
    for line in reversed(log.read_text(encoding="utf-8").splitlines()):
        try:
            prev = json.loads(line)
        except Exception:
            continue
        if prev.get("event") == "subagent_start" and prev.get("agent_id") == agent_id and prev.get("agent") in TIER:
            agent, stitched = prev["agent"], True
            break
if not agent:
    if status == "foreign_prefix" and not DEBUG_ALL:
        sys.exit(0)  # чужой плагин с именем ростера - не ростер
    if status == "empty" and has_type_key and not DEBUG_ALL:
        sys.exit(0)  # внутренний субагент харнесса: ключ agent_type есть, значение пустое, строки start нет
    # ключа нет и сшивка не удалась, либо имя не разбирается: сигнал в журнал, не тишина (аудит 2026-09-08, gap 2)
    agent = "unknown" if DEBUG_ALL else "unroutable"
elif agent not in TIER and not DEBUG_ALL:
    sys.exit(0)  # explore / general-purpose / claude-code-guide - не ростер, строка не пишется

rec = {
    "ts": now.isoformat(timespec="seconds"),
    "event": event,
    "agent": agent,
    "tier": TIER.get(agent, "unknown"),
}
if d.get("session_id"):
    rec["session_id"] = str(d["session_id"])
if agent_id:
    rec["agent_id"] = agent_id
if stitched:
    rec["agent_source"] = "stitched_by_agent_id"
if agent in ("unknown", "unroutable"):
    rec["payload_keys"] = sorted(k for k in d.keys() if k not in ("last_assistant_message", "initial_prompt", "transcript_path"))[:12]
    rec["note"] = f"norm:{status}"

if event == "subagent_stop":
    msg = str(d.get("last_assistant_message") or "")
    rec["msg_chars"] = len(msg)
    if d.get("stop_reason"):
        rec["stop_reason"] = str(d["stop_reason"])[:80]
    m = re.search(r"VERDICT:\s*(go|return|veto|blocked|n/a)", msg, re.I)
    v = m.group(1).lower() if m else None
    if agent in ("unknown", "unroutable"):
        v = None  # вердикт и outcome нераспознанному агенту не приписываются
    if v in ("go", "return", "veto"):
        rec["verdict"] = v
    # outcome только по явным маркерам; «success по умолчанию» завышало метрики P15 (аудит 2026-09-06)
    if v in ("go", "return", "veto", "blocked"):
        rec["outcome"] = {"go": "success", "return": "returned", "veto": "vetoed", "blocked": "blocked"}[v]
    elif re.search(r"\bPARTIAL\b", msg):
        rec["outcome"] = "partial"
    elif re.search(r"(не выполнен|не удалось|упал|failed|error:|exception|traceback)", msg, re.I):
        rec["outcome"] = "error"
    elif v == "n/a":
        rec["outcome"] = "unknown"
    else:
        rec["outcome"] = "unknown"
    if re.search(r"\bPARTIAL\b", msg):
        rec["outcome"] = "partial"
    if agent == "feniks":  # feniks_score пишется только ФЕНИКСУ; «8.5/10» в тексте другого агента - не оценка
        # Оценка берётся из строки с VERDICT, иначе последнее вхождение по сообщению: первое вхождение подхватывало
        # цитаты чужих оценок из evidence (аудит 2026-09-08 iter2: записано 9.9 при фактических 7.7)
        WT = r"weighted_total\"?\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)"
        OF10 = r"\b([0-9](?:\.[0-9]{1,2})?)\s*/\s*10\b"
        vline = ""
        if m:
            le = msg.find("\n", m.end())
            vline = msg[m.start():le if le != -1 else len(msg)]  # от слова VERDICT до конца строки
        s = re.search(WT, vline) or re.search(OF10, vline)
        if not s:
            found = re.findall(WT, msg) or re.findall(OF10, msg)
            s = re.match(r"(.*)", found[-1]) if found else None
        if s:
            try:
                val = float(s.group(1))
                if 0 <= val <= 10:
                    rec["feniks_score"] = val
            except ValueError:
                pass
    c = re.search(r"CONFIDENCE:\s*([01](?:\.[0-9]+)?)", msg, re.I)
    if c:
        rec["confidence"] = float(c.group(1))

with log.open("a", encoding="utf-8") as f:
    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
PY
exit 0
