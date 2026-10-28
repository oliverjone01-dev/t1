import csv
import datetime as dt
import io
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'delivery'))
import collect_delivery_timeline as t
NOW=dt.datetime(2026,10,28,9,tzinfo=dt.timezone.utc)
def row(**kw):
    r=['OZON GENGLASS','12345678-0001-1','М26-1234','GGT-TEST','16 октября','21 октября','28 октября','Создан']
    for k,v in kw.items():r[int(k)]=v
    return r+['PRIVATE CONTACT MUST NEVER BE SAVED']*30
def sheet(*rows):
    f=io.StringIO();w=csv.writer(f);w.writerow([t.HEADERS[i] for i in range(8)]);w.writerows(rows or [['']*8]);return f.getvalue()
def collect(rows,old=None,now=NOW,archive=None):return t.prepare(sheet(*rows),archive or sheet(),old,now)
class TimelineTests(unittest.TestCase):
    def test_baseline_has_no_invented_changes_and_no_private_fields(self):
        s=collect([row()]);self.assertEqual(s['history'],[]);self.assertEqual(s['rows'][0]['actual'],'2026-10-28');self.assertNotIn('PRIVATE',str(s));self.assertNotIn('ship_cents',str(s))
    def test_unknown_cost_and_future_shipments_still_in_queue(self):
        s=collect([row(**{'4':'30 октября','6':''})]);self.assertEqual(len(s['rows']),1);self.assertIsNone(s['rows'][0]['actual'])
    def test_repeat_is_idempotent_for_history(self):
        s=collect([row()]);s2=collect([row()],s,NOW+dt.timedelta(hours=1));self.assertEqual(s2['history'],[]);self.assertEqual(s2['rows'][0]['first_seen'],s['loaded_at'])
    def test_plan_status_and_actual_changes_are_saved_once(self):
        s=collect([row(**{'6':''})]);r=row(**{'5':'29 октября','7':'Доставлен'});s2=collect([r],s,NOW+dt.timedelta(days=1));h=s2['history'][0];self.assertEqual(h['changes']['planned'],['2026-10-21','2026-10-29']);self.assertEqual(h['changes']['actual'],[None,'2026-10-28']);self.assertEqual(h['changes']['status'],['Создан','Доставлен']);self.assertEqual(len(collect([r],s2,NOW+dt.timedelta(days=1,hours=2))['history']),1)
    def test_same_order_two_trips_are_not_collapsed(self):
        s=collect([row(),row(**{'2':'М26-1235'})]);self.assertEqual(len(s['rows']),2)
    def test_duplicate_archive_move_not_a_change(self):
        s=collect([row()],archive=sheet(row()));self.assertEqual(len(s['rows']),1);m=collect([],s,NOW+dt.timedelta(days=1),sheet(row()));self.assertEqual(m['history'],[]);self.assertFalse(m['rows'][0]['missing'])
    def test_missing_not_cancelled_and_reappearance_keeps_history(self):
        s=collect([row(),row(**{'1':'12345678-0002-1','2':'М26-9'})]);s2=collect([row(**{'1':'12345678-0002-1','2':'М26-9'})],s,NOW+dt.timedelta(days=1));r=next(r for r in s2['rows'] if r['trip']=='М26-1234');self.assertTrue(r['missing']);self.assertEqual(r['status'],'Создан');self.assertEqual(s2['history'],[])
    def test_conflicting_sources_flag_change_unconfirmed(self):
        s=collect([row()]);s2=collect([row(**{'5':'25 октября'})],s,NOW+dt.timedelta(days=1),sheet(row()));self.assertIn('source_conflict',s2['rows'][0]['issues']);self.assertTrue(s2['history'][0]['conflict'])
    def test_same_tab_conflict_fails(self):
        with self.assertRaises(ValueError):collect([row(),row(**{'5':'25 октября'})])
    def test_bad_identity_and_truncated_empty_source_fail(self):
        for r in [row(**{'1':'phone unknown'}),row(**{'2':'not a trip'})]:
            with self.assertRaises(ValueError):collect([r])
        with self.assertRaises(ValueError):t.prepare('bad','bad',None,NOW)
        with self.assertRaises(ValueError):collect([])
    def test_unknown_status_and_bad_dates_safe(self):
        s=collect([row(**{'7':'SECRET NAME','5':'ошибка'})]);r=s['rows'][0];self.assertIsNone(r['planned']);self.assertEqual(r['status'],'Неизвестный статус');self.assertNotIn('SECRET',str(s))
    def test_moscow_day_and_no_future_fact_clamping(self):
        s=collect([row(**{'6':'6 ноября'})],now=dt.datetime(2026,10,28,21,30,tzinfo=dt.timezone.utc));self.assertEqual(s['source_date'],'2026-10-29');self.assertEqual(s['rows'][0]['actual'],'2026-11-06')
    def test_scope_and_out_of_order(self):
        s=collect([row(),row(**{'1':'12345678-0002-1','4':'4 октября'})]);self.assertEqual(len(s['rows']),1)
        with self.assertRaises(ValueError):collect([row()],s,NOW-dt.timedelta(days=1))
    def test_unnumbered_different_articles_are_ambiguous_within_and_across_tabs(self):
        a=row(**{'2':'','3':'GGT-ONE'});b=row(**{'2':'','3':'GGT-TWO'})
        with self.assertRaises(ValueError):collect([a,b])
        with self.assertRaises(ValueError):collect([a],archive=sheet(b))
        self.assertEqual(len(collect([a,a],archive=sheet(a))['rows']),1)
    def test_real_ledger_variants_and_missing_number(self):
        for code,expected in [('НС26-477','НС26-477'),('2 ШТ С26-1458','С26-1458'),('М26-5101\nМ26-5102','М26-5101+М26-5102'),('','БЕЗ-НОМЕРА')]:
            r=collect([row(**{'2':code})])['rows'][0];self.assertEqual(r['trip'],expected)
    def test_yearless_missing_ledger_requires_review_after_year_boundary(self):
        with self.assertRaises(ValueError):collect([row(**{'2':''})],now=dt.datetime(2027,1,1,tzinfo=dt.timezone.utc))
        r=collect([row(**{'2':'С27-1','4':'5 января','5':'6 января','6':''})],now=dt.datetime(2027,1,5,tzinfo=dt.timezone.utc))['rows'][0];self.assertEqual(r['planned'],'2027-01-06')
if __name__=='__main__':unittest.main()
