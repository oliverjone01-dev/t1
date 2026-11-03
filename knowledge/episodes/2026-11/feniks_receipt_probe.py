import pathlib,sys,subprocess
from unittest.mock import patch
ROOT=pathlib.Path.cwd();sys.path.insert(0,str(ROOT/'analytics-mvp/tools/cabinet'))
from test_submission import Submission,NOW
import submit_capture as client
case=Submission('test_confirmed_failure_gets_only_one_explicit_retry');case.setUp()
try:
 r=client.submit(case.prepared,NOW)
 case.runs=[{'id':9,'display_title':r['run_name'],'status':'completed','conclusion':'failure'}]
 r=client.submit(case.prepared,NOW,retry_failed=True);assert r['attempt']==2
 for _ in range(3):
  r=client.submit(case.prepared,NOW,retry_failed=True)
  assert r['state']=='unknown' and r['attempt']==2 and r['previous_run_id']==9
 assert sum(e.endswith('/dispatches') for e,_ in case.calls)==2
 print('D7 immediate repeat before retry run is indexed: old failed id9 cannot authorize third dispatch PASS')
 case.runs.append({'id':10,'display_title':r['run_name'],'status':'in_progress','conclusion':None})
 assert client.submit(case.prepared,NOW,retry_failed=True)['state']=='server_running'
 case.runs[-1].update(status='completed',conclusion='failure')
 assert client.submit(case.prepared,NOW,retry_failed=True)['state']=='server_failed'
 assert sum(e.endswith('/dispatches') for e,_ in case.calls)==2
 print('D7 indexed retry running/failed retains attempt2 cap PASS')
finally:case.doCleanups()
# API adapter itself must transmit a bounded timeout to the subprocess, not only mocked business logic.
with patch.object(client.subprocess,'run') as run:
 run.return_value.stdout='{}';client.api('fixture');assert run.call_args.kwargs['timeout']==60
print('D8 real client API adapter has timeout60 PASS')
