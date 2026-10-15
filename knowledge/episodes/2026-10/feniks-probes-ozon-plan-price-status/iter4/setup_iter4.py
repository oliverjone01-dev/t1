# ФЕНИКС iter4 (ba5b560, audit_hash fe21110678075a4b): дерево analytics-mvp головы в scratch (git archive).
# main b55e514 по analytics-mvp = 3810a26 (p5/tree_3810a26). data/ - закреплённая копия коммита 4f2409c
# (по data/ = ba5b560, diff пуст). node_modules - установленные в iter4 серии #479 (package.json, lock, tsconfig не менялись).
# python3 -I setup_iter4.py
import os, io, shutil, tarfile, subprocess

SC = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/'
SP = SC + 'p7/'
DATA = SC + 'p5/data_4f2409c/analytics-mvp/data'
NM = SC + 'tree_753bf11/analytics-mvp/node_modules'
REPO = '/home/user/t1'
os.makedirs(SP, exist_ok=True)
assert os.path.isdir(DATA) and os.path.isdir(NM)
for rev in ('ba5b560',):
    d = SP + 'tree_' + rev + '/'
    if os.path.isdir(d):
        shutil.rmtree(d)
    os.makedirs(d)
    raw = subprocess.run(['git', '-C', REPO, 'archive', rev, 'analytics-mvp/src', 'analytics-mvp/tools', 'analytics-mvp/package.json',
                          'analytics-mvp/package-lock.json', 'analytics-mvp/tsconfig.json'], capture_output=True, check=True).stdout
    tarfile.open(fileobj=io.BytesIO(raw)).extractall(d, filter='data')
    os.symlink(DATA, d + 'analytics-mvp/data')
    os.symlink(NM, d + 'analytics-mvp/node_modules')
    print(rev, '->', d + 'analytics-mvp', sorted(os.listdir(d + 'analytics-mvp')))
