# ФЕНИКС проба B4 (OZON v5): docx автора против doc.json конвейера - каждая ячейка таблиц doc.json есть в тексте docx
import zipfile, re, json, html
EM = chr(0x2014)
z = zipfile.ZipFile('/tmp/ozon-v5/OZON-variant1-vs-variant2-2026-10-13.docx')
xml = z.read('word/document.xml').decode()
txt = '\n'.join(html.unescape(''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', p, flags=re.S)))
                for p in re.findall(r'<w:p[ >].*?</w:p>', xml, flags=re.S))
print('символов', len(txt), '; em dash в docx:', txt.count(EM))
d = json.load(open('/tmp/ozon-v5/doc.json'))
cells = [c for k in ('main', 'dec', 'ops', 'eps') for row in d[k] for c in row[1:]]
cells += [c for k in ('art', 'cand', 'cpo', 'skip') for row in d[k] for c in row if c]
cells += [d['cpo_tot'][0], d['art_tot'][0], d['v2_be']]
miss = [c for c in cells if c not in txt]
print('ячеек doc.json', len(cells), '; нет в docx:', len(miss), miss[:20])
