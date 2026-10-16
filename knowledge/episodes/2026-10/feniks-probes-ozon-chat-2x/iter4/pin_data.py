# ФЕНИКС iter4: data/ из коммита 753bf11 в scratch (рабочее дерево меняется параллельно - не опираться на него).
# Обе сборки (head, base) читают одну и ту же копию данных коммита.
import os, io, shutil, tarfile, subprocess
SP = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/'
REPO = '/home/user/t1'
dst = SP + 'data_753bf11/'
if os.path.isdir(dst):
    shutil.rmtree(dst)
os.makedirs(dst)
raw = subprocess.run(['git', '-C', REPO, 'archive', '753bf11', 'analytics-mvp/data'], capture_output=True, check=True).stdout
tarfile.open(fileobj=io.BytesIO(raw)).extractall(dst, filter='data')
for t in ('tree_753bf11', 'tree_5c4f053'):
    link = SP + t + '/analytics-mvp/data'
    if os.path.islink(link):
        os.unlink(link)
    os.symlink(dst + 'analytics-mvp/data', link)
    print(link, '->', os.path.realpath(link))
print(len(os.listdir(dst + 'analytics-mvp/data')), 'файлов')
