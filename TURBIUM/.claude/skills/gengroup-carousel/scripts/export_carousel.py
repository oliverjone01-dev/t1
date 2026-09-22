#!/usr/bin/env python3
"""
GENGROUP carousel exporter.

Renders every <section class="slide"> in an HTML file to one PNG, in order.
Output PNGs match the slide's CSS size exactly (e.g. 1080x1350), supersampled
at 2x for crispness and downscaled with Lanczos.

Usage:
    python export_carousel.py INPUT.html OUTPUT_DIR
    python export_carousel.py carousel.html ./slides --prefix glass --retina

Why this approach (do not "simplify" these away):
  * Real Chromium renders Google Fonts and flexbox exactly as previewed.
  * device_scale_factor=2 + Lanchos downscale = crisp text at native size.
  * Per-element screenshot clips to the slide box - no manual cropping.
  * Waits for networkidle + a fixed delay so webfonts finish loading before
    the screenshot. Skip the wait and slides export in a fallback system font.

Dependencies: playwright (chromium installed), pillow.
  pip install playwright pillow --break-system-packages
  python -m playwright install chromium
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    Image = None


async def export(input_html: str, out_dir: str, prefix: str, scale: int, retina: bool, font_wait_ms: int):
    in_path = Path(input_html).resolve()
    if not in_path.exists():
        sys.exit(f"[error] not found: {in_path}")
    out = Path(out_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)

    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        # Portable launch: honor a system Chromium via env (containers/CI where the
        # bundled download is blocked) and add --no-sandbox when running as root.
        # On a normal machine no env is set -> default Playwright Chromium is used.
        launch_args = ["--force-color-profile=srgb"]
        if os.environ.get("PW_NO_SANDBOX") or (hasattr(os, "geteuid") and os.geteuid() == 0):
            launch_args.append("--no-sandbox")
        launch_kwargs = {"args": launch_args}
        exe = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        if exe:
            launch_kwargs["executable_path"] = exe
        browser = await p.chromium.launch(**launch_kwargs)
        page = await browser.new_page(device_scale_factor=scale)
        await page.goto(in_path.as_uri(), wait_until="networkidle")
        # let webfonts settle (Montserrat/Georgia); critical for correct render
        await page.wait_for_timeout(font_wait_ms)
        try:
            await page.evaluate("document.fonts.ready")
        except Exception:
            pass

        slides = await page.query_selector_all(".slide")
        if not slides:
            await browser.close()
            sys.exit("[error] no elements with class .slide found")

        written = []
        for i, el in enumerate(slides, start=1):
            box = await el.bounding_box()
            target_w = round(box["width"])   # CSS px = intended PNG size
            target_h = round(box["height"])
            name = f"{prefix}-{i:02d}.png"
            fpath = out / name
            await el.screenshot(path=str(fpath))  # captured at 2x

            if not retina and Image is not None and scale != 1:
                img = Image.open(fpath)
                if img.size != (target_w, target_h):
                    img = img.resize((target_w, target_h), Image.LANCZOS)
                    img.save(fpath, "PNG", optimize=True)
            written.append((name, target_w, target_h))

        await browser.close()

    print(f"[ok] {len(written)} slides -> {out}")
    for name, w, h in written:
        suffix = f"{w*scale}x{h*scale} (retina)" if retina else f"{w}x{h}"
        print(f"     {name}  {suffix}")
    print("\nNext: review each PNG visually before publishing (ФЕНИКС step).")


def main():
    ap = argparse.ArgumentParser(description="Export GENGROUP carousel HTML slides to PNG.")
    ap.add_argument("input_html")
    ap.add_argument("output_dir")
    ap.add_argument("--prefix", default="slide", help="filename prefix (default: slide)")
    ap.add_argument("--scale", type=int, default=2, help="device_scale_factor for supersampling (default: 2)")
    ap.add_argument("--retina", action="store_true", help="keep the 2x render, do not downscale to native size")
    ap.add_argument("--font-wait-ms", type=int, default=2500, help="delay for webfonts to load (default: 2500)")
    args = ap.parse_args()
    if not args.retina and Image is None:
        print("[warn] pillow not installed -> exporting at retina size. "
              "Install pillow to get exact native dimensions.", file=sys.stderr)
    asyncio.run(export(args.input_html, args.output_dir, args.prefix, args.scale, args.retina, args.font_wait_ms))


if __name__ == "__main__":
    main()
