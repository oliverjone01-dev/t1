#!/usr/bin/env python3
"""
TURBIUM - website visuals generator (OpenAI GPT Image).

Reads prompts/site.json, fills {{placeholders}} from its "subject" block (or from
--set key=value), appends the series style-lock and constraints to every shot and
either prints the final prompts or calls the OpenAI Images API, saving PNGs to
turbium/out/<id>.png.

Without OPENAI_API_KEY (or with --dry-run) it only prints the prompts, so they can
be pasted into ChatGPT Images by hand. Real generation is refused while any
{{placeholder}} is unresolved: an empty brief must not reach the model.

Usage:
    python3 turbium/scripts/generate.py --dry-run
    python3 turbium/scripts/generate.py --set product="..." --set palette="..." --dry-run
    OPENAI_API_KEY=... python3 turbium/scripts/generate.py --only hero-desktop
    OPENAI_API_KEY=... python3 turbium/scripts/generate.py --force

Model: taken from site.json "model", override with OPENAI_IMAGE_MODEL or --model.
No dependencies beyond the standard library. Network: api.openai.com.
"""
import argparse
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API_URL = "https://api.openai.com/v1/images/generations"
PH_RE = re.compile(r"\{\{(\w+)\}\}")


def fill(text: str, subject: dict) -> str:
    def sub(m):
        val = subject.get(m.group(1), "")
        return val if val and not PH_RE.search(val) else m.group(0)
    return PH_RE.sub(sub, text)


def build_prompt(shot: dict, cfg: dict, subject: dict) -> str:
    parts = [shot["prompt"], cfg.get("style_lock", ""), cfg.get("constraints", "")]
    return fill(" ".join(p.strip() for p in parts if p), subject)


def generate(prompt: str, shot: dict, model: str, key: str) -> bytes:
    body = {
        "model": model,
        "prompt": prompt,
        "size": shot.get("size", "1536x1024"),
        "quality": shot.get("quality", "high"),
        "n": 1,
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        data = json.load(r)
    for item in data.get("data", []):
        if item.get("b64_json"):
            return base64.b64decode(item["b64_json"])
    raise RuntimeError("no image in API response: " + json.dumps(data)[:300])


def main():
    ap = argparse.ArgumentParser(description="Generate TURBIUM website visuals via OpenAI GPT Image.")
    ap.add_argument("--config", default=str(ROOT / "prompts" / "site.json"))
    ap.add_argument("--set", action="append", default=[], metavar="KEY=VALUE",
                    help="override a subject field, e.g. --set product='...'")
    ap.add_argument("--only", action="append", default=[], metavar="ID", help="generate only these shot ids")
    ap.add_argument("--model", default=None)
    ap.add_argument("--out", default=str(ROOT / "out"))
    ap.add_argument("--dry-run", action="store_true", help="print prompts, do not call the API")
    ap.add_argument("--force", action="store_true", help="regenerate even if the file exists")
    args = ap.parse_args()

    cfg = json.loads(Path(args.config).read_text(encoding="utf-8"))
    subject = dict(cfg.get("subject", {}))
    for kv in args.set:
        k, _, v = kv.partition("=")
        if not v:
            sys.exit(f"[error] --set expects KEY=VALUE, got: {kv}")
        subject[k.strip()] = v.strip()

    model = args.model or os.environ.get("OPENAI_IMAGE_MODEL") or cfg.get("model", "gpt-image-2")
    shots = [s for s in cfg["shots"] if not args.only or s["id"] in args.only]
    if not shots:
        sys.exit("[error] no shots match --only")

    key = os.environ.get("OPENAI_API_KEY")
    dry = args.dry_run or not key
    if dry and not args.dry_run:
        print("[warn] OPENAI_API_KEY not set -> printing prompts only\n", file=sys.stderr)

    prompts = [(s, build_prompt(s, cfg, subject)) for s in shots]
    missing = sorted({m for _, p in prompts for m in PH_RE.findall(p)})
    if missing:
        print(f"[warn] unresolved placeholders: {', '.join(missing)} (fill site.json subject or use --set)\n",
              file=sys.stderr)
        if not dry:
            sys.exit("[error] refusing to generate with an incomplete brief")

    out_dir = Path(args.out)
    print(f"[info] {len(shots)} shot(s), model={model}\n")
    made = 0
    for shot, prompt in prompts:
        dest = out_dir / f"{shot['id']}.png"
        if not dry and not args.force and dest.exists():
            print(f"[skip] {dest.name} exists")
            continue
        print(f"[shot] {shot['id']} ({shot.get('section', '')}, {shot.get('size')}, {shot.get('quality')})\n"
              f"       {prompt}\n")
        if dry:
            continue
        try:
            raw = generate(prompt, shot, model, key)
            out_dir.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(raw)
            print(f"[ok]   wrote {dest}")
            made += 1
        except urllib.error.HTTPError as e:
            print(f"[fail] {shot['id']}: HTTP {e.code} {e.read()[:300]}", file=sys.stderr)
        except Exception as e:
            print(f"[fail] {shot['id']}: {e}", file=sys.stderr)

    if dry:
        print("[done] dry-run - prompts above.")
    else:
        print(f"[done] generated {made}/{len(shots)} into {out_dir}")


if __name__ == "__main__":
    main()
