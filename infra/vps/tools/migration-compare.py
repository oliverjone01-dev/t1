#!/usr/bin/env python3
"""Read-only data checks; only permitted side effect is one alerts message per run/day."""
import argparse, collections, concurrent.futures, fcntl, hashlib, json, os, re, subprocess, urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path('/srv/gg'); OUT=ROOT/'state/migration-compare'; OUT.mkdir(exist_ok=True)
SOURCES=[('РОП ГГ','rop-dashboard-v1','rop/data/rop.json',['rop']),('Офис','office-dashboard-v1','rop/data/rop.json',['office']),('РОП ГМ','rop-gm-dashboard-v1','rop/data/rop-gm.json',['rop-gm']),('Экономика','economics-dashboard-v1','economics/data/economics.json',['economics']),('Контроль экономики','economics-dashboard-v1','economics/data/econ-recon.json',['econ-control']),('Производство','prod-dashboard-v1','prod/data/prod.json',['prod']),('ПТО','pto-dashboard-v1','pto/data/pto.json',['pto']),('Коммуникации','dialog-export-v1','dialog/data/dialog.json',['dialog'])]
KP={'C49:PREPAYMENT_INVOIC','C49:3','C49:UC_8JTBV2'}
PLAN={'Юлия Лысанова','Татьяна Лакомова','Юлия Шура-Бура','Алина Платонова','Екатерина Зазноба','Надежда Лобова','Татьяна Фомичева','Алёна Филатова'}
def command(args,**kw):
 if args[0]=='git' and os.getuid()==0:args=['runuser','-u','gg','--']+args
 return subprocess.check_output(args,timeout=90,stderr=subprocess.DEVNULL,**kw)
def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
def metrics(j):
 result={}; managers={}
 for key in ('deals','leads','items','prodItems','events'):
  rows=j.get(key)
  if not isinstance(rows,list):continue
  result[key]={'count':len(rows),'budget':round(sum(float(x.get('budget') or 0) for x in rows if isinstance(x,dict)),2)}
  for row in rows:
   if not isinstance(row,dict):continue
   name=str(row.get('mgr') or row.get('dealMgr') or '');mid=str(row.get('mgrId') or digest(name)[:16])
   m=managers.setdefault(mid,{'deals':0,'leads':0,'events':0,'portfolio':0,'portfolioBudget':0,'monthPrepayments':0,'monthPrepaymentBudget':0})
   if key in ('deals','leads','events'):m[key]+=1
   if key=='deals' and str(row.get('category'))=='49' and name in PLAN:
    if row.get('stageCode') in KP:m['portfolio']+=1;m['portfolioBudget']+=float(row.get('budget') or 0)
    ep=next((h[1] for h in row.get('hist',[]) if h[0]=='C49:EXECUTING' and h[1]),None)
    if not ep and row.get('won'):ep=row.get('closed')
    if ep and str(ep)[:7]==str(j.get('generated_at',''))[:7]:m['monthPrepayments']+=1;m['monthPrepaymentBudget']+=float(row.get('budget') or 0)
 result['managers']=managers
 result['department']={key:sum(m[key] for m in managers.values()) for key in ('portfolio','portfolioBudget','monthPrepayments','monthPrepaymentBudget')}
 scoring=j.get('scoring')
 if isinstance(scoring,dict):
  rows=scoring.get('deals',[]);result['communications']={'scoredDeals':len(rows),'overdueDeals':sum((x.get('overdueD') or 0)>0 for x in rows),'scoringHash':digest(scoring)}
 for key in ('dealCount','leadCount','counts','channelMix'):
  if key in j:result[key]=j[key]
 return result
