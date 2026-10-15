# ФЕНИКС iter4: деревья analytics-mvp на двух коммитах в scratch, data/ - ссылка на живые (дерево чистое = 753bf11).
# python3 -I setup_trees.py <rev> [<rev> ...]
import os, sys, io, shutil, tarfile, subprocess

SP = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/'
REPO = '/home/user/t1'
for rev in sys.argv[1:]:
    d = SP + 'tree_' + rev + '/'
    if os.path.isdir(d):
        shutil.rmtree(d)
    os.makedirs(d)
    raw = subprocess.run(['git', '-C', REPO, 'archive', rev, 'analytics-mvp/src', 'analytics-mvp/tools', 'analytics-mvp/package.json',
                          'analytics-mvp/package-lock.json', 'analytics-mvp/tsconfig.json'], capture_output=True, check=True).stdout
    tarfile.open(fileobj=io.BytesIO(raw)).extractall(d, filter='data')
    os.symlink(REPO + '/analytics-mvp/data', d + 'analytics-mvp/data')
    print(rev, '->', d + 'analytics-mvp', sorted(os.listdir(d + 'analytics-mvp')))
