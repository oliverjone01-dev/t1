#!/usr/bin/env bash
# build_account_zip.sh - архив скилла для загрузки в аккаунт claude.ai (Settings > Skills).
# Кладёт снимок реестра из knowledge/errors/registry.jsonl в references/registry-snapshot.jsonl внутри архива.
# Usage: bash .claude/skills/data-guard/scripts/build_account_zip.sh [выходной.zip]
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
OUT="${1:-$ROOT/data-guard.zip}"
TMP="$(mktemp -d)"
cp -r "$ROOT/.claude/skills/data-guard" "$TMP/data-guard"
cp "$ROOT/knowledge/errors/registry.jsonl" "$TMP/data-guard/references/registry-snapshot.jsonl"
find "$TMP/data-guard" -name __pycache__ -prune -exec rm -r {} +
# в скилле аккаунта допустимы только name и description во frontmatter (проверка перед упаковкой)
python3 - "$TMP/data-guard/SKILL.md" <<'PY'
import sys, re
fm = open(sys.argv[1], encoding="utf-8").read().split("---")[1]
keys = re.findall(r"^([a-z_-]+):", fm, re.M)
bad = [k for k in keys if k not in ("name", "description", "license", "compatibility", "metadata", "allowed-tools")]
desc = re.search(r"^description: (.*)$", fm, re.M).group(1)
assert not bad, f"лишние поля frontmatter: {bad}"
assert len(desc) <= 1024, f"description {len(desc)} > 1024"
PY
( cd "$TMP" && rm -f "$OUT" && zip -qr "$OUT" data-guard )
rm -r "$TMP"
echo "$OUT"
