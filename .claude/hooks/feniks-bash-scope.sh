#!/usr/bin/env bash
# feniks-bash-scope.sh - гейт записи ФЕНИКСА, второй эшелон: PreToolUse Bash.
# Закрывает вектор ATTACK B (проба A2): `echo > .claude/agents/marco.md`, `cp`, `sed -i`, `find -delete`, `sort -o`,
# `perl -i`, `ex`, `xargs rm`, write-API python/node, git-операции записи - из Bash ФЕНИКСА.
# Блокирует (exit 2), если команда пишет вне зон: knowledge/episodes, knowledge/reflexion, traces,
# .claude/agent-memory/feniks (внутри проекта) и /tmp, /dev/null (вне проекта). Пути нормализуются realpath.
#
# Порядок разбора каждого сегмента (`|`, `;`, `&&`, `||`, перенос строки):
#   1. снять обёртки-исполнители: env [VAR=v ...], command, exec, time, nohup, nice, sudo, xargs, bash/sh -c "...", eval "..."
#      (тело в кавычках разбирается как вложенная команда: `env cp a b` == `cp a b`, `bash -c "git push"` == `git push`);
#   2. git-операции записи -> блок (коммит делает автор);
#   3. перенаправления (`>`, `>>`, `N>`, `&>`, `>|`) ищутся в тексте БЕЗ строковых литералов: `echo 'k -> v'` не запись;
#   4. read-only голова (grep/cat/git log/...) - дальше не проверяется; иначе:
#   5. DANGEROUS-команды (find -delete/-exec rm, sort -o, perl/ruby -i, ex/vi/ed, xargs rm) - явная цель извлекается
#      по правилам команды (аргумент -o, файлы после выражения, стартовые пути find), без требования расширения;
#   6. WRITE_CMD (cp/mv/rm/tee/touch/chmod/mkdir/sed -i ...) - цели: path-токены и имена с расширением; для cp/mv - последний аргумент;
#   7. write-API в коде (open(...,'w'), Path(...).write_text, fs.writeFileSync ...) - первый аргумент вызова в кавычках.
#
# Известные классы обхода (задокументированный остаточный риск, аудит 2026-09-06, итерации 1-3):
#   (1) скрипт-посредник: `bash /tmp/x.sh`, `python3 /tmp/x.py`, которые пишут внутрь проекта;
#   (2) интерпретатор с кодом без узнаваемого write-API (например, `os.system` внутри python, `subprocess`);
#   (3) переменные и подстановки, собирающие имя команды или путь по частям (`$(printf ...)`, `${V}`);
#   (4) редкий бинарник с побочной записью вне списков DANGEROUS/WRITE_CMD.
# Третий эшелон - Stop-хук approvals-state-monitor и `git status --porcelain` в отчёте ФЕНИКСА.
# Регрессионный тест: `bash .claude/hooks/tests/run-hook-tests.sh` (обязателен при любой правке этого файла).
# Регистрация: project-level по agent_type=feniks (settings.json) и agent-scoped с --force (feniks.md).
# Трейс: только блокировки (event=gate); allow - при FENIKS_GATE_TRACE_ALL=1.

set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
FORCE="${1:-}"
EVENT="$(cat)"

python3 - "$ROOT" "$FORCE" "$EVENT" <<'PY'
import sys, json, os, re, shlex, datetime

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

def allowed(real):
    inside = real == root or real.startswith(root + os.sep)
    if inside:
        return any(real == z or real.startswith(z + os.sep) for z in PROJECT_ZONES)
    return any(real == a or real.startswith(a + os.sep) for a in OUTSIDE_OK)

def resolve(tok):
    tok = tok.strip("'\"`")
    if not tok or "://" in tok or tok.startswith("-") or tok in ("{}", "\;", ";", "+", "/"):
        return None  # одиночный `/` - оператор деления (pathlib `p / "x"`), не корень ФС
    if re.fullmatch(r"[0-9]+(\.[0-9]+)?", tok):
        return None  # числовая «цель» - сравнение в коде
    if any(ch in tok for ch in "*?[") or tok.startswith("$"):
        return None  # glob-паттерны и переменные - не адрес (класс обхода 3 признан в шапке)
    if tok.startswith("~/"):
        tok = os.path.expanduser(tok)
    tok = re.split(r"[{%]", tok)[0] or tok  # `traces/{d:%Y}` -> `traces/`
    p = tok if os.path.isabs(tok) else os.path.join(root, tok)
    return os.path.realpath(p)

def strip_quotes(text):
    return re.sub(r"'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\"", "''", text)

def words_of(seg):
    try:
        return shlex.split(seg, posix=True)
    except ValueError:
        return seg.split()

