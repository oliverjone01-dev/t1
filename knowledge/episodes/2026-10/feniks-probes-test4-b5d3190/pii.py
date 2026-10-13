import re, sys
PHONE = re.compile(r"\+7[\s(-]*\d{3}|\b\d{3}-\d{3}-\d{2}-\d{2}\b")
for p in sys.argv[1:]:
    h = open(p, encoding="utf-8").read()
    hits = [(m.start(), h[max(0, m.start() - 120):m.end() + 60].replace("\n", " ")) for m in PHONE.finditer(h)]
    print("####", p, "hits:", len(hits))
    for pos, ctx in hits[:5]:
        print("   @", pos, "::", ctx)
