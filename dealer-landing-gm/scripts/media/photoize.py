"""Совмещает фотокопию иконки с исходной иконкой и делает фон прозрачным.
Использование: photoize.py <assets_dir> <photo_dir> <out_dir> <ids...>"""
import sys
import numpy as np
from PIL import Image

assets, photo_dir, out_dir = sys.argv[1:4]
ids = sys.argv[4:]
# id: (исходник, область в исходнике или None, файл фото)
SPEC = {
    '1': ('3ad21.webp', (0, 0, 724, 724)),
    '2': ('157d4.webp', None),
    '3': ('3ad21.webp', (1448, 0, 2172, 724)),
    '4': ('b096b.webp', None),
    '5': ('87b59.webp', None),
    '6': ('791dc.webp', None),
}


def color_to_alpha(rgb):
    """Белый фон в прозрачность без потери полутонов (тени и стекло остаются)."""
    a = rgb.astype(np.float32) / 255.0
    alpha = np.max(1.0 - a, axis=2)
    alpha = np.clip((alpha - 0.015) / 0.985, 0, 1)  # убрать шум почти белого фона
    safe = np.where(alpha > 1e-4, alpha, 1)[..., None]
    col = 1.0 - (1.0 - a) / safe
    col = np.clip(col, 0, 1)
    return np.dstack([col * 255, alpha * 255]).astype(np.uint8)


def bbox_alpha(arr, thr):
    m = arr > thr
    xs = np.where(m.sum(0) > 3)[0]
    ys = np.where(m.sum(1) > 3)[0]
    return int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1


results = {}
for i in ids:
    src_name, box = SPEC[i]
    icon = Image.open(f'{assets}/{src_name}').convert('RGBA')
    if box:
        icon = icon.crop(box)
    ia = np.array(icon)[..., 3]
    ix0, iy0, ix1, iy1 = bbox_alpha(ia, 40)
    photo = np.array(Image.open(f'{photo_dir}/{i}.png').convert('RGB'))
    b = 12  # служебная метка в углу и край кадра
    photo[:b, :] = 255; photo[-b:, :] = 255; photo[:, :b] = 255; photo[:, -b:] = 255
    rgba = color_to_alpha(photo)
    px0, py0, px1, py1 = bbox_alpha(rgba[..., 3], 70)  # тень слабее порога
    s = ((ix1 - ix0) / (px1 - px0) + (iy1 - iy0) / (py1 - py0)) / 2
    p = Image.fromarray(rgba, 'RGBA')
    p = p.resize((round(p.width * s), round(p.height * s)), Image.LANCZOS)
    # совместить центр по горизонтали и низ объекта
    dx = round((ix0 + ix1) / 2 - (px0 + px1) / 2 * s)
    dy = round(iy1 - py1 * s)
    canvas = Image.new('RGBA', icon.size, (0, 0, 0, 0))
    canvas.alpha_composite(p, (max(dx, 0), max(dy, 0)), (max(-dx, 0), max(-dy, 0)))
    results[i] = canvas
    print(i, 'icon bbox', (ix0, iy0, ix1, iy1), 'photo bbox', (px0, py0, px1, py1), 'scale', round(s, 3), 'shift', dx, dy)

# Сборка: атлас для 1 и 3, отдельные файлы для остальных
if '1' in results or '3' in results:
    atlas = Image.new('RGBA', (2172, 724), (0, 0, 0, 0))
    for i, x in (('1', 0), ('3', 1448)):
        if i in results:
            atlas.alpha_composite(results[i], (x, 0))
    atlas.save(f'{out_dir}/3ad21-photo.webp', quality=86, method=6)
names = {'2': '157d4', '4': 'b096b', '5': '87b59', '6': '791dc'}
for i, n in names.items():
    if i in results:
        results[i].save(f'{out_dir}/{n}-photo.webp', quality=86, method=6)
