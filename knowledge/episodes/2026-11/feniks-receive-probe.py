import pathlib,tempfile,subprocess,json,base64,os,datetime as dt
root=pathlib.Path.cwd();text=(root/'.github/workflows/ozon-cabinet-publish.yml').read_text(); part=text.split('      - name: Receive only')[1].split('      - name: Build and verify')[0];script=part.split('        run: |\n')[1];script='\n'.join(s[10:] for s in script.splitlines())
with tempfile.TemporaryDirectory() as t:
 temp=pathlib.Path(t);os.mkdir(temp/'bin')
 gh=temp/'bin/gh'; gh.write_text('#!/bin/sh\ncat "$FENIKS_BLOB"\n');gh.chmod(0o700)
 raw=json.loads((root/'analytics-mvp/data/cabinet_capture.json').read_text());row=raw['snapshots'][-1].copy();now=dt.datetime.now(dt.timezone.utc);row.update(day=(now+dt.timedelta(hours=3)-dt.timedelta(days=1)).date().isoformat(),captured_at=now.isoformat(),phase='утро',day_in_progress=False)
 payload=json.dumps({'version':1,'company':'GENGLASS','snapshots':[row]}).encode();blob=temp/'blob';blob.write_text(json.dumps({'encoding':'base64','size':len(payload),'content':base64.b64encode(payload).decode()}))
 sha=subprocess.check_output(['git','hash-object','data/cabinet_capture.json'],cwd=root/'analytics-mvp',text=True).strip()
 env=dict(os.environ,PATH=str(temp/'bin')+':'+os.environ['PATH'],FENIKS_BLOB=str(blob),BLOB_SHA='a'*40,BASE_SHA=sha,GITHUB_REPOSITORY='fixture/repo',RUNNER_TEMP=t)
 p=subprocess.run(['bash','-c',script],cwd=root/'analytics-mvp',env=env,text=True,capture_output=True); print('Exact receive step real validators return',p.returncode);print(p.stdout[-250:]);print(p.stderr[-600:]);assert p.returncode==0
 env['BASE_SHA']='0'*40;p=subprocess.run(['bash','-c',script],cwd=root/'analytics-mvp',env=env,text=True,capture_output=True);assert p.returncode!=0;print('Optimistic SHA mismatch exact receive step: rejected PASS')
