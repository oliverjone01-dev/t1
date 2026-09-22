#!/usr/bin/env python3
"""
GENGROUP carousel - image generator (Nano Banana / Gemini Image).

Reads the image slots from a carousel HTML, builds one prompt per slot from its
brief + a per-carousel style-lock, calls the Gemini image API, and saves each
result next to the carousel as images/<name> (matching the slot's <img src>).

Why this exists: the skill's slots show a brief placeholder until a file exists.
This fills those files automatically instead of pasting briefs by hand. Without a
key (or with --dry-run) it just PRINTS the prompts so you can paste them into
Nano Banana 2 manually - still useful.

Usage:
    export GEMINI_API_KEY=...                 # required for real generation
    python generate_images.py carousel.html                      # generate missing
    python generate_images.py carousel.html --style-lock "cool daylight, matte black RAL 9005, 50mm, no people"
    python generate_images.py carousel.html --dry-run            # print prompts only
    python generate_images.py carousel.html --force              # regenerate existing

Model: default 'gemini-2.5-flash-image' (Nano Banana). For Nano Banana 2 / a newer
build, set GEMINI_IMAGE_MODEL to its exact model id - the call shape is the same.

Dependency for format conversion (optional): pillow. Network: needs egress to
generativelanguage.googleapis.com.
"""
import argparse
import base64
import json
import os
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path

API_HOST = "https://generativelanguage.googleapis.com"
DEFAULT_MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
CONSTRAINTS = ("Photographic, premium editorial quality, portrait 4:5, no text, "
               "no logos, no watermark, no captions.")

SLOT_RE = re.compile(r'class="imgslot".*?<img[^>]*src="([^"]+)"'
                     r'.*?class="brief">(.*?)</div>', re.DOTALL)
TAG_RE = re.compile(r'<[^>]+>')


def strip_tags(s: str) -> str:
    return re.sub(r'\s+', ' ', TAG_RE.sub('', s)).strip()


def find_slots(html: str):
    # ignore CSS/HTML comments and the <style> block (they hold doc examples)
    html = re.sub(r'(?is)<style.*?</style>', ' ', html)
    html = re.sub(r'(?s)<!--.*?-->', ' ', html)
    out = []
    for src, brief in SLOT_RE.findall(html):
        out.append((src.strip(), strip_tags(brief)))
    return out


def build_prompt(brief: str, style_lock: str) -> str:
    p = brief
    if style_lock and "style-lock" not in brief.lower():
        p += f" Style-lock: {style_lock}."
    return f"{p} {CONSTRAINTS}"


def gemini_image(prompt: str, model: str, key: str) -> bytes:
    url = f"{API_HOST}/v1beta/models/{model}:generateContent?key={key}"
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["IMAGE"]},
    }).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.load(r)
    for cand in data.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                return base64.b64decode(inline["data"])
    raise RuntimeError("no image in API response: " + json.dumps(data)[:300])


def save_image(raw: bytes, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    ext = dest.suffix.lower().lstrip(".") or "png"
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        fmt = "JPEG" if ext in ("jpg", "jpeg") else ext.upper()
        img.save(dest, fmt, quality=90)
    except Exception:
        dest.write_bytes(raw)  # pillow absent -> save bytes as-is


def main():
    ap = argparse.ArgumentParser(description="Generate carousel slot images via Gemini/Nano Banana.")
    ap.add_argument("carousel_html")
    ap.add_argument("--style-lock", default="", help="one visual lock applied to every slot (consistency)")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--dry-run", action="store_true", help="print prompts, do not call the API")
    ap.add_argument("--force", action="store_true", help="regenerate even if the file exists")
    args = ap.parse_args()

    html_path = Path(args.carousel_html).resolve()
    if not html_path.exists():
        sys.exit(f"[error] not found: {html_path}")
    slots = find_slots(html_path.read_text(encoding="utf-8"))
    if not slots:
        sys.exit("[error] no .imgslot blocks with a brief found in the HTML")

    key = os.environ.get("GEMINI_API_KEY")
    dry = args.dry_run or not key
    if dry and not args.dry_run:
        print("[warn] GEMINI_API_KEY not set -> printing prompts only (paste into Nano Banana 2)\n", file=sys.stderr)

    print(f"[info] {len(slots)} slot(s), model={args.model}\n")
    made = 0
    for src, brief in slots:
        dest = (html_path.parent / src).resolve()
        prompt = build_prompt(brief, args.style_lock)
        if not args.force and dest.exists():
            print(f"[skip] {src} exists"); continue
        print(f"[slot] {src}\n       {prompt}\n")
        if dry:
            continue
        try:
            save_image(gemini_image(prompt, args.model, key), dest)
            print(f"[ok]   wrote {dest}"); made += 1
        except urllib.error.HTTPError as e:
            print(f"[fail] {src}: HTTP {e.code} {e.read()[:200]}", file=sys.stderr)
        except Exception as e:
            print(f"[fail] {src}: {e}", file=sys.stderr)

    if dry:
        print("[done] dry-run - prompts above. Generate in Nano Banana 2, save files to images/, then re-export.")
    else:
        print(f"[done] generated {made}/{len(slots)}. Re-run export_carousel.py to bake them in.")


if __name__ == "__main__":
    main()
