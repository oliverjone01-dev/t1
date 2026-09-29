#!/usr/bin/env python3
"""data-guard.py - хуки-предупреждения скилла data-guard (.claude/skills/data-guard).

Режимы (первый аргумент): session-start | prompt | pre-bash | pre-edit | pre-mcp-merge | stop
Вход: JSON события Claude Code в stdin. Выход: JSON в stdout (hookSpecificOutput / systemMessage).
Сам ничего не отменяет: максимум permissionDecision "ask" (подтверждает пользователь).
Молчит, если в репо нет .claude/data-guard.json или задано DATA_GUARD_OFF=1.
Переопределение: DG_OVERRIDE="причина" в команде пишет причину в traces/<дата>/data-guard.jsonl; для сборки на main
снимает запрос, для слияния без go ФЕНИКСА не снимает (решает человек в окне подтверждения). Внутренняя ошибка = молча exit 0.
Настройки: .claude/data-guard.json. Тесты: python3 .claude/hooks/tests/data-guard-tests.py -v
"""
import datetime as dt
import glob
import hashlib
import json
import os
import re
import shlex
import subprocess
import sys

sys.dont_write_bytecode = True  # не оставлять __pycache__ в репо (иначе неотслеживаемые файлы)

ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
SKILL = os.path.join(ROOT, ".claude", "skills", "data-guard")
STATE_DIR = os.path.join(os.environ.get("TMPDIR", "/tmp"), "data-guard-state")
CFG_PATH = os.path.join(ROOT, ".claude", "data-guard.json")


def cfg():
    with open(CFG_PATH, encoding="utf-8") as f:
        return json.load(f)


def out(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False))


def git(*args):
    try:
        return subprocess.run(["git", "-C", ROOT, *args], capture_output=True, text=True, timeout=10).stdout.strip()
    except Exception:
        return ""


def branch():
    return git("rev-parse", "--abbrev-ref", "HEAD")


def glob_re(pattern):
    """analytics-mvp/public/**/*.html -> regex. ** = любые подпапки, * = в пределах папки."""
    i, res = 0, ""
    while i < len(pattern):
        if pattern.startswith("**/", i):
            res += "(?:.*/)?"
            i += 3
        elif pattern.startswith("**", i):
            res += ".*"
            i += 2
        elif pattern[i] == "*":
            res += "[^/]*"
            i += 1
        else:
            res += re.escape(pattern[i])
            i += 1
    return re.compile("^" + res + "$")


def rel(path):
    return os.path.relpath(os.path.abspath(os.path.join(ROOT, path)), ROOT) if path else ""


def matches_any(path, globs):
    r = rel(path)
    return any(glob_re(g).match(r) for g in globs)


def override_reason(text):
    m = re.search(r"DG_OVERRIDE=(?:\"([^\"]+)\"|'([^']+)'|(\S+))", text or "")
    return next((g for g in m.groups() if g), None) if m else None


def log_override(kind, reason, session_id):
    try:
        day = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
        d = os.path.join(ROOT, "traces", day)
        os.makedirs(d, exist_ok=True)
        rec = {"ts": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "tool": "data-guard",
               "event": "override", "kind": kind, "reason": reason[:300], "branch": branch()}
        if session_id:
            rec["session_id"] = session_id
        with open(os.path.join(d, "data-guard.jsonl"), "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except Exception:
        pass


def content_hash(rev="HEAD"):
    try:
        sys.path.insert(0, os.path.join(SKILL, "scripts"))
        import audit_hash  # noqa: E402
        return audit_hash.content_hash(False, cwd=ROOT, rev=rev)
    except Exception:
        return None


def feniks_go_for(rev, max_age_h):
    """Последний вердикт ФЕНИКСА (строки event: audit и subagent_stop) с audited_hash = хешу изменений rev,
    не старше max_age_h часов. go только если последний вердикт на этот хеш = go."""
    cur = content_hash(rev)
    if not cur:
        return False
    since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=max_age_h)
    last = None
    for f in sorted(glob.glob(os.path.join(ROOT, "traces", "*", "agents.jsonl")))[-5:]:
        try:
            lines = open(f, encoding="utf-8").read().splitlines()
        except Exception:
            continue
        for line in lines:
            try:
                r = json.loads(line)
                ts = dt.datetime.fromisoformat(str(r.get("ts")).replace("Z", "+00:00"))
            except Exception:
                continue
            if r.get("agent") == "feniks" and r.get("audited_hash") == cur and r.get("verdict") in ("go", "return", "veto") and ts >= since:
                if last is None or ts >= last[0]:
                    last = (ts, r.get("verdict"))
    return bool(last and last[1] == "go")


