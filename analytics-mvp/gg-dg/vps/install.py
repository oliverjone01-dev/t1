#!/usr/bin/python3
"""Transactional DG install from an audited package over SSH stdin."""
import base64,datetime,fcntl,grp,hashlib,http.client,json,os,pathlib,pwd,re,shutil,ssl,subprocess,sys,time
payload=json.load(sys.stdin)
fingerprint=payload['fingerprint']
assert re.fullmatch('[a-f0-9]{64}',fingerprint)
assert payload['username']=='domglass' and re.fullmatch('[A-Za-z0-9_-]{24,}',payload['password'])
BASE=pathlib.Path('/srv/gg/dg'); WEB=pathlib.Path('/srv/gg/dg-www'); STATE=BASE/'state'
CODE=BASE/'code/releases'/fingerprint
# Provision this one-setting file separately. This installer never opens shared environments.
secret=pathlib.Path('/etc/gg-dg/bitrix.env')
assert secret.is_file() and not secret.is_symlink() and secret.stat().st_uid==0 and secret.stat().st_mode&0o077==0, 'Dedicated Bitrix environment required'
os.umask(0o027)
def command(args,check=True,**kw):
    r=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,**kw)
    if check and r.returncode: raise RuntimeError('Command failed: '+args[0])
    return r
try: account=pwd.getpwnam('gg-dg')
except KeyError:
    command(['/usr/sbin/useradd','--system','--user-group','--home-dir',str(BASE),'--no-create-home','--shell','/usr/sbin/nologin','gg-dg'])
    account=pwd.getpwnam('gg-dg')
uid,gid=account.pw_uid,account.pw_gid
web_gid=grp.getgrnam('www-data').gr_gid
def directory(p,owner,group,mode):
    p.mkdir(parents=True,exist_ok=True)
    assert not p.is_symlink()
    os.chown(p,owner,group);p.chmod(mode)
