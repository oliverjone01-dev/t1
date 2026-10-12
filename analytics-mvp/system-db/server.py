#!/usr/bin/env python3
"""Authenticated-by-nginx dashboard storage and system inventory, PostgreSQL."""
import hashlib,json,os,re,sys,time,subprocess,threading
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlparse,parse_qs
import psycopg2
from psycopg2.extras import Json,execute_values
ROOT=Path('/srv/gg');SITE=ROOT/'www/current';DSN='dbname=gg_dialog user=gg';SCHEMA='gg_system'
EXEMPT={'dialog','structure'}
LABELS={'rop':'РОП GENGLASS','prod':'Производство','office':'Офис','economics':'Экономика','rop-gm':'РОП GLASS MEMORY','dialog':'Коммуникации','structure':'Структура системы','pto':'ПТО','integra':'Замеры и монтажи','marketing':'Маркетинг'}
CONNECT=lambda:psycopg2.connect(DSN)
LOADER=r'''<script data-gg-db-loader>(async function(){const holder=document.querySelector('[data-gg-db-payload]');const status=document.createElement('div');status.id='gg-db-loading';status.style.cssText='padding:20px;color:#9daab9;font:14px system-ui';status.textContent='Загрузка данных…';(document.getElementById('gg-dashboard')||document.body).prepend(status);try{const res=await fetch(holder.dataset.ggDbPayload,{cache:'no-cache'});if(!res.ok)throw Error('HTTP '+res.status);window.__GG_DB_PAYLOAD=await res.json();const queued=[],original=document.addEventListener;document.addEventListener=function(type,fn,options){if(type==='DOMContentLoaded'&&document.readyState!=='loading'){queued.push(fn);return;}return original.call(this,type,fn,options);};try{for(const old of document.querySelectorAll('script[type="application/x-gg-deferred"]')){const n=document.createElement('script');for(const a of old.attributes)if(!['type','data-gg-original-type'].includes(a.name))n.setAttribute(a.name,a.value);if(old.dataset.ggOriginalType)n.type=old.dataset.ggOriginalType;n.textContent=old.textContent;if(n.src){await new Promise((resolve,reject)=>{n.onload=resolve;n.onerror=reject;old.replaceWith(n);});}else old.replaceWith(n);}for(const fn of queued){if(typeof fn==='function')fn.call(document,new Event('DOMContentLoaded'));else fn.handleEvent(new Event('DOMContentLoaded'));}}finally{document.addEventListener=original;}status.remove();}catch(e){status.textContent='Не удалось загрузить данные. Повторите загрузку страницы.';console.error('Dashboard data loading',e);}})();</script>'''

def setup(c):
 with c.cursor() as q:
  q.execute('CREATE SCHEMA IF NOT EXISTS gg_system')
  q.execute('CREATE TABLE IF NOT EXISTS gg_system.payloads(slug text,version text,data jsonb NOT NULL,created timestamptz DEFAULT now(),PRIMARY KEY(slug,version))')
  q.execute('CREATE TABLE IF NOT EXISTS gg_system.registry(slug text PRIMARY KEY,version text,variable text,metadata jsonb,updated timestamptz DEFAULT now())')
  q.execute('CREATE TABLE IF NOT EXISTS gg_system.records(slug text,collection text,key text,mgr text,created text,data jsonb,PRIMARY KEY(slug,collection,key))')
  q.execute('CREATE INDEX IF NOT EXISTS system_record_filter ON gg_system.records(slug,collection,mgr,created)')
  q.execute('CREATE TABLE IF NOT EXISTS gg_system.inventory(id boolean PRIMARY KEY DEFAULT true CHECK(id),data jsonb,updated timestamptz DEFAULT now())')
 c.commit()

def extract(s):
 for m in re.finditer(r'(?:const|let|var)\s+(DATA|D)\s*=\s*([\[{])',s):
  try:
   obj,n=json.JSONDecoder().raw_decode(s[m.end()-1:])
   if n>1000:return m.group(1),m.end()-1,m.end()-1+n,obj
  except ValueError:pass
 return None

def convert(s,slug,variable,a,b,version):
 s=s[:a]+'window.__GG_DB_PAYLOAD'+s[b:]
 # Execute all scripts in their original order only after the payload has loaded.
 script_start=s.rfind('<script',0,a)
 prefix=s[:script_start];tail=s[script_start:]
 def defer(m):
  tag=m.group(0)
  old=re.search(r'\btype=["\']([^"\']+)',tag)
  if old and old.group(1) not in ['text/javascript','application/javascript','module']:return tag
  if old:tag=re.sub(r'\s+type=["\'][^"\']+["\']','',tag)
  return tag[:-1]+' type="application/x-gg-deferred"'+(' data-gg-original-type="'+old.group(1)+'"' if old else '')+'>'
 tail=re.sub(r'<script\b[^>]*>',defer,tail)
 tag='<meta data-gg-db-payload="/_system/api/payload?slug='+slug+'&amp;version='+version+'">'
 result=prefix+tail
 return result.replace('</head>',tag+'</head>',1).replace('</body>',LOADER+'</body>',1)

