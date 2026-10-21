from pathlib import Path
import subprocess,tempfile,json,os
rev='509e39c20b03e9f8f952003ba962040cf0e0dcc1'
text=subprocess.check_output(['git','show',rev+':.github/workflows/orders-backfill.yml'],text=True)
start=text.index('          cd "$GITHUB_WORKSPACE"',text.index('- name: Коммит'))
end=text.index('          if git diff --cached --quiet;',start)
fragment='\n'.join(line[10:] for line in text[start:end].splitlines())+'\n'
paths=next(line.strip().split()[2:] for line in fragment.splitlines() if line.strip().startswith('git add analytics-mvp/data/orders_daily'))
base=Path('/private/tmp/ozon-marker-independent');base.mkdir(exist_ok=True);(base/'staging-fragment.sh').write_text(fragment)
results=[]
for name,tracked_marker,write_marker,change_data,expected in [
 ('new_marker_only',False,'new',False,['analytics-mvp/data/collector_status.json']),
 ('absent_marker',False,None,False,[]),
 ('changed_marker_plus_data',True,'new',True,['analytics-mvp/data/collector_status.json','analytics-mvp/data/orders_daily.ndjson']),
 ('unchanged_existing_marker',True,None,False,[]),
 ('unchanged_marker_plus_data',True,None,True,['analytics-mvp/data/orders_daily.ndjson'])]:
 d=Path(tempfile.mkdtemp(prefix='marker-case-',dir=base))
 def git(*args):return subprocess.check_output(['git',*args],cwd=d,text=True).strip()
 git('init','-q');git('config','user.name','Independent audit fixture');git('config','user.email','fixture@example.invalid')
 for p in paths:
  f=d/p;f.parent.mkdir(parents=True,exist_ok=True);f.write_text('{}\n')
 marker=d/'analytics-mvp/data/collector_status.json'
 if tracked_marker:marker.write_text('{"pnl-accrual-daily":{"through":"2026-10-19","loaded_at":"2026-10-20T06:00:00Z"}}\n')
 git('add','analytics-mvp');git('commit','-qm','fixture baseline')
 initial=git('rev-parse','HEAD:analytics-mvp/data/orders_daily.ndjson')
 if write_marker:marker.write_text('{"pnl-accrual-daily":{"through":"2026-10-20","loaded_at":"2026-10-21T06:00:00Z"}}\n')
 if change_data:(d/'analytics-mvp/data/orders_daily.ndjson').write_text('{"fixture":1}\n')
 env=dict(os.environ,GITHUB_WORKSPACE=str(d));p=subprocess.run(['bash','-euo','pipefail','-c',fragment],cwd=d,text=True,capture_output=True,env=env)
 staged=git('diff','--cached','--name-only').splitlines();quiet=subprocess.run(['git','diff','--cached','--quiet'],cwd=d).returncode
 committed=False
 if staged:
  git('commit','-qm','fixture local only');committed=True
  if marker.exists():assert git('show','HEAD:analytics-mvp/data/collector_status.json')==marker.read_text().strip()
 money_unchanged=git('rev-parse','HEAD:analytics-mvp/data/orders_daily.ndjson')==initial
 rec={'case':name,'exit':p.returncode,'staged':staged,'quiet_exit':quiet,'local_commit':committed,'money_blob_unchanged':money_unchanged,'passed':p.returncode==0 and sorted(staged)==sorted(expected) and quiet==(1 if expected else 0)}
 results.append(rec)
assert all(r['passed'] for r in results)
(base/'results.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results,indent=2))
