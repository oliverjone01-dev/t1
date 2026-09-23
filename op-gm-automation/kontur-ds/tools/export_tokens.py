#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Выгружает tokens.css в tokens.json и в пресет Tailwind. Источник истины один:
tokens.css. JSON и пресет генерируются, руками их не правят."""
import re, json
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]
css = (HERE/'tokens'/'tokens.css').read_text(encoding='utf-8')
def block(sel):
    i = css.index(sel); j = css.index('{', i); d, k = 1, j + 1
    while d:
        d += {'{':1,'}':-1}.get(css[k], 0); k += 1
    return dict((a, b.strip()) for a, b in re.findall(r'(--[\w-]+):\s*([^;]+);', css[j+1:k-1]))
base  = block(':root{')
light = block(':root, [data-theme="light"]{')
dark  = block('[data-theme="dark"], :root.dark{')
group = lambda d, pref: {k[2:]: v for k, v in d.items() if any(k.startswith('--' + p) for p in pref)}
out = {
  '$schema': 'Контур DS токены. Генерируется из tokens/tokens.css, руками не править.',
  'font':   group(base, ['font', 'fs-', 'lh-', 'fw-', 'tracking']),
  'space':  group(base, ['sp-']),
  'radius': group(base, ['r-']),
  'motion': group(base, ['ease', 'dur']),
  'layout': group(base, ['sidebar', 'topbar', 'content', 'drawer', 'z-', 'tap']),
  'density': {'comfortable': group(base, ['pad-box', 'gap-stack', 'cell-', 'ctl-h', 'field-h', 'select-h', 'nav-y']),
              'compact': {k[2:]: v for k, v in block('[data-density="compact"]{').items()}},
  'breakpoints': {'sm': '640px', 'md': '768px', 'lg': '1024px', 'xl': '1280px', '2xl': '1536px'},
  'container': {'kpi-1col-max': '300px', 'kpi-4col-min': '680px', 'grid-2-min': '720px', 'grid-3-min': '1080px', 'table-stack-max': '520px'},
  'color':  {'light': light, 'dark': dark},
}
(HERE/'tokens'/'tokens.json').write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')

# Пресет Tailwind: классы ссылаются на CSS-переменные, поэтому тема переключается сама
colors = {k[2:]: f'var({k})' for k in light if not k.startswith('--sh') and not k.startswith('--scroll')}
preset = """/* Контур DS · пресет Tailwind. Генерируется tools/export_tokens.py.
   Подключение: presets: [require('./kontur-ds/tokens/tailwind.preset.js')] и tokens.css в глобальных стилях.
   Цвета это ссылки на CSS-переменные: bg-surface, text-text-muted, border-border и так далее. */
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: { extend: {
    colors: %s,
    fontFamily: { sans: ['var(--font-sans)'], mono: ['var(--font-mono)'] },
    fontSize: %s,
    spacing: %s,
    borderRadius: %s,
    boxShadow: { hover: 'var(--sh-hover)', pop: 'var(--sh-pop)', drawer: 'var(--sh-drawer)' },
    screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
    minHeight: { tap: 'var(--tap)', 'tap-sm': 'var(--tap-sm)' },
    transitionTimingFunction: { std: 'var(--ease-std)', out: 'var(--ease-out)', in: 'var(--ease-in)' },
    transitionDuration: { fast: '160ms', base: '250ms', slow: '300ms', enter: '420ms' }
  } }
};
""" % (json.dumps(colors, ensure_ascii=False, indent=6),
       json.dumps({k[5:]: f'var({k})' for k in base if k.startswith('--fs-')}, indent=6),
       json.dumps({k[5:].replace('-', '.'): f'var({k})' for k in base if k.startswith('--sp-')}, indent=6),
       json.dumps({k[4:]: f'var({k})' for k in base if k.startswith('--r-')}, indent=6))
(HERE/'tokens'/'tailwind.preset.js').write_text(preset, encoding='utf-8')
print('tokens.json:', len(light), 'цветовых токенов на тему,', sum(len(v) for k, v in out.items() if isinstance(v, dict) and k != 'color'), 'прочих')
print('tailwind.preset.js записан')

# Мост для shadcn/ui: имена shadcn указывают на токены Контура.
# Объявлен на :root И на каждом [data-theme]: var() внутри пользовательского свойства
# вычисляется там, где оно объявлено, и без второго селектора вложенная тёмная панель
# унаследовала бы светлые значения корня.
MAP = [
  ('background', 'bg'), ('foreground', 'text'),
  ('card', 'surface'), ('card-foreground', 'text'),
  ('popover', 'surface'), ('popover-foreground', 'text'),
  ('secondary', 'surface-2'), ('secondary-foreground', 'text-strong'),
  ('muted', 'surface-2'), ('muted-foreground', 'text-muted'),
  ('accent', 'surface-2'), ('accent-foreground', 'text-strong'),
  ('destructive', 'crit'), ('destructive-foreground', 'primary-foreground'),
  ('input', 'border-strong'), ('ring', 'focus'), ('radius', 'r-lg'),
  ('chart-1', 'cat-1'), ('chart-2', 'cat-2'), ('chart-3', 'cat-3'), ('chart-4', 'cat-4'), ('chart-5', 'cat-5'),
  ('sidebar', 'surface'), ('sidebar-foreground', 'text'), ('sidebar-primary', 'action'),
  ('sidebar-primary-foreground', 'action-foreground'), ('sidebar-accent', 'surface-2'),
  ('sidebar-accent-foreground', 'text-strong'), ('sidebar-border', 'border'), ('sidebar-ring', 'focus'),
]
known = set(light) | set(base)
miss = [k for _, k in MAP if '--' + k not in known]
if miss: raise SystemExit('мост shadcn ссылается на несуществующие токены: ' + ', '.join(miss))
colors4 = ['background','foreground','card','card-foreground','popover','popover-foreground','primary','primary-foreground',
           'secondary','secondary-foreground','muted','muted-foreground','accent','accent-foreground','destructive',
           'border','input','ring','chart-1','chart-2','chart-3','chart-4','chart-5','sidebar','sidebar-foreground',
           'sidebar-primary','sidebar-primary-foreground','sidebar-accent','sidebar-accent-foreground','sidebar-border','sidebar-ring']
# primary и sidebar-primary ведут на почти чёрную основную кнопку через промежуточную переменную,
# чтобы data-shadcn-primary="blue" мог вернуть синий без пересборки Tailwind
SH = {'primary': 'sh-primary', 'primary-foreground': 'sh-primary-foreground',
      'sidebar-primary': 'sh-primary', 'sidebar-primary-foreground': 'sh-primary-foreground'}
bridge = """/* Контур DS · мост для shadcn/ui. Генерируется tools/export_tokens.py, руками не править.
   Подключение: tokens.css, затем этот файл. Компоненты shadcn берут цвета, радиус и обе темы Контура.
   Тёмная тема: data-theme="dark" на любом контейнере или класс .dark на корне, как ждёт shadcn.

   1.4: основная кнопка shadcn (bg-primary, text-primary-foreground) почти чёрная, как .ks-btn--primary
   (в тёмной теме почти белая). Синий --primary Контура не трогается: он остаётся акцентом выбора,
   фокуса и ссылки, а в Tailwind доступен как bg-primary-blue. Вернуть синюю основную кнопку в одном
   проекте или блоке: data-shadcn-primary="blue" на корне или на контейнере. */
:root, [data-theme]{
%s
  --sh-primary: var(--action);
  --sh-primary-foreground: var(--action-foreground);
}
[data-shadcn-primary="blue"], [data-shadcn-primary="blue"] [data-theme]{
  --sh-primary: var(--primary);
  --sh-primary-foreground: var(--primary-foreground);
}

/* Tailwind v4: утилиты bg-background, text-muted-foreground, rounded-lg и так далее.
   Браузер без Tailwind этот блок просто пропускает. */
@theme inline {
%s
  --color-primary-blue: var(--primary);
  --color-primary-blue-foreground: var(--primary-foreground);
  --color-link: var(--text-link);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
""" % ('\n'.join(f'  --{a}: var(--{b});' for a, b in MAP), '\n'.join(f'  --color-{c}: var(--{SH.get(c, c)});' for c in colors4))
(HERE/'tokens'/'shadcn.css').write_text(bridge, encoding='utf-8')
print('shadcn.css записан:', len(MAP), 'имён')
