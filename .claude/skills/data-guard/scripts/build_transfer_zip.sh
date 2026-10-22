#!/usr/bin/env bash
# build_transfer_zip.sh - полный пакет data-guard для переноса в другой аккаунт или репозиторий.
# Внутри: account/data-guard.zip (скилл для claude.ai Settings > Skills), repo/ (скилл + хуки + конфиг + реестр для
# Claude Code в другом репо), install.sh + merge_hooks.py (установка repo/ в целевой репозиторий с дописыванием хуков
# в settings.json), README.md (как ставить). Шаблоны лежат в transfer/.
# Usage: bash .claude/skills/data-guard/scripts/build_transfer_zip.sh [выходной.zip]
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
SK="$ROOT/.claude/skills/data-guard"
OUT="${1:-${TMPDIR:-/tmp}/data-guard-transfer.zip}"
TMP="$(mktemp -d)"
PK="$TMP/data-guard-transfer"
mkdir -p "$PK/account" "$PK/repo/.claude/skills" "$PK/repo/.claude/hooks/tests" "$PK/repo/knowledge/errors"

# Реестр живой, его формат чинится на рефлексии: ошибки валидации показываем, сборку не останавливаем.
python3 -B "$SK/scripts/registry_match.py" --validate | tail -1 >&2 || echo "ВНИМАНИЕ: реестр с ошибками формата (см. выше), пакет собран как есть" >&2
bash "$SK/scripts/build_account_zip.sh" "$PK/account/data-guard.zip" >/dev/null

cp -r "$SK" "$PK/repo/.claude/skills/data-guard"
find "$PK/repo/.claude/skills/data-guard" -name __pycache__ -prune -exec rm -r {} +
cp "$ROOT/knowledge/errors/registry.jsonl" "$PK/repo/.claude/skills/data-guard/references/registry-snapshot.jsonl"
cp "$ROOT/knowledge/errors/registry.jsonl" "$ROOT/knowledge/errors/README.md" "$PK/repo/knowledge/errors/"
cp "$ROOT/.claude/hooks/data-guard.py" "$PK/repo/.claude/hooks/"
cp "$ROOT/.claude/hooks/tests/data-guard-tests.py" "$PK/repo/.claude/hooks/tests/"
cp "$ROOT/.claude/data-guard.json" "$PK/repo/.claude/data-guard.json"
cp "$SK/transfer/install.sh" "$SK/transfer/merge_hooks.py" "$SK/transfer/README.md" "$PK/"
chmod +x "$PK/install.sh"

# Хуки data-guard из settings.json этого репо - отдельным файлом; install.sh дописывает их в settings.json цели.
python3 -I "$SK/transfer/extract_hooks.py" "$ROOT/.claude/settings.json" "$PK/repo/.claude/data-guard.hooks.json"

( cd "$TMP" && rm -f "$OUT" && zip -qr "$OUT" data-guard-transfer )
rm -r "$TMP"
echo "$OUT"
