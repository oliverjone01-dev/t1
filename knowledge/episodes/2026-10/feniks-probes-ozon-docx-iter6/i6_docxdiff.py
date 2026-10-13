import zipfile, re, subprocess, io, difflib, sys
def text(rev):
    blob = subprocess.run(['git', '-C', '/home/user/t1', 'show', rev + ':sessions/OZON-testy-itogi-2026-10-12.docx'], capture_output=True).stdout
    x = zipfile.ZipFile(io.BytesIO(blob)).read('word/document.xml').decode('utf8')
    out = []
    for p in re.findall(r'<w:p[ >].*?</w:p>', x, flags=re.S):
        t = ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', p, flags=re.S))
        if t.strip(): out.append(t)
    return out, x
a, xa = text('fb98d83'); b, xb = text('16a192e')
for l in difflib.unified_diff(a, b, lineterm='', n=0):
    print(l[:400])
new = [l for l in b if l not in a]
print('NEW paragraphs:', len(new))
for t in new:
    print('  len', len(t), 'emdash', t.count('—'), 'endash', t.count('–'), 'minus', t.count('−'))
print('whole doc emdash', xb.count('—'), 'endash', xb.count('–'))
# compare with make2.js source text
src = open('/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/make2.js', encoding='utf8').read()
for t in new:
    tail = t[t.find('. ') + 2:][:80]
    print('  in make2.js:', tail[:60] in src)
