"""Выгрузка компактных расшифровок диалогов для смысловой разметки.

Телефоны и почты маскируются. Выход: data/transcripts/<кабинет>.jsonl, по строке на чат.
"""
import json
import re
from pathlib import Path

from build_weekly import ACCOUNTS, EMAIL_RE, MAILING_RE, PERIOD_FROM, PHONE_RE, AUTO_RE, ts

ROOT = Path(__file__).parent
MAX_MSG = 400
MAX_LINES = 70
PHONE_LOOSE_RE = re.compile(r"(?:\+7|8)[\s\-()]*\d[\d\s\-()]{8,14}\d")


def mask(t):
    t = PHONE_RE.sub("[телефон]", t)
    t = PHONE_LOOSE_RE.sub("[телефон]", t)
    return EMAIL_RE.sub("[почта]", t)


def line(m, own):
    t = m["type"]
    b = m["body"]
    if t == "system":
        txt = " ".join((c.get("value") or {}).get("text", "") for c in b.get("chunks", []))
        if "попросил вас позвонить" in txt:
            return "АВИТО", "[клиент попросил перезвонить]"
        if "посмотрел номер" in txt:
            return "АВИТО", "[клиент посмотрел номер телефона]"
        return None
    who = "МЫ" if m["fromUid"] == own else "КЛ"
    if t == "text":
        txt = b.get("text", "")
        if txt == "Сообщение удалено":
            return None
        if who == "МЫ" and AUTO_RE.search(txt):
            who = "АВТО"
        if who == "МЫ" and MAILING_RE.search(txt):
            txt = "[шаблон-рассылка] " + txt[:120]
        return who, mask(txt.replace("\n", " "))[:MAX_MSG]
    if t == "appCall":
        st = "принят " + (b.get("subTitle") or "") if b.get("status") == "success" else "пропущен"
        return who, f"[входящий звонок {st}]"
    if t in ("image", "video"):
        return who, "[фото]" if t == "image" else "[видео]"
    if t == "link":
        return who, "[ссылка] " + mask(b.get("text", ""))[:120]
    if t == "voice":
        return who, "[голосовое]"
    if t == "file":
        return who, "[файл]"
    return None


def main():
    out_dir = ROOT / "data/transcripts"
    out_dir.mkdir(parents=True, exist_ok=True)
    marks = json.loads((ROOT / "data/chats.json").read_text())
    for path, code, _ in ACCOUNTS:
        d = json.loads((ROOT / path).read_text())
        own = d["ownerId"]
        meta = {r["id"]: r for r in marks[code]}
        n = 0
        with open(out_dir / f"{code}.jsonl", "w") as fh:
            for cid, h in d["history"].items():
                r = meta.get(cid)
                if not r or r["origin"] not in ("inbound", "mailing", "call_only"):
                    continue
                items = sorted(h["result"]["items"], key=lambda m: m["created"])
                if not any(m["fromUid"] != own and m["type"] == "text" for m in items):
                    continue  # без единого слова клиента разбирать нечего
                lines = []
                for m in items:
                    x = line(m, own)
                    if x:
                        lines.append(f"{ts(m['created']).strftime('%d.%m %H:%M')} {x[0]}: {x[1]}")
                if len(lines) > MAX_LINES:
                    lines = lines[:20] + ["... (пропуск) ..."] + lines[-(MAX_LINES - 20):]
                fh.write(json.dumps({
                    "id": cid, "cab": code, "week": r["week"], "origin": r["origin"],
                    "item": r.get("item"), "text": "\n".join(lines),
                }, ensure_ascii=False) + "\n")
                n += 1
        print(code, n)


if __name__ == "__main__":
    main()
