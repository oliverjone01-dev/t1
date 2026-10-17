import json,os,shutil,subprocess
from pathlib import Path
dest=Path('/usr/local/lib/gg-migration-compare');dest.mkdir(exist_ok=True)
shutil.copy2(Path(__file__).with_name('migration-compare.py'),dest/'migration-compare.py')
service='''[Unit]
Description=GENGROUP GitHub versus VPS migration check
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/etc/gg/secrets.env
ExecStart=/usr/bin/python3 /usr/local/lib/gg-migration-compare/migration-compare.py --send
UMask=0027
TimeoutStartSec=20min
Nice=10
PrivateTmp=true
NoNewPrivileges=true
'''
timer='''[Unit]
Description=GENGROUP migration checks at 22:00 Moscow, through October 10

[Timer]
OnCalendar=2026-10-07..10 19:00:00 UTC
Persistent=true
Unit=gg-migration-compare.service

[Install]
WantedBy=timers.target
'''
for name,text in [('service',service),('timer',timer)]:Path('/etc/systemd/system/gg-migration-compare.'+name).write_text(text)
root=Path('/srv/gg/state/migration-compare');root.mkdir(exist_ok=True)
missed=root/'2026-10-06.json'
if not missed.exists():missed.write_text(json.dumps({'date':'2026-10-06','status':'unavailable','reason':'No verified execution or archived same-time VPS snapshot; historical success must not be fabricated.'},indent=2))
delivery=Path('/srv/gg/state/digest-delivery')
subprocess.run(['chown','-R','gg:gg',str(delivery)],check=True);delivery.chmod(0o750)
subprocess.run(['systemd-analyze','verify','/etc/systemd/system/gg-migration-compare.service','/etc/systemd/system/gg-migration-compare.timer'],check=True)
subprocess.run(['systemctl','daemon-reload'],check=True)
subprocess.run(['systemctl','enable','--now','gg-migration-compare.timer'],check=True)
print('Installed native VPS timer at 22:00 MSK for Oct 7–10; Oct 6 recorded as missed')