def pr_head(num):
    """sha головы PR по номеру (git fetch origin pull/N/head). None, если не удалось."""
    if not num:
        return "HEAD"
    try:
        p = subprocess.run(["git", "-C", ROOT, "fetch", "-q", "origin", f"pull/{num}/head"], capture_output=True, text=True, timeout=60)
        if p.returncode:
            return None
        return git("rev-parse", "FETCH_HEAD") or None
    except Exception:
        return None


def touches_numbers(c, rev="HEAD"):
    """Изменения rev против merge-base с origin/main задевают файлы с цифрами. Нет изменений = нечего сливать."""
    base = git("merge-base", "origin/main", rev)
    if not base:
        return True  # не смогли определить: лучше спросить
    changed = git("diff", "--name-only", base, rev).splitlines()
    if rev == "HEAD":
        changed += git("diff", "--name-only", "--cached").splitlines()
    return any(matches_any(p, c.get("numbers_globs", [])) for p in changed if p)


def once(session_id, key):
    try:
        os.makedirs(STATE_DIR, exist_ok=True)
        p = os.path.join(STATE_DIR, re.sub(r"[^\w.-]", "_", f"{session_id or 'nosession'}-{key}")[:200])
        if os.path.exists(p):
            return False
        open(p, "w").close()
        return True
    except Exception:
        return True


def ask(reason_user, context_claude):
    out({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "ask",
                                "permissionDecisionReason": reason_user, "additionalContext": context_claude}})


def warn_pre(text, system=None):
    o = {"hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": text}}
    if system:
        o["systemMessage"] = system
    out(o)


WRAPPERS = {"env", "command", "nice", "nohup", "sudo", "time", "exec", "builtin"}


