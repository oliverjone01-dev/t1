#!/usr/bin/env python3
"""audit_hash.py - отпечаток изменений ветки, которые проверял ФЕНИКС (привязка go к коду, гейт К11).

Хеш считается только по путям, которые ветка меняет относительно merge-base с базой (по умолчанию origin/main),
вместе с их содержимым (blob), кроме служебных: traces/, knowledge/episodes/, knowledge/errors/, sessions/handoff/.
Поэтому слияние main в ветку хеш не меняет (если не задело те же файлы), а трейсы, отчёт аудита
и запись в реестр после go тоже не меняют. Любая правка кода или данных ветки меняет.

  audit_hash.py                    # HEAD против origin/main
  audit_hash.py --rev <sha|ветка>  # указанный коммит (например, голова PR: git fetch origin pull/N/head)
  audit_hash.py --worktree         # рабочее дерево с незакоммиченным (для аудита до коммита)
  --base <ref>                     # другая база
Одинаковые изменения дают одинаковый хеш во всех режимах.
В запросе ФЕНИКСУ передай хеш; ФЕНИКС пишет audited_hash в строку трейса event: audit и строку `AUDITED: <хеш>` в отчёте.
"""
import hashlib
import os
import subprocess
import sys

EXCLUDE = ("traces/", "knowledge/episodes/", "knowledge/errors/", "sessions/handoff/")


def _git(args, cwd=None, check=True):
    p = subprocess.run(["git", *args], capture_output=True, text=True, cwd=cwd)
    if check and p.returncode:
        raise RuntimeError(f"git {' '.join(args)}: {p.stderr.strip()}")
    return p.stdout


def _skip(p):
    return p.startswith(EXCLUDE) or "__pycache__/" in p


def content_hash(worktree=False, cwd=None, rev="HEAD", base="origin/main"):
    mb = _git(["merge-base", base, rev], cwd=cwd).strip()
    items = []
    if worktree:
        paths = set(_git(["diff", "--name-only", mb], cwd=cwd).split("\n"))
        paths |= set(_git(["ls-files", "--others", "--exclude-standard"], cwd=cwd).split("\n"))
        root = _git(["rev-parse", "--show-toplevel"], cwd=cwd).strip()
        for p in sorted(x for x in paths if x and not _skip(x)):
            full = os.path.join(root, p)
            blob = _git(["hash-object", full], cwd=cwd).strip() if os.path.isfile(full) else "deleted"
            items.append((p, blob))
    else:
        paths = _git(["diff", "--name-only", mb, rev], cwd=cwd).split("\n")
        for p in sorted(x for x in paths if x and not _skip(x)):
            blob = _git(["rev-parse", "-q", "--verify", f"{rev}:{p}"], cwd=cwd, check=False).strip() or "deleted"
            items.append((p, blob))
    h = hashlib.sha1()
    for p, b in items:
        h.update(f"{b} {p}\n".encode())
    return h.hexdigest()[:16]


if __name__ == "__main__":
    a = sys.argv[1:]
    rev = a[a.index("--rev") + 1] if "--rev" in a else "HEAD"
    base = a[a.index("--base") + 1] if "--base" in a else "origin/main"
    print(content_hash("--worktree" in a, rev=rev, base=base))
