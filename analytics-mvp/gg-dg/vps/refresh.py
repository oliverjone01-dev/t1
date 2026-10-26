#!/usr/bin/python3
"""DG-only refresh. No shared environment, wrappers, API proxy, or notifications."""
import datetime,fcntl,json,os,pathlib,re,shutil,subprocess,sys
BASE=pathlib.Path('/srv/gg/dg')
STATE=BASE/'state'
WEB=pathlib.Path('/srv/gg/dg-www')
CODE=pathlib.Path(__file__).resolve().parent.parent
REF=CODE/'reference'
os.umask(0o027)
lock=(STATE/'refresh.lock').open('a')
fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S')+'-'+str(os.getpid())
release=WEB/'releases'/stamp
stage='prepare'
safe_env={'PATH':'/usr/bin:/bin','NODE_NO_WARNINGS':'1'}
def run(args,env):
    result=subprocess.run(args,env=env,cwd=STATE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=540)
    if result.returncode: raise RuntimeError('exit '+str(result.returncode))
try:
    stage='compile collector'
    run(['/usr/bin/node',str(CODE/'collect-widgets.cjs'),str(REF),str(STATE/'collector.mjs')],safe_env)
    stage='collect'
    key=os.environ['B24_WEBHOOK_URL']
    run(['/usr/bin/node',str(STATE/'collector.mjs')],dict(safe_env,B24_WEBHOOK_URL=key,B24_CONC='2',GG_DG_OUTPUT=str(STATE/'snapshot.next.json')))
    stage='validate and build'
    run(['/usr/bin/node',str(CODE/'build-widgets.cjs'),str(STATE/'snapshot.next.json'),str(REF),str(release)],safe_env)
    manifest=json.loads((release/'manifest.json').read_text())
    manifest['code']=json.loads((CODE/'release.json').read_text())
    (release/'manifest.json').write_text(json.dumps(manifest))
    if '--prepare' in sys.argv:
        (STATE/'prepared.json').write_text(json.dumps({'release':str(release),'manifest':manifest}))
        print(json.dumps({'prepared':True,'fingerprint':manifest['code']['fingerprint']}))
        sys.exit(0)
    os.replace(STATE/'snapshot.next.json',STATE/'snapshot.json')
    next_link=WEB/'current.next'
    if next_link.is_symlink(): next_link.unlink()
    next_link.symlink_to(release)
    os.replace(next_link,WEB/'current')
    (STATE/'last-success.json').write_text(json.dumps(manifest))
    # Retain the latest five successful releases; never follow an unknown directory.
    candidates=sorted((p for p in (WEB/'releases').iterdir() if re.fullmatch(r'\d{8}T\d{6}-\d+',p.name) and p.is_dir() and not p.is_symlink()),reverse=True)
    for old in candidates[5:]:
        if old.resolve().parent==(WEB/'releases').resolve() and old!=release: shutil.rmtree(old)
    print(json.dumps({'ok':True,'generatedAt':manifest['generatedAt'],'leads':manifest['leads'],'deals':manifest['deals']}))
except Exception as exc:
    # Raw CRM error bodies and URLs must never reach service logs.
    (STATE/'last-failure.json').write_text(json.dumps({'at':stamp,'stage':stage,'type':type(exc).__name__}))
    print('DG refresh failed at '+stage+'; last successful release retained.',file=sys.stderr)
    sys.exit(1)
