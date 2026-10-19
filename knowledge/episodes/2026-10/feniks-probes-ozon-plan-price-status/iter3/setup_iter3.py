# ФЕНИКС iter3 (e063381, audit_hash 44662f80704eb119): дерево analytics-mvp головы в scratch (git archive).
# main b55e514 по analytics-mvp = 3810a26 (iter2), его дерево берётся из p5/tree_3810a26.
# data/ - закреплённая копия коммита 4f2409c (по data/ = e063381, git diff --name-only пуст).
# node_modules - установленные в iter4 (package.json, lock и tsconfig не менялись 753bf11..e063381).
# python3 -I setup_iter3.py
import os, io, shutil, tarfile, subprocess

SC = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/'
SP = SC + 'p6/'
DATA = SC + 'p5/data_4f2409c/analytics-mvp/data'
NM = SC + 'tree_753bf11/analytics-mvp/node_modules'
REPO = '/home/user/t1'
os.makedirs(SP, exist_ok=True)
assert os.path.isdir(DATA) and os.path.isdir(NM)
for rev in ('e063381',):
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
main = SC + 'p5/tree_3810a26/analytics-mvp'
print('main (= 3810a26 по analytics-mvp):', main, os.path.isdir(main))
