#!/usr/bin/env bash
# Выгрузка плагина gengroup-roster из текущей ветки (обычно main) в лёгкую ветку `plugin`.
# Зачем: Claude Desktop → Customize → Plugins → Add marketplace клонирует репозиторий целиком,
# а main с историей аналитики весит сотни мегабайт и sync падает. Ветка plugin содержит только
# манифесты, agents/, skills из plugin.json, .claude/hooks, workflow council и schemas (< 1 МБ).
# Использование: bash .claude-plugin/export-plugin.sh                 # собрать и закоммитить в ветку plugin локально
#               bash .claude-plugin/export-plugin.sh --push          # и запушить origin/plugin
#               bash .claude-plugin/export-plugin.sh --repo <url> [--push]
#                   # зеркало в отдельный маленький репозиторий: Desktop → Customize → Add marketplace принимает
#                   # только owner/repo и клонирует ветку по умолчанию, а t1 весит ~500 МБ и sync падает.
#                   # Раскладка зеркала: .claude-plugin/marketplace.json (source ./plugins/gengroup-roster) +
#                   # plugins/gengroup-roster/<плагин> + README.md. Ветка main.
# Ветку plugin и зеркало руками не править: следующий запуск перезапишет содержимое.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${PLUGIN_BRANCH:-plugin}"
PUSH=""; MIRROR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --push) PUSH=1 ;;
    --repo) MIRROR="$2"; shift ;;
    --repo=*) MIRROR="${1#--repo=}" ;;
    *) echo "неизвестный аргумент: $1" >&2; exit 2 ;;
  esac
  shift
done
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

if [ -n "$MIRROR" ]; then
  # ---- режим зеркала: отдельный репозиторий, ветка main ----
  if git clone -q --depth 1 "$MIRROR" "$TMP/mirror" 2>/dev/null; then
    git -C "$TMP/mirror" checkout -q -B main
  else
    mkdir -p "$TMP/mirror" && git -C "$TMP/mirror" init -q -b main && git -C "$TMP/mirror" remote add origin "$MIRROR"
  fi
  python3 - "$TMP/payload" "$TMP/mirror" "$MIRROR" <<'PY'
import json, os, shutil, sys
src, wt, url = sys.argv[1], sys.argv[2], sys.argv[3]
for name in os.listdir(wt):
    if name in (".git", "README.md"): continue
    p = os.path.join(wt, name)
    shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
plug = os.path.join(wt, "plugins", "gengroup-roster")
os.makedirs(plug)
for name in os.listdir(src):
    s, d = os.path.join(src, name), os.path.join(plug, name)
    shutil.copytree(s, d) if os.path.isdir(s) else shutil.copy(s, d)
os.remove(os.path.join(plug, ".claude-plugin", "marketplace.json"))  # маркетплейс живёт в корне зеркала
mk = json.load(open(os.path.join(src, ".claude-plugin", "marketplace.json"), encoding="utf-8"))
for pl in mk["plugins"]:
    pl["source"] = "./plugins/" + pl["name"]
web = url.replace("git@github.com:", "https://github.com/").removesuffix(".git")
if web.startswith("https://github.com/"):
    mk.setdefault("owner", {})["url"] = web
os.makedirs(os.path.join(wt, ".claude-plugin"), exist_ok=True)
with open(os.path.join(wt, ".claude-plugin", "marketplace.json"), "w", encoding="utf-8") as f:
    json.dump(mk, f, ensure_ascii=False, indent=2); f.write("\n")
pj = json.load(open(os.path.join(plug, ".claude-plugin", "plugin.json"), encoding="utf-8"))
short = web.removeprefix("https://github.com/")
if not os.path.exists(os.path.join(wt, "README.md")):
    with open(os.path.join(wt, "README.md"), "w", encoding="utf-8") as f:
        f.write("# gengroup-roster - маркетплейс плагина GENGROUP AI Roster v3\n\n"
                "Зеркало плагина из репозитория `oliverjone01-dev/t1` (ветка `plugin`); собирается скриптом "
                "`.claude-plugin/export-plugin.sh --repo <url> --push`. Руками не править.\n\n"
                "Установка. Claude Desktop → Customize → Plugins → Add marketplace → `" + short + "` → Sync → "
                "установить `gengroup-roster`. Claude Code: `/plugin marketplace add " + short + "`, затем "
                "`/plugin install gengroup-roster@gengroup`.\n\n"
                "Содержимое `plugins/gengroup-roster/`: 13 агентов ростера, skills, хуки Protocols 6/9/14, workflow council, схемы A2A.\n")
print("зеркало:", sum(len(f) for _, _, f in os.walk(plug)), "файлов плагина, версия", pj.get("version"))
PY
  claude plugin validate "$TMP/mirror/.claude-plugin/marketplace.json" >/dev/null 2>&1 || { echo "marketplace.json зеркала не проходит validate" >&2; exit 1; }
  cd "$TMP/mirror"
  if [ -n "$(git status --porcelain)" ]; then
    VER="$(python3 -c 'import json;print(json.load(open("plugins/gengroup-roster/.claude-plugin/plugin.json"))["version"])')"
    git add -A
    git -c core.hooksPath=/dev/null commit -q -m "plugin: gengroup-roster ${VER} из t1 $(git -C "$ROOT" rev-parse --abbrev-ref HEAD)@$(git -C "$ROOT" rev-parse --short HEAD)"
    echo "зеркало обновлено: $(git rev-parse --short HEAD)"
    if [ -n "$PUSH" ]; then git push -u origin main; fi
  else
    echo "зеркало уже соответствует $(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
  fi
  exit 0
fi

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
  if [ -n "$PUSH" ]; then git push -u origin "$BRANCH"; fi
else
  echo "ветка $BRANCH уже соответствует $(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
fi
