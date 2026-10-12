#!/usr/bin/env python3
"""
TURBIUM - storyboard prompt builder and generator (OpenAI GPT Image).

Reads prompts/storyboard.json and assembles, for each visual direction:
  - sheet   one 3x2 contact sheet with all six states (fast comparison of directions)
  - frames  six separate storyboard frames, 1536x1024, cropped to 16:9 afterwards
  - mobile  the first frame as a vertical mobile hero, 1024x1536
Every prompt = purpose + state + camera + composition + direction style-lock +
palette + avoid list, so the whole series stays in one look.

Without OPENAI_API_KEY (or with --dry-run) it only prints the prompts.
--md writes all prompts into a Markdown file for copy-paste into ChatGPT.
--chain feeds each generated frame as the reference image for the next one
(images/edits endpoint) to keep the six frames consistent.

Usage:
    python3 turbium/scripts/generate.py --dry-run
    python3 turbium/scripts/generate.py --md turbium/prompts/storyboards.md
    OPENAI_API_KEY=... python3 turbium/scripts/generate.py --kind sheet
    OPENAI_API_KEY=... python3 turbium/scripts/generate.py --direction c-swarm --kind frames --chain

Model: storyboard.json "model", override with OPENAI_IMAGE_MODEL or --model.
Standard library only. Network: api.openai.com. Output: turbium/out/<direction>/.
"""
import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "https://api.openai.com/v1/images"
KINDS = ("sheet", "frames", "mobile")
CHAIN_NOTE = ("The attached image is the previous frame of the same continuous shot: keep exactly "
              "the same look, palette, lighting, materials and scene elements, change only what "
              "is described below. ")


def frame_prompt(cfg, d, f, state, comp):
    return " ".join([
        cfg["purpose"].format(n=f["n"]),
        f"Direction: {d['name']}.",
        state["state"],
        f"Camera: {state['camera']}",
        cfg["compositions"][comp],
        d["style_lock"],
        cfg["palette"],
        cfg["avoid"],
    ])


def sheet_prompt(cfg, d):
    panels = " ".join(f"Panel {f['n']}: {s['state']}" for f, s in zip(cfg["frames"], d["frames"]))
    return " ".join([
        "A storyboard contact sheet: six 16:9 panels arranged in 3 columns and 2 rows with thin "
        "dark gutters, read left to right, top to bottom; every panel is a frame of the same "
        "scroll-driven 3D hero animation for a B2B analytics website that connects customer "
        f"requests, deals and payments and shows where orders get lost. Direction: {d['name']}.",
        panels,
        "Layout inside the panels, mandatory: panel 1 keeps its upper 45 percent as empty flat background "
        "for a headline, with the scene in its lower half; panels 2 to 6 keep their left 40 percent as empty "
        "flat background for copy, with the scene on the right. No haze, points or light in these empty zones.",
        d["style_lock"],
        cfg["palette"].replace("in the frame", "per panel"),
        cfg["avoid"],
    ])


def build_jobs(cfg, directions, kinds, only_frames):
    jobs = []
    for d in cfg["directions"]:
        if directions and d["id"] not in directions:
            continue
        if "sheet" in kinds:
            jobs.append(dict(direction=d, id="00-sheet", title="Раскадровка одним листом",
                             size="1536x1024", quality="high", prompt=sheet_prompt(cfg, d)))
        if "frames" in kinds:
            for f, s in zip(cfg["frames"], d["frames"]):
                if only_frames and f["id"] not in only_frames:
                    continue
                jobs.append(dict(direction=d, id=f["id"], title=f["title_ru"], size=f["size"],
                                 quality="high", motion=s.get("motion_ru", ""),
                                 prompt=frame_prompt(cfg, d, f, s, f["comp"])))
        if "mobile" in kinds:
            f, s = cfg["frames"][0], d["frames"][0]
            jobs.append(dict(direction=d, id="07-mobile-hero", title="Мобильный первый экран",
                             size="1024x1536", quality="high",
                             prompt=frame_prompt(cfg, d, f, s, "mobile")))
    return jobs


def write_md(cfg, jobs, path):
    out = ["# TURBIUM - промты раскадровки анимации первого экрана", "",
           "Файл собран скриптом `turbium/scripts/generate.py --md` из `prompts/storyboard.json`.",
           "Правки вносить в JSON, этот файл пересобирать. Модель: OpenAI GPT Image "
           f"(`{cfg['model']}`). Порядок работы и правила - `prompts/method.md`.", ""]
    current = None
    for j in jobs:
        d = j["direction"]
        if d["id"] != current:
            current = d["id"]
            out += [f"## {d['name_ru']}", "", d["concept_ru"], ""]
        out += [f"### {j['id']} · {j['title']} · `{j['size']}`", ""]
        if j.get("motion"):
            out += [f"**Движение (для разработки):** {j['motion']}", ""]
        out += ["```text", j["prompt"], "```", ""]
    Path(path).write_text("\n".join(out), encoding="utf-8")


