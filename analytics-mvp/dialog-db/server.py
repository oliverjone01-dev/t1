#!/usr/bin/env python3
"""Read-only dialogue API; PostgreSQL via local peer authentication."""
import json, os, re, sys, hashlib, time
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
import psycopg2
from psycopg2.extras import Json, execute_values

DSN = os.environ.get('DIALOG_DSN', 'dbname=gg_dialog user=gg')
ROOT = Path(__file__).parent
def connect():
    c=psycopg2.connect(DSN); c.autocommit=False
    return c

def ingest(path):
    raw=Path(path).read_text()
    start=raw.index('const DATA = ')+len('const DATA = ')
    data,end=json.JSONDecoder().raw_decode(raw[start:])
    events=data.pop('events'); scoring=data.pop('scoring'); deals=scoring.pop('deals')
    identity=hashlib.sha256(raw[start:start+end].encode()).hexdigest()
    c=connect()
    try:
        with c.cursor() as q:
            q.execute('SELECT pg_advisory_xact_lock(872611)')
            q.execute('CREATE TABLE IF NOT EXISTS snapshot (id boolean PRIMARY KEY DEFAULT true CHECK(id), hash text, data jsonb, imported timestamptz DEFAULT now())')
            q.execute('SELECT hash FROM snapshot WHERE id=true')
            prev=q.fetchone()
            if prev and prev[0]==identity:
                print('unchanged'); c.rollback(); return
            q.execute('CREATE TABLE IF NOT EXISTS deals (key text PRIMARY KEY, mgr text, outcome text, created text, title text, data jsonb)')
            q.execute('CREATE TABLE IF NOT EXISTS events (id bigint PRIMARY KEY, key text, ts bigint, data jsonb)')
            q.execute('CREATE INDEX IF NOT EXISTS event_key_ts ON events(key,ts,id)')
            q.execute('CREATE INDEX IF NOT EXISTS deal_mgr ON deals(mgr,outcome)')
            q.execute('TRUNCATE deals, events')
            leadmap={str(e['leadId']):str(e['dealId']) for e in events if e.get('leadId') and e.get('dealId')}
            def key(e):
                if e.get('dealId'): return 'D'+str(e['dealId'])
                lead=str(e.get('leadId',''))
                return 'D'+leadmap[lead] if lead in leadmap else 'L'+lead
            execute_values(q,'INSERT INTO deals VALUES %s',[(d['key'],d.get('mgr',''),d.get('outcome','open'),d.get('createdAt',''),d.get('title',''),Json(d)) for d in deals],page_size=300)
            execute_values(q,'INSERT INTO events VALUES %s',[(i,key(e),e.get('ts',0),Json(e)) for i,e in enumerate(events)],page_size=1000)
            data['scoring']=scoring
            data['expected']={'deals':len(deals),'events':len(events)}
            q.execute('INSERT INTO snapshot(id,hash,data) VALUES(true,%s,%s) ON CONFLICT(id) DO UPDATE SET hash=excluded.hash,data=excluded.data,imported=now()',(identity,Json(data)))
            q.execute('SELECT (SELECT count(*) FROM deals),(SELECT count(*) FROM events)')
            assert q.fetchone()==(len(deals),len(events))
        c.commit()
        with c.cursor() as q: q.execute('ANALYZE deals');q.execute('ANALYZE events')
        c.commit(); print(json.dumps({'deals':len(deals),'events':len(events),'hash':identity}))
    finally: c.close()

def query_filter(p):
    clauses=[]; values=[]
    for name,col in [('manager','mgr'),('outcome','outcome')]:
        if p.get(name) and p[name]!='all': clauses.append('d.'+col+'=%s'); values.append(p[name])
    if p.get('q'): clauses.append('(d.title ILIKE %s OR d.key ILIKE %s)'); values += ['%'+p['q']+'%']*2
    lo=p.get('from',''); hi=p.get('to','')
    if lo or hi:
        for v in (lo,hi):
            if v and not re.fullmatch(r'\d{4}-\d{2}-\d{2}',v): raise ValueError('Дата должна быть YYYY-MM-DD')
        if p.get('mode')=='created':
            if lo: clauses.append("COALESCE(NULLIF(d.created,''),to_char(to_timestamp((SELECT min(ts) FROM events WHERE key=d.key)/1000.0) AT TIME ZONE 'Europe/Moscow','YYYY-MM-DD')) >= %s");values.append(lo)
            if hi: clauses.append("COALESCE(NULLIF(d.created,''),to_char(to_timestamp((SELECT min(ts) FROM events WHERE key=d.key)/1000.0) AT TIME ZONE 'Europe/Moscow','YYYY-MM-DD')) <= %s");values.append(hi)
        else:
            sub=['e.key=d.key']
            if lo: sub.append("e.ts >= extract(epoch FROM %s::date::timestamp AT TIME ZONE 'Europe/Moscow')*1000");values.append(lo)
            if hi: sub.append("e.ts < extract(epoch FROM (%s::date+1)::timestamp AT TIME ZONE 'Europe/Moscow')*1000");values.append(hi)
            clauses.append('EXISTS(SELECT 1 FROM events e WHERE '+' AND '.join(sub)+')')
    return (' WHERE '+' AND '.join(clauses) if clauses else ''),values

