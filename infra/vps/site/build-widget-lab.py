from pathlib import Path
import zipfile,sys
archive,site=map(Path,sys.argv[1:]);dest=site/'widget-lab';dest.mkdir(exist_ok=True)
with zipfile.ZipFile(archive) as z:
    for item in z.infolist():
        path=dest/item.filename
        if not path.resolve().is_relative_to(dest.resolve()):raise ValueError('Unsafe lab archive entry')
    z.extractall(dest)
# Append a local lab link to each shell without editing embedded business scripts.
for path in [site/'index.html',site/'structure/index.html',site/'dashboards/index.html',*site.glob('*/index.html')]:
    if not path.is_file() or path.parent==dest:continue
    source=path.read_text()
    if 'href="/widget-lab/"' in source:continue
    if '<nav class="gg-nav">' in source:source=source.replace('</nav>','<a href="/widget-lab/">◇ <span>Тестовые виджеты</span></a></nav>',1)
    elif '<nav class="nav">' in source:source=source.replace('</nav>','<a class="org-nav-link" href="/widget-lab/">◇ Тестовые виджеты</a></nav>',1)
    else:continue
    temp=path.with_name(path.name+'.lab-new');temp.write_text(source);temp.replace(path)
print('TURBIUM widget lab published; synthetic examples only; production scripts untouched')