def post_json(endpoint, body, key):
    req = urllib.request.Request(f"{API}/{endpoint}", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json",
                                          "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)


def post_edit(fields, image: Path, key):
    boundary = uuid.uuid4().hex
    parts = []
    for name, value in fields.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n'
                     f"{value}\r\n".encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; '
                 f'filename="{image.name}"\r\nContent-Type: image/png\r\n\r\n'.encode()
                 + image.read_bytes() + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(f"{API}/edits", data=b"".join(parts),
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}",
                                          "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)


def generate(job, model, key, ref=None) -> bytes:
    fields = {"model": model, "prompt": job["prompt"], "size": job["size"],
              "quality": job["quality"], "n": 1}
    if ref:
        fields["prompt"] = CHAIN_NOTE + job["prompt"]
        data = post_edit(fields, ref, key)
    else:
        data = post_json("generations", fields, key)
    for item in data.get("data", []):
        if item.get("b64_json"):
            return base64.b64decode(item["b64_json"])
    raise RuntimeError("no image in API response: " + json.dumps(data)[:300])


def main():
    ap = argparse.ArgumentParser(description="TURBIUM storyboard prompts / generation via OpenAI GPT Image.")
    ap.add_argument("--config", default=str(ROOT / "prompts" / "storyboard.json"))
    ap.add_argument("--direction", action="append", default=[], help="a-light-field | b-optics | c-swarm")
    ap.add_argument("--kind", action="append", default=[], choices=KINDS, help="default: all kinds")
    ap.add_argument("--frame", action="append", default=[], metavar="ID", help="e.g. 03-signal")
    ap.add_argument("--model", default=None)
    ap.add_argument("--out", default=str(ROOT / "out"))
    ap.add_argument("--md", metavar="PATH", help="write all prompts to a Markdown file and exit")
    ap.add_argument("--chain", action="store_true", help="use the previous frame as reference image")
    ap.add_argument("--dry-run", action="store_true", help="print prompts, do not call the API")
    ap.add_argument("--force", action="store_true", help="regenerate even if the file exists")
    args = ap.parse_args()

    cfg = json.loads(Path(args.config).read_text(encoding="utf-8"))
    known = {d["id"] for d in cfg["directions"]}
    if set(args.direction) - known:
        sys.exit(f"[error] unknown direction, use: {', '.join(sorted(known))}")
    jobs = build_jobs(cfg, args.direction, args.kind or KINDS, args.frame)
    if not jobs:
        sys.exit("[error] nothing matches the filters")

    if args.md:
        write_md(cfg, jobs, args.md)
        print(f"[done] {len(jobs)} prompts -> {args.md}")
        return

    model = args.model or os.environ.get("OPENAI_IMAGE_MODEL") or cfg.get("model", "gpt-image-2")
    key = os.environ.get("OPENAI_API_KEY")
    dry = args.dry_run or not key
    if dry and not args.dry_run:
        print("[warn] OPENAI_API_KEY not set -> printing prompts only\n", file=sys.stderr)

    print(f"[info] {len(jobs)} image(s), model={model}\n")
    made, prev = 0, {}
    for job in jobs:
        did = job["direction"]["id"]
        out_dir = Path(args.out) / did
        dest = out_dir / f"{job['id']}.png"
        # chain: each frame follows the previous one, the mobile hero follows frame 01
        ref = None
        if args.chain and job["id"] != "00-sheet":
            ref = out_dir / "01-overview.png" if job["id"] == "07-mobile-hero" else prev.get(did)
            ref = ref if ref and ref.exists() else None
        if job["id"] not in ("00-sheet", "07-mobile-hero"):
            prev[did] = dest
        if not dry and not args.force and dest.exists():
            print(f"[skip] {did}/{dest.name} exists")
            continue
        print(f"[img]  {did}/{job['id']} ({job['title']}, {job['size']})"
              f"{' <- ' + ref.name if ref else ''}\n       {job['prompt']}\n")
        if dry:
            continue
        try:
            raw = generate(job, model, key, ref)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(raw)
            print(f"[ok]   wrote {dest}")
            made += 1
        except urllib.error.HTTPError as e:
            print(f"[fail] {did}/{job['id']}: HTTP {e.code} {e.read()[:300]}", file=sys.stderr)
        except Exception as e:
            print(f"[fail] {did}/{job['id']}: {e}", file=sys.stderr)

    print("[done] dry-run - prompts above." if dry else f"[done] generated {made}/{len(jobs)} into {args.out}")


if __name__ == "__main__":
    main()
