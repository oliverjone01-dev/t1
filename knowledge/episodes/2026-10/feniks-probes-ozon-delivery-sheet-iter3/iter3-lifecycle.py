from pathlib import Path
import sys,json,datetime as dt
sys.path.insert(0,"/private/tmp/ozon-delivery-audit/source-78714fd4/analytics-mvp/tools/tests")
import delivery_sheet_test as f
s=f.sheet
results=[]
def prep(data,state,active,archive=None,h=1): return s.prepare(data,state,active,archive,f.NOW+dt.timedelta(hours=h),f.LOCATIONS)
def st(out):return json.loads(out["delivery_sheet_state.json"])
def last(out,file):return json.loads(out[file].splitlines()[-1])
initial,ist=prep(f.baseline(),None,f.csv_text(f.row(ship="1000")),f.csv_text(f.row(date="4 \u043e\u043a\u0442\u044f\u0431\u0440\u044f")),0)
primary=last(initial,s.FILES[0])
# New earlier recovered trip must remain extra over repeated active/archive moves.
source=f.csv_text(f.row(ship="1000"),f.row(date="6 \u043e\u043a\u0442\u044f\u0431\u0440\u044f",ship="2000",paid=""))
added,status=prep(initial,st(initial),source)
assert last(added,s.FILES[0])==primary
assert last(added,s.FILES[3])["ship"]==2000 and last(added,s.FILES[3])["d_trip"]=="2026-10-06"
assert status["ship"]==3000
replay,_=prep(added,st(added),source,h=2)
for file in s.FILES:assert added[file]==replay[file]
archived,ast=prep(replay,st(replay),f.csv_text(f.row(date="27 \u043e\u043a\u0442\u044f\u0431\u0440\u044f")),source,h=3)
for file in s.FILES:assert added[file]==archived[file]
assert ast["retained_unseen_events"]==0
results.append({"case":"earlier-trip-and-archive-lifecycle","primary_unchanged":True,"five_outputs_identical_after_replay_and_archive":True,"sum":ast["ship"]})
# Lost key survives full then partial reads and resolves when actual source returns.
lost,lst=prep(archived,st(archived),f.csv_text(f.row(date="27 \u043e\u043a\u0442\u044f\u0431\u0440\u044f")),f.csv_text(),4)
assert lst["retained_unseen_events"]==2 and s.archive_needed(st(lost),f.NOW+dt.timedelta(hours=5))
kept,kst=prep(lost,st(lost),f.csv_text(f.row(date="27 \u043e\u043a\u0442\u044f\u0431\u0440\u044f")),h=5)
assert kst["retained_unseen_events"]==2
recovered,rst=prep(kept,st(kept),f.csv_text(),source,6)
assert rst["retained_unseen_events"]==0
for file in s.FILES:assert added[file]==recovered[file]
results.append({"case":"sticky-two-events-and-full-recovery","missing_full":lst["retained_unseen_events"],"missing_partial":kst["retained_unseen_events"],"resolved":rst["retained_unseen_events"],"five_outputs_unchanged":True})
# Damaged primary pointer fails before any output can be accepted.
bad=st(initial);bad["primary_keys"][primary["order"]]=[primary["order"],"2026-10-05",1]
try:prep(initial,bad,f.csv_text(f.row(ship="1000")))
except ValueError as ex:results.append({"case":"missing-primary-pointer","blocked":True,"error":str(ex)})
else:raise AssertionError("bad primary accepted")
Path("/private/tmp/ozon-delivery-audit/iter3-lifecycle.json").write_text(json.dumps(results,indent=2)+"\n")
print(json.dumps(results,indent=2))
