import sys
f = sys.argv[1]
keys = sys.argv[2:]
s = open(f, encoding="utf-8").read()
for key in keys:
    i = s.find(key)
    print("=====", key, i, "count", s.count(key))
    if i >= 0:
        print(s[max(0, i - 300):i + 1100].replace("\n", "\\n")[:1500])
