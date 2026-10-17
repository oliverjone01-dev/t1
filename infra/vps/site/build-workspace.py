#!/usr/bin/env python3
"""Native ROP workspace; presentation changes and explicitly requested plan-target correction."""
import hashlib, html, json, re, shutil, sys
from pathlib import Path

template, style, behavior, site = map(Path, sys.argv[1:])
target = site / 'rop/index.html'
original = target.read_text(encoding='utf-8')
def snapshot_hash(document):
    start=document.index('const DATA=')+len('const DATA=')
    _,length=json.JSONDecoder().raw_decode(document[start:])
    return hashlib.sha256(document[start:start+length].encode()).hexdigest()
source_snapshot=snapshot_hash(original)
if 'id="gg-workspace"' in original:
    raise SystemExit('Workspace already composed; rebuild from the original ROP source')
source_scripts = re.findall(r'<script\b[^>]*>.*?</script>', original, re.S)
# An empty month's CR2 must use the last explicitly entered norm, rather than the hidden 15% fallback.
old_norm = 'const _pmH=((DATA.plan&&DATA.plan.months)||[]).find(x=>x.month===String(S.end).slice(0,7));'
new_norm = 'const _pmH=((DATA.plan&&DATA.plan.months)||[]).filter(x=>x.month<=String(S.end).slice(0,7)&&x.cr2>0).sort((a,b)=>a.month.localeCompare(b.month)).at(-1);'
if original.count(old_norm) != 1:
    raise SystemExit('Expected one health plan target lookup; source changed')
original = original.replace(old_norm, new_norm)
scripts = re.findall(r'<script\b[^>]*>.*?</script>', original, re.S)
if not scripts or 'let S=' not in ''.join(scripts) or 'id="root"' not in original:
    raise SystemExit('ROP source structure changed')
roster = []
for row in (site / '.gg/managers.txt').read_text(encoding='utf-8').splitlines():
    slug, _, name = row.partition('\t')
    if not re.fullmatch(r'rop-[a-z0-9-]+', slug):
        raise SystemExit('Invalid manager route')
    roster.append(f'<a href="/{slug}/">{html.escape(name or slug)}</a>')
from importlib.util import spec_from_file_location,module_from_spec
_spec=spec_from_file_location('manager_grouping',style.parent/'manager-grouping.py');_group=module_from_spec(_spec);_spec.loader.exec_module(_group)
_published=[html.unescape(re.search(r'>([^<]+)</a>',row)[1]) for row in roster]
original=_group.apply_manager_grouping(original,_published)
scripts=re.findall(r'<script\b[^>]*>.*?</script>',original,re.S)
shell = template.read_text(encoding='utf-8').replace('<!-- MANAGERS -->', '\n'.join(roster))
body = original.split('<body>', 1)[1].rsplit('</body>', 1)[0]
# The original DOM, identifiers, events, charts and complete scripts stay intact.
design_style = (style.parent / 'rop-approved-design.css').read_text(encoding='utf-8')
design_behavior = (behavior.parent / 'rop-approved-design.js').read_text(encoding='utf-8')
design_behavior += '\n' + (behavior.parent / 'rop-palette.js').read_text(encoding='utf-8')
design_behavior += '\n' + (behavior.parent / 'rop-refinements.js').read_text(encoding='utf-8')
design_behavior += '\n' + (behavior.parent / 'shared-shell.js').read_text(encoding='utf-8')
font_source = style.parent / 'turbium-fonts'
if font_source.is_dir():
    shutil.copytree(font_source, site / 'turbium-fonts', dirs_exist_ok=True)
page = original.split('<body>', 1)[0].replace('</head>', '<style>' + style.read_text(encoding='utf-8') + design_style + '</style></head>')
page += '<body>' + shell.replace('<!-- DASHBOARD -->', '<div id="gg-dashboard">' + body + '</div>')
page += '<script>' + behavior.read_text(encoding='utf-8') + '</script><script>' + design_behavior + '</script></body></html>'
composed_scripts = re.findall(r'<script\b[^>]*>.*?</script>', page, re.S)
if composed_scripts[:len(scripts)] != scripts:
    raise SystemExit('Business script integrity failure')

