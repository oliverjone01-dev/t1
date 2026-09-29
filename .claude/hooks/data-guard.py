#!/usr/bin/env python3
"""data-guard.py - хуки-предупреждения скилла data-guard (.claude/skills/data-guard).

Режимы (первый аргумент): session-start | prompt | pre-bash | pre-edit | pre-mcp-merge | stop
Вход: JSON события Claude Code в stdin. Выход: JSON в stdout (hookSpecificOutput / systemMessage).
Ничего не блокирует: максимум permissionDecision "ask" (пользователь подтверждает сам).
Переопределение агентом: DG_OVERRIDE="причина" в команде или в заголовке слияния; причина пишется в
traces/<дата>/data-guard.jsonl. Любая внутренняя ошибка = молча exit 0 (хук не должен мешать работе).
Настройки: .claude/data-guard.json. Тесты: python3 .claude/hooks/tests/data-guard-tests.py
"""
import datetime as dt
import glob
import json
import os
import re
import subprocess
import sys

ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
SKILL = os.path.join(ROOT, ".claude", "skills", "data-guard")
STATE_DIR = os.path.join(os.environ.get("TMPDIR", "/tmp"), "data-guard-state")


def cfg():
    try:
        with open(os.path.join(ROOT, ".claude", "data-guard.json"), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


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


def matches_any(path, globs):
    rel = os.path.relpath(os.path.abspath(os.path.join(ROOT, path)), ROOT) if path else ""
    return any(glob_re(g).match(rel) for g in globs)


def override_reason(text):
    m = re.search(r"DG_OVERRIDE=(?:\"([^\"]+)\"|'([^']+)'|(\S+))", text or "")
    if not m:
        return None
    return next(g for g in m.groups() if g)


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


def feniks_go_after_head(max_age_h):
    """Есть ли вердикт go ФЕНИКСА (trace agent=feniks, verdict=go) после последнего коммита HEAD."""
    head = git("log", "-1", "--format=%cI")
    try:
        head_ts = dt.datetime.fromisoformat(head) if head else None
    except ValueError:
        head_ts = None
    now = dt.datetime.now(dt.timezone.utc)
    since = now - dt.timedelta(hours=max_age_h)
    for f in sorted(glob.glob(os.path.join(ROOT, "traces", "*", "agents.jsonl")))[-5:]:
        try:
            lines = open(f, encoding="utf-8").read().splitlines()
        except Exception:
            continue
        for line in lines:
            try:
                r = json.loads(line)
            except Exception:
                continue
            if r.get("agent") != "feniks" or r.get("verdict") != "go":
                continue
            try:
                ts = dt.datetime.fromisoformat(str(r.get("ts")).replace("Z", "+00:00"))
            except ValueError:
                continue
            if ts >= since and (head_ts is None or ts >= head_ts):
                return True
    return False


def once(session_id, key):
    """True, если в этой сессии ключ ещё не срабатывал (и помечает его)."""
    try:
        os.makedirs(STATE_DIR, exist_ok=True)
        p = os.path.join(STATE_DIR, re.sub(r"[^\w.-]", "_", f"{session_id or 'nosession'}-{key}"))
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


# ---------- режимы ----------

def session_start(ev):
    if ev.get("source") not in (None, "startup", "resume", "clear", "compact"):
        return
    try:
        text = open(os.path.join(SKILL, "bootstrap.md"), encoding="utf-8").read().strip()
    except Exception:
        return
    out({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": text}})


def prompt(ev):
    c = cfg()
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
    lines = ["data-guard: задача похожа на работу с цифрами. Примени скилл data-guard: шаг 1 pre-mortem и вопросы заказчику с вариантом (рекомендую) до кода; шаг 6: «сошлось» только с двумя цифрами из разных семейств источников."]
    if matches:
        lines.append("Похожие прошлые ошибки из knowledge/errors/registry.jsonl:")
        for e, _ in matches:
            lines.append(f"- {e['id']} [{e['cls']}] {e['title']}. Не повторить: {e['prevention']}")
    out({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": "\n".join(lines)[:2500]}})


def pre_bash(ev):
    c = cfg()
    cmd = (ev.get("tool_input") or {}).get("command") or ""
    sid = ev.get("session_id")
    reason = override_reason(cmd)
    notes = []

    if c.get("merge_regex") and re.search(c["merge_regex"], cmd):
        if not feniks_go_after_head(c.get("feniks_go_max_age_hours", 72)):
            if reason:
                log_override("merge_without_go", reason, sid)
                warn_pre("data-guard: слияние без go ФЕНИКСА переопределено, причина записана в traces/<дата>/data-guard.jsonl.",
                         f"data-guard: слияние без go ФЕНИКСА. Переопределено агентом, причина: {reason}")
            else:
                ask("data-guard (К11): не найден go ФЕНИКСА после последнего коммита. Слить всё равно?",
                    "data-guard К11: перед слиянием нужен go ФЕНИКСА на текущий коммит (Step 12.5), после return обязателен повторный аудит. "
                    "Если слияние оправдано без go (решение Ивана, правка без чисел), повтори команду с DG_OVERRIDE=\"причина\" в начале.")
            return

    if c.get("build_regex") and re.search(c["build_regex"], cmd) and branch() == "main":
        if reason:
            log_override("build_on_main", reason, sid)
        else:
            ask("data-guard (К12): пересборка на ветке main. Продолжить?",
                "data-guard К12: пересборка на main руками агента однажды стёрла январь (134695b5). Собирай в рабочей ветке; на main пересобирает workflow. "
                "Если это осознанно, повтори с DG_OVERRIDE=\"причина\".")
            return

    if re.search(r"\bgh workflow run\b", cmd):
        m = re.search(r"--ref[ =](\S+)", cmd)
        if m and m.group(1) not in ("main", "refs/heads/main"):
            notes.append("К12: workflow запускается на рабочей ветке. Если он пушит снимки, бот начнёт коммитить в твою ветку и git pull даст self-merge. Снимки только на main.")

    if re.search(r"\bgit commit\b", cmd):
        staged = [p for p in git("diff", "--cached", "--name-only").splitlines() if p]
        if re.search(r"\s-(a|am|[a-z]*a[a-z]*)\b|--all\b", cmd):
            staged += [p for p in git("diff", "--name-only").splitlines() if p]
        if staged:
            traces = c.get("trace_globs", ["traces/**"])
            if all(matches_any(p, traces) for p in staged):
                notes.append("К12: коммит состоит только из трейсов. Трейсы копятся и коммитятся пачкой в конце дня, отдельные коммиты трейсов засоряют историю и будят сессию событиями CI.")
            br = branch()
            snap = [p for p in staged if matches_any(p, c.get("snapshot_globs", []))]
            if snap and br != "main":
                notes.append(f"К12: в коммит рабочей ветки {br} попали снимки или сгенерированные страницы ({len(snap)} файлов, напр. {snap[0]}). "
                             "Это главный источник конфликтов с main. Коммить код билдера, а данные и страницы пусть пересобирает workflow на main.")
    if notes:
        warn_pre("data-guard: " + " ".join(notes))


def pre_edit(ev):
    c = cfg()
    ti = ev.get("tool_input") or {}
    path = ti.get("file_path") or ti.get("notebook_path") or ""
    if path and matches_any(path, c.get("generated_globs", [])):
        warn_pre(f"data-guard К9: {os.path.relpath(os.path.abspath(path), ROOT)} генерируется билдером (analytics-mvp/src/scripts/build-*.ts и шаблоны). "
                 "Правка здесь пропадёт при следующей сборке. Правь билдер или шаблон и пересобери.")


def pre_mcp_merge(ev):
    c = cfg()
    ti = ev.get("tool_input") or {}
    text = " ".join(str(ti.get(k, "")) for k in ("commit_title", "commit_message"))
    reason = override_reason(text)
    if feniks_go_after_head(c.get("feniks_go_max_age_hours", 72)):
        return
    if reason:
        log_override("mcp_merge_without_go", reason, ev.get("session_id"))
        warn_pre("data-guard: слияние без go ФЕНИКСА переопределено, причина записана.",
                 f"data-guard: слияние PR #{ti.get('pullNumber')} без go ФЕНИКСА. Причина: {reason}")
        return
    ask(f"data-guard (К11): для PR #{ti.get('pullNumber')} не найден go ФЕНИКСА после последнего коммита. Слить всё равно?",
        "data-guard К11: нужен go ФЕНИКСА на текущий коммит. Для осознанного слияния без go добавь DG_OVERRIDE=\"причина\" в commit_title.")


def stop(ev):
    if ev.get("stop_hook_active"):
        return
    c = cfg()
    msg = ev.get("last_assistant_message") or ""
    sid = ev.get("session_id")
    parts = []

    claim = re.search(c.get("claim_regex", "$^"), msg, re.I)
    numbers_ctx = re.search(c.get("numbers_prompt_regex", "$^"), msg, re.I)
    if claim and numbers_ctx:
        nums = [n for n in re.findall(c.get("number_regex", r"\d+"), msg) if len(re.sub(r"\D", "", n)) >= 2]
        low = msg.lower()
        sources = {w for w in c.get("source_words", []) if w in low}
        if len(nums) < 2 or len(sources) < 2:
            parts.append(f"В ответе есть утверждение о сверке («{claim.group(0)}»), но не видно двух цифр из двух независимых источников. "
                         "Дополни по формату из .claude/skills/data-guard/references/evidence.md (источник A, источник B, разница и причина) "
                         "или замени утверждение на «не проверено» и напиши, что нужно для проверки. Если сверка уже показана выше в этом ответе, просто подтверди одной строкой.")

    done = re.search(r"(готово|сделано|запушил|запушено|смержен|слит[оа]?|pr #?\d+|итог)", msg, re.I)
    if done:
        rx = c.get("rework_regex")
        base = "origin/main"
        log = git("log", f"{base}..HEAD", "--since=24 hours ago", "--format=%s")
        reworks = [s for s in log.splitlines() if rx and re.search(rx, s, re.I)]
        reg_touched = bool(git("log", f"{base}..HEAD", "--format=%h", "--", "knowledge/errors/registry.jsonl")) or \
            "knowledge/errors/registry.jsonl" in git("status", "--porcelain")
        if reworks and not reg_touched and once(sid, "retro"):
            parts.append(f"В ветке за сутки {len(reworks)} коммитов-переделок. Шаг 8 data-guard: если это правки заказчика или откаты по твоему недосмотру, "
                         "допиши их в knowledge/errors/registry.jsonl (формат: .claude/skills/data-guard/references/retro.md) и проверь registry_match.py --validate.")
    if parts:
        out({"hookSpecificOutput": {"hookEventName": "Stop", "additionalContext": "data-guard: " + " ".join(parts)}})


MODES = {"session-start": session_start, "prompt": prompt, "pre-bash": pre_bash, "pre-edit": pre_edit,
         "pre-mcp-merge": pre_mcp_merge, "stop": stop}

if __name__ == "__main__":
    try:
        mode = sys.argv[1] if len(sys.argv) > 1 else ""
        raw = sys.stdin.read()
        ev = json.loads(raw) if raw.strip() else {}
        fn = MODES.get(mode)
        if fn:
            fn(ev)
    except Exception:
        pass
    sys.exit(0)
