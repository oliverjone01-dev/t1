import pathlib,subprocess,tempfile,os,pwd,grp
root=pathlib.Path(tempfile.mkdtemp(prefix='gg-scope-test-'));uid=pwd.getpwnam('gg').pw_uid;gid=grp.getgrnam('gg').gr_gid
def give(p):os.chown(p,uid,gid)
os.chmod(root,0o755);give(root)
repo=root/'data';repo.mkdir();give(repo)
locks=root/'state/locks';locks.mkdir(parents=True)
give(root/'state');give(locks)
own=repo/'own-branch';own.mkdir();give(own)
(own/'snapshot.json').write_text('{"version":1}');give(own/'snapshot.json')
(repo/'unrelated.txt').write_text('other');give(repo/'unrelated.txt')
def run(*args):return subprocess.check_output(['runuser','-u','gg','--',*args],text=True)
run('git','-C',str(repo),'init','-q');run('git','-C',str(repo),'add','own-branch','unrelated.txt');run('git','-C',str(repo),'-c','user.name=fixture','-c','user.email=fixture@localhost','commit','-qm','baseline')
(repo/'unrelated.txt').write_text('already staged separate work');give(repo/'unrelated.txt');run('git','-C',str(repo),'add','unrelated.txt')
foreign=repo/'private-previews';foreign.mkdir(mode=0o700);(foreign/'checks.json').write_text('root private')
(own/'snapshot.json').write_text('{"version":2}')
source=pathlib.Path(os.environ.get('GG_TEST_LIBRARY',str(pathlib.Path(__file__).resolve().parents[1]/'lib/gg.sh'))).read_text()
fn=source[source.index('gg_data_commit() {'):source.index('# Откат незакоммиченных',source.index('gg_data_commit() {'))]
test=root/'test.sh';test.write_text('set -euo pipefail\nGG_ROOT='+str(root)+'\nGG_DATA='+str(repo)+'\ngg_warn(){ echo "$*" >&2; }\n'+fn+'\ngg_data_commit fixture own-branch\n');os.chmod(test,0o755)
run('bash',str(test))
changed=run('git','-C',str(repo),'show','--pretty=','--name-only','HEAD').strip();assert changed=='own-branch/snapshot.json',changed
assert run('git','-C',str(repo),'diff','--cached','--name-only').strip()=='unrelated.txt'
assert foreign.stat().st_mode&0o777==0o700
print('PASS scoped snapshot commit ignores unreadable private previews, commits only own branch, preserves staged unrelated work and permissions')


