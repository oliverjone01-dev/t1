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
for row in roster.read_text(encoding='utf-8').splitlines():
    slug, _, name = row.partition('\t')
    if not re.fullmatch(r'rop-[a-z0-9-]+', slug) or not (site / slug / 'index.html').is_file():
        raise SystemExit('Invalid or unpublished manager: ' + slug)
    label = html.escape(name or slug)
    photo = site / 'dashboards/previews/mgr' / (slug.removeprefix('rop-') + '.webp')
    avatar = html.escape((name or slug)[0])
    if photo.is_file():
        version = hashlib.sha256(photo.read_bytes()).hexdigest()[:12]
        avatar = f'<img src="/dashboards/previews/mgr/{photo.name}?v={version}" width="44" height="44" loading="lazy" decoding="async" alt="">'
    cards.append(f'<a class="manager" data-brand="gg" href="/{slug}/"><span class="avatar">{avatar}</span><span><strong>{label}</strong><small>Менеджер ОП · GENGLASS</small></span><span class="arrow">↗</span></a>')
if not cards or page.count('<!-- MANAGERS -->') != 1:
    raise SystemExit('Missing roster or placeholder')
page = page.replace('<!-- MANAGERS -->', '\n'.join(cards))
links = []
for row in roster.read_text(encoding='utf-8').splitlines():
    slug, _, name = row.partition('\t')
    links.append(f'<a data-brand="gg" href="/{slug}/">{html.escape(name or slug)}</a>')
page = page.replace('<!-- MANAGER_NAV -->', '\n'.join(links))
def preview(match):
    slug = match[1]
    image = site / 'dashboards/previews' / (slug + '.webp')
    if not image.is_file():
        return '<div class="preview placeholder">Дашборд</div>'
    version = hashlib.sha256(image.read_bytes()).hexdigest()[:12]
    return f'<div class="preview"><img src="/dashboards/previews/{slug}.webp?v={version}" width="640" height="400" loading="lazy" decoding="async" alt="Превью дашборда"></div>'
page = re.sub(r'<!-- PREVIEW:([a-z0-9-]+) -->', preview, page)
if re.search(r'<iframe|github\.io|https?://', page, re.I):
    raise SystemExit('External dependency or embedded dashboard')
for href in re.findall(r'href="([^"]+)"', page):
    if not re.fullmatch(r'/[a-z0-9-]+/', href):
        raise SystemExit('Non-local dashboard link')
out = site / 'dashboards'
out.mkdir(parents=True, exist_ok=True)
for target in (out / 'index.html', site / 'index.html'):
    temporary = target.with_name(target.name + '.new')
    temporary.write_text(page, encoding='utf-8')
    temporary.replace(target)
print(f'Главная: новый каркас, менеджеров {len(cards)}, HTML {len(page.encode())} байт')
