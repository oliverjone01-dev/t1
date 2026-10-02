import glob,collections,json,sys
sys.path.insert(0,'tools/ym-sverka')
from xl import sheet_rows
UP='UPLOADS_DIR/'; D='COPY_OF_DATA_YM/'
def dt(s): d,m,y=str(s).split(' ')[0].split('.'); return f'{y}-{m}-{d}'
def oid(r):
    if r[10] not in (None,''): return str(r[10])
    return str(int(r[9])) if isinstance(r[9],float) else (r[9] or '')
K=lambda b,d,o,s,n,a:(b,d,str(o or ''),s or '',(n or '').strip(),round(float(a),2))
st=collections.defaultdict(list); n=0; sts=collections.Counter()
for f in sorted(glob.glob(UP+'*united_netting*.xlsx')):
    for r in sheet_rows(f,'Отчёт о платежах')[2:]:
        if not r or not isinstance(r[0],float): continue
        st[K(str(int(r[0])),dt(r[7]),oid(r),r[24],r[18],r[20] or 0)].append(r[25]); n+=1; sts[r[25]]+=1
rows=[json.loads(l) for l in open(D+'netting.ndjson') if l.strip()]
hit=canc=0
for r in rows:
    k=K(r['business'],r['d'],r.get('order',''),r.get('src',''),r.get('service',''),r['amount'])
    if st.get(k):
        r['status']=st[k].pop(0); hit+=1; canc+=('не будет' in r['status'].lower())
open(D+'netting.ndjson','w').write(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in rows))
print('xlsx',n,'проставлено',hit,'из них «не будет»',canc,'| не нашли пару в реестре',sum(len(v) for v in st.values()))
print(sts.most_common())
