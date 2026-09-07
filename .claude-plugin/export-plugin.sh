#!/usr/bin/env bash
# Выгрузка плагина gengroup-roster из текущей ветки (обычно main) в лёгкую ветку `plugin`.
# Зачем: Claude Desktop → Customize → Plugins → Add marketplace клонирует репозиторий целиком,
# а main с историей аналитики весит сотни мегабайт и sync падает. Ветка plugin содержит только
# манифесты, agents/, skills из plugin.json, .claude/hooks, workflow council и schemas (< 1 МБ).
# Использование: bash .claude-plugin/export-plugin.sh          # собрать и закоммитить локально
#               bash .claude-plugin/export-plugin.sh --push   # и запушить origin/plugin
# Ветку plugin руками не править: следующий запуск перезапишет её содержимое.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${PLUGIN_BRANCH:-plugin}"
TMP="$(mktemp -d)"
cleanup() { git -C "$ROOT" worktree remove --force "$TMP/wt" >/dev/null 2>&1 || true; rm -r "$TMP"; }
trap cleanup EXIT
cd "$ROOT"

python3 - "$ROOT" "$TMP/payload" <<'PY'
import json, os, shutil, sys
root, dst = sys.argv[1], sys.argv[2]
IGN = shutil.ignore_patterns("__pycache__", "*.pyc", ".DS_Store")
pj = json.load(open(os.path.join(root, ".claude-plugin/plugin.json"), encoding="utf-8"))
os.makedirs(os.path.join(dst, ".claude-plugin"), exist_ok=True)
for f in ("plugin.json", "marketplace.json"):
    shutil.copy(os.path.join(root, ".claude-plugin", f), os.path.join(dst, ".claude-plugin", f))
shutil.copytree(os.path.join(root, "agents"), os.path.join(dst, "agents"), ignore=IGN)
for s in pj.get("skills", []):
    shutil.copytree(os.path.join(root, s), os.path.join(dst, s), ignore=IGN)
shutil.copytree(os.path.join(root, ".claude/hooks"), os.path.join(dst, ".claude/hooks"), ignore=IGN)
for w in pj.get("workflows", []):
    os.makedirs(os.path.dirname(os.path.join(dst, w)), exist_ok=True)
    shutil.copy(os.path.join(root, w), os.path.join(dst, w))
shutil.copytree(os.path.join(root, "schemas"), os.path.join(dst, "schemas"), ignore=IGN)
print("payload:", sum(len(f) for _, _, f in os.walk(dst)), "файлов, версия", pj.get("version"))
PY

git fetch -q origin "$BRANCH" 2>/dev/null || true
if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git worktree add -q "$TMP/wt" -B "$BRANCH" "origin/$BRANCH"
else
  git worktree add -q --detach "$TMP/wt" HEAD
  ( cd "$TMP/wt" && git checkout -q --orphan "$BRANCH" && git rm -rq --cached . && find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -r {} + )
fi

python3 - "$TMP/payload" "$TMP/wt" <<'PY'
import os, shutil, sys
src, wt = sys.argv[1], sys.argv[2]
for name in os.listdir(wt):
    if name in (".git", "README.md"): continue
    p = os.path.join(wt, name)
    shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
for name in os.listdir(src):
    s, d = os.path.join(src, name), os.path.join(wt, name)
    shutil.copytree(s, d) if os.path.isdir(s) else shutil.copy(s, d)
PY

cd "$TMP/wt"
if [ -n "$(git status --porcelain)" ]; then
  VER="$(python3 -c 'import json;print(json.load(open(".claude-plugin/plugin.json"))["version"])')"
  git add -A
  git -c core.hooksPath=/dev/null commit -q -m "plugin: выгрузка gengroup-roster ${VER} из $(git -C "$ROOT" rev-parse --abbrev-ref HEAD)@$(git -C "$ROOT" rev-parse --short HEAD)"
  echo "ветка $BRANCH обновлена: $(git rev-parse --short HEAD)"
  if [ "${1:-}" = "--push" ]; then git push -u origin "$BRANCH"; fi
else
  echo "ветка $BRANCH уже соответствует $(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
fi