def atomic(path,text):
 temp=path.with_name(path.name+'.db-tmp');temp.write_text(text);os.replace(temp,path)

def ingest():
 c=CONNECT();setup(c);report=[]
 try:
  with c.cursor() as q:
   q.execute('SELECT pg_advisory_lock(872612)')
  for p in sorted(SITE.glob('*/index.html')):
   slug=p.parent.name
   if slug in EXEMPT:continue
   s=p.read_text();out=extract(s)
   if not out:continue
   variable,a,b,data=out
   packed=json.dumps(data,ensure_ascii=False,separators=(',',':'));version=hashlib.sha256(packed.encode()).hexdigest()
   rows=[];counts={}
   if isinstance(data,dict):
    for collection,items in data.items():
     if not isinstance(items,list):continue
     counts[collection]=len(items)
     for i,row in enumerate(items):
      if not isinstance(row,dict):continue
      key=str(row.get('id',row.get('key',i)))+':'+str(i)
      rows.append((slug,collection,key,str(row.get('mgr',row.get('manager',''))),str(row.get('created',row.get('createdAt',''))),Json(row)))
   metadata={'counts':counts,'source_bytes':len(s.encode()),'payload_bytes':len(packed.encode()),'title':LABELS.get(slug,slug),'generated':data.get('generatedAt',data.get('generated_at')) if isinstance(data,dict) else None,'mode':'database_payload','server_filters':False}
   with c.cursor() as q:
    q.execute('INSERT INTO gg_system.payloads(slug,version,data) VALUES(%s,%s,%s) ON CONFLICT DO NOTHING',(slug,version,Json(data)))
    q.execute('DELETE FROM gg_system.records WHERE slug=%s',(slug,))
    if rows:execute_values(q,'INSERT INTO gg_system.records VALUES %s',rows,page_size=300)
    q.execute('SELECT count(*) FROM gg_system.records WHERE slug=%s',(slug,));assert q.fetchone()[0]==len(rows)
    q.execute('INSERT INTO gg_system.registry(slug,version,variable,metadata) VALUES(%s,%s,%s,%s) ON CONFLICT(slug) DO UPDATE SET version=excluded.version,variable=excluded.variable,metadata=excluded.metadata,updated=now()',(slug,version,variable,Json(metadata)))
   c.commit()
   # Keep a restore copy outside the public site; publish only after DB commit.
   backup=ROOT/'system-db/rollback'/slug/version/'index.html';backup.parent.mkdir(parents=True,exist_ok=True)
   if not backup.exists():backup.write_text(s)
   converted=convert(s,slug,variable,a,b,version)
   assert extract(converted) is None
   atomic(p,converted);report.append({'slug':slug,'records':len(rows),'html_bytes':len(converted.encode()),'payload_bytes':len(packed.encode())})
  with c.cursor() as q:q.execute('ANALYZE gg_system.records')
  c.commit()
 finally:c.close()
 dialog=SITE/'dialog/index.html'
 assets=Path(__file__).parent
 enhancement=assets/'dialog-enhancement.css'
 if dialog.exists() and enhancement.exists():
  page=dialog.read_text();page=re.sub(r'<style data-gg-dialog-enhancement>.*?</style>','',page,flags=re.S)
  page=page.replace('</head>','<style data-gg-dialog-enhancement>'+enhancement.read_text()+'</style></head>',1)
  page=re.sub(r'<script data-gg-dialog-enhancement>.*?</script>','',page,flags=re.S)
  behavior=assets/'dialog-enhancement.js'
  if behavior.exists():page=page.replace('</body>','<script data-gg-dialog-enhancement>'+behavior.read_text()+'</script></body>',1)
  page=page.replace("r.article.scrollIntoView({block:'start'","r.article.scrollIntoView({block:'center'")
  atomic(dialog,page)
 structure=SITE/'structure/index.html'
 if structure.exists():
  page=structure.read_text()
  if 'data-gg-system-inventory' not in page:
   assets=Path(__file__).parent
   page=page.replace('</head>','<style data-gg-system-inventory>'+ (assets/'structure.css').read_text()+'</style></head>',1).replace('</body>','<script data-gg-system-inventory>'+ (assets/'structure.js').read_text()+'</script></body>',1)
   atomic(structure,page)
 refresh_inventory();print(json.dumps(report,ensure_ascii=False))

