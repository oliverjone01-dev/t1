import zipfile,re,xml.etree.ElementTree as ET
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
def col(ref):
    n=0
    for ch in re.match(r'[A-Z]+',ref).group(0): n=n*26+ord(ch)-64
    return n-1
def sheet_rows(path, name):
    z=zipfile.ZipFile(path)
    ss=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',NS):
            ss.append(''.join(t.text or '' for t in si.iter('{%s}t'%NS['m'])))
    wb=ET.fromstring(z.read('xl/workbook.xml'))
    rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rid=[s.get('{%s}id'%NS['r']) for s in wb.find('m:sheets',NS) if s.get('name')==name][0]
    tgt=[r.get('Target') for r in rels if r.get('Id')==rid][0]
    tgt=tgt.lstrip('/'); tgt=tgt if tgt.startswith('xl/') else 'xl/'+tgt
    out=[]
    for row in ET.fromstring(z.read(tgt)).iter('{%s}row'%NS['m']):
        vals={}
        for c in row.findall('m:c',NS):
            t=c.get('t'); v=c.find('m:v',NS); isv=c.find('m:is',NS)
            if t=='s' and v is not None: x=ss[int(v.text)]
            elif t=='inlineStr' and isv is not None: x=''.join(tt.text or '' for tt in isv.iter('{%s}t'%NS['m']))
            elif v is not None:
                x=v.text
                if t not in ('str',):
                    try: x=float(x)
                    except: pass
            else: x=None
            vals[col(c.get('r'))]=x
        out.append([vals.get(i) for i in range(max(vals)+1)] if vals else [])
    return out
