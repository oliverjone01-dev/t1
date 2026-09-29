#!/usr/bin/env python3
"""audit_hash.py - отпечаток содержимого, которое проверял ФЕНИКС (привязка go к коду, гейт К11).

Хеш считается по (blob sha, путь) всех файлов, кроме служебных: traces/, knowledge/episodes/,
knowledge/errors/, sessions/handoff/. Поэтому трейсы, отчёт аудита и запись в реестр после go его не меняют,
а любая правка кода или данных меняет.

  audit_hash.py            # по HEAD (закоммиченное)
  audit_hash.py --worktree # по рабочему дереву, включая незакоммиченное (для запроса аудита до коммита)
Одинаковое содержимое даёт одинаковый хеш в обоих режимах.
В запросе ФЕНИКСУ передай хеш; ФЕНИКС пишет в отчёте строку `AUDITED: <хеш>`, subagent-trace кладёт её в трейс.
"""
import hashlib
import os
import subprocess
import sys
import tempfile

EXCLUDE = ("traces/", "knowledge/episodes/", "knowledge/errors/", "sessions/handoff/")


def _git(args, env=None, cwd=None):
    return subprocess.run(["git", *args], capture_output=True, text=True, check=True, env=env, cwd=cwd).stdout


def entries_head(cwd=None):
    for line in _git(["ls-tree", "-r", "HEAD"], cwd=cwd).splitlines():
        meta, path = line.split("\t", 1)
        yield meta.split()[2], path


def entries_worktree(cwd=None):
    with tempfile.TemporaryDirectory() as d:
        env = dict(os.environ, GIT_INDEX_FILE=os.path.join(d, "index"))
        _git(["read-tree", "HEAD"], env=env, cwd=cwd)
        _git(["add", "-A"], env=env, cwd=cwd)
        for line in _git(["ls-files", "-s"], env=env, cwd=cwd).splitlines():
            meta, path = line.split("\t", 1)
            yield meta.split()[1], path


def content_hash(worktree=False, cwd=None):
    items = sorted((p, s) for s, p in (entries_worktree(cwd) if worktree else entries_head(cwd)) if not p.startswith(EXCLUDE) and "__pycache__/" not in p)
    h = hashlib.sha1()
    for p, s in items:
        h.update(f"{s} {p}\n".encode())
    return h.hexdigest()[:16]


if __name__ == "__main__":
    print(content_hash("--worktree" in sys.argv))
