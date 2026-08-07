#!/usr/bin/env python3
"""Потоковый парсер листа «Диалоги» из выгрузки Bitrix24 C49 в JSONL."""
import sys, json, zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
COLS = ["date", "time", "dealId", "stage", "stageSense", "mgr", "clientType",
        "itemType", "amount", "author", "channel", "text"]

def col_idx(ref):
    s = "".join(c for c in ref if c.isalpha())
    n = 0
    for ch in s:
        n = n * 26 + (ord(ch) - 64)
    return n - 1

def main(src, dst):
    z = zipfile.ZipFile(src)
    name = [n for n in z.namelist() if n.startswith("xl/worksheets/sheet")][0]
    out = open(dst, "w", encoding="utf-8")
    n = 0
    with z.open(name) as fh:
        for ev, el in ET.iterparse(fh, events=("end",)):
            if el.tag != NS + "row":
                continue
            r = int(el.get("r"))
            if r == 1:
                el.clear(); continue
            row = [""] * len(COLS)
            for c in el.findall(NS + "c"):
                i = col_idx(c.get("r"))
                if i >= len(COLS):
                    continue
                if c.get("t") == "inlineStr":
                    isn = c.find(NS + "is")
                    val = "".join(t.text or "" for t in isn.iter(NS + "t")) if isn is not None else ""
                else:
                    v = c.find(NS + "v")
                    val = v.text if v is not None else ""
                row[i] = (val or "").strip()
            out.write(json.dumps(dict(zip(COLS, row)), ensure_ascii=False) + "\n")
            n += 1
            el.clear()
    out.close()
    print(f"строк: {n}")

main(sys.argv[1], sys.argv[2])
