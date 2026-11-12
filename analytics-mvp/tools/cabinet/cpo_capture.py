"""Prepare public CPO aggregates; native order identities never leave local files.

Archive pairs named NAME.orders.xlsx and NAME.daily.xlsx. Every report window is
replaced, never added twice. Retain the full archive since the first CPO capture.
Use the existing private archive and fresh orders_daily from main each run.
"""
import argparse
import collections
import datetime as dt
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'cpo'))
from cpo_raw import read_file, read_raw, _date


def money(x):
    try:
        v=Decimal(str(x).replace(',', '.').strip())
        if not v.is_finite() or v<0 or v*100 != (v*100).to_integral(): raise ValueError('Invalid CPO amount')
        return int(v*100)
    except (InvalidOperation,TypeError): raise ValueError('Missing/malformed CPO amount')


def cells(path):
    import openpyxl
    w=openpyxl.load_workbook(path,read_only=True,data_only=True)
    try:
        s=w['Statistics'];s.reset_dimensions();return list(s.values)
    finally:w.close()


def join_orders(by_order,data):
    posts=collections.defaultdict(list)
    for line in (data/'orders_daily.ndjson').read_text().splitlines():
        p=json.loads(line);posts[p['order'].rsplit('-',1)[0]].append(p)
    od=collections.defaultdict(lambda:[0,0,0]);miss=collections.defaultdict(lambda:[0,0])
    for order,rr in by_order.items():
        sp=sum(money(r['sp']) for r in rr);ps=posts.get(order)
        if not ps:
            m=min(r['d'] for r in rr)[:7];miss[m][0]+=1;miss[m][1]+=sp;continue
        day=min(p['d'] for p in ps);od[day][0]+=sp
        for p in ps:
            if p.get('status')!='cancelled':od[day][1]+=money(p['revenue']);od[day][2]+=int(p['units'])
    return ([{'d':d,'sp':v[0]/100,'rev':v[1]/100,'units':v[2]} for d,v in sorted(od.items())],
            [{'month':m,'n':v[0],'sp':v[1]/100} for m,v in sorted(miss.items())])