def segments(cmd, depth=0):
    """Команда -> список сегментов (токены), разбитых по ; && || | и переводам строк.
    Разворачивает обёртки (env, timeout N, command, nice, sudo, скобки) и bash -c / sh -c."""
    res = []
    for part in re.split(r"(?:&&|\|\||[;|\n])", cmd or ""):
        part = part.strip().lstrip("({").rstrip(")}").strip()
        try:
            toks = shlex.split(part, posix=True)
        except ValueError:
            toks = part.split()
        changed = True
        while toks and changed:
            changed = False
            while toks and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", toks[0]):  # VAR=... перед командой
                toks, changed = toks[1:], True
            if toks and os.path.basename(toks[0]) in WRAPPERS:
                toks, changed = toks[1:], True
                while toks and (toks[0].startswith("-") or re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", toks[0])):
                    toks = toks[1:]
            if toks and os.path.basename(toks[0]) == "timeout":
                toks, changed = toks[1:], True
                while toks and toks[0].startswith("-"):
                    toks = toks[1:]
                if toks and re.match(r"^\d+[smhd]?$", toks[0]):
                    toks = toks[1:]
        if len(toks) >= 3 and os.path.basename(toks[0]) in ("bash", "sh", "zsh") and toks[1] in ("-c", "-lc") and depth < 3:
            res.extend(segments(toks[2], depth + 1))
            continue
        if toks:
            res.append(toks)
    return res


def git_sub(toks):
    """['git','-C','dir','push',...] -> ('push', [аргументы после подкоманды]) или (None, [])."""
    if not toks or os.path.basename(toks[0]) != "git":
        return None, []
    i = 1
    while i < len(toks) and toks[i].startswith("-"):
        i += 2 if toks[i] in ("-C", "-c", "--git-dir", "--work-tree") else 1
    return (toks[i], toks[i + 1:]) if i < len(toks) else (None, [])


def is_main_ref(ref):
    return re.fullmatch(r"(\+)?((HEAD|[\w./-]+):)?(refs/heads/)?main", ref) is not None


def merge_intent(cmd, cur_branch):
    """-> (описание, номер PR или None) либо None."""
    for t in segments(cmd):
        base = os.path.basename(t[0])
        if base == "gh" and len(t) >= 3 and t[1] == "pr" and t[2] == "merge":
            num = next((a for a in t[3:] if re.fullmatch(r"#?\d+", a)), None)
            return "gh pr merge", (num.lstrip("#") if num else None)
        if base == "gh" and len(t) >= 2 and t[1] == "api":
            m = re.search(r"pulls/(\d+)/merge\b", " ".join(t))
            if m:
                return "gh api merge", m.group(1)
        sub, args = git_sub(t)
        if sub == "push":
            pos = [a for a in args if not a.startswith("-")]
            refs = pos[1:]
            if any(is_main_ref(r) for r in refs):
                return "git push в main", None
            if cur_branch == "main" and (not refs or any(r in ("HEAD", "@") or r.startswith("HEAD:") and is_main_ref(r) for r in refs)):
                return "git push в main", None
        if sub == "merge" and cur_branch == "main" and not any(a in ("--abort", "--continue", "--quit") for a in args):
            pos = [a for a in args if not a.startswith("-")]
            if pos and all(re.fullmatch(r"(origin/)?main", p) for p in pos):
                continue  # обновление локального main из origin/main, не слияние работы
            return "git merge в main", None
    return None


def build_intent(cmd, c):
    rx = re.compile(c.get("build_script_regex", "$^"))
    for t in segments(cmd):
        w = t
        if w and w[0] == "npx":
            w = w[1:]
        if not w:
            continue
        head = os.path.basename(w[0])
        if head in ("npm", "pnpm", "yarn"):
            args = [a for a in w[1:] if not a.startswith("-")]
            if any(a == "build" or a.startswith("build:") for a in args):
                return " ".join(t)
            continue
        if head in ("tsx", "node", "bash", "sh", "python3", "python", "deno", "ts-node"):
            if "--check" in w or "-c" in w:
                continue
            if any(rx.search(a) for a in w[1:] if not a.startswith("-")):
                return " ".join(t)
    return None


# ---------- режимы ----------

def session_start(ev, c):
    if ev.get("source") not in (None, "startup", "resume", "clear", "compact"):
        return
    try:
        text = open(os.path.join(SKILL, "bootstrap.md"), encoding="utf-8").read().strip()
    except Exception:
        return
    out({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": text}})


def prompt(ev, c):
    text = ev.get("prompt") or ""
    rx = c.get("numbers_prompt_regex")
    if not rx or not re.search(rx, text, re.I):
        return
    matches = []
    try:
        sys.path.insert(0, os.path.join(SKILL, "scripts"))
        import registry_match  # noqa: E402
        matches = registry_match.match(text, 3)
    except Exception:
        matches = []
    ids = ",".join(e["id"] for e, _ in matches) or "none"
    if not once(ev.get("session_id"), f"prompt-{ids}"):
        return
    lines = ["data-guard: задача похожа на работу с цифрами. Примени скилл data-guard: шаг 1 pre-mortem и вопросы заказчику с вариантом (рекомендую) до кода, масштаб по размеру задачи; шаг 6: «сошлось» только с двумя цифрами из разных семейств источников."]
    if matches:
        lines.append("Похожие прошлые ошибки из knowledge/errors/registry.jsonl:")
        for e, _ in matches:
            lines.append(f"- {e['id']} [{e['cls']}] {e['title']}. Не повторить: {e['prevention']}")
    out({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": "\n".join(lines)[:2500]}})


def merge_gate(c, what, reason, sid, pr=None):
    """Гейт К11 для git/gh/MCP. Переопределение агентом не снимает запрос: решает человек в окне подтверждения.
    Возвращает True, если что-то вывели."""
    rev = pr_head(pr)
    target = f"PR #{pr}" if pr else what
    if rev is None:
        ask(f"data-guard (К11): не удалось получить голову {target} для проверки go ФЕНИКСА. Продолжить?",
            f"data-guard К11: git fetch origin pull/{pr}/head не удался, проверить go на содержимое PR нельзя. Спроси Ивана или проверь вручную.")
        return True
    if not touches_numbers(c, rev):
        return False
    if feniks_go_for(rev, c.get("feniks_go_max_age_hours", 72)):
        return False
    if reason:
        log_override("merge_without_go", reason, sid)
    ask(f"data-guard (К11): {target} меняет файлы с цифрами, а go ФЕНИКСА на эти изменения не найден."
        + (f" Причина агента: {reason[:200]}." if reason else "") + " Слить без go?",
        "data-guard К11: нужен go ФЕНИКСА на текущие изменения. Посчитай хеш `python3 -B .claude/skills/data-guard/scripts/audit_hash.py` "
        "(для PR: `--rev <голова PR>`), передай ФЕНИКСУ; он пишет audited_hash в строку event: audit и строки `AUDITED: <хеш>`, `VERDICT: go` в отчёте. "
        "После return нужен повторный аудит. Слияние без go решает только человек в окне подтверждения; DG_OVERRIDE лишь записывает причину.")
    return True


def pre_bash(ev, c):
    cmd = (ev.get("tool_input") or {}).get("command") or ""
    sid = ev.get("session_id")
    reason = override_reason(cmd)
    br = branch()
    notes = []

    mi = merge_intent(cmd, br)
    if mi and merge_gate(c, mi[0], reason, sid, mi[1]):
        return

    b = build_intent(cmd, c)
    if b and br == "main":
        if reason:
            log_override("build_on_main", reason, sid)
        else:
            ask("data-guard (К12): запуск сборки на ветке main. Продолжить?",
                f"data-guard К12: `{b[:120]}` на main. Пересборка на main руками агента однажды стёрла январь (134695b5). "
                "Собирай в рабочей ветке; на main пересобирает workflow. Если это осознанно, повтори с DG_OVERRIDE=\"причина\".")
            return

    for t in segments(cmd):
        if len(t) >= 3 and os.path.basename(t[0]) == "gh" and t[1] == "workflow" and t[2] == "run":
            joined = " ".join(t)
            m = re.search(r"--ref[ =](\S+)", joined)
            if m and m.group(1) not in ("main", "refs/heads/main"):
                notes.append("К12: workflow запускается на рабочей ветке. Если он пушит снимки, бот начнёт коммитить в твою ветку и git pull даст self-merge. Снимки только на main.")
        sub, args = git_sub(t)
        if sub == "commit":
            staged = [p for p in git("diff", "--cached", "--name-only").splitlines() if p]
            if any(re.fullmatch(r"-[a-zA-Z]*a[a-zA-Z]*", a) or a == "--all" for a in args):
                staged += [p for p in git("diff", "--name-only").splitlines() if p]
            if staged:
                if all(matches_any(p, c.get("trace_globs", ["traces/**"])) for p in staged):
                    notes.append("К12: коммит состоит только из трейсов. Трейсы копятся и коммитятся пачкой в конце дня, отдельные коммиты трейсов засоряют историю и будят сессию событиями CI.")
                snap = [p for p in staged if matches_any(p, c.get("snapshot_globs", []))]
                if snap and br != "main":
                    notes.append(f"К12: в коммит рабочей ветки {br} попали снимки или сгенерированные страницы ({len(snap)} файлов, напр. {snap[0]}). "
                                 "Это главный источник конфликтов с main. Коммить код билдера, данные и страницы пусть пересобирает workflow на main.")
    if notes:
        warn_pre("data-guard: " + " ".join(dict.fromkeys(notes)))


def pre_edit(ev, c):
    ti = ev.get("tool_input") or {}
    path = ti.get("file_path") or ti.get("notebook_path") or ""
    if path and matches_any(path, c.get("generated_globs", [])):
        warn_pre(f"data-guard К9: {rel(path)} генерируется билдером (analytics-mvp/src/scripts/build-*.ts и шаблоны). "
                 "Правка здесь пропадёт при следующей сборке. Правь билдер или шаблон и пересобери.")


def pre_mcp_merge(ev, c):
    ti = ev.get("tool_input") or {}
    text = " ".join(str(ti.get(k, "")) for k in ("commit_title", "commit_message"))
    merge_gate(c, "слияние через GitHub", override_reason(text), ev.get("session_id"), ti.get("pullNumber"))


def stop(ev, c):
    if ev.get("stop_hook_active"):
        return
    msg = ev.get("last_assistant_message") or ""
    sid = ev.get("session_id")
    parts = []

    claim = re.search(c.get("claim_regex", "$^"), msg, re.I)
    if claim and re.search(c.get("money_ctx_regex", "$^"), msg, re.I):
        nums = [n for n in re.findall(c.get("number_regex", r"\d+"), msg) if len(re.sub(r"\D", "", n)) >= 2]
        low = msg.lower()
        sources = {w for w in c.get("source_words", []) if w in low}
        if (len(nums) < 2 or len(sources) < 2) and once(sid, "claim-" + hashlib.sha1(msg[:500].encode()).hexdigest()[:12]):
            parts.append(f"В ответе есть утверждение о сверке («{claim.group(0)}»), но не видно двух цифр из двух независимых источников. "
                         "Дополни по формату из .claude/skills/data-guard/references/evidence.md (источник A, источник B, разница и причина) "
                         "или замени утверждение на «не проверено» и напиши, что нужно для проверки. Если сверка уже показана выше в этом ответе, подтверди одной строкой.")

    done = re.search(r"(готово|сделано|запушил|запушено|смержен|pr #?\d+)", msg, re.I)
    if done:
        rx = c.get("rework_regex")
        log = git("log", "origin/main..HEAD", "--since=24 hours ago", "--format=%s")
        reworks = [s for s in log.splitlines() if rx and re.search(rx, s, re.I)]
        reg_touched = bool(git("log", "origin/main..HEAD", "--format=%h", "--", "knowledge/errors/registry.jsonl")) or \
            "knowledge/errors/registry.jsonl" in git("status", "--porcelain")
        if reworks and not reg_touched and once(sid, "retro"):
            parts.append(f"В ветке за сутки {len(reworks)} коммитов-переделок. Шаг 8 data-guard: правки заказчика и откаты по твоему недосмотру "
                         "допиши в knowledge/errors/registry.jsonl (формат: .claude/skills/data-guard/references/retro.md), у коммитов-переделок ставь трейлер Rework: customer|self|feniks.")
    if parts:
        out({"hookSpecificOutput": {"hookEventName": "Stop", "additionalContext": "data-guard: " + " ".join(parts)}})


MODES = {"session-start": session_start, "prompt": prompt, "pre-bash": pre_bash, "pre-edit": pre_edit,
         "pre-mcp-merge": pre_mcp_merge, "stop": stop}

if __name__ == "__main__":
    try:
        if os.environ.get("DATA_GUARD_OFF") == "1" or not os.path.isfile(CFG_PATH):
            sys.exit(0)
        mode = sys.argv[1] if len(sys.argv) > 1 else ""
        raw = sys.stdin.read()
        ev = json.loads(raw) if raw.strip() else {}
        fn = MODES.get(mode)
        if fn:
            fn(ev, cfg())
    except Exception:
        pass
    sys.exit(0)
