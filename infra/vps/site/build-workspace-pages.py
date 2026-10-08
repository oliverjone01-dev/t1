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
css+='\n'+(style.parent/'rop-approved-design.css').read_text()
css+="\n#gg-workspace,.gg-sidebar{font-family:'Golos Text','Segoe UI',sans-serif}#gg-dashboard .kpi-strip{gap:12px!important;background:transparent;border:0}#gg-dashboard .kpi-strip>.kpi-cell{border:1px solid var(--border);border-radius:12px;background:var(--bg-card)}"
js=behavior.read_text()
js+='\n'+(behavior.parent/'workspace-palette.js').read_text()+'\n'+(behavior.parent/'shared-shell.js').read_text()
theme_bootstrap="<script data-gg-theme-bootstrap>document.documentElement.dataset.sidebarMode='compact';try{document.documentElement.dataset.sidebarMode=localStorage.getItem('gg-sidebar-mode')||'compact';}catch(e){}document.documentElement.dataset.theme='dark';try{if(localStorage.getItem('gg-hub-theme')==='light')document.documentElement.dataset.theme='light';}catch(e){}</script><style>html{background:#0f1216;color-scheme:dark}html[data-theme=light]{background:#e9edef;color-scheme:light}</style>"
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
    shell=shell.replace('href="#sec','href="/rop/#sec')
    if company=='gm':
        shell=shell.replace('>GENGLASS <span>⌄</span>','>GLASS MEMORY <span>⌄</span>')
        shell=shell.replace('data-company="gg" aria-selected="true"','data-company="gg" aria-selected="false"').replace('data-company="gm" aria-selected="false"','data-company="gm" aria-selected="true"')
    if slug=='ozon-research':
        # Next hydrates the complete document. Preserve its root in a same-origin
        # frame, then apply the common visual tokens after hydration.
        atomic(target.with_name('native.html'),source)
        atomic(target.with_name('shared-design.css'),css+'\nhtml,body{background:var(--bg-base)!important;font-family:"Golos Text",sans-serif!important}body{margin:0}')
        body='<iframe class="gg-native-frame" title="Исследование OZON" src="native.html" style="width:100%;min-height:800px;border:0;display:block"></iframe>'
    shell=shell.replace('<!-- DASHBOARD -->','<div id="gg-dashboard" class="gg-generic">'+body+'</div>')
    result=head.replace('</head>','<style>'+css+'</style></head>')+'<body>'+shell+'<script>'+js+'</script></body></html>'
    if slug!='ozon-research' and re.findall(r'<script\b[^>]*>.*?</script>',result,re.S)[:len(scripts)]!=scripts:raise SystemExit('Script integrity failure: '+slug)
    result=result.replace('<head>','<head>'+theme_bootstrap,1)
    atomic(target,result)
    report.append({'section':slug,'business_scripts_unchanged':True,'script_sha256':hashlib.sha256(''.join(scripts).encode()).hexdigest()})
atomic(site/'.gg/workspace-pages.json',json.dumps(report,ensure_ascii=False,indent=2))
marketing=base.replace('<h1>РОП GENGLASS</h1>','<h1>Маркетинг</h1>').replace('ПРОДАЖИ · GENGLASS','МАРКЕТИНГ · GENGLASS').replace('/ Продажи / РОП GENGLASS','/ Маркетинг').replace('Результаты отдела, воронка, менеджеры и дисциплина.','Раздел готов к наполнению.')
marketing=marketing.replace('<!-- DASHBOARD -->','<div id="gg-dashboard" class="gg-generic"><div class="card"><h2 style="font-size:16px">Маркетинг</h2><p style="color:var(--ink-3);margin-top:10px">Дашборд пока пустой.</p></div></div>')
marketing=marketing.replace('href="#sec','href="/rop/#sec')
(site/'marketing').mkdir(exist_ok=True)
atomic(site/'marketing/index.html','<!doctype html><html lang="ru"><head>'+theme_bootstrap+'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GENGROUP · Маркетинг</title><style>'+css+'</style></head><body>'+marketing+'<script>'+js+'</script></body></html>')
print('Native workspace:',len(report),'additional dashboards; all original scripts unchanged')