def prepare(archive,data,captured_at,settings):
    archive,data=Path(archive),Path(data)
    pairs=sorted(archive.glob('*.orders.xlsx'))
    if not pairs:raise ValueError('No archived native CPO reports')
    allowed={p for f in pairs for p in [f,f.with_name(f.name.replace('.orders.xlsx','.daily.xlsx'))]}
    if set(archive.glob('*.xlsx'))!=allowed:raise ValueError('CPO archive must contain only complete named report pairs')
    hashes=[]; windows=[]
    for path in pairs:
        # Native schema has a stale A1 dimension hint. Strictly check every money
        # cell before using the shared legacy parser (which is otherwise lenient).
        rows=cells(path);hdr=rows[2]
        if hdr[0]!='Дата' or hdr[2]!='Номер заказа' or hdr[-1]!='Расход, ₽':raise ValueError('CPO order header changed')
        seen=set()
        for r in rows[3:]:
            if not r or all(x is None for x in r):continue
            if len(r)!=len(hdr) or not _date(r[0]) or not r[2]:raise ValueError('Invalid CPO order row')
            money(r[-1]);key=(str(r[1]),str(r[3]),str(r[0]))
            if key in seen:raise ValueError('Duplicate native CPO order line')
            seen.add(key)
        parsed=read_file(path);windows.append(parsed['win'])
        daily_path=path.with_name(path.name.replace('.orders.xlsx','.daily.xlsx'))
        daily=cells(daily_path)
        if daily[0][0]!=rows[0][0] or daily[2][0]!='Дата' or daily[2][2]!='Расход, ₽':raise ValueError('CPO daily report window/header mismatch')
        actual={}; expected=collections.Counter()
        for r in parsed['rows']:expected[r['d']]+=money(r['sp'])
        for r in daily[3:]:
            d=_date(r[0]);sp=money(r[2])
            if not d or d in actual:raise ValueError('Duplicate/missing daily CPO date')
            actual[d]=sp
        lo,hi=parsed['win']; days=[(dt.date.fromisoformat(lo)+dt.timedelta(days=i)).isoformat() for i in range((dt.date.fromisoformat(hi)-dt.date.fromisoformat(lo)).days+1)]
        if set(actual)!=set(days) or any(actual[d]!=expected[d] for d in days):raise ValueError('CPO daily vs orders disagreement')
        hashes.extend(hashlib.sha256(p.read_bytes()).hexdigest() for p in [path,daily_path])
    rows,used,_=read_raw(archive)
    lo=min(w[0] for w in windows);hi=max(w[1] for w in windows)
    days=[(dt.date.fromisoformat(lo)+dt.timedelta(days=i)).isoformat() for i in range((dt.date.fromisoformat(hi)-dt.date.fromisoformat(lo)).days+1)]
    if any(not any(a<=d<=b for a,b in windows) for d in days):raise ValueError('CPO archive coverage gap')
    legacy=[json.loads(l) for l in (data/'cpo_orders.ndjson').read_text().splitlines() if l.strip()]
    if any(r.get('d','')>=lo for r in legacy):raise ValueError('Aggregate window overlaps legacy CPO report dates')
    old_ids={str(r['order']) for r in legacy}
    if any(r['order'] in old_ids for r in rows):raise ValueError('Order crosses legacy and aggregate boundary; review before publishing')
    sku=collections.defaultdict(lambda:[0,0]); offers={};by_order=collections.defaultdict(list)
    rd={d:{'d':d,'sp':0,'n':0} for d in days};no_sku=0
    for r in rows:
        sp=money(r['sp']);rd[r['d']]['sp']+=sp;rd[r['d']]['n']+=1;by_order[r['order']].append(r)
        if not r['sku'] or r['sku']=='0':no_sku+=sp;continue
        key=(r['d'],r['sku']);sku[key][0]+=sp;sku[key][1]+=1
        if key in offers and offers[key]!=r['offer']:raise ValueError('Conflicting SKU/article')
        offers[key]=r['offer']
    order_days,miss=join_orders(by_order,data)
    return {'version':1,'from':lo,'to':hi,'captured_at':captured_at,'source':'ozon-cpo-order-export',
        'orders_sha256':hashlib.sha256((data/'orders_daily.ndjson').read_bytes()).hexdigest(),'source_sha256':hashes,
        'sku':[{'d':d,'sku':s,'offer':offers[d,s],'sp':v[0]/100,'n':v[1]} for (d,s),v in sorted(sku.items())],
        'report_days':[dict(r,sp=r['sp']/100) for r in rd.values()],
        'order_days':order_days,'miss':miss,
        'no_sku_sp':no_sku/100,'settings':settings}


def package(archive,data,previous,captured_at,settings,out):
    old=json.loads(Path(previous).read_text());c=prepare(archive,data,captured_at,settings)
    if old.get('cpo') and (c['from']!=old['cpo']['from'] or c['to']<old['cpo']['to']):raise ValueError('Private archive incomplete; retain full observed history')
    old['cpo']=c;text=json.dumps(old,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n';digest=hashlib.sha256(text.encode()).hexdigest()
    out=Path(out);out.mkdir(parents=True,exist_ok=False)
    (out/'cabinet_capture.json').write_text(text)
    (out/'manifest.json').write_text(json.dumps({'public_sha256':digest,'ready_for_summary_publication':True}))
    (out/'READY.json').write_text(json.dumps({'sha256':digest}))
    return {'from':c['from'],'to':c['to'],'sku_rows':len(c['sku']),'order_days':len(c['order_days']),'missing_orders':sum(x['n'] for x in c['miss'])}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['archive','data','previous','captured-at','settings','out']:p.add_argument('--'+n,required=True)
    a=p.parse_args();print(json.dumps(package(a.archive,a.data,a.previous,a.captured_at,json.loads(Path(a.settings).read_text()),a.out)))
