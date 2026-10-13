import sys
import docx
from docx.oxml.ns import qn

d = docx.Document(sys.argv[1])
out = []
body = d.element.body
for el in body.iterchildren():
    if el.tag == qn('w:p'):
        t = ''.join(x.text or '' for x in el.iter(qn('w:t')))
        out.append(t)
    elif el.tag == qn('w:tbl'):
        for row in el.iter(qn('w:tr')):
            cells = []
            for tc in row.iter(qn('w:tc')):
                cells.append(' / '.join(''.join(x.text or '' for x in p.iter(qn('w:t'))) for p in tc.iter(qn('w:p'))))
            out.append('| ' + ' | '.join(cells) + ' |')
print('\n'.join(out))
