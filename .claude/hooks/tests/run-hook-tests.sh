#!/usr/bin/env bash
# run-hook-tests.sh - регрессионный тест гейтов ФЕНИКСА, deliver-gate и датчика context-meter (условие мержа любой правки хуков).
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
    *) echo "unknown hook $hook"; continue ;;
  esac
  if [[ "$rc" == "$expect" ]]; then
    pass=$((pass+1)); [[ -n "$VERBOSE" ]] && echo "ok   [$hook|$agent] $input -> $rc"
  else
    fail=$((fail+1)); echo "FAIL [$hook|$agent] $input -> $rc (expect $expect)"
  fi
done < "$HERE/scope-cases.tsv"

# context-meter (датчик переезда): порог SOFT 150K, HARD 200K, битый ввод и «без переезда» молчат, rc всегда 0.
cm() {  # $1 имя, $2 контекст в токенах, $3 ожидаемая подстрока или "-" (тишина), $4 prompt
  local tr="$FX/tr-$1.jsonl" ts out rc
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '{"type":"assistant","timestamp":"%s","message":{"usage":{"input_tokens":%s}}}\n' "$ts" "$2" > "$tr"
  out="$(python3 -c 'import json,sys; print(json.dumps({"transcript_path": sys.argv[1], "prompt": sys.argv[2]}))' "$tr" "$4" \
    | python3 "$REPO/.claude/hooks/context-meter.py" 2>/dev/null)"; rc=$?
  n=$((n+1))
  if [[ "$rc" == 0 && ( ( "$3" == "-" && -z "$out" ) || ( "$3" != "-" && "$out" == *"$3"* ) ) ]]; then
    pass=$((pass+1)); [[ -n "$VERBOSE" ]] && echo "ok   [context-meter] $1"
  else
    fail=$((fail+1)); echo "FAIL [context-meter] $1 -> rc=$rc out=${out:0:80}"
  fi
}
cm below-soft 120000 - "привет"
cm soft 170000 "Закончи текущий шаг" "привет"
cm hard 210000 "ОБЯЗАТЕЛЕН" "привет"
cm opt-out 210000 - "без переезда, продолжаем"
n=$((n+1)); out="$(printf 'not json' | python3 "$REPO/.claude/hooks/context-meter.py" 2>/dev/null)"; rc=$?
if [[ "$rc" == 0 && -z "$out" ]]; then pass=$((pass+1)); [[ -n "$VERBOSE" ]] && echo "ok   [context-meter] broken-json"; else fail=$((fail+1)); echo "FAIL [context-meter] broken-json -> rc=$rc"; fi
# Команда хука из settings.json при пустом CLAUDE_PROJECT_DIR не должна давать rc=2 (блок промпта).
n=$((n+1)); cmd="$(python3 -c 'import json,sys; print(next(h["command"] for g in json.load(open(sys.argv[1]))["hooks"]["UserPromptSubmit"] for h in g["hooks"] if "context-meter" in h["command"]))' "$REPO/.claude/settings.json")"
( cd "$REPO" && printf '{}' | env -u CLAUDE_PROJECT_DIR bash -c "$cmd" >/dev/null 2>&1 ); rc=$?
if [[ "$rc" == 0 ]]; then pass=$((pass+1)); [[ -n "$VERBOSE" ]] && echo "ok   [context-meter] settings-empty-project-dir"; else fail=$((fail+1)); echo "FAIL [context-meter] settings-empty-project-dir -> rc=$rc"; fi

rm -r "$FX"
echo "hook tests: $pass/$n passed, $fail failed"
[[ "$fail" -eq 0 ]]
