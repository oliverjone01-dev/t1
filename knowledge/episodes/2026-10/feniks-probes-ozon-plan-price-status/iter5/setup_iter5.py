# ФЕНИКС iter5 (PR #482 @ 381f11d5, audit_hash 3fc874ed10dd7cb7, 5 путей поверх main 9a3a212): деревья analytics-mvp
# головы и main в scratch (git archive из рабочей копии /home/user/t1-wt). data/ - архив коммита 381f11d5 (по data/ = 9a3a212,
# git diff --quiet пуст). node_modules - ссылка на установленные автором в /home/user/t1-wt/analytics-mvp/node_modules.
# python3 -I setup_iter5.py
import os, io, shutil, tarfile, subprocess

SC = '/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/'
SP = SC + 'p8/'
REPO = '/home/user/t1-wt'
NM = REPO + '/analytics-mvp/node_modules'
os.makedirs(SP, exist_ok=True)
assert os.path.isdir(NM)
assert subprocess.run(['git', '-C', REPO, 'diff', '--quiet', '9a3a212', '381f11d5', '--', 'analytics-mvp/data']).returncode == 0, 'data/ differs'


def archive(rev, paths, dst):
    raw = subprocess.run(['git', '-C', REPO, 'archive', rev, *paths], capture_output=True, check=True).stdout
    tarfile.open(fileobj=io.BytesIO(raw)).extractall(dst, filter='data')


DATA = SP + 'data_381f11d5/'
if not os.path.isdir(DATA + 'analytics-mvp/data'):
    os.makedirs(DATA, exist_ok=True)
    archive('381f11d5', ['analytics-mvp/data'], DATA)
DATA += 'analytics-mvp/data'
for rev in ('381f11d5', '9a3a212'):
    d = SP + 'tree_' + rev + '/'
    if os.path.isdir(d):
        shutil.rmtree(d)
    os.makedirs(d)
    archive(rev, ['analytics-mvp/src', 'analytics-mvp/tools', 'analytics-mvp/package.json', 'analytics-mvp/package-lock.json',
                  'analytics-mvp/tsconfig.json'], d)
    os.symlink(DATA, d + 'analytics-mvp/data')
    os.symlink(NM, d + 'analytics-mvp/node_modules')
    print(rev, '->', d + 'analytics-mvp', sorted(os.listdir(d + 'analytics-mvp')))
print('data', DATA, len(os.listdir(DATA)), 'файлов')
