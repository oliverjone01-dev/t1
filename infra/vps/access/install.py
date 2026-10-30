#!/usr/bin/env python3
import hashlib,json,os,pathlib,pwd,grp,re,shutil,subprocess,sys,time
source=pathlib.Path(__file__).resolve().parent
def run(*args):subprocess.run(args,check=True)
try:pwd.getpwnam('gg-access')
except KeyError:run('useradd','--system','--no-create-home','--shell','/usr/sbin/nologin','--gid','www-data','gg-access')
uid=pwd.getpwnam('gg-access').pw_uid;gid=grp.getgrnam('www-data').gr_gid
data=pathlib.Path('/srv/gg/access');data.mkdir(mode=0o750,exist_ok=True);os.chown(data,uid,gid);os.chmod(data,0o750)
common=pathlib.Path('/etc/nginx/gg.htpasswd');users=data/'users.htpasswd';admins=data/'admins.json'
backup=pathlib.Path('/srv/gg/backups/access-ui-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime()));backup.mkdir(mode=0o700)
shutil.copy2(common,backup/'gg.htpasswd')
if not users.exists():shutil.copyfile(common,users)
if not admins.exists():
 if 'yanchoglov' not in {line.split(':',1)[0] for line in users.read_text().splitlines()}:raise SystemExit('Administrator yanchoglov is missing; no nginx changes applied')
 admins.write_text(json.dumps(['yanchoglov'])+'\n')
for p,mode in [(users,0o640),(admins,0o600)]:os.chown(p,uid,gid);os.chmod(p,mode)
link=common.with_name('gg.htpasswd.access-tmp');link.unlink(missing_ok=True);link.symlink_to(users);os.replace(link,common)
current=pathlib.Path('/srv/gg/access-api/current');current.parent.mkdir(exist_ok=True);tmp=current.with_name('.current.tmp');tmp.unlink(missing_ok=True);tmp.symlink_to(source);os.replace(tmp,current)
shutil.copy2(source/'gg-access-api.service','/etc/systemd/system/gg-access-api.service')
run('systemctl','daemon-reload');run('systemctl','enable','--now','gg-access-api.service');run('systemctl','restart','gg-access-api.service')
config=pathlib.Path('/etc/nginx/sites-available/gg.conf');text=config.read_text();shutil.copy2(config,backup/'gg.conf')
shutil.copy2(source/'gg-access.conf','/etc/nginx/snippets/gg-access.conf')
include='    include /etc/nginx/snippets/gg-access.conf;'
if 'include /etc/nginx/snippets/gg-access' not in text:
 marker='    auth_basic_user_file /etc/nginx/gg.htpasswd;'
 if text.count(marker)!=1:raise SystemExit('Unexpected nginx auth configuration')
 config.write_text(text.replace(marker,marker+'\n'+include))
try:run('nginx','-t');run('systemctl','reload','nginx')
except Exception:
 shutil.copy2(backup/'gg.conf',config);run('nginx','-t');run('systemctl','reload','nginx');raise
print('Access administration installed; existing passwords preserved; backup:',backup)
