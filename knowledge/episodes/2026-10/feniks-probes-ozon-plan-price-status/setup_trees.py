# ФЕНИКС, раздел 5 «Цена» (4f2409c). Деревья analytics-mvp на коммитах в scratch (git archive), data/ закреплены
# копией коммита 4f2409c (рабочее дерево может меняться параллельно - на него не опираемся),
# node_modules - ссылка на установленные в iter4 (package.json и lock не менялись 753bf11..4f2409c).
# python3 -I setup_trees.py <rev> [<rev> ...]
import os, sys, io, shutil, tarfile, subprocess

SP = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/p5/'
NM = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/tree_753bf11/analytics-mvp/node_modules'
REPO = '/home/user/t1'
os.makedirs(SP, exist_ok=True)
data = SP + 'data_4f2409c/'
if not os.path.isdir(data + 'analytics-mvp/data'):
    os.makedirs(data, exist_ok=True)
    raw = subprocess.run(['git', '-C', REPO, 'archive', '4f2409c', 'analytics-mvp/data'], capture_output=True, check=True).stdout
    tarfile.open(fileobj=io.BytesIO(raw)).extractall(data, filter='data')
print('data:', data + 'analytics-mvp/data', len(os.listdir(data + 'analytics-mvp/data')), 'файлов')
for rev in sys.argv[1:]:
    d = SP + 'tree_' + rev + '/'
    if os.path.isdir(d):
        shutil.rmtree(d)
    os.makedirs(d)
    raw = subprocess.run(['git', '-C', REPO, 'archive', rev, 'analytics-mvp/src', 'analytics-mvp/tools', 'analytics-mvp/package.json',
                          'analytics-mvp/package-lock.json', 'analytics-mvp/tsconfig.json'], capture_output=True, check=True).stdout
    tarfile.open(fileobj=io.BytesIO(raw)).extractall(d, filter='data')
    os.symlink(data + 'analytics-mvp/data', d + 'analytics-mvp/data')
    os.symlink(NM, d + 'analytics-mvp/node_modules')
    print(rev, '->', d + 'analytics-mvp', sorted(os.listdir(d + 'analytics-mvp')))
