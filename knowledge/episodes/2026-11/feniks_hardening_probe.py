import pathlib,tempfile,subprocess,json,os,datetime as dt,base64,re,sys,copy
ROOT=pathlib.Path.cwd();AN=ROOT/'analytics-mvp'
def sh(cmd,**kw):return subprocess.check_output(cmd,text=True,**kw).strip()
def yaml(file):return json.loads(sh(['ruby','-r','yaml','-r','json','-e','puts JSON.generate(YAML.load_file(ARGV[0]))',str(ROOT/'.github/workflows'/file)]))
pub=yaml('ozon-cabinet-publish.yml');orders=yaml('orders-backfill.yml')
assert pub['jobs']['publish']['if']==orders['jobs']['orders']['if']=="github.ref == 'refs/heads/main'"
for doc in [pub,orders]:
 for job in doc['jobs'].values():
  for s in job['steps']:
   if 'run' in s:assert subprocess.run(['bash','-n'],input=re.sub(r'\$\{\{.*?\}\}','EXPR',s['run']),text=True,capture_output=True).returncode==0
print('D11 YAML parsing, all shell syntax, main-only guards PASS')
steps=pub['jobs']['publish']['steps'];receive=next(s['run'] for s in steps if s.get('name','').startswith('Receive only'));publish=next(s['run'] for s in steps if s.get('name','').startswith('Publish only'));chain=steps[-1]['run']
MOCK='''#!/usr/bin/env python3
import sys,os,json,base64,subprocess,pathlib
args=sys.argv[1:]; state=pathlib.Path(os.environ['MOCK_DIR']); repo=state/'repo'
def git(*args,input=None):return subprocess.check_output(['git','-C',str(repo),*args],input=input).decode().strip()
log=state/'calls'; log.open('a').write(json.dumps(args)+'\\n')
if args[0]=='workflow': print('');sys.exit(0)
ep=next(a for a in args if a.startswith('repos/')).split('/',3)[3]
body=json.loads(sys.stdin.read()) if '--input' in args else None
if 'actions/workflows/' in ep:
 print(1 if os.environ.get('SNAPSHOTS_ACTIVE')=='1' and 'ozon-snapshots.yml' in ep else 0);sys.exit(0)
if ep=='git/blobs/incoming': print((state/'server_blob.json').read_text());sys.exit(0)
if ep.startswith('git/ref/'): out={'object':{'sha':git('rev-parse','refs/heads/main')}}
elif ep.startswith('git/commits/'):
 out={'tree':{'sha':git('rev-parse',ep.split('/')[-1]+'^{tree}')}}
elif ep=='git/blobs':out={'sha':git('hash-object','-w','--stdin',input=base64.b64decode(body['content']))}
elif ep=='git/trees':
 git('read-tree',body['base_tree'])
 for row in body['tree']:git('update-index','--add','--cacheinfo',row['mode'],row['sha'],row['path'])
 out={'sha':git('write-tree')}
elif ep=='git/commits':out={'sha':git('commit-tree',body['tree'],'-p',body['parents'][0],input=body['message'].encode())}
elif ep=='git/refs/heads/main':
 old=git('rev-parse','refs/heads/main')
 if os.environ.get('MOCK_RACE')=='1':
  tree=git('rev-parse',old+'^{tree}'); rival=git('commit-tree',tree,'-p',old,input=b'concurrent commit');git('update-ref','refs/heads/main',rival,old);old=rival
 if body['force'] is not False:raise Exception('force update forbidden')
 p=subprocess.run(['git','-C',str(repo),'merge-base','--is-ancestor',old,body['sha']])
 if p.returncode: print('HTTP 422 non-fast-forward',file=sys.stderr);sys.exit(1)
 git('update-ref','refs/heads/main',body['sha'],old);out={'object':{'sha':body['sha']}}
else:raise Exception(ep)
print(json.dumps(out))
'''
with tempfile.TemporaryDirectory() as tmp:
 t=pathlib.Path(tmp);(t/'bin').mkdir();(t/'repo').mkdir();gh=t/'bin/gh';gh.write_text(MOCK);gh.chmod(0o700)
 env=dict(os.environ,MOCK_DIR=tmp,PATH=str(t/'bin')+':'+os.environ['PATH'],RUNNER_TEMP=tmp,GITHUB_ENV=str(t/'github_env'),GITHUB_REPOSITORY='fixture/repo',BLOB_SHA='a'*40)
 # Receive uses real validators on a fresh, valid sanitized source fixture.
 data=json.loads((AN/'data/cabinet_capture.json').read_text());row=copy.deepcopy(data['snapshots'][-1]);now=dt.datetime.now(dt.timezone.utc);row.update(captured_at=now.isoformat(),day=(now+dt.timedelta(hours=3)-dt.timedelta(days=1)).date().isoformat(),phase='утро',day_in_progress=False)
 payload=json.dumps({'version':1,'company':'GENGLASS','snapshots':[row]}).encode();(t/'server_blob.json').write_text(json.dumps({'encoding':'base64','size':len(payload),'content':base64.b64encode(payload).decode()}))
 # Blob endpoint is a valid40hex in exact source; map fixture expected string.
 gh.write_text(MOCK.replace("ep=='git/blobs/incoming'","ep=='git/blobs/"+'a'*40+"'"))
 env['BASE_SHA']=sh(['git','hash-object','data/cabinet_capture.json'],cwd=AN)
 p=subprocess.run(['bash','-c',receive],cwd=AN,env=env,text=True,capture_output=True);assert p.returncode==0,p.stderr
 env['BASE_SHA']='0'*40;p=subprocess.run(['bash','-c',receive],cwd=AN,env=env,text=True,capture_output=True);assert p.returncode!=0
 print('A5 exact receive shell + actual validators validPASS/badSHAreject PASS')
 # Use a tiny real Git object graph for transactional publication and race.
 repo=t/'repo';subprocess.run(['git','init','-q',str(repo)],check=True)
 for key,val in [('user.name','Fixture'),('user.email','fixture@example.invalid')]:subprocess.run(['git','-C',str(repo),'config',key,val],check=True)
 f=repo/'analytics-mvp/data/cabinet_capture.json';f.parent.mkdir(parents=True);f.write_text(json.dumps(data))
 subprocess.run(['git','-C',str(repo),'add','.'],check=True);subprocess.run(['git','-C',str(repo),'commit','-qm','base'],check=True)
 head=sh(['git','-C',str(repo),'rev-parse','HEAD']);subprocess.run(['git','-C',str(repo),'update-ref','refs/heads/main',head],check=True);env['CHECKED_HEAD']=head
 p=subprocess.run(['bash','-c',publish],cwd=AN,env=env,text=True,capture_output=True);assert p.returncode==0,p.stderr
 new=sh(['git','-C',str(repo),'rev-parse','refs/heads/main']);assert sh(['git','-C',str(repo),'diff','--name-only',head,new])=='analytics-mvp/data/cabinet_capture.json';assert sh(['git','-C',str(repo),'rev-parse',new+'^'])==head
 print('A6 exact publisher shell real Git objects: single changed path, checked soleparent, nonforce PASS')
 subprocess.run(['git','-C',str(repo),'update-ref','refs/heads/main',head],check=True);env['MOCK_RACE']='1'
 p=subprocess.run(['bash','-c',publish],cwd=AN,env=env,text=True,capture_output=True);assert p.returncode!=0,(p.stdout,p.stderr)
 assert sh(['git','-C',str(repo),'log','-1','--format=%s','refs/heads/main'])=='concurrent commit'
 print('A5 race after initial ref read: mockHTTP422, concurrent main preserved PASS')
 env.pop('MOCK_RACE');env['SNAPSHOTS_ACTIVE']='1';(t/'calls').write_text('');p=subprocess.run(['bash','-c',chain],cwd=AN,env=env,text=True,capture_output=True);assert p.returncode==0,p.stderr;assert '"workflow"' not in (t/'calls').read_text()
 print('D7 exact continue shell does not dispatch over active snapshots PASS')
 env['SNAPSHOTS_ACTIVE']='0';(t/'calls').write_text('');p=subprocess.run(['bash','-c',chain],cwd=AN,env=env,text=True,capture_output=True);assert p.returncode==0,p.stderr;assert '"workflow"' in (t/'calls').read_text()
 print('D7 exact continue shell dispatches when both source queues empty PASS')
 # Actual final outcomes shell cannot convert failed orders to green.
 final=orders['jobs']['orders']['steps'][-1]['run'];outcomes={'orders':'failure','realm':'success','reald':'success','pnlsku':'success','acq':'success','pnlacc':'success'}
 script=re.sub(r'\$\{\{ steps\.(\w+)\.outcome \}\}',lambda m:outcomes[m[1]],final)
 p=subprocess.run(['bash','-c',script],cwd=AN,text=True,capture_output=True);assert p.returncode!=0
 outcomes['orders']='success';script=re.sub(r'\$\{\{ steps\.(\w+)\.outcome \}\}',lambda m:outcomes[m[1]],final);assert subprocess.run(['bash','-c',script],cwd=AN,capture_output=True).returncode==0
 print('D7 exact final outcomes shell: failed orders red / allsuccessgreen PASS')
steps=orders['jobs']['orders']['steps'];first=next(s for s in steps if s.get('id')=='orders');assert first['continue-on-error'] is True and first['timeout-minutes']==30
for ident in ['pnlsku','acq','pnlacc','realm','reald']:
 s=next(s for s in steps if s.get('id')==ident);assert s['continue-on-error'] is True;assert 'if' not in s
commit=next(s for s in steps if s.get('name')=='Коммит данных в ветку');assert 'if' not in commit
chain=next(s for s in steps if s.get('name','').startswith('Запуск ozon-snapshots'));assert "!cancelled()" in chain['if'] and "github.ref == 'refs/heads/main'" in chain['if'];assert 'steps.orders' not in chain['if']
source=(AN/'src/scripts/ozon/orders-daily.ts').read_text();assert source.count('writeFileSync("data/orders_accrual_types.json"')==1;assert source.index('if (bad) throw new Error(bad);') < source.index('writeFileSync("data/orders_accrual_types.json"')
print('D7 independent finance/commit/dispatch not gated by failed orders; types write after checkRows PASS (GitHub outcome semantics checked against official docs)')
