#!/usr/bin/env python3
"""data-guard.py - хуки-предупреждения скилла data-guard (.claude/skills/data-guard).

Режимы (первый аргумент): session-start | prompt | pre-bash | pre-edit | pre-mcp-merge | stop
Вход: JSON события Claude Code в stdin. Выход: JSON в stdout (hookSpecificOutput / systemMessage).
Сам ничего не отменяет: максимум permissionDecision "ask" (подтверждает пользователь).
Молчит, если в репо нет .claude/data-guard.json или задано DATA_GUARD_OFF=1.
Переопределение: DG_OVERRIDE="причина" в команде (для слияния без go: "decisions.md#<якорь>: причина"),
причина пишется в traces/<дата>/data-guard.jsonl. Внутренняя ошибка = молча exit 0.
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


def decision_ref_ok(reason):
    """Причина слияния без go должна ссылаться на существующую запись: decisions.md#<текст якоря>."""
    m = re.match(r"\s*(?:knowledge/)?decisions\.md#([^:]+)", reason or "")
    if not m:
        return False
    try:
        text = open(os.path.join(ROOT, "knowledge", "decisions.md"), encoding="utf-8").read().lower()
    except Exception:
        return False
    anchor = m.group(1).strip().lower()
    return len(anchor) >= 4 and anchor in text


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


def content_hash():
    try:
        sys.path.insert(0, os.path.join(SKILL, "scripts"))
        import audit_hash  # noqa: E402
        return audit_hash.content_hash(False, cwd=ROOT)
    except Exception:
        return None


def feniks_go_for_head(max_age_h):
    """go ФЕНИКСА за последние max_age_h часов, привязанный к текущему содержимому (audited_hash == хеш HEAD)."""
    cur = content_hash()
    if not cur:
        return False
    since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=max_age_h)
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
            if r.get("agent") == "feniks" and r.get("verdict") == "go" and ts >= since and r.get("audited_hash") == cur:
                return True
    return False


def touches_numbers(c):
    """Ветка против origin/main (плюс staged) задевает файлы с цифрами."""
    base = git("merge-base", "HEAD", "origin/main")
    changed = git("diff", "--name-only", base, "HEAD").splitlines() if base else git("diff", "--name-only", "origin/main", "HEAD").splitlines()
    changed += git("diff", "--name-only", "--cached").splitlines()
    if not changed:
        return True  # не смогли определить: лучше спросить
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


def segments(cmd):
    """Команда -> список сегментов (токены), разбитых по ; && || | и переводам строк."""
    res = []
    for part in re.split(r"(?:&&|\|\||[;|\n])", cmd or ""):
        try:
            toks = shlex.split(part, posix=True)
        except ValueError:
            toks = part.split()
        while toks and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", toks[0]):  # VAR=... перед командой
            toks = toks[1:]
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
    for t in segments(cmd):
        if len(t) >= 3 and os.path.basename(t[0]) == "gh" and t[1] == "pr" and t[2] == "merge":
            return "gh pr merge"
        sub, args = git_sub(t)
        if sub == "push":
            pos = [a for a in args if not a.startswith("-")]
            refs = pos[1:]
            if any(is_main_ref(r) for r in refs) or (not refs and cur_branch == "main"):
                return "git push в main"
        if sub == "merge" and cur_branch == "main" and not any(a in ("--abort", "--continue") for a in args):
            return "git merge в main"
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
        if head in ("npm", "pnpm", "yarn") and any(a == "build" or a.startswith("build:") for a in w[1:3]):
            return " ".join(t)
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
    """Общая логика К11 для git/gh и MCP. Возвращает True, если что-то вывели."""
    if not touches_numbers(c):
        return False
    if feniks_go_for_head(c.get("feniks_go_max_age_hours", 72)):
        return False
    target = f"PR #{pr}" if pr else what
    if reason and decision_ref_ok(reason):
        log_override("merge_without_go", reason, sid)
        warn_pre("data-guard: слияние без go ФЕНИКСА по записанному решению, причина в traces/<дата>/data-guard.jsonl.",
                 f"data-guard: {target} без go ФЕНИКСА. Основание: {reason}")
        return True
    extra = " Ссылка в DG_OVERRIDE не найдена в knowledge/decisions.md." if reason else ""
    ask(f"data-guard (К11): {target} меняет файлы с цифрами, а go ФЕНИКСА на текущее содержимое не найден. Продолжить?",
        "data-guard К11: нужен go ФЕНИКСА на текущее содержимое. Посчитай хеш `python3 .claude/skills/data-guard/scripts/audit_hash.py`, "
        "передай его в запросе ФЕНИКСУ, он пишет в отчёте `AUDITED: <хеш>` и `VERDICT: go`. После return обязателен повторный аудит. "
        "Слияние без go только по решению Ивана, записанному в knowledge/decisions.md: DG_OVERRIDE=\"decisions.md#<текст якоря>: причина\"." + extra)
    return True


def pre_bash(ev, c):
    cmd = (ev.get("tool_input") or {}).get("command") or ""
    sid = ev.get("session_id")
    reason = override_reason(cmd)
    br = branch()
    notes = []

    what = merge_intent(cmd, br)
    if what and merge_gate(c, what, reason, sid):
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
