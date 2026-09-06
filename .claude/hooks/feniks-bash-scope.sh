#!/usr/bin/env bash
# feniks-bash-scope.sh - гейт записи ФЕНИКСА, второй эшелон: PreToolUse Bash.
# Закрывает вектор ATTACK B (проба A2, аудит 2026-09-06): `echo > .claude/agents/marco.md` из Bash.
# Блокирует (exit 2), если команда (а) содержит git-операции записи (add/commit/push/checkout/reset/...),
# или (б) содержит признак записи (перенаправление, tee/cp/mv/rm/sed -i/touch/chmod/mkdir/..., write-API python/node)
# и хотя бы одна path-подобная цель лежит вне разрешённых зон (knowledge/episodes, knowledge/reflexion, traces,
# .claude/agent-memory/feniks, /tmp, /dev/null). Пути нормализуются realpath.
# Честное ограничение: это string-эвристика. Известные классы обхода (аудит 2026-09-06, итерации 1-2):
#   (1) скрипт-посредник: `bash /tmp/x.sh`, `python3 /tmp/x.py`, которые пишут внутрь проекта;
#   (2) интерпретатор с кодом из stdin/heredoc без узнаваемого write-API (например, `os.system` внутри python);
#   (3) переменные и подстановки, собирающие имя команды или путь по частям (`$(printf ...)`, `${V}`);
#   (4) редкие инструменты записи вне списка WRITE_CMD/DANGEROUS (любой бинарник с побочной записью).
# Поэтому третий эшелон - Stop-хук approvals-state-monitor и `git status --porcelain` в отчёте ФЕНИКСА:
# гейт снижает вероятность ошибки, а не гарантирует её отсутствие. Read-only команды (grep/cat/git log ...)
# не проверяются на «git add» и «cp» внутри аргументов - только на перенаправления.
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

GIT_WRITE = re.compile(r"(^|[^A-Za-z0-9_/.-])([^\s'\"]*/)?git(\s+(-[^\s]+|-C\s+[^\s]+))*\s+(add|commit|push|checkout|switch|reset|rm|mv|stash|apply|am|rebase|merge|cherry-pick|clean|restore|tag|notes|filter-branch|update-ref|worktree)(?![A-Za-z0-9_-])")
READONLY_HEAD = re.compile(r"^\s*(grep|rg|egrep|fgrep|cat|head|tail|less|more|echo|printf|wc|diff|cmp|ls|stat|file|which|type|env|date|uniq|cut|tr|jq|xxd|od|bash\s+-n|node\s+--check|python3\s+-m\s+py_compile|python3\s+schemas/validate\.py|python3\s+schemas/smoke-test\.py|git\s+(log|diff|status|show|blame|rev-parse|merge-base|ls-files|ls-tree|branch(\s+-[av]+)?|remote(\s+-v)?|describe|cat-file|shortlog|rev-list|count-objects|config\s+--get|fetch))(\s|$)")
def strip_quotes(text):
    # строковые литералы с экранированными кавычками: "print(\"git add\")" - это строка, не команда
    return re.sub(r"'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\"", "''", text)

segments_all = re.split(r"\|\||&&|[;|\n]", cmd)
WRAPPER_HEAD = re.compile(r"^\s*(bash|sh|zsh|dash|eval|env|nohup|time|xargs|sudo|command|exec)\b")
for seg in segments_all:
    if READONLY_HEAD.match(seg):
        continue  # `grep -rn 'git add'`, `git merge-base` - чтение
    probe_text = seg if WRAPPER_HEAD.match(seg) else strip_quotes(seg)  # `bash -c "git push"` - исполнение, `python3 -c "print('git add')"` - строка
    if GIT_WRITE.search(probe_text):
        block("git-операции записи ФЕНИКСУ запрещены (коммит делает автор)")

