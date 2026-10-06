#!/usr/bin/env python3
import html
import hashlib
import re
import sys
from pathlib import Path

template, site = map(Path, sys.argv[1:])
page = template.read_text(encoding='utf-8')
cards = []
roster = site / '.gg/managers.txt'
if not roster.is_file():
    raise SystemExit('Missing published manager roster')
for row in roster.read_text(encoding='utf-8').splitlines():
    slug, _, name = row.partition('\t')
    if not re.fullmatch(r'rop-[a-z0-9-]+', slug):
        raise SystemExit('Invalid manager slug')
    if not (site / slug / 'index.html').is_file():
        raise SystemExit('Missing manager page: ' + slug)
    label = html.escape(name or slug)
    photo = site / 'dashboards/previews/mgr' / (slug.removeprefix('rop-') + '.webp')
    avatar = html.escape((name or slug)[0])
    if photo.is_file():
        version = hashlib.sha256(photo.read_bytes()).hexdigest()[:12]
        avatar = f'<img src="/dashboards/previews/mgr/{photo.name}?v={version}" width="52" height="52" loading="lazy" decoding="async" alt="{label}">'
    cards.append(f'<a class="card mcard" href="/{slug}/" target="_blank" rel="noopener"><span class="avatar" style="background:#22d3ee">{avatar}</span><div><div class="t">{label}</div><div class="d">Личная панель: сделки, воронка, активность, дисциплина.</div><div class="u">/{slug}/</div></div></a>')
if not cards:
    raise SystemExit('Empty manager roster')
page, count = re.subn(r'(<div class="grid" id="mgrGrid">).*?(\n    </div>)', lambda m: m[1] + '\n' + '\n'.join(cards) + m[2], page, count=1, flags=re.S)
def preview(match):
    slug = match[2]
    image = site / 'dashboards/previews' / (slug + '.webp')
    if not image.is_file():
        return match[0]
    version = hashlib.sha256(image.read_bytes()).hexdigest()[:12]
    return match[1] + f'<img src="/dashboards/previews/{slug}.webp?v={version}" width="640" height="400" loading="lazy" decoding="async" alt="Превью дашборда">' + match[4]
page = re.sub(r'(<a class="card" href="/([a-z0-9-]+)/"[^>]*><div class="prev">)(.*?)(</div>)', preview, page, flags=re.S)
if count != 1 or re.search(r'<iframe|<script|github\.io', page, re.I):
    raise SystemExit('Hub validation failed')
for href in re.findall(r'href="([^"]+)"', page):
    if not re.fullmatch(r'/[a-z0-9-]+/', href):
        raise SystemExit('Non-local navigation link')
out = site / 'dashboards'
out.mkdir(parents=True, exist_ok=True)
(out / 'index.html').write_text(page, encoding='utf-8')
(site / 'index.html').write_text(page, encoding='utf-8')
print(f'Главная: / и /dashboards/, менеджеров {len(cards)}, HTML {len(page.encode("utf-8"))} байт')
