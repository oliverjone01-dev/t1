#!/usr/bin/env bash
# run-hook-tests.sh - регрессионный тест гейтов ФЕНИКСА, deliver-gate и трейс-хука P14 (условие мержа любой правки хуков).
# Кейсы: .claude/hooks/tests/scope-cases.tsv (hook, expect, agent_type или `-`, input). Корень фикстуры создаётся
# ВНЕ /tmp (иначе всё разрешено по дизайну), удаляется после прогона. Exit 0 = все кейсы прошли.
# Usage: bash .claude/hooks/tests/run-hook-tests.sh [-v]
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
VERBOSE="${1:-}"
FX="$(mktemp -d "${HOME:-/home/user}/hooktest.XXXXXX")"
mkdir -p "$FX/knowledge/episodes/2026-09" "$FX/traces" "$FX/.claude/agents" "$FX/schemas" "$FX/.claude/agent-memory/feniks"
( cd "$FX" && git init -q . && echo x > CLAUDE.md && git add -A && git -c user.email=t@t -c user.name=t commit -q -m c1 ) || { echo "fixture repo failed"; exit 2; }

pass=0; fail=0; n=0
while IFS=$'\t' read -r hook expect agent input; do
  [[ -z "$hook" || "$hook" == \#* ]] && continue
  n=$((n+1))
  [[ "$agent" == "-" ]] && agent=""   # `-` в TSV = без agent_type (main-сессия); пустое поле схлопывается read'ом
  input="$(printf '%b' "$input")"   # \n в TSV -> перенос строки (heredoc-кейсы)
  case "$hook" in
    bash)
      ev="$(python3 -c 'import json,sys; print(json.dumps({"agent_type": sys.argv[1], "tool_name": "Bash", "tool_input": {"command": sys.argv[2]}}))' "$agent" "$input")"
      printf '%s' "$ev" | CLAUDE_PROJECT_DIR="$FX" bash "$REPO/.claude/hooks/feniks-bash-scope.sh" >/dev/null 2>&1; rc=$? ;;
    write)
      ev="$(python3 -c 'import json,sys; print(json.dumps({"agent_type": sys.argv[1], "tool_name": "Write", "tool_input": {"file_path": sys.argv[2]}}))' "$agent" "$input")"
      printf '%s' "$ev" | CLAUDE_PROJECT_DIR="$FX" bash "$REPO/.claude/hooks/feniks-write-scope.sh" >/dev/null 2>&1; rc=$? ;;
    deliver)
      ev="$(python3 -c 'import json,sys; print(json.dumps({"tool_name": "Bash", "tool_input": {"command": sys.argv[1]}}))' "$input")"
      out="$(printf '%s' "$ev" | CLAUDE_PROJECT_DIR="$FX" bash "$REPO/.claude/hooks/deliver-gate.sh" 2>/dev/null)"
      if printf '%s' "$out" | grep -q "Step 12.5 reminder"; then rc=1; else rc=0; fi ;;
    trace|trace-all)
      # agent = agent_type (`-` = отсутствует); input = JSON события (hook_event_name, agent_id, last_assistant_message).
      # Результат: `agent/outcome[/feniks_score][/note]` по добавленной строке журнала фикстуры или 0, если строка не записана.
      ev="$(python3 -c 'import json,sys; d=json.loads(sys.argv[2]); a=sys.argv[1]
if a: d["agent_type"]=a
print(json.dumps(d))' "$agent" "$input")"
      before="$(cat "$FX"/traces/*/agents.jsonl 2>/dev/null | wc -l)"
      if [[ "$hook" == "trace-all" ]]; then
        printf '%s' "$ev" | CLAUDE_PROJECT_DIR="$FX" P14_TRACE_NONROSTER=1 bash "$REPO/.claude/hooks/subagent-trace.sh" >/dev/null 2>&1
      else
        printf '%s' "$ev" | CLAUDE_PROJECT_DIR="$FX" bash "$REPO/.claude/hooks/subagent-trace.sh" >/dev/null 2>&1
      fi
      after="$(cat "$FX"/traces/*/agents.jsonl 2>/dev/null | wc -l)"
      if [[ "$after" -gt "$before" ]]; then
        rc="$(cat "$FX"/traces/*/agents.jsonl | tail -1 | python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(d["agent"]+"/"+str(d.get("outcome","-"))+("/"+str(d["feniks_score"]) if "feniks_score" in d else "")+("/"+d["note"] if d.get("note") else ""))')"
      else
        rc=0
      fi ;;
    *) echo "unknown hook $hook"; continue ;;
  esac
  if [[ "$rc" == "$expect" ]]; then
    pass=$((pass+1)); [[ -n "$VERBOSE" ]] && echo "ok   [$hook|$agent] $input -> $rc"
  else
    fail=$((fail+1)); echo "FAIL [$hook|$agent] $input -> $rc (expect $expect)"
  fi
done < "$HERE/scope-cases.tsv"

# Журнал фикстуры, записанный trace-кейсами, обязан проходить schemas/agent-trace.json (D4)
if ls "$FX"/traces/*/agents.jsonl >/dev/null 2>&1; then
  n=$((n+1))
  if cat "$FX"/traces/*/agents.jsonl | python3 "$REPO/schemas/validate.py" agent-trace --jsonl - >/dev/null 2>&1; then
    pass=$((pass+1)); [[ -n "$VERBOSE" ]] && echo "ok   [trace-schema] журнал фикстуры valid"
  else
    fail=$((fail+1)); echo "FAIL [trace-schema] журнал фикстуры не проходит schemas/agent-trace.json"
  fi
fi
rm -r "$FX"
echo "hook tests: $pass/$n passed, $fail failed"
[[ "$fail" -eq 0 ]]
