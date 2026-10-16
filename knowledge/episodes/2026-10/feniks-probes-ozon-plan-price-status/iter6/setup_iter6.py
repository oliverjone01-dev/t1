# ФЕНИКС iter6 (дельта к go 7.95): PR #482 голова 2677794e, код db5ede19 (audit_hash 28a5fec9f1e28feb). Дерево analytics-mvp
# коммита db5ede19 в scratch (git archive из /home/user/t1-wt), data/ - архив 381f11d5 из iter5 (data/ в дельте не менялись),
# node_modules автора. python3 -I setup_iter6.py
import os, io, shutil, tarfile, subprocess
SC = '/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/'
SP = SC + 'p9/'
REPO = '/home/user/t1-wt'
DATA = SC + 'p8/data_381f11d5/analytics-mvp/data'
NM = REPO + '/analytics-mvp/node_modules'
assert os.path.isdir(DATA) and os.path.isdir(NM)
assert subprocess.run(['git', '-C', REPO, 'diff', '--quiet', '381f11d5', 'db5ede19', '--', 'analytics-mvp/data']).returncode == 0
os.makedirs(SP, exist_ok=True)
d = SP + 'tree_db5ede19/'
if os.path.isdir(d): shutil.rmtree(d)
os.makedirs(d)
raw = subprocess.run(['git', '-C', REPO, 'archive', 'db5ede19', 'analytics-mvp/src', 'analytics-mvp/tools', 'analytics-mvp/package.json',
                      'analytics-mvp/package-lock.json', 'analytics-mvp/tsconfig.json'], capture_output=True, check=True).stdout
tarfile.open(fileobj=io.BytesIO(raw)).extractall(d, filter='data')
os.symlink(DATA, d + 'analytics-mvp/data'); os.symlink(NM, d + 'analytics-mvp/node_modules')
print('db5ede19 ->', d + 'analytics-mvp')
