#!/usr/bin/env python3
"""Place published native dashboards in the common shell without changing scripts/data."""
import hashlib,html,json,re,sys
from pathlib import Path
template,style,behavior,site=map(Path,sys.argv[1:])
base=template.read_text()
start=base.index('  <div class="gg-filter-toolbar">')
end=base.index('  <!-- DASHBOARD -->',start)
base=base[:start]+base[end:]
start=base.index('<button id="gg-filter-backdrop"')
end=base.index('<button id="gg-backdrop"',start)
base=base[:start]+base[end:]
roster=[]
names={}
for row in (site/'.gg/managers.txt').read_text().splitlines():
    slug,_,name=row.partition('\t');names[slug]=name
    roster.append(f'<a href="/{slug}/">{html.escape(name)}</a>')
base=base.replace('<!-- MANAGERS -->','\n'.join(roster))
sections={'rop-gm':('РОП GLASS MEMORY','Продажи','gm'),'office':('Офис','Продажи','gg'),'dialog':('Хронология диалогов','Коммуникации','gg'),'prod':('Производство','Исполнение заказов','gg'),'pto':('ПТО','Исполнение заказов','gg'),'economics':('Экономика','Операционный отдел','gg'),'integra':('Замеры / Монтажи','Исполнение заказов','gg')}
sections.update({slug:(name,'Продажи','gg') for slug,name in names.items()})
sections.update({'op-gm':('Разбор переговоров','Коммуникации','gm'),'kp-gm':('Коммерческие предложения','Продажи','gm'),'messages':('Сообщения','Коммуникации','gg'),'plan':('Планы и материалы','Планы и материалы','gg'),'smm':('Социальные сети','Маркетинг','gg'),'markplan':('План маркетинга','Маркетинг','gg'),'stand-protocol':('Протокол стенда','Планы и материалы','gg'),'ozon-research':('Исследование OZON','Маркетинг','gg'),'econ-control':('Контроль экономики','Операционный отдел','gg')})
css=style.read_text()+'\n'+(style.parent/'workspace-pages.css').read_text()
js=behavior.read_text()
report=[]
def atomic(path,text):
    temporary=path.with_name(path.name+'.workspace-new');temporary.write_text(text);temporary.replace(path)
for slug,(title,department,company) in sections.items():
    target=site/slug/'index.html'
    if not target.is_file():continue
    source=target.read_text()
    if 'id="gg-workspace"' in source:raise SystemExit('Expected freshly built native document: '+slug)
    split=re.search(r'<body\b[^>]*>',source,re.I)
    if not split:raise SystemExit('Missing body: '+slug)
    head=source[:split.start()]
    body=re.split(r'</body>',source[split.end():],flags=re.I)[0]
    scripts=re.findall(r'<script\b[^>]*>.*?</script>',source,re.S)
    shell=base.replace('<h1>РОП GENGLASS</h1>','<h1>'+html.escape(title)+'</h1>')
    shell=shell.replace('Результаты отдела, воронка, менеджеры и дисциплина.','Рабочий дашборд · '+html.escape(department))
    brand='GLASS MEMORY' if company=='gm' else 'GENGLASS'
    shell=shell.replace('ПРОДАЖИ · GENGLASS',html.escape(department.upper())+' · '+brand)
    shell=shell.replace('/ Продажи / РОП GENGLASS','/ '+html.escape(department)+' / '+html.escape(title))
    # ROP anchors belong to the ROP page, not the embedded native dashboard.
    shell=re.sub(r'<details open><summary class="gg-selected">РОП GENGLASS</summary><div class="gg-sections">.*?</div></details>',f'<a href="/{"rop-gm" if company=="gm" else "rop"}/">РОП {brand}</a>',shell,flags=re.S)
    if company=='gm':
        shell=shell.replace('>GENGLASS <span>⌄</span>','>GLASS MEMORY <span>⌄</span>')
        shell=re.sub(r'<details><summary>Менеджеры ОП</summary><div class="gg-sections">.*?</div></details>','',shell,flags=re.S)
        shell=shell.replace('data-company="gg" aria-selected="true"','data-company="gg" aria-selected="false"').replace('data-company="gm" aria-selected="false"','data-company="gm" aria-selected="true"')
        shell=re.sub(r'<nav class="gg-nav">.*?</nav>','<nav class="gg-nav"><a href="/structure/">◇ <span>Структура компании</span></a><details open><summary>▥ <span>Продажи</span></summary><div class="gg-subnav"><a href="/rop-gm/">РОП GLASS MEMORY</a></div></details><details><summary>☷ <span>Коммуникации</span></summary><div class="gg-subnav"><a href="/op-gm/">Разбор переговоров</a></div></details><a href="/kp-gm/">КП GLASS MEMORY</a></nav>',shell,flags=re.S)
    shell=shell.replace('<!-- DASHBOARD -->','<div id="gg-dashboard" class="gg-generic">'+body+'</div>')
    result=head+'<body>'+shell+'<style>'+css+'</style><script>'+js+'</script></body></html>'
    if re.findall(r'<script\b[^>]*>.*?</script>',result,re.S)[:len(scripts)]!=scripts:raise SystemExit('Script integrity failure: '+slug)
    atomic(target,result)
    report.append({'section':slug,'business_scripts_unchanged':True,'script_sha256':hashlib.sha256(''.join(scripts).encode()).hexdigest()})
atomic(site/'.gg/workspace-pages.json',json.dumps(report,ensure_ascii=False,indent=2))
marketing=base.replace('<h1>РОП GENGLASS</h1>','<h1>Маркетинг</h1>').replace('ПРОДАЖИ · GENGLASS','МАРКЕТИНГ · GENGLASS').replace('/ Продажи / РОП GENGLASS','/ Маркетинг').replace('Результаты отдела, воронка, менеджеры и дисциплина.','Раздел готов к наполнению.')
marketing=marketing.replace('<!-- DASHBOARD -->','<div id="gg-dashboard" class="gg-generic"><div class="card"><h2 style="font-size:16px">Маркетинг</h2><p style="color:var(--ink-3);margin-top:10px">Дашборд пока пустой.</p></div></div>')
marketing=re.sub(r'<details open><summary class="gg-selected">РОП GENGLASS</summary><div class="gg-sections">.*?</div></details>','<a href="/rop/">РОП GENGLASS</a>',marketing,flags=re.S)
(site/'marketing').mkdir(exist_ok=True)
atomic(site/'marketing/index.html','<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GENGROUP · Маркетинг</title><style>'+css+'</style></head><body>'+marketing+'<script>'+js+'</script></body></html>')
print('Native workspace:',len(report),'additional dashboards; all original scripts unchanged')
