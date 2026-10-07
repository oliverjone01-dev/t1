#!/usr/bin/env python3
"""Native workspace around the complete ROP document; keep every business script byte-identical."""
import hashlib, html, json, re, sys
from pathlib import Path

template, style, behavior, site = map(Path, sys.argv[1:])
target = site / 'rop/index.html'
original = target.read_text(encoding='utf-8')
if 'id="gg-workspace"' in original:
    raise SystemExit('Workspace already composed; rebuild from the original ROP source')
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
page = original.split('<body>', 1)[0].replace('</head>', '<style>' + style.read_text(encoding='utf-8') + '</style></head>')
page += '<body>' + shell.replace('<!-- DASHBOARD -->', '<div id="gg-dashboard">' + body + '</div>')
page += '<script>' + behavior.read_text(encoding='utf-8') + '</script></body></html>'
composed_scripts = re.findall(r'<script\b[^>]*>.*?</script>', page, re.S)
if composed_scripts[:len(scripts)] != scripts:
    raise SystemExit('Business script integrity failure')
def atomic(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.workspace-new')
    temporary.write_text(text, encoding='utf-8')
    temporary.replace(path)  # Never overwrite a hard-linked source/previous release inode.
atomic(target, page)
atomic(site / '.gg/workspace.json', json.dumps({
    'version': 1, 'section': 'rop', 'managers': len(roster),
    'source_sha256': hashlib.sha256(original.encode()).hexdigest(),
    'business_scripts_sha256': hashlib.sha256(''.join(scripts).encode()).hexdigest(),
    'business_scripts_unchanged': True, 'iframe': False,
}, ensure_ascii=False, indent=2))
print('ROP native workspace composed; business scripts unchanged; managers:', len(roster))
