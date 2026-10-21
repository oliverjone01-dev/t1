from pathlib import Path
import subprocess,sys,json,datetime as dt
rev='ab7094cf6dc450b6c6b98919fe15a40294569e37';root=Path('/private/tmp/ozon-delivery-audit/source-ab7094cf')
for file in ['tools/delivery/fetch_delivery_sheet.py','tools/delivery/build_delivery_sku_daily.py','tools/delivery/ledger_money.py','tools/tests/delivery_sheet_test.py']:
 p=root/'analytics-mvp'/file;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(subprocess.check_output(['git','show',rev+':analytics-mvp/'+file]))
sys.path.insert(0,str(root/'analytics-mvp/tools/tests'));import delivery_sheet_test as f
s=f.sheet;out=[]
def rec(name,**kw):out.append({'case':name,**kw});print(json.dumps(out[-1],ensure_ascii=False))
initial,status=s.prepare(f.baseline(),None,f.csv_text(f.row()),f.csv_text(f.row(date='4 \u043e\u043a\u0442\u044f\u0431\u0440\u044f')),f.NOW,f.LOCATIONS);state=json.loads(initial['delivery_sheet_state.json']);future=f.csv_text(f.row(date='27 \u043e\u043a\u0442\u044f\u0431\u0440\u044f'))
full_missing,full_status=s.prepare(initial,state,future,f.csv_text(),f.NOW+dt.timedelta(hours=1),f.LOCATIONS);st=json.loads(full_missing['delivery_sheet_state.json']);daily,next_status=s.prepare(full_missing,st,future,None,f.NOW+dt.timedelta(hours=2),f.LOCATIONS)
rec('retained-warning-clears-without-recovery',first_retained=full_status['retained_unseen_events'],next_retained=next_status['retained_unseen_events'],archive_needed_next=s.archive_needed(st,f.NOW+dt.timedelta(hours=2)),expense=[full_status['ship'],next_status['ship']],next_incomplete_flags={k:next_status[k] for k in ['missing_cost','undated_rows','retained_unseen_events','city_unknown','missing_customer_paid']})
zero,zstatus=s.prepare(initial,state,f.csv_text(f.row(ship='0')),None,f.NOW+dt.timedelta(hours=1),f.LOCATIONS)
rec('priced-row-becomes-explicit-zero',retained=zstatus['retained_unseen_events'],ship=zstatus['ship'],zero_rows=zstatus['counts'].get('zero_cost_rows'),incomplete_flags={k:zstatus[k] for k in ['missing_cost','undated_rows','retained_unseen_events','city_unknown','missing_customer_paid']})
# Independent comparison of a corrected shipment date: prior row retained as a trip, new key added.
changed,cstatus=s.prepare(initial,state,f.csv_text(f.row(date='8 \u043e\u043a\u0442\u044f\u0431\u0440\u044f')),f.csv_text(),f.NOW+dt.timedelta(hours=1),f.LOCATIONS)
rec('shipment-date-change-ambiguous',before_ship=status['ship'],after_ship=cstatus['ship'],events=cstatus['events'],retained=cstatus['retained_unseen_events'])
Path('/private/tmp/ozon-delivery-audit/focused-probes.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
Path('/private/tmp/ozon-delivery-audit/zero-status.json').write_text(json.dumps(zstatus,ensure_ascii=False)+'\n')
for name,text in zero.items():(Path('/private/tmp/ozon-delivery-audit/zero-bundle')/name).parent.mkdir(parents=True,exist_ok=True);(Path('/private/tmp/ozon-delivery-audit/zero-bundle')/name).write_text(text)
