import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
month = sys.argv[2] if len(sys.argv) > 2 else None
print("options", d.get("options"), "errors", d.get("errors"))
for m, rec in d["months"].items():
    if month and m != month:
        continue
    print("=====", m, "renderError", rec.get("renderError"), "exportError", rec.get("exportError"))
    print("SUB:", rec.get("sub"))
    print("FLAGS:", rec.get("flags"))
    print("FLOWNOTE:", rec.get("flowNote"))
    fl = rec.get("flow")
    if fl:
        print("FLOW HEAD:", " | ".join(x or "" for x in fl["head"]))
        for r in fl["rows"]:
            print("  ", " | ".join(x or "" for x in r["cells"]))
    c = rec.get("cost")
    if c:
        print("COST HEAD:", " | ".join(x or "" for x in c["head"]))
        for r in c["rows"]:
            print("  ", " | ".join(x or "" for x in r["cells"]))
