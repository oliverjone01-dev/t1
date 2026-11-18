from pathlib import Path
import shutil,subprocess,datetime,os
config=Path('/etc/nginx/sites-available/gg.conf')
assert config.exists()
backup=Path('/srv/gg/backups/dialog-db');backup.mkdir(parents=True,exist_ok=True);backup.chmod(0o700)
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
shutil.copy2(config,backup/('nginx-'+stamp+'.conf'))
s=config.read_text()
block='''    # PostgreSQL dialogue preview: inherits dashboard basic authentication.
    location ^~ /dialog-next/ {
        proxy_pass http://127.0.0.1:18764/;
        proxy_set_header Host $host;
        proxy_read_timeout 15s;
    }

'''
if 'location ^~ /dialog-next/' not in s:
 s=s.replace('    location = /healthz',block+'    location = /healthz')
 config.write_text(s)
 try:subprocess.run(['nginx','-t'],check=True)
 except Exception:
  shutil.copy2(backup/('nginx-'+stamp+'.conf'),config);raise
 subprocess.run(['systemctl','reload','nginx'],check=True)
with open(backup/('gg_dialog-'+stamp+'.dump'),'wb') as f:subprocess.run(['runuser','-u','postgres','--','pg_dump','-Fc','gg_dialog'],stdout=f,check=True)
print('preview configured; backup saved; legacy route unchanged')
