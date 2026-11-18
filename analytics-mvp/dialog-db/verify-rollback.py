import sys,json,subprocess,urllib.request,tempfile
from pathlib import Path
sys.path.insert(0,'/srv/gg/dialog-db/current')
from server import ingest,connect
c=connect()
with c.cursor() as q:
 q.execute('SELECT hash FROM snapshot');before=q.fetchone()[0]
 q.execute('SELECT count(*) FROM events');previous_count=q.fetchone()[0]
c.close()
# Duplicate primary key fails after TRUNCATE: rollback must preserve the whole prior snapshot.
bad={'generatedAt':'test','events':[],'scoring':{'deals':[{'key':'D1'},{'key':'D1'}]}}
with tempfile.NamedTemporaryFile(mode='w',suffix='.html') as f:
 f.write('const DATA = '+json.dumps(bad));f.flush()
 try:ingest(f.name)
 except Exception:pass
 else:raise AssertionError('invalid import succeeded')
c=connect()
with c.cursor() as q:
 q.execute('SELECT hash FROM snapshot');assert q.fetchone()[0]==before
 q.execute('SELECT count(*) FROM events');assert q.fetchone()[0]==previous_count
c.close()
print('PASS failed import rolls back and preserves prior snapshot and events')