WRAPPERS = {"env", "command", "exec", "time", "nohup", "nice", "sudo", "builtin"}
SHELL_C = re.compile(r"^\s*(bash|sh|zsh|dash|ksh)\s+(-[a-zA-Z]*c[a-zA-Z]*)\s+(.+)$", re.S)
EVAL = re.compile(r"^\s*eval\s+(.+)$", re.S)

def unwrap(seg, depth=0):
    """Снять исполнители-обёртки; вернуть (сегмент, список вложенных команд для отдельного разбора)."""
    nested = []
    s = seg.strip()
    for _ in range(6):
        m = SHELL_C.match(s) or EVAL.match(s)
        if m:
            body = m.group(m.lastindex)
            try:
                parts = shlex.split(body, posix=True)
            except ValueError:
                parts = [body.strip("'\"")]
            nested.append(parts[0] if parts else body)
            return "", nested
        w = words_of(s)
        if not w:
            return "", nested
        head = w[0]
        if head in WRAPPERS or (head == "sudo"):
            rest = w[1:]
            while rest and (re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", rest[0]) or rest[0].startswith("-")):
                rest = rest[1:]
            if not rest:
                return "", nested  # `env` сам по себе - чтение
            s = " ".join(shlex.quote(x) for x in rest)
            continue
        break
    return s, nested

GIT_WRITE = re.compile(r"(^|[\s;|&(])([^\s'\"]*/)?git(\s+(-[^\s]+|-C\s+[^\s]+|-c\s+[^\s]+))*\s+(add|commit|push|checkout|switch|reset|rm|mv|stash|apply|am|rebase|merge|cherry-pick|clean|restore|tag|notes|filter-branch|update-ref|worktree)(?![A-Za-z0-9_-])")
READONLY_HEAD = re.compile(r"^\s*(grep|rg|egrep|fgrep|cat|head|tail|less|more|echo|printf|wc|diff|cmp|ls|stat|file|which|type|date|uniq|cut|tr|jq|xxd|od|test|\[|true|false|pwd|basename|dirname|realpath|readlink|bash\s+-n|node\s+--check|python3\s+-m\s+py_compile|python3\s+schemas/validate\.py|python3\s+schemas/smoke-test\.py|python3\s+\.claude/skills/reflexion/scripts/trace-summary\.py|git\s+(log|diff|status|show|blame|rev-parse|merge-base|ls-files|ls-tree|branch(\s+-[av]+)?|remote(\s+-v)?|describe|cat-file|shortlog|rev-list|count-objects|config\s+--get|fetch|grep))(\s|$)")
REDIRECT = re.compile(r"(?<![<-])(?:[0-9]*|&)>{1,2}(?!&)\s*([^\s;&|)]+)")
DANGEROUS_KIND = [
    ("find", re.compile(r"^\s*find\b.*\s-(delete|execdir|exec|ok)\b.*", re.S)),
    ("sort", re.compile(r"^\s*sort\b.*\s-o\b", re.S)),
    ("perl", re.compile(r"^\s*(perl|ruby)\b.*\s-[a-zA-Z]*i\b", re.S)),
    ("editor", re.compile(r"^\s*(ex|vi|vim|nvim|ed|nano|emacs)\s", re.S)),
    ("awk", re.compile(r"^\s*g?awk\b.*-i\s*inplace", re.S)),
]
WRITE_CMD = re.compile(r"^\s*(tee|cp|mv|rm|touch|chmod|chown|ln|dd|patch|install|truncate|shred|mkdir|rmdir|unzip|wget|rsync|split|csplit|zip)\b|^\s*sed\s+(-[a-zA-Z]*i|--in-place)|^\s*tar\s+[a-z-]*x|^\s*curl\b.*\s-[oO]\b")
WRITE_API = re.compile(r"write_text\(|write_bytes\(|\.write\(|open\([^)]*['\"][wax]|shutil\.|os\.(remove|unlink|rename|replace|makedirs|mkdir|rmdir)|Path\([^)]*\)\.(unlink|rename|touch|mkdir|write)|fs\.(write|append|unlink|rename|mkdir|rm)|writeFileSync|copyFileSync")
CALL_ARG = re.compile(r"(?:\bopen|\bPath|os\.(?:remove|unlink|rename|replace|makedirs|mkdir|rmdir)|shutil\.\w+|fs\.\w+|writeFileSync|copyFileSync|appendFileSync)\(\s*['\"]([^'\"\n]+)['\"]")
PATH_TOKEN = re.compile(r"(?<![A-Za-z0-9_@])((?:\.{1,2}/|/|~/|[A-Za-z0-9_.-]+/)[A-Za-z0-9_./{}%:-]*)")
FILE_TOKEN = re.compile(r"(?<![A-Za-z0-9_@/.=-])([A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+)(?![A-Za-z0-9_/])")
FIND_VALUE_OPTS = {"-name", "-iname", "-path", "-ipath", "-regex", "-iregex", "-type", "-mtime", "-mmin", "-size", "-user", "-group", "-perm", "-newer", "-maxdepth", "-mindepth", "-printf", "-fprintf"}

def dangerous_targets(kind, seg):
    w = words_of(seg)
    if not w:
        return []
    if kind == "sort":
        return [w[i + 1] for i, x in enumerate(w) if x == "-o" and i + 1 < len(w)] + [x for x in w if x.startswith("-o") and len(x) > 2 and not x.startswith("--")]
    if kind == "perl":
        out, skip = [], False
        for x in w[1:]:
            if skip:
                skip = False
                continue
            if x in ("-e", "-E"):
                skip = True
                continue
            if x.startswith("-"):
                continue
            out.append(x)
        return out
    if kind == "editor":
        out, skip = [], False
        for x in w[1:]:
            if skip:
                skip = False
                continue
            if x in ("-c", "--cmd", "-S", "-u"):
                skip = True
                continue
            if x.startswith("-") or x.startswith("+"):
                continue
            out.append(x)
        return out
    if kind == "awk":
        return [x for x in w[1:] if not x.startswith("-") and x != "inplace" and not x.startswith("{")]
    if kind == "find":
        paths = []
        for x in w[1:]:
            if x.startswith("-"):
                break
            paths.append(x)
        return paths or ["."]
    return []

targets, strict = [], []
seen_nested = []

def analyze(segment, depth=0):
    seg, nested = unwrap(segment)
    for n in nested:
        if depth < 3:
            analyze(n, depth + 1)
    if not seg.strip():
        return
    if GIT_WRITE.search(strip_quotes(seg)) or GIT_WRITE.search(" " + seg.strip()) and not READONLY_HEAD.match(seg):
        if not READONLY_HEAD.match(seg):
            block("git-операции записи ФЕНИКСУ запрещены (коммит делает автор)")
    for m in REDIRECT.finditer(strip_quotes(seg)):
        targets.append(m.group(1))
    if READONLY_HEAD.match(seg):
        return
    for kind, rx in DANGEROUS_KIND:
        if rx.match(seg):
            # find -exec: опасен только с пишущей командой
            if kind == "find" and re.search(r"-exec(dir)?\s", seg) and not re.search(r"-(delete|ok)\b", seg) and not re.search(r"-exec(dir)?\s+(rm|mv|cp|sed|tee|chmod|chown|truncate|shred|ln|touch|dd)\b", seg):
                continue
            t = dangerous_targets(kind, seg)
            if not t:
                block(f"команда с побочной записью без явного пути ({kind}): {seg.strip()[:80]}")
            strict.extend(t)
    head = words_of(seg)[0] if words_of(seg) else ""
    if head == "xargs":
        rest = " ".join(words_of(seg)[1:])
        rest = re.sub(r"^(-[^\s]+\s+)*", "", rest)
        if rest and READONLY_HEAD.match(rest):
            return  # `xargs grep foo` - чтение
        block("xargs с пишущей командой ФЕНИКСУ запрещён (цели неизвестны до исполнения)")
    if WRITE_CMD.match(seg):
        w = words_of(seg)
        if w and w[0] in ("cp", "mv", "install", "rsync"):
            args = [x for x in w[1:] if not x.startswith("-")]
            targets.extend(args[-1:] if len(args) >= 2 else args)
        elif w and w[0] == "tee":
            targets.extend([x for x in w[1:] if not x.startswith("-")])
        elif w and w[0] == "sed":
            args, skip = [], False
            for x in w[1:]:
                if skip:
                    skip = False
                    continue
                if x in ("-e", "--expression", "-f"):
                    skip = True
                    continue
                if x.startswith("-") or re.match(r"^([0-9,$]*[sydpaic]|[sy])[/|#]", x):
                    continue
                args.append(x)
            targets.extend(args)
        else:
            targets.extend(PATH_TOKEN.findall(seg) + FILE_TOKEN.findall(seg))
            if w:
                targets.extend([x for x in w[1:] if not x.startswith("-")])
    if WRITE_API.search(seg):
        targets.extend(a for a in CALL_ARG.findall(seg) if not re.fullmatch(r"[rwaxbt+]{1,3}", a))
        ptoks = PATH_TOKEN.findall(seg)
        if ptoks:
            targets.extend(ptoks)

# сегментация: сначала снять `>|`, потом резать по операторам; heredoc-тело python остаётся внутри сегмента
cmd_norm = re.sub(r">\|", ">", cmd)
for segment in re.split(r"\|\||&&|[;|\n]", cmd_norm):
    analyze(segment)
# write-API в heredoc: разбор по всему тексту команды (тело может быть разрезано переносами)
if WRITE_API.search(cmd):
    targets.extend(a for a in CALL_ARG.findall(cmd) if not re.fullmatch(r"[rwaxbt+]{1,3}", a))

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