# Resolve the shared theme before styles and the large CRM snapshot are parsed.
theme_bootstrap = "<script data-gg-theme-bootstrap>document.documentElement.dataset.sidebarMode='compact';try{document.documentElement.dataset.sidebarMode=localStorage.getItem('gg-sidebar-mode')||'compact';}catch(e){}document.documentElement.dataset.theme='dark';try{if(localStorage.getItem('gg-hub-theme')==='light')document.documentElement.dataset.theme='light';}catch(e){}</script><style>html{background:#0f1216;color-scheme:dark}html[data-theme=light]{background:#e9edef;color-scheme:light}</style>"
ui_bootstrap = '<script data-gg-ui-bootstrap>document.documentElement.dataset.ggUi="pending";</script><style>html[data-gg-ui=pending] #root{visibility:hidden}html[data-gg-ui=pending] .gg-toolbar-top{visibility:hidden}</style>'
page = page.replace('<head>', '<head>' + theme_bootstrap + ui_bootstrap, 1)
if snapshot_hash(page)!=source_snapshot:
    raise SystemExit('Raw CRM snapshot changed during workspace composition')
def atomic(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.workspace-new')
    temporary.write_text(text, encoding='utf-8')
    temporary.replace(path)  # Never overwrite a hard-linked source/previous release inode.
atomic(target, page)
if snapshot_hash(target.read_text(encoding='utf-8'))!=source_snapshot:
    raise SystemExit('Raw CRM snapshot verification failed after writing')
for home in (site / 'index.html', site / 'dashboards/index.html'):
    if home.is_file():
        text = home.read_text(encoding='utf-8')
        text = re.sub(r'<small class="org-status" data-status="rop">.*?</small>', '<small class="org-status" data-status="rop"><i class="org-dot live"></i>Дашборд есть</small>', text)
        if 'data-gg-theme-bootstrap' not in text:
            text = text.replace('<head>', '<head>' + theme_bootstrap, 1)
        shared_style = '<style data-gg-shared-design>' + design_style + 'html[data-theme]{--bg:var(--bg-base);--surface:var(--bg-card);--soft:var(--bg-elevated);--text:var(--ink-2);--muted:var(--ink-3);--action:var(--ink)}</style>'
        text = re.sub(r'<style data-gg-shared-design>.*?</style>', '', text, flags=re.S)
        text = text.replace('</head>', shared_style + '</head>', 1)
        # Use the same navigation and header on the structure page after native initialization.
        common = shell[:shell.index('<main class="gg-main">')]
        common = common.replace('href="#sec','href="/rop/#sec')
        header = re.search(r'<header class="gg-topbar">.*?</header>', shell, re.S)[0].replace('/ Продажи / РОП GENGLASS', '/ Структура компании')
        home_ui = "(function(){const old=document.querySelector('#sidebar'),main=document.querySelector('.workspace'),bar=main?.querySelector('.topbar'),content=main?.querySelector('.content');if(!old||!main||!bar)return;const brand=document.getElementById('brand');if(brand){brand.hidden=true;document.body.append(brand);}old.outerHTML="+json.dumps(common)+";main.classList.add('gg-main');bar.outerHTML="+json.dumps(header)+";content?.classList.add('gg-content');document.getElementById('backdrop')?.remove();const bd=document.createElement('button');bd.id='gg-backdrop';bd.hidden=true;document.body.append(bd);const root=document.getElementById('gg-workspace');root.append(main);})();"
        shared_js = (behavior.parent/'workspace-pages.js').read_text(encoding='utf-8')+'\n'+(behavior.parent/'shared-shell.js').read_text(encoding='utf-8')
        text = text.replace('<style data-gg-shared-design>', '<style>'+style.read_text(encoding='utf-8')+'</style><style data-gg-shared-design>', 1)
        text = text.replace('</body>', '<script>'+home_ui+'</script><script>'+shared_js+'</script></body>', 1)
        atomic(home, text)
structure = site / 'index.html'
if structure.is_file():
    atomic(site / 'structure/index.html', structure.read_text(encoding='utf-8'))
# The landing page is the company structure; ROP remains a section of the workspace.
atomic(site / '.gg/workspace.json', json.dumps({
    'version': 1, 'section': 'rop', 'managers': len(roster),
    'source_sha256': hashlib.sha256(original.encode()).hexdigest(),
    'business_scripts_sha256': hashlib.sha256(''.join(scripts).encode()).hexdigest(),
    'business_scripts_unchanged': scripts == source_scripts, 'iframe': False,
    'requested_business_change': 'Health CR2 last entered norm; lead and deal plan quantities without cycle coefficient; snapshot data unchanged; managers without published dashboards grouped as Другие before ratios/medians',
}, ensure_ascii=False, indent=2))
print('ROP native workspace composed; requested plan-target correction; managers:', len(roster))

