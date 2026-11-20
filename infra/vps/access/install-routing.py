import pathlib,subprocess,time,shutil,pwd,grp,os,json,hashlib
stamp=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime());backup=pathlib.Path('/srv/gg/backups/routing-'+stamp);backup.mkdir(mode=0o700)
source=pathlib.Path(__file__).resolve().parent;release=pathlib.Path('/srv/gg/access-api/releases/ip-routing-'+stamp);release.mkdir(mode=0o755)
for f in ['server.py','routing.py','routing-panel.js','recovery.html']:shutil.copy2(source/f,release/f);os.chmod(release/f,0o644)
uid=pwd.getpwnam('gg-access').pw_uid;gid=grp.getgrnam('www-data').gr_gid
routing=pathlib.Path('/srv/gg/routing');routing.mkdir(mode=0o755,exist_ok=True);os.chown(routing,uid,gid)
state=routing/'mode.json'
if not state.exists():
 state.write_text(json.dumps({'mode':'ip','updatedBy':'system:owner-requested-emergency-setup','updatedAt':stamp})+'\n');os.chown(state,uid,gid);os.chmod(state,0o644)
hashfile=pathlib.Path('/srv/gg/access/users.htpasswd');before=hashlib.sha256(hashfile.read_bytes()).digest()
current=pathlib.Path('/srv/gg/access-api/current');(backup/'previous-service-target.txt').write_text(str(current.readlink())+'\n')
fallback=release.parent/('fallback-'+stamp)
previous=current.resolve()
shutil.copytree(previous if previous.is_dir() else source,fallback)
os.chmod(fallback,0o755)
for item in fallback.iterdir():
 if item.is_file():os.chmod(item,0o644)
drop=pathlib.Path('/etc/systemd/system/gg-access-api.service.d');drop.mkdir(exist_ok=True)
(drop/'routing.conf').write_text('[Service]\nReadWritePaths=/srv/gg/routing\nEnvironment=GG_ROUTING_STATE=/srv/gg/routing/mode.json\n')
temp=current.with_name('.current-routing');temp.unlink(missing_ok=True);temp.symlink_to(release);os.replace(temp,current)
subprocess.run(['systemctl','daemon-reload'],check=True)
try:subprocess.run(['systemctl','restart','gg-access-api'],check=True)
except Exception:
 temp.symlink_to(fallback);os.replace(temp,current);subprocess.run(['systemctl','restart','gg-access-api']);raise
files=[pathlib.Path('/etc/nginx/sites-available/gg.conf'),pathlib.Path('/etc/nginx/sites-available/gg-emergency-ip.conf'),pathlib.Path('/etc/nginx/snippets/gg-access.conf')]
for f in files:shutil.copy2(f,backup/f.name)
snippet=pathlib.Path('/etc/nginx/snippets/gg-routing.conf');shutil.copy2(source/'gg-routing.conf',snippet)
access=files[2];text=access.read_text()
if 'auth_request off;' not in text:text=text.replace('location ^~ /_access/api/ {','location ^~ /_access/api/ {\n    auth_request off;')
text=text.replace('proxy_set_header Host $host;','proxy_set_header Host $host;\n    proxy_set_header X-GG-Request-Host $host;\n    proxy_set_header X-GG-Request-Port $server_port;')
access.write_text(text)
for f in files[:2]:
 text=f.read_text();marker='    include /etc/nginx/snippets/gg-access.conf;'
 if text.count(marker)!=1:raise SystemExit('Unexpected GG include count; no nginx reload')
 if 'include /etc/nginx/snippets/gg-routing.conf;' not in text:text=text.replace(marker,marker+'\n    include /etc/nginx/snippets/gg-routing.conf;')
 text=text.replace('location ^~ /_audit-bridge/ {','location ^~ /_audit-bridge/ {\n        auth_request off;')
 text=text.replace('location = /healthz { auth_basic off;','location = /healthz { auth_request off; auth_basic off;')
 f.write_text(text)
try:subprocess.run(['nginx','-t'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True)
except Exception:
 for f in files:shutil.copy2(backup/f.name,f)
 subprocess.run(['nginx','-t'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True);raise
assert hashlib.sha256(hashfile.read_bytes()).digest()==before
print('Owner-only routing API installed; initial mode=IP; passwords unchanged; root and recovery protected; backup:',backup)
