import pathlib,time,shutil,ast
source=pathlib.Path(__file__).resolve().parent
target=pathlib.Path('/opt/gg-audit-bridge')
backup=pathlib.Path('/srv/gg/backups/python-report-routing-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime()));backup.mkdir(mode=0o700)
module=source/'report_links.py';ast.parse(module.read_text(encoding='utf-8'))
path=target/'audit_dispatch_watchdog.py';original=path.read_text();needle='def http(url, token, payload=None):\n'
if 'from report_links import route_payload' not in original:
 if original.count(needle)!=1:raise SystemExit('Unexpected report HTTP function; no changes applied')
 new=original.replace(needle,needle+"    # Resolve only dashboard links at the existing authorized delivery boundary.\n    if url.startswith('https://api.telegram.org/bot') and url.endswith('/sendMessage') and isinstance(payload, dict):\n        from report_links import route_payload\n        payload = route_payload(payload)\n")
 ast.parse(new);shutil.copy2(path,backup/path.name);shutil.copy2(module,target/'report_links.py')
 temp=path.with_suffix('.routing-new');temp.write_text(new);shutil.copymode(path,temp);temp.replace(path)
 print('Python report links installed; delivery paths, tokens, AI calls, recipients and schedules unchanged. No reports executed.')
else:print('Python report link routing already installed')
