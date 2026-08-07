import zipfile, re, sys, os, glob

NS = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
import xml.etree.ElementTree as ET

def para_text(p):
    parts = []
    for node in p.iter():
        if node.tag == NS+'t':
            parts.append(node.text or '')
        elif node.tag == NS+'tab':
            parts.append('\t')
        elif node.tag == NS+'br':
            parts.append('\n')
    return ''.join(parts)

def style_of(p):
    pr = p.find(NS+'pPr')
    if pr is None: return ''
    ps = pr.find(NS+'pStyle')
    if ps is None: return ''
    return ps.get(NS+'val','')

def numbered(p):
    pr = p.find(NS+'pPr')
    if pr is None: return False
    return pr.find(NS+'numPr') is not None

def walk(body, out):
    for child in body:
        if child.tag == NS+'p':
            t = para_text(child).strip()
            st = style_of(child)
            if not t: continue
            if st.startswith('Heading') or st.startswith('Заголовок'):
                lvl = re.sub(r'\D','',st) or '1'
                out.append('#'*(int(lvl)+1) + ' ' + t)
            elif numbered(child):
                out.append('- ' + t)
            else:
                out.append(t)
        elif child.tag == NS+'tbl':
            rows = []
            for tr in child.findall(NS+'tr'):
                cells = []
                for tc in tr.findall(NS+'tc'):
                    ct = ' '.join(para_text(p).strip() for p in tc.findall(NS+'p'))
                    cells.append(ct.strip())
                rows.append(cells)
            if rows:
                out.append('')
                w = max(len(r) for r in rows)
                for i, r in enumerate(rows):
                    r = r + ['']*(w-len(r))
                    out.append('| ' + ' | '.join(x.replace('|','/') for x in r) + ' |')
                    if i == 0:
                        out.append('|' + '---|'*w)
                out.append('')

def extract(path):
    z = zipfile.ZipFile(path)
    xml = z.read('word/document.xml')
    root = ET.fromstring(xml)
    body = root.find(NS+'body')
    out = []
    walk(body, out)
    imgs = [n for n in z.namelist() if n.startswith('word/media/')]
    return '\n'.join(out), len(imgs)

src = sys.argv[1]; dst = sys.argv[2]
os.makedirs(dst, exist_ok=True)
for f in sorted(glob.glob(os.path.join(src,'*.docx'))):
    txt, nimg = extract(f)
    base = os.path.splitext(os.path.basename(f))[0]
    p = os.path.join(dst, base + '.md')
    with open(p,'w') as fh:
        fh.write(txt)
    print(f'{len(txt):>7} chars | {nimg:>3} img | {base}')
