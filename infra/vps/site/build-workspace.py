#!/usr/bin/env python3
"""Native ROP workspace; presentation changes and explicitly requested plan-target correction."""
import hashlib, html, json, re, shutil, sys
from pathlib import Path

template, style, behavior, site = map(Path, sys.argv[1:])
target = site / 'rop/index.html'
original = target.read_text(encoding='utf-8')
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
shell = template.read_text(encoding='utf-8').replace('<!-- MANAGERS -->', '\n'.join(roster))
body = original.split('<body>', 1)[1].rsplit('</body>', 1)[0]
# The original DOM, identifiers, events, charts and complete scripts stay intact.
design_style = (style.parent / 'rop-approved-design.css').read_text(encoding='utf-8')
design_behavior = (behavior.parent / 'rop-approved-design.js').read_text(encoding='utf-8')
design_behavior += '\n' + (behavior.parent / 'rop-palette.js').read_text(encoding='utf-8')
font_source = style.parent / 'turbium-fonts'
if font_source.is_dir():
    shutil.copytree(font_source, site / 'turbium-fonts', dirs_exist_ok=True)
page = original.split('<body>', 1)[0].replace('</head>', '<style>' + style.read_text(encoding='utf-8') + design_style + '</style></head>')
page += '<body>' + shell.replace('<!-- DASHBOARD -->', '<div id="gg-dashboard">' + body + '</div>')
page += '<script>' + behavior.read_text(encoding='utf-8') + '</script><script>' + design_behavior + '</script></body></html>'
composed_scripts = re.findall(r'<script\b[^>]*>.*?</script>', page, re.S)
if composed_scripts[:len(scripts)] != scripts:
    raise SystemExit('Business script integrity failure')
def atomic(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.workspace-new')
    temporary.write_text(text, encoding='utf-8')
    temporary.replace(path)  # Never overwrite a hard-linked source/previous release inode.
atomic(target, page)
for home in (site / 'index.html', site / 'dashboards/index.html'):
    if home.is_file():
        text = home.read_text(encoding='utf-8')
        text = re.sub(r'<small class="org-status" data-status="rop">.*?</small>', '<small class="org-status" data-status="rop"><i class="org-dot live"></i>Дашборд есть</small>', text)
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
    'requested_business_change': 'Health CR2 target: last explicitly entered monthly norm; no snapshot data modified',
}, ensure_ascii=False, indent=2))
print('ROP native workspace composed; requested plan-target correction; managers:', len(roster))
