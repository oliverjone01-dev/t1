import sys,copy,json,tempfile,subprocess,datetime as dt,pathlib
root=pathlib.Path.cwd(); sys.path.insert(0,str(root/'analytics-mvp/tools/cabinet'))
from accept_capture import accept
from watchdog import plan,WORKFLOWS
now=dt.datetime(2026,11,3,9,tzinfo=dt.timezone.utc)
base=json.loads((root/'analytics-mvp/data/cabinet_capture.json').read_text())
row=copy.deepcopy(base['snapshots'][-1]);row.update(day='2026-11-02',captured_at='2026-11-03T08:00:00Z',phase='утро',day_in_progress=False)
old={'version':1,'company':'GENGLASS','snapshots':[]}
incoming={'version':1,'company':'GENGLASS','snapshots':[row]}
def validator(data):
 with tempfile.NamedTemporaryFile(mode='w',suffix='.json') as f:
  json.dump(data,f);f.flush()
  p=subprocess.run(['node','--import','tsx','src/scripts/ozon/validate-cabinet-capture.ts',f.name],cwd=root/'analytics-mvp',capture_output=True,text=True)
  return p.returncode
assert validator(incoming)==0
for field in ['secret_token','raw_report','browser_cookie']:
 bad=copy.deepcopy(incoming);bad['snapshots'][0][field]='SENSITIVE_SENTINEL'
 assert validator(bad)!=0
print('B7 extra public fields rejected at real TS validator: PASS')
bad=copy.deepcopy(incoming);bad['snapshots'][0]['totals']['views']+=1
assert validator(bad)!=0
print('B7 mismatched total rejected: PASS')
result,changes=accept(base,incoming,now)
oldkeys={(r['day'],r['phase']) for r in base['snapshots']}
assert oldkeys <= {(r['day'],r['phase']) for r in result['snapshots']}
assert all(r in result['snapshots'] for r in base['snapshots'] if (r['day'],r['phase']) != ('2026-11-02','утро'))
print('B3 history outside updated day/phase preserved: PASS')
for stamp in ['2026-11-02T08:00:00Z','2026-11-03T10:00:00Z']:
 bad=copy.deepcopy(incoming);bad['snapshots'][0]['captured_at']=stamp
 try: accept(old,bad,now)
 except ValueError: pass
 else: raise AssertionError(stamp)
print('A7 stale/future incoming rejection: PASS')
old=copy.deepcopy(incoming);new=copy.deepcopy(incoming);new['snapshots'][0]['totals']['views']+=1
try: accept(old,new,now)
except ValueError: pass
else: raise AssertionError('same timestamp conflict allowed')
print('A5 same timestamp conflict rejection: PASS')
def r(hour,status='completed',conclusion='success',attempt=1):
 t=now.replace(hour=hour).isoformat(); return dict(id=hour,status=status,conclusion=conclusion,created_at=t,updated_at=t,run_attempt=attempt)
def runs():return dict(zip(WORKFLOWS,[[r(4)],[r(5)],[r(8)],[]]))
for attempt,action in [(1,'rerun'),(2,'attention')]:
 rows=runs();rows[WORKFLOWS[1]]=[r(5,conclusion='failure',attempt=attempt)];assert plan(rows,now)['action']==action
print('D7 retry same run is bounded: PASS')
rows=runs();rows[WORKFLOWS[0]].append(r(8,status='queued',conclusion=None));assert plan(rows,now)['action']=='wait'
print('D7 active pending source never evicted: PASS')
rows=runs();rows[WORKFLOWS[1]]=[];assert plan(rows,now)['workflow']=='ozon-snapshots.yml'
print('D7 missing chain dispatch: PASS')
for status in ['failure','cancelled','timed_out']:
 rows=runs();rows[WORKFLOWS[3]]=[r(7,conclusion=status)]
 print('D7 failed cabinet '+status+': '+json.dumps(plan(rows,now)))

bad=copy.deepcopy(incoming);bad['snapshots'][0]['not_refreshed']=['private_client_name'];assert validator(bad)!=0;print('B7 provenance free text rejected PASS')
