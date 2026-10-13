# Тот же алгоритм, что data-guard audit_hash.py, но merge-base задан явно (клон shallow, git merge-base не находит базу;
# база e0ad2dc получена из GitHub compare API main...0e76c3c).
import hashlib, subprocess, sys
cwd, base, rev = '/home/user/t1-v4', sys.argv[1], sys.argv[2]
EXCLUDE = ("traces/", "knowledge/episodes/", "knowledge/errors/", "sessions/handoff/")
g = lambda a, check=True: subprocess.run(['git', *a], capture_output=True, text=True, cwd=cwd, check=check).stdout
paths = [p for p in g(['diff', '--name-only', base, rev]).split('\n') if p and not p.startswith(EXCLUDE)]
h = hashlib.sha1()
for p in sorted(paths):
    b = g(['rev-parse', '-q', '--verify', f'{rev}:{p}'], check=False).strip() or 'deleted'
    h.update(f"{b} {p}\n".encode())
print(len(paths), 'путей;', 'hash', h.hexdigest()[:16])
