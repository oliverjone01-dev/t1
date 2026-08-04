#!/usr/bin/env python3
"""
Подготовка съёмки для страницы ИНТЕГРА 2.0.

Берёт PNG из public/img/src/, приводит к размерам из GRAPHICS_BRIEF.md,
кладёт WebP в public/img/. Разметка ссылается именно на .webp.

Кроп по центру композиции с сохранением пропорции: если исходник шире целевой
пропорции, режутся бока, если выше - верх и низ. Апскейла нет: если исходник
меньше целевого размера, оставляем как есть и пишем предупреждение.

Перезапускать после каждой новой партии картинок. Идемпотентно.
Пересобирать index.html после этого НЕ нужно: файлы лежат рядом, пути в
зашифрованном теле документа уже прописаны.

  python3 prepare-images.py
"""
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("нет Pillow: pip install Pillow")

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "public", "img", "src")
DST = os.path.join(HERE, "public", "img")

# имя -> (ширина, высота, качество webp)
SPEC = {
    "hero-bg":            (2400, 1350, 82),
    "cat-01-railing":     (1200,  800, 80),
    "cat-02-door-frame":  (1200,  800, 80),
    "cat-03-shower":      (1200,  800, 80),
    "cat-04-swing":       (1200,  800, 80),
    "cat-05-sliding":     (1200,  800, 80),
    "cat-06-partition":   (1200,  800, 80),
    "warehouse-parts":    (1600,  900, 80),
    "glass-processing":   (1600,  900, 80),
    "og-cover":           (1200,  630, 85),
}


def cover(im, tw, th):
    """Кроп по центру до нужной пропорции, затем ресайз. Без апскейла."""
    sw, sh = im.size
    target, source = tw / th, sw / sh
    if source > target:                      # исходник шире: режем бока
        nw = round(sh * target)
        left = (sw - nw) // 2
        im = im.crop((left, 0, left + nw, sh))
    elif source < target:                    # исходник выше: режем верх и низ
        nh = round(sw / target)
        top = (sh - nh) // 2
        im = im.crop((0, top, sw, top + nh))
    if im.size[0] < tw:
        return im, True                      # меньше цели, не растягиваем
    return im.resize((tw, th), Image.LANCZOS), False


def main():
    if not os.path.isdir(SRC):
        sys.exit(f"нет папки {SRC}. Создай её и положи туда PNG из GPT Image")
    os.makedirs(DST, exist_ok=True)

    done, missing, warned = [], [], []
    for name, (tw, th, q) in SPEC.items():
        src = next((os.path.join(SRC, name + e)
                    for e in (".png", ".jpg", ".jpeg", ".webp")
                    if os.path.isfile(os.path.join(SRC, name + e))), None)
        if not src:
            missing.append(name)
            continue
        with Image.open(src) as im:
            im = im.convert("RGB")
            orig = im.size
            im, small = cover(im, tw, th)
            if small:
                warned.append(f"{name}: исходник {orig[0]}x{orig[1]} меньше цели {tw}x{th}")
            out = os.path.join(DST, name + ".webp")
            im.save(out, "WEBP", quality=q, method=6)
        kb = os.path.getsize(out) // 1024
        done.append(f"  {name+'.webp':26s} {im.size[0]}x{im.size[1]:<5d} {kb:4d} КБ   (из {orig[0]}x{orig[1]})")

    print(f"готово: {len(done)} из {len(SPEC)}")
    print("\n".join(done) if done else "  ничего не сконвертировано")
    if warned:
        print("\nпредупреждения (апскейл не делался):")
        for w in warned:
            print("  " + w)
    if missing:
        print(f"\nещё нет ({len(missing)}): " + ", ".join(missing))
    total = sum(os.path.getsize(os.path.join(DST, f))
                for f in os.listdir(DST) if f.endswith(".webp"))
    print(f"\nсуммарный вес графики: {total // 1024} КБ")


if __name__ == "__main__":
    main()
