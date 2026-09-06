#!/usr/bin/env bash
# subagent-trace.sh - Protocol 14 (Observability) executable.
# Fires on SubagentStart и SubagentStop. Пишет одну строку в traces/YYYY-MM-DD/agents.jsonl
# по схеме schemas/agent-trace.json. Никогда не блокирует (exit 0).
# Содержимое сообщений агента в трейс НЕ пишется (репозиторий публичный): только производные
# поля - outcome, verdict, feniks_score, длина сообщения.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || true

EVENT="$(cat)"
[ -z "$EVENT" ] && exit 0

python3 - "$EVENT" <<'PY' 2>/dev/null || true
import json, re, sys, datetime, pathlib

try:
    d = json.loads(sys.argv[1])
except Exception:
    sys.exit(0)

name = (d.get("hook_event_name") or "").strip()
event = {"SubagentStart": "subagent_start", "SubagentStop": "subagent_stop"}.get(name)
if not event:
    sys.exit(0)

agent_raw = str(d.get("agent_type") or d.get("agent_name") or "unknown").strip().lower()
agent = agent_raw if re.match(r"^[a-z][a-z0-9-]*$", agent_raw) else "unknown"

TIER = {"feniks": "0", "spartak": "chairman", "marco": "1", "data": "1",
        "viktor": "2", "boris": "2", "emma": "2",
        "maks": "3", "semyon": "3", "timur": "3", "krea": "3",
        "roman": "4", "trener": "4"}

now = datetime.datetime.now(datetime.timezone.utc)
rec = {
    "ts": now.isoformat(timespec="seconds"),
    "event": event,
    "agent": agent,
    "tier": TIER.get(agent, "unknown"),
}
for k in ("session_id", "agent_id"):
    if d.get(k):
        rec[k] = str(d[k])

if event == "subagent_stop":
    msg = str(d.get("last_assistant_message") or "")
    rec["msg_chars"] = len(msg)
    if d.get("stop_reason"):
        rec["stop_reason"] = str(d["stop_reason"])[:80]
    m = re.search(r"VERDICT:\s*(go|return|veto|blocked|n/a)", msg, re.I)
    v = m.group(1).lower() if m else None
    if v in ("go", "return", "veto"):
        rec["verdict"] = v
    rec["outcome"] = {"go": "success", "return": "returned", "veto": "vetoed", "blocked": "blocked"}.get(v, "success" if msg else "unknown")
    if re.search(r"\bPARTIAL\b", msg):
        rec["outcome"] = "partial"
    s = re.search(r"weighted_total\"?\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)", msg) or re.search(r"\b([0-9](?:\.[0-9]{1,2})?)\s*/\s*10\b", msg)
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

out = pathlib.Path("traces") / now.strftime("%Y-%m-%d")
out.mkdir(parents=True, exist_ok=True)
with (out / "agents.jsonl").open("a", encoding="utf-8") as f:
    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
PY
exit 0