def stamp(j):return j.get('generated_at') or j.get('generatedAt')
def compare(item):
 label,branch,relative,pages=item;file='analytics-mvp/'+relative;record={'section':label,'branch':branch,'pages':{page:(ROOT/'www/current'/page/'index.html').is_file() for page in pages}}
 try:
  raw=(ROOT/'data'/branch/file).read_bytes();server=json.loads(raw)
  command(['git','--git-dir='+str(ROOT/'git/t1.git'),'fetch','--quiet','origin',branch+':refs/migration-compare/'+branch])
  ref='refs/migration-compare/'+branch;ghraw=command(['git','--git-dir='+str(ROOT/'git/t1.git'),'show',ref+':'+file]);github=json.loads(ghraw)
  record.update(serverAt=stamp(server),githubAt=stamp(github),serverHash=hashlib.sha256(raw).hexdigest(),githubHash=hashlib.sha256(ghraw).hexdigest(),githubCommit=command(['git','--git-dir='+str(ROOT/'git/t1.git'),'rev-parse',ref]).decode().strip(),serverMetrics=metrics(server),githubMetrics=metrics(github))
  same_time=bool(stamp(server)) and stamp(server)==stamp(github)
  record['metricsEqual']=record['serverMetrics']==record['githubMetrics']
  record['sameSnapshotTime']=same_time
  record['classification']='equal' if same_time and record['metricsEqual'] else 'mismatch' if same_time else 'different_snapshot_times'
  record['differences']={}
  for key in ('deals','leads','items','prodItems','events'):
   a=server.get(key);b=github.get(key)
   if not isinstance(a,list) or not isinstance(b,list):continue
   def ident(x):return str(x.get('id')) if key!='events' else json.dumps([x.get('ts'),x.get('type'),x.get('dealId'),x.get('leadId'),x.get('src')],ensure_ascii=False)
   am={ident(x):digest(x) for x in a};bm={ident(x):digest(x) for x in b}
   record['differences'][key]={'onlyVps':len(am.keys()-bm.keys()),'onlyGithub':len(bm.keys()-am.keys()),'changedSharedRecords':sum(am[k]!=bm[k] for k in am.keys()&bm.keys())}
  # Financial/manager equality is not enough if same-time source records differ.
  if same_time and any(any(v.values()) for v in record['differences'].values()):record['classification']='mismatch'
  for name,when in [('server',stamp(server)),('github',stamp(github))]:
   if when:
    record[name+'AgeHours']=round((datetime.now(timezone.utc)-datetime.fromisoformat(when.replace('Z','+00:00'))).total_seconds()/3600,2)
  if record.get('serverAgeHours',99)>27:record['staleVps']=True
 except Exception as e:record.update(classification='unavailable',reason=type(e).__name__)
 return record
