from pathlib import Path
import subprocess,sys,json,datetime as dt
rev='2babf54530c3c0f7292fdbaf9b819eb928ad71aa';root=Path('/private/tmp/ozon-delivery-audit/source-2babf545')
for file in ['tools/delivery/fetch_delivery_sheet.py','tools/delivery/build_delivery_sku_daily.py','tools/delivery/ledger_money.py','tools/tests/delivery_sheet_test.py']:
 p=root/'analytics-mvp'/file;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(subprocess.check_output(['git','show',rev+':analytics-mvp/'+file]))
sys.path.insert(0,str(root/'analytics-mvp/tools/tests'));import delivery_sheet_test as f
s=f.sheet;results=[]
def rec(name,**data):results.append({'case':name,**data});print(json.dumps(results[-1],ensure_ascii=False))
base=f.baseline();source=f.csv_text(f.row(ship='1000'),f.row(ship='0'))
initial,status=s.prepare(base,None,source,f.csv_text(f.row(date='4 \u043e\u043a\u0442\u044f\u0431\u0440\u044f')),f.NOW,f.LOCATIONS);state=json.loads(initial['delivery_sheet_state.json'])
try:
 replay,rstatus=s.prepare(initial,state,source,None,f.NOW+dt.timedelta(hours=1),f.LOCATIONS);rec('identical-zero-placeholder-replay',first='success',second='success')
except ValueError as ex:rec('identical-zero-placeholder-replay',first='success',second='error',error=str(ex))
initial,status=s.prepare(base,None,f.csv_text(f.row(ship='1000')),f.csv_text(f.row(date='4 \u043e\u043a\u0442\u044f\u0431\u0440\u044f')),f.NOW,f.LOCATIONS);state=json.loads(initial['delivery_sheet_state.json'])
updated,ustatus=s.prepare(initial,state,f.csv_text(f.row(ship='1000'),f.row(ship='2000',paid='')),None,f.NOW+dt.timedelta(hours=1),f.LOCATIONS)
old_primary=[json.loads(x) for x in initial[s.FILES[0]].splitlines()][-1];new_primary=[json.loads(x) for x in updated[s.FILES[0]].splitlines()][-1];extra=[json.loads(x) for x in updated[s.FILES[3]].splitlines()][-1]
rec('new-higher-trip-replaces-primary',before_primary=old_primary,after_primary=new_primary,new_extra=extra,total=ustatus['ship'])
# Prior missing-row and positive->zero findings now blocked/sticky.
future=f.csv_text(f.row(date='27 \u043e\u043a\u0442\u044f\u0431\u0440\u044f'));lost,lstatus=s.prepare(initial,state,future,f.csv_text(),f.NOW+dt.timedelta(hours=1),f.LOCATIONS);lst=json.loads(lost['delivery_sheet_state.json']);again,astatus=s.prepare(lost,lst,future,None,f.NOW+dt.timedelta(hours=2),f.LOCATIONS)
rec('sticky-warning-fixed',full=lstatus['retained_unseen_events'],partial=astatus['retained_unseen_events'],archive=s.archive_needed(lst,f.NOW+dt.timedelta(hours=2)))
try:s.prepare(initial,state,f.csv_text(f.row(ship='0')),None,f.NOW+dt.timedelta(hours=1),f.LOCATIONS);rec('positive-zero-fixed',blocked=False)
except ValueError as ex:rec('positive-zero-fixed',blocked=True,error=str(ex))
Path('/private/tmp/ozon-delivery-audit/iter2-counterexamples.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