# Перенаправления: `> f`, `>> f`, `1> f`, `2> f`, `&> f`, `>| f`; исключаем `>&2`, `2>&1`, `<>`. Проба `1>` (итерация 2, 2026-09-06).
REDIRECT = re.compile(r"(?<![<])(?:[0-9]*|&)>{1,2}(?!&)\s*([^\s;&|)]+)")
WRITE_CMD = re.compile(r"(^|[\s;|&(])(tee|cp|mv|rm|touch|chmod|chown|ln|dd|patch|install|truncate|shred|mkdir|rmdir|unzip|wget|rsync)\b|\bsed\s+(-[a-zA-Z]*i|--in-place)|\btar\s+[a-z-]*x|\bcurl\b[^|;]*\s-[oO]\b")
DANGEROUS = re.compile(r"\bfind\b[^|;]*\s-(delete|exec|execdir|ok)\b|\bsort\b[^|;]*\s-o\b|\b(perl|ruby)\b[^|;]*\s-[a-zA-Z]*i\b|(^|[\s;|&(])(ex|vi|vim|nvim|ed|nano|emacs)\s|\bxargs\b[^|;]*\b(rm|mv|cp|sed|tee|truncate)\b|\bg?awk\b[^|;]*-i\s*inplace")
WRITE_API = re.compile(r"write_text\(|write_bytes\(|\.write\(|open\([^)]*['\"][wax]|shutil\.|os\.(remove|unlink|rename|replace|makedirs|mkdir|rmdir)|Path\([^)]*\)\.(unlink|rename|touch|mkdir|write)|fs\.(write|append|unlink|rename|mkdir|rm)|writeFileSync|copyFileSync")
PATH_TOKEN = re.compile(r"(?<![A-Za-z0-9_@])((?:\.{1,2}/|/|~/|[A-Za-z0-9_.-]+/)[A-Za-z0-9_./{}%:-]*)")

def resolve(tok):
    tok = tok.strip("'\"`")
    if "://" in tok or tok.startswith("-"):
        return None
    if re.fullmatch(r"[0-9]+(\.[0-9]+)?", tok):
        return None  # `print(1 > 0)`: числовая «цель» - это сравнение в коде, не файл
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
cmd_norm = re.sub(r">\|", ">", cmd)  # `>|` (noclobber override) - та же запись; иначе разбиение по `|` прячет цель
segments = re.split(r"\|\||&&|[;|\n]", cmd_norm)
strict = []  # цели DANGEROUS-команд: должны существовать и все лежать в зонах
for seg in segments:
    for m in REDIRECT.finditer(seg):
        targets.append(m.group(1))
    if READONLY_HEAD.match(seg):
        continue
    if DANGEROUS.search(seg):
        toks = [t for t in PATH_TOKEN.findall(seg)] + [t for t in FILE_TOKEN.findall(seg)]
        toks += [w for w in re.split(r"\s+", seg.strip()) if w in (".", "..")]
        if not toks:
            block(f"команда с побочной записью без явного пути (find -delete / sort -o / perl -i / ex / xargs): {seg.strip()[:80]}")
        strict += toks
    if WRITE_CMD.search(seg):
        targets += seg_tokens(seg)
QUOTED_FILE = re.compile(r"['\"]([^'\"\n]*?[A-Za-z0-9_-]+\.[A-Za-z0-9]{1,6})['\"]")  # 'a/b.md', "out.json" внутри кода
if WRITE_API.search(cmd):
    targets += [t for t in PATH_TOKEN.findall(cmd)] + [t for t in QUOTED_FILE.findall(cmd)]

bad = []
for t in targets + strict:
    r = resolve(t)
    if r and not allowed(r):
        bad.append(r)
if bad:
    block("запись вне разрешённых зон: " + ", ".join(sorted(set(bad))[:5]))
if (targets or strict) and os.environ.get("FENIKS_GATE_TRACE_ALL") == "1":
    trace("allow", "targets " + ", ".join(sorted(set(targets + strict))[:5]))
sys.exit(0)
PY
exit $?