def send(text):
 chat=os.getenv('GG_ALERT_CHAT_ID');token=os.getenv('GG_ALERT_BOT_TOKEN')
 if chat!='-5439260952' or not token:raise RuntimeError('Invalid alert destination')
 request=urllib.request.Request('https://api.telegram.org/bot'+token+'/sendMessage',data=json.dumps({'chat_id':chat,'text':text,'disable_web_page_preview':True}).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(request,timeout=35) as response:result=json.load(response)
 if not result.get('ok'):raise RuntimeError('Telegram rejected message')
 return result['result']['message_id']
def run():
 parser=argparse.ArgumentParser();parser.add_argument('--test',action='store_true');parser.add_argument('--send',action='store_true');args=parser.parse_args()
 now=datetime.now(ZoneInfo('Europe/Moscow'));day=now.date().isoformat();prefix=('test-'+now.strftime('%Y%m%dT%H%M%S')) if args.test else day
 reportfile=OUT/(prefix+'.json');claim=OUT/(prefix+'.delivery.json')
 with (OUT/'compare.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  if not args.test and not ('2026-10-07'<=day<='2026-10-10'):print('Outside agreed dates');return
  if not args.test and now.hour<22:print('Before 22:00 MSK; skip');return
  if claim.exists():print('Daily report already sent or pending; duplicate blocked');return
  with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:sections=list(pool.map(compare,SOURCES))
  jobs=[]
  for p in sorted((ROOT/'state/jobs').glob('*.json')):
   if p.stem=='daily-report':continue
   j=json.loads(p.read_text());jobs.append({'name':p.stem,'ok':j.get('ok'),'started':j.get('started'),'finished':j.get('finished')})
  roster=(ROOT/'www/current/.gg/managers.txt').read_text().splitlines();manager_pages=[r.split('\t')[0] for r in roster if r]
  missing=[p for p in manager_pages if not (ROOT/'www/current'/p/'index.html').is_file()]
  timers=command(['systemctl','list-timers','--all','--no-pager']).decode();digestTimers=all(name in timers for name in ('gg-job-rop-digest-plan.timer','gg-job-rop-digest-itogi.timer'))
  report={'date':day,'checkedAt':now.isoformat(),'test':args.test,'sections':sections,'jobs':jobs,'managerPages':len(manager_pages),'missingManagerPages':missing,'digestTimersPresent':digestTimers,'limitations':['Снимки разных часов сравниваются как разные состояния; причина каждого изменения отдельно не доказана.','Показатели сверены по источникам данных. Все интерактивные фильтры и расчёты виджетов браузером в этой проверке не пересчитываются.','Для Офиса проверяется его источник и наличие опубликованной панели; бизнес-метрики виджетов отдельно не подтверждены.']}
  reportfile.write_text(json.dumps(report,ensure_ascii=False,indent=2))
  tally=collections.Counter(s['classification'] for s in sections);lines=[('🧪 Контрольная проверка' if args.test else '📏 Ежедневная сверка')+' GitHub ↔ VPS · '+now.strftime('%d.%m %H:%M')+' МСК']
  for s in sections:
   cl=s['classification'];symbol={'equal':'✅','mismatch':'❌','unavailable':'⚠️','different_snapshot_times':'🕒'}[cl]
   desc={'equal':'совпало на одном времени снимка','mismatch':'расхождение на одном времени снимка','unavailable':'проверка недоступна','different_snapshot_times':'снимки разных часов; совпадение не подтверждено'}[cl]
   lines.append(symbol+' '+s['section']+': '+desc)
   if 'serverMetrics' in s:
    key=next((k for k in ('deals','items','events') if k in s['serverMetrics']),None)
    if key:lines.append('  записей VPS / GitHub: '+str(s['serverMetrics'][key]['count'])+' / '+str(s['githubMetrics'].get(key,{}).get('count','?')))
   if s.get('staleVps'):lines.append('  ⚠️ снимок VPS старше 27 часов')
  rop=sections[0]
  if 'serverMetrics' in rop:
   a=rop['serverMetrics']['department'];b=rop['githubMetrics']['department'];lines.extend(['РОП ГГ · VPS / GitHub:','• портфель с КП: '+str(a['portfolio'])+' / '+str(b['portfolio']),'• предоплаты месяца: '+str(a['monthPrepayments'])+' / '+str(b['monthPrepayments'])+'; сумма по правилу дайджеста: '+str(round(a['monthPrepaymentBudget']))+' / '+str(round(b['monthPrepaymentBudget']))+' ₽'])
  bad=[j['name'] for j in jobs if j['ok'] is not True]
  lines.append('Личные панели: '+str(len(manager_pages))+'; отсутствуют '+str(len(missing))+'. Последние задания: '+('ошибки '+', '.join(bad) if bad else 'успешны')+'.')
  lines.append('Фильтры и расчёты всех виджетов отдельно не перепроверены. Академия, Перегородки и эксперименты исключены.')
  if tally['mismatch'] or tally['unavailable'] or tally['different_snapshot_times'] or missing or bad:lines.append('Полное совпадение всех разделов пока НЕ подтверждено.')
  lines.append('За 06.10 подтверждённой сверки нет — день пропущен, задним числом успех не ставим.')
  if day=='2026-10-10' and not args.test:
   lines.append('Окно 06–10.10 завершено. Пять успешных ежедневных сверок не выполнены: 06.10 пропущено. Автопереключения нет; контроль остановлен.')
  if args.send:
   claim.write_text(json.dumps({'status':'pending','date':day}))
   try:mid=send('\n'.join(lines));claim.write_text(json.dumps({'status':'sent','message_id':mid,'date':day}));print('Delivered migration check, message_id='+str(mid))
   except Exception:claim.write_text(json.dumps({'status':'unknown','date':day}));raise
  else:print('\n'.join(lines))
  if day=='2026-10-10' and not args.test:subprocess.run(['systemctl','disable','--now','gg-migration-compare.timer'],check=True)
if __name__=='__main__':run()