def aggregate(ds):
    scores={}; fields=['polite','qual','deadline','process','result']
    for f in fields:
        vals=[d.get('ai',{}).get('scores',{}).get(f) for d in ds if isinstance(d.get('ai'),dict)]
        vals=[v for v in vals if isinstance(v,(int,float)) and 0<=v<=5]
        scores[f]={'value':sum(vals)/len(vals) if vals else None,'n':len(vals)}
    reviewed=[d for d in ds if isinstance(d.get('ai'),dict) and d['ai'].get('verdict')]
    reviewed.sort(key=lambda d: {'bad':0,'warn':1,'good':2}.get(d['ai'].get('tone'),3))
    return {'total':len(ds),'reviewed':len(reviewed),'budget':sum(d.get('budget') or 0 for d in ds),'scores':scores,'comments':[{'key':d['key'],'title':d.get('title'),'ai':d['ai']} for d in reviewed[:8]]}

class API(BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_GET(self):
        u=urlparse(self.path);p={k:v[0] for k,v in parse_qs(u.query).items()}
        c=None
        try:
            if u.path in ('/','/index.html'):
                body=(ROOT/'index.html').read_bytes(); typ='text/html; charset=utf-8'
            else:
                c=connect()
                with c.cursor() as q:
                    q.execute("SET LOCAL statement_timeout='8s'")
                    if u.path=='/api/status':
                        q.execute('SELECT data,imported FROM snapshot WHERE id=true'); r=q.fetchone()
                        obj={'generatedAt':r[0].get('generatedAt'),'imported':r[1].isoformat(),'expected':r[0]['expected'],'aiCoverage':r[0]['scoring'].get('aiCoverage'),'portal':r[0].get('portal')}
                    elif u.path=='/api/summary':
                        where,args=query_filter(p);q.execute('SELECT d.data FROM deals d'+where,args);ds=[r[0] for r in q.fetchall()]
                        grouped={}
                        for d in ds: grouped.setdefault(d.get('mgr',''),[]).append(d)
                        obj={'department':aggregate(ds),'managers':[dict(manager=m,**aggregate(items)) for m,items in grouped.items()]}
                        # Manager list does not ship individual AI comments.
                        for m in obj['managers']:m.pop('comments')
                    elif u.path=='/api/deals':
                        where,args=query_filter(p); page=max(0,int(p.get('page',0)));limit=min(100,max(1,int(p.get('limit',40))))
                        orders={'budget':"COALESCE((data->>'budget')::numeric,0)",'silence':"COALESCE((data->>'silenceD')::numeric,0)",'title':'title','last':"data->>'lastDt'"}
                        order=orders.get(p.get('sort'),'data->>\'lastDt\''); direction='ASC' if p.get('direction')=='asc' else 'DESC'
                        q.execute('SELECT count(*) FROM deals d'+where,args);total=q.fetchone()[0]
                        q.execute('SELECT d.data - \'evTags\' - \'stageRows\' - \'owners\' FROM deals d'+where+' ORDER BY '+order+' '+direction+' NULLS LAST,key LIMIT %s OFFSET %s',args+[limit,page*limit]);obj={'total':total,'items':[r[0] for r in q.fetchall()]}
                    elif u.path=='/api/deal':
                        key=p.get('key','');q.execute('SELECT data FROM deals WHERE key=%s',(key,));r=q.fetchone()
                        if not r: self.send_error(404);return
                        obj={'deal':r[0]}
                    elif u.path=='/api/events':
                        key=p.get('key','');page=max(0,int(p.get('page',0)));q.execute('SELECT count(*) FROM events WHERE key=%s',(key,));total=q.fetchone()[0]
                        q.execute('SELECT data FROM events WHERE key=%s ORDER BY ts,id LIMIT 100 OFFSET %s',(key,page*100));obj={'total':total,'items':[r[0] for r in q.fetchall()]}
                    else:self.send_error(404);return
                body=json.dumps(obj,ensure_ascii=False).encode();typ='application/json; charset=utf-8'
            self.send_response(200);self.send_header('Content-Type',typ);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body)
        except (ValueError,psycopg2.Error):self.send_error(400,'Invalid query')
        except Exception:self.send_error(503,'Data unavailable')
        finally:
            if c:c.close()

if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='import':ingest(sys.argv[2])
    else:ThreadingHTTPServer(('127.0.0.1',18764),API).serve_forever()
