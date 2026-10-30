from pathlib import Path
import zipfile,sys,re
archive,site=map(Path,sys.argv[1:]);dest=site/'widget-lab';dest.mkdir(exist_ok=True)
ops=Path(__file__).resolve().parent
src=ops/'widget-gallery'
with zipfile.ZipFile(archive) as z:
 for item in z.infolist():
  if not item.filename.startswith('core/') or item.is_dir():continue
  path=dest/item.filename
  if not path.resolve().is_relative_to(dest.resolve()):raise ValueError('Unsafe gallery archive entry')
  path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(z.read(item))
for name in ('gallery.css','gallery.js','catalog.js'):(dest/name).write_bytes((src/name).read_bytes())
template=(ops/'workspace.html').read_text()
aside=re.search(r'<aside\b.*?</aside>',template,re.S)[0]
aside=aside.replace('href="#sec','href="/rop/#sec')
aside=aside.replace('РОП GENGLASS</summary>','РОП GG</summary>')
aside=aside.replace('<!-- MANAGERS -->',''.join('<a href="/rop-'+slug+'/">'+name+'</a>' for slug,name in [('lysanova','Юлия Лысанова'),('lakomova','Татьяна Лакомова'),('shura-bura','Юлия Шура-Бура'),('fomicheva','Татьяна Фомичева'),('lobova','Надежда Лобова'),('kubanova','Алёна Кубанова'),('filatova','Алёна Филатова')]))
aside=aside.replace('<a href="/widget-lab/">','<a class="gg-current" aria-current="page" href="/widget-lab/">')
aside=aside.replace('<details open>','<details>')
aside=aside.replace('<a href="/dialog/">Сводка','<a href="/dialog/#summary">Сводка').replace('<a href="/dialog/">Хронология','<a href="/dialog/#chronology">Хронология').replace('<a href="/dialog/">ИИ-разборы','<a href="/dialog/#ai-analysis">ИИ-разборы')
aside=re.sub(r'<a class="gg-brand".*?</a>','<a class="gg-brand" href="/" aria-label="GENGLASS · рабочее пространство"><span class="gg-monogram"><img src="/brand/genglass-mark.svg" alt=""></span><span class="gallery-brand-copy"><img src="/brand/genglass-logo.svg" alt="GENGLASS"><small>Рабочее пространство · GENGROUP</small></span></a>',aside,count=1,flags=re.S)
home=(site/'index.html').read_text()
market=re.search(r'<details[^>]*>\s*<summary[^>]*>[^<]*Маркетплейсы.*?</details>',home,re.S)
aside=aside.replace('</nav>',(market[0] if market else '<details><summary>▦ <span>Маркетплейсы</span></summary><div class="gg-subnav"><a href="/ozon-research/">Исследование OZON</a></div></details>')+'</nav>')
css=(ops/'workspace.css').read_text()+'\n'+(ops/'workspace-pages.css').read_text()+'\n'+(ops/'rop-approved-design.css').read_text()
(dest/'workspace.css').write_text(css)
js=(ops/'workspace-pages.js').read_text();end=js.index(' function metricRows()')
shell=js[:end]+'\n})();\n'
shared=(ops/'shared-shell.js').read_text();marker='// GG_GALLERY_NAV_FIX'
if marker in shared:shell+=shared[shared.index(marker):]
(dest/'shell.js').write_text(shell)
boot="<script>document.documentElement.dataset.theme='dark';document.documentElement.dataset.sidebarMode='compact';try{document.documentElement.dataset.theme=localStorage.getItem('gg-hub-theme')==='light'?'light':'dark';document.documentElement.dataset.sidebarMode=localStorage.getItem('gg-sidebar-mode')||'compact';}catch(e){}</script>"
html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Галерея виджетов · GENGLASS</title>'+boot+'<link rel="icon" href="/brand/genglass-favicon.svg"><link rel="stylesheet" href="workspace.css"><link rel="stylesheet" href="gallery.css"></head><body><div id="gg-workspace">'+aside+'<main class="gg-main"><header class="gg-topbar"><button id="gg-menu" class="gg-icon-button" aria-label="Открыть меню">☰</button><div class="gg-breadcrumb">GENGROUP / Тестовые виджеты / Галерея</div><button id="gg-theme" class="gg-icon-button" aria-label="Переключить тему">◐</button></header><div class="gg-content">'+(src/'gallery.html').read_text()+'</div></main><button id="gg-backdrop" aria-label="Закрыть меню" hidden></button></div><script src="shell.js"></script><script src="catalog.js"></script><script src="gallery.js"></script></body></html>'
(dest/'index.html').write_text(html)
print('GG widget gallery published with shared workspace shell and synthetic examples')
