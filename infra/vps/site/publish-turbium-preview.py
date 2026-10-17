from pathlib import Path
import zipfile,subprocess,shutil
root=Path('/srv/gg/public/turbium-kit');root.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile('/srv/gg/cache/TURBIUM_Dashboard_Kit.zip') as archive:
 for entry in archive.infolist():
  parts=Path(entry.filename).parts
  if not parts or parts[0]!='TURBIUM_Dashboard_Kit' or '..' in parts:raise SystemExit('Invalid archive path')
  relative=Path(*parts[1:])
  if not parts[1:] or entry.is_dir():continue
  # Static kit assets only; no scripts from the package are executed.
  if relative.suffix.lower() not in {'.html','.css','.js','.svg','.ttf','.txt','.json'}:continue
  target=root/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.read(entry))
(root/'index.html').write_text('''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TURBIUM · Каталог из архива</title><link rel="stylesheet" href="core/fonts.css"><style>body{margin:0;background:#0f1216;color:#e9ebef;font:16px "Golos Text",sans-serif}main{max-width:860px;margin:10vh auto;padding:24px}h1{font-size:32px}p{color:#989faa;line-height:1.6}a{display:block;color:#83c9ae;text-decoration:none;border:1px solid #2a2e34;background:#171a1f;border-radius:12px;padding:24px;margin:16px 0}small{display:block;color:#989faa;margin-top:8px}</style></head><body><main><h1>TURBIUM · Виджеты и дизайн-система</h1><p>Примеры из предоставленного архива Dashboard Kit. Открываются без входа.</p><a href="reference/index.html">Дизайн-система и каталог компонентов<small>Цвета, типографика, диаграммы и состояния</small></a><a href="examples/starter.html">Примеры виджетов Dashboard Kit<small>Интерактивные компоненты и визуализации</small></a></main></body></html>''')
config=Path('/etc/nginx/sites-available/gg.conf');text=config.read_text()
marker='    # TURBIUM: public static examples supplied by the user; no dashboard data.\n'
location=marker+'    location ^~ /turbium-kit/ {\n        auth_basic off;\n        alias /srv/gg/public/turbium-kit/;\n        index index.html;\n        autoindex off;\n    }\n\n'
if marker not in text:
 backup=config.with_name('gg.conf.before-turbium-preview');shutil.copy2(config,backup)
 config.write_text(text.replace('    # Проверка живости',location+'    # Проверка живости',1))
 try:subprocess.run(['nginx','-t'],check=True)
 except Exception:shutil.copy2(backup,config);raise
 subprocess.run(['systemctl','reload','nginx'],check=True)
print('Static TURBIUM archive preview published; dashboard authentication unchanged')