_inventory_lock=threading.Lock()
def allocated(path):
 try:return int(subprocess.check_output(['du','-s','-B1',str(path)],stderr=subprocess.DEVNULL,text=True).split()[0])
 except:return 0

def refresh_inventory():
 with _inventory_lock:
  c=CONNECT();setup(c)
  try:
   with c.cursor() as q:
    q.execute('SELECT slug,metadata,updated FROM gg_system.registry');reg={r[0]:dict(r[1],updated=r[2].isoformat()) for r in q.fetchall()}
    q.execute('SELECT pg_database_size(current_database()),pg_total_relation_size(\'gg_system.records\'),pg_total_relation_size(\'gg_system.payloads\')');db,records,payloads=q.fetchone()
    q.execute("SELECT slug,COALESCE(sum(pg_column_size(data)),0) FROM gg_system.payloads GROUP BY slug");dbslug=dict(q.fetchall())
  finally:c.close()
  dashboards=[]
  managers={}
  mp=SITE/'.gg/managers.txt'
  if mp.exists():
   for line in mp.read_text().splitlines():
    slug,_,label=line.partition('\t');managers[slug]=label
  for p in sorted(SITE.iterdir()):
   if not p.is_dir() or p.name.startswith('.'):continue
   slug=p.name;r=reg.get(slug);html=p/'index.html';text=html.read_text() if html.exists() else ''
   db_active='data-gg-db-payload' in text
   if slug=='dialog':status='База есть в /dialog-next/; основной интерфейс ещё на выгрузке';stage='in_progress'
   elif db_active:status='Данные в PostgreSQL · интерфейс сохранён';stage='db'
   elif extract(text):status='Данные в HTML · перенос не выполнен';stage='pending'
   else:status='Статический раздел / интеграция · отдельного массива данных не найдено';stage='static'
   dashboards.append({'slug':slug,'title':LABELS.get(slug,managers.get(slug,slug)),'url':'/'+slug+'/','site_bytes':allocated(p),'db_payload_bytes':int(dbslug.get(slug,0)),'stage':stage,'status':status,'updated':r.get('updated') if r else None,'server_filters':r.get('server_filters',False) if r else False})
  stat=os.statvfs(ROOT)
  data={'generated':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'filesystem':{'total':stat.f_blocks*stat.f_frsize,'free':stat.f_bavail*stat.f_frsize},'system_bytes':allocated(ROOT),'active_site_bytes':allocated(SITE.resolve()),'database_bytes':db,'system_records_bytes':records,'system_payload_table_bytes':payloads,'components':{name:allocated(ROOT/name) for name in ['www','data','src','git','backups','cache','dialog-db','system-db','logs']},'dashboards':dashboards,'note':'Размер сайта — занятые блоки файлов. Размер данных раздела в БД — полезная нагрузка JSON; индексы и общий служебный объём БД показаны отдельно. Псевдонимы и общие источники могут пересекаться; размеры разделов не равны общей сумме системы.'}
  c=CONNECT()
  try:
   with c.cursor() as q:q.execute('INSERT INTO gg_system.inventory(id,data) VALUES(true,%s) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=now()',(Json(data),))
   c.commit()
  finally:c.close()

class API(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  u=urlparse(self.path);params={k:v[0] for k,v in parse_qs(u.query).items()};c=None
  try:
   if u.path=='/api/inventory':
    c=CONNECT()
    with c.cursor() as q:q.execute('SELECT data::text FROM gg_system.inventory WHERE id=true');body=q.fetchone()[0].encode()
   elif u.path=='/api/status':body=json.dumps({'ok':True,'service':'gg-system-api'}).encode()
   elif u.path=='/api/payload':
    slug=params.get('slug','');version=params.get('version','')
    if not re.fullmatch(r'[a-z0-9-]+',slug) or not re.fullmatch(r'[a-f0-9]{64}',version):raise ValueError('Invalid selection')
    c=CONNECT()
    with c.cursor() as q:
     q.execute("SET LOCAL statement_timeout='12s'");q.execute('SELECT data::text FROM gg_system.payloads WHERE slug=%s AND version=%s',(slug,version));row=q.fetchone()
    if not row:self.send_error(404);return
    body=row[0].encode()
   else:self.send_error(404);return
   self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','private, no-cache');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
  except BrokenPipeError:pass
  except Exception as e:
   print(type(e).__name__,str(e),file=sys.stderr);self.send_error(503,'Data temporarily unavailable')
  finally:
   if c:c.close()

if __name__=='__main__':
 if len(sys.argv)>1 and sys.argv[1]=='import':ingest()
 elif len(sys.argv)>1 and sys.argv[1]=='inventory':refresh_inventory()
 else:ThreadingHTTPServer(('127.0.0.1',18765),API).serve_forever()
