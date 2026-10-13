import sys, zipfile
from xml.etree import ElementTree as ET
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def paras(path):
    z = zipfile.ZipFile(path)
    root = ET.fromstring(z.read('word/document.xml'))
    body = root.find(W + 'body')
    out = []
    for el in body:
        if el.tag == W + 'p':
            t = ''.join(x.text or '' for x in el.iter(W + 't'))
            out.append(('P', t))
        elif el.tag == W + 'tbl':
            for tr in el.iter(W + 'tr'):
                cells = []
                for tc in tr.findall(W + 'tc'):
                    cells.append(' / '.join(''.join(x.text or '' for x in p.iter(W + 't')) for p in tc.iter(W + 'p')))
                out.append(('T', ' | '.join(cells)))
    return out


src, dst = sys.argv[1], sys.argv[2]
with open(dst, 'w', encoding='utf-8') as f:
    for i, (k, t) in enumerate(paras(src)):
        if t.strip():
            f.write(f"{i:03d} {k} {t}\n")
print('ok', dst)
