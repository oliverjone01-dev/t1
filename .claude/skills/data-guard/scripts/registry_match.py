#!/usr/bin/env python3
"""registry_match.py - находит прошлые ошибки из реестра, похожие на текущую задачу.

Использование:
  registry_match.py "описание задачи" [--top 5] [--json]
  registry_match.py --validate            # проверка формата реестра
Реестр: <корень git>/knowledge/errors/registry.jsonl, иначе ../references/registry-snapshot.jsonl рядом со скиллом.
"""
import json
import os
import re
import subprocess
import sys

CLASSES = {f"К{i}" for i in range(1, 15)}
REQUIRED = ["id", "cls", "title", "trigger", "symptom", "root_cause", "prevention", "check", "evidence", "count", "status"]
STATUSES = {"new", "checklist", "hook-candidate", "hook"}
PII = [re.compile(r"\+?7[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}"), re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"),
       re.compile(r"(?<![\w-])\d{8}-\d{4}(-\d+)?(?![\w-])")]  # телефон, email, номер отправления Ozon
SCOPES = {"main", "branch", "deleted-branch", "no-sha"}


def registry_path():
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = []
    env = os.environ.get("CLAUDE_PROJECT_DIR")
    if env:
        candidates.append(os.path.join(env, "knowledge/errors/registry.jsonl"))
    try:
        root = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, timeout=5).stdout.strip()
        if root:
            candidates.append(os.path.join(root, "knowledge/errors/registry.jsonl"))
    except Exception:
        pass
    candidates.append(os.path.join(here, "..", "references", "registry-snapshot.jsonl"))
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None


def load(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise SystemExit(f"registry: строка {n} не JSON: {e}")
    return rows


def norm(s):
    return re.sub(r"\s+", " ", str(s).lower().replace("ё", "е"))


DOMAIN_WORDS = {
    "ozon": ["озон", "ozon"], "ym": ["маркет", "яндекс маркет", "ям ", "market"], "wb": ["wb", "вайлдберриз", "wildberries"],
    "bitrix": ["битрикс", "bitrix", "crm", "срм", "сделк", "воронк", "роп"], "direct": ["директ", "direct", "метрик"],
    "money": ["деньг", "начислен", "выплат", "выручк", "с/с", "себестоим"], "crm": ["crm", "сделк", "менеджер"],
}


def has_word(t, k):
    k = norm(k)
    tail = r"(?![\w])" if len(k.strip()) <= 3 else ""
    return re.search(r"(?<![\w])" + re.escape(k) + tail, t) is not None


def score(entry, text):
    t = norm(text)
    hits = [k for k in entry.get("trigger", {}).get("keywords", []) if k and has_word(t, k)]
    if not hits:
        return 0.0, hits
    weight = 1.0 + min(int(entry.get("count", 0) or 0), 10) / 10.0
    doms = entry.get("domains", [])
    bonus = 0.5 if any(has_word(t, w) for d in doms for w in DOMAIN_WORDS.get(d, [])) else 0.0
    return len(hits) * weight + bonus, hits


def match(text, top=5):
    path = registry_path()
    if not path:
        return []
    scored = []
    for e in load(path):
        s, hits = score(e, text)
        if s > 0:
            scored.append((s, e, hits))
    scored.sort(key=lambda x: (-x[0], x[1].get("id", "")))
    return [(e, hits) for _, e, hits in scored[:top]]


def validate():
    path = registry_path()
    if not path:
        print("реестр не найден")
        return 1
    rows = load(path)
    errors = []
    ids = set()
    for r in rows:
        rid = r.get("id", "?")
        for k in REQUIRED:
            if k not in r:
                errors.append(f"{rid}: нет поля {k}")
        if r.get("cls") not in CLASSES:
            errors.append(f"{rid}: класс {r.get('cls')} не из К1-К14")
        if r.get("status") not in STATUSES:
            errors.append(f"{rid}: статус {r.get('status')}")
        if rid in ids:
            errors.append(f"{rid}: дубль id")
        ids.add(rid)
        blob = json.dumps(r, ensure_ascii=False)
        if "—" in blob:
            errors.append(f"{rid}: длинное тире")
        for p in PII:
            if p.search(blob):
                errors.append(f"{rid}: похоже на персональные данные ({p.pattern[:20]})")
        if r.get("evidence_scope") not in SCOPES:
            errors.append(f"{rid}: evidence_scope {r.get('evidence_scope')} (main|branch|deleted-branch|no-sha)")
        if not r.get("trigger", {}).get("keywords"):
            errors.append(f"{rid}: нет keywords")
    for e in errors:
        print(e)
    print(f"{path}: записей {len(rows)}, ошибок {len(errors)}")
    return 1 if errors else 0


def main(argv):
    if "--validate" in argv:
        return validate()
    top = 5
    if "--top" in argv:
        top = int(argv[argv.index("--top") + 1])
    as_json = "--json" in argv
    words = [a for i, a in enumerate(argv) if not a.startswith("--") and (i == 0 or argv[i - 1] != "--top")]
    text = " ".join(words) if words else sys.stdin.read()
    res = match(text, top)
    if as_json:
        print(json.dumps([dict(e, matched=h) for e, h in res], ensure_ascii=False))
        return 0
    if not res:
        where = registry_path() or "реестр не найден (в репо t1: knowledge/errors/registry.jsonl; в скилле аккаунта: references/registry-snapshot.jsonl)"
        print(f"Похожих прошлых ошибок не найдено ({where}). Пройди общий список рисков из references/premortem.md.")
        return 0
    print("Похожие прошлые ошибки (реестр knowledge/errors/registry.jsonl):")
    for e, h in res:
        print(f"- {e['id']} [{e['cls']}] {e['title']} (случаев: {e.get('count', 0)})")
        print(f"  как не повторить: {e['prevention']}")
        print(f"  проверка: {e['check']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