for p in [BASE,BASE/'code',BASE/'code/releases',CODE]: directory(p,0,gid,0o750)
directory(STATE,uid,gid,0o700)
for p in [WEB,WEB/'releases']: directory(p,uid,web_gid,0o2750)
lock=(BASE/'install.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
def write_source(relative,content):
    assert re.fullmatch(r'[A-Za-z0-9_./-]+',relative) and '..' not in pathlib.PurePosixPath(relative).parts
    target=CODE/relative
    assert target.resolve().is_relative_to(CODE.resolve()) and not target.is_symlink()
    parent=CODE
    for part in target.parent.relative_to(CODE).parts:
        parent=parent/part;directory(parent,0,gid,0o750)
    if target.exists():
        assert target.read_bytes()==content, 'Immutable source mismatch'
    else:
        target.write_bytes(content);os.chown(target,0,gid);target.chmod(0o640)
for name,encoded in payload['files'].items(): write_source(name,base64.b64decode(encoded,validate=True))
for name,encoded in payload['reference'].items():
    content=base64.b64decode(encoded,validate=True)
    assert hashlib.sha256(content).hexdigest()==payload['referenceSha256'][name]
    write_source('reference/'+name,content)
write_source('release.json',json.dumps({'fingerprint':fingerprint,'gitCommit':payload['gitCommit'],'referenceSha256':payload['referenceSha256']}).encode())
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S')+'-'+str(os.getpid())
rollback=BASE/'rollback'/stamp;directory(rollback,0,0,0o700)
conf=pathlib.Path('/etc/nginx/sites-enabled/gg.conf').resolve()
assert conf==pathlib.Path('/etc/nginx/sites-available/gg.conf')
snippet=pathlib.Path('/etc/nginx/snippets/gg-dg.conf')
unit_dir=pathlib.Path('/etc/systemd/system')
unit_names=['gg-dg-refresh.service','gg-dg-refresh.timer','gg-dg-prepare.service']
targets=[conf,snippet,*[unit_dir/n for n in unit_names]]
saved={}
def save_file(target):
    assert not target.is_symlink()
    if target.exists():
        stat=target.stat();backup=rollback/str(len(saved));shutil.copy2(target,backup)
        saved[target]=(backup,stat.st_uid,stat.st_gid,stat.st_mode&0o777)
    else: saved[target]=None
for target in targets: save_file(target)
def restore_file(target):
    old=saved[target]
    if old:
        shutil.copy2(old[0],target);os.chown(target,old[1],old[2]);target.chmod(old[3])
    elif target.exists(): target.unlink()
def link_target(p):
    assert not p.exists() or p.is_symlink()
    return os.readlink(p) if p.is_symlink() else None
links={}
def set_link(p,target):
    temp=p.with_name(p.name+'.install-next')
    if temp.is_symlink(): temp.unlink()
    if target is None:
        if p.is_symlink(): p.unlink()
    else:
        temp.symlink_to(target);os.replace(temp,p)
timer_active=command(['/usr/bin/systemctl','is-active','--quiet','gg-dg-refresh.timer'],check=False).returncode==0
timer_enabled=command(['/usr/bin/systemctl','is-enabled','--quiet','gg-dg-refresh.timer'],check=False).returncode==0
service_active=command(['/usr/bin/systemctl','is-active','--quiet','gg-dg-refresh.service'],check=False).returncode==0
auth_dir=pathlib.Path('/etc/nginx/gg-dg');directory(auth_dir,0,web_gid,0o750)
auth_path=auth_dir/(fingerprint[:12]+'-'+stamp+'.htpasswd')
nginx_touched=False
touched=set()
try:
    # Stop only DG scheduling; the previous authenticated page remains available.
    for name in ['gg-dg-refresh.timer','gg-dg-refresh.service']:
        state=command(['/usr/bin/systemctl','show','--property=LoadState','--value',name],check=False)
        if state.stdout.strip()==b'not-found': continue
        if state.returncode: raise RuntimeError('Cannot inspect DG unit')
        command(['/usr/bin/systemctl','stop',name])
    # Capture one consistent generation only after the writer has stopped.
    for target in [STATE/'snapshot.json',STATE/'last-success.json']: save_file(target)
    links={BASE/'code/current':link_target(BASE/'code/current'),WEB/'current':link_target(WEB/'current')}
    prepare=(CODE/'vps/gg-dg-refresh.service').read_text().replace('ExecStart=/usr/bin/python3 /srv/gg/dg/code/current/vps/refresh.py','ExecStart=/usr/bin/python3 '+str(CODE/'vps/refresh.py')+' --prepare')
    touched.add(unit_dir/'gg-dg-prepare.service');(unit_dir/'gg-dg-prepare.service').write_text(prepare)
    command(['/usr/bin/systemctl','daemon-reload'])
    command(['/usr/bin/systemctl','start','gg-dg-prepare.service'],timeout=610)
    prepared=json.loads((STATE/'prepared.json').read_text())
    release=pathlib.Path(prepared['release'])
    assert release.resolve().parent==(WEB/'releases').resolve() and not release.is_symlink()
    manifest=json.loads((release/'manifest.json').read_text())
    assert manifest['code']['fingerprint']==fingerprint
    # Every attempt gets a new auth file: never mutate the active password file.
    auth=command(['/usr/bin/htpasswd','-niB','-C','10',payload['username']],input=(payload['password']+'\n').encode()).stdout
    auth_path.write_bytes(auth);os.chown(auth_path,0,web_gid);auth_path.chmod(0o640)
    before=conf.read_text();marker='    auth_basic_user_file /etc/nginx/gg.htpasswd;\n'
    include='    include /etc/nginx/snippets/gg-dg.conf;\n'
    assert before.count(marker)==1
    candidate=before if include in before else before.replace(marker,marker+include)
    # Do not overwrite a concurrent change to the shared nginx configuration.
    for target in [conf,snippet]:
        assert (target.read_bytes() if target.exists() else None)==(saved[target][0].read_bytes() if saved[target] else None), 'Nginx changed during preparation'
    touched.update([conf,snippet])
    snippet.write_text((CODE/'vps/nginx.conf').read_text().replace('/etc/nginx/gg-dg.htpasswd',str(auth_path)).replace('__DG_RELEASE__',fingerprint));snippet.chmod(0o644)
    nginx_touched=True;conf.write_text(candidate)
    command(['/usr/sbin/nginx','-t'])
    set_link(BASE/'code/current',CODE)
    set_link(WEB/'current',release)
    touched.update([STATE/'snapshot.json',STATE/'last-success.json'])
    os.replace(STATE/'snapshot.next.json',STATE/'snapshot.json')
    (STATE/'last-success.json').write_text(json.dumps(manifest));os.chown(STATE/'last-success.json',uid,gid)
    for name in ['gg-dg-refresh.service','gg-dg-refresh.timer']:
        target=unit_dir/name;touched.add(target);target.write_bytes((CODE/'vps'/name).read_bytes());target.chmod(0o644)
    command(['/usr/bin/systemctl','daemon-reload'])
    command(['/usr/bin/systemctl','reload','nginx'])
    authorization='Basic '+base64.b64encode((payload['username']+':'+payload['password']).encode()).decode()
    def status(path,authenticated,with_release=False):
        connection=http.client.HTTPSConnection('dash.genglas.ru',timeout=20,context=ssl.create_default_context())
        connection.request('GET',path,headers={'Authorization':authorization} if authenticated else {})
        response=connection.getresponse();code=response.status;version=response.getheader('X-DG-Release');response.read();connection.close();return (code,version) if with_release else code
    # reload is asynchronous: old workers can still answer with the GG auth realm.
    # Wait for this exact route generation before testing its credentials.
    for attempt in range(40):
        if status('/gg-dg/',False,True)==(401,fingerprint): break
        time.sleep(0.25)
    else: raise RuntimeError('DG route generation did not become ready')
    checks=[]
    for path in ['/gg-dg/','/gg-dg/index.html','/gg-dg/v.txt']:
        for authenticated,expected in [(False,401),(True,200)]:
            actual=status(path,authenticated);checks.append([path,authenticated,actual]);assert actual==expected,(path,actual)
    for path in ['/','/rop/','/dialog/','/_system/api/inventory','/gg-dg/../rop/','/gg-dg/%2e%2e/_system/api/inventory']:
        actual=status(path,True);checks.append([path,True,actual]);assert actual==401,(path,actual)
    for path in ['/gg-dg/.env','/gg-dg/missing','/gg-dg/manifest.json']:
        actual=status(path,True);checks.append([path,True,actual]);assert actual==404,(path,actual)
    restore_file(unit_dir/'gg-dg-prepare.service')
    command(['/usr/bin/systemctl','daemon-reload'])
    command(['/usr/bin/systemctl','enable','--now','gg-dg-refresh.timer'])
    verification={'url':'https://dash.genglas.ru/gg-dg/','fingerprint':fingerprint,'generatedAt':manifest['generatedAt'],'leads':manifest['leads'],'deals':manifest['deals'],'authChecks':checks}
    (STATE/'deployment-verification.json').write_text(json.dumps(verification))
    print(json.dumps(verification))
except BaseException:
    command(['/usr/bin/systemctl','stop','gg-dg-refresh.timer','gg-dg-refresh.service','gg-dg-prepare.service'],check=False)
    for target in touched: restore_file(target)
    for p,target in links.items(): set_link(p,target)
    command(['/usr/bin/systemctl','daemon-reload'])
    if nginx_touched:
        command(['/usr/sbin/nginx','-t'])
        command(['/usr/bin/systemctl','reload','nginx'])
    if auth_path.exists(): auth_path.unlink()
    command(['/usr/bin/systemctl','enable' if timer_enabled else 'disable','gg-dg-refresh.timer'],check=False)
    enabled_link=pathlib.Path('/etc/systemd/system/timers.target.wants/gg-dg-refresh.timer')
    if not timer_enabled and enabled_link.is_symlink(): enabled_link.unlink()
    if timer_active: command(['/usr/bin/systemctl','start','gg-dg-refresh.timer'])
    if service_active: command(['/usr/bin/systemctl','start','gg-dg-refresh.service'])
    raise
