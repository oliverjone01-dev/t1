import copy
import datetime as dt
from pathlib import Path
import unittest
from unittest.mock import patch
from catalog_capture import catalog_capture, merge_catalogs
from accept_capture import accept

NOW=dt.datetime(2026,11,9,12,tzinfo=dt.timezone.utc)

class Catalog(unittest.TestCase):
    def row(self, stamp='2026-11-09T11:00:00+00:00', day='2026-11-09'):
        return {'day':day,'phase':'утро','captured_at':stamp,'items':[{'sku':'1'}]}

    def test_backfill_requires_explicit_window_and_preserves_other_days(self):
        old=self.row('2026-11-04T06:00:00+03:00','2026-11-04')
        with self.assertRaises(ValueError):merge_catalogs([], [old], NOW)
        self.assertEqual(len(merge_catalogs([self.row()], [old], NOW,'2026-11-01')),2)
        with self.assertRaises(ValueError):merge_catalogs([], [old], NOW,'2026-11-05')

    def test_no_rollback_or_conflicting_equal_stamp(self):
        old=self.row(); new=copy.deepcopy(old);new['items'][0]['sku']='2'
        with self.assertRaises(ValueError):merge_catalogs([old],[new],NOW)
        self.assertEqual(merge_catalogs([old],[old],NOW),[old])

    def test_moscow_midnight_and_future(self):
        row=self.row('2026-11-08T20:30:00Z','2026-11-08')
        self.assertEqual(merge_catalogs([],[row],NOW,'2026-11-01')[0]['day'],'2026-11-08')
        row['day']='2026-11-09'
        with self.assertRaises(ValueError):merge_catalogs([],[row],NOW,'2026-11-01')
        with self.assertRaises(ValueError):merge_catalogs([],[self.row('2026-11-09T13:00:00Z')],NOW)

    def test_competitor_source_cannot_roll_back_on_new_download(self):
        old={'snapshots':[], 'competitors':{'captured_at':'2026-11-09T10:00:00Z','source_updated_at':'2026-11-08T20:00:00Z'}}
        incoming={'snapshots':[], 'competitors':{'captured_at':'2026-11-09T11:00:00Z','source_updated_at':'2026-10-27T20:00:00Z'}}
        with self.assertRaisesRegex(ValueError,'source period'):accept(old,incoming,NOW)
        incoming['competitors']['source_updated_at']=old['competitors']['source_updated_at']
        self.assertEqual(accept(old,incoming,NOW)[0]['competitors'],incoming['competitors'])

    def test_active_pipeline_rejects_funnel_only_update(self):
        old={'snapshots':[], 'catalogs':[self.row()]}
        incoming={'snapshots':[{'day':'2026-11-09','phase':'утро','captured_at':'2026-11-09T11:00:00Z','day_in_progress':True}]}
        with patch('accept_capture.merge_capture',return_value=old):
            with self.assertRaisesRegex(ValueError,'requires catalog'):accept(old,incoming,NOW)
        self.assertEqual(accept(old,{'snapshots':[]},NOW)[0],old)

    def test_shifted_headers_and_missing_not_zero(self):
        # Deliberately move price columns; business fields are looked up by label.
        records=[{'sku':'5426756030','offer_id':'KONUX','source_values':{'X':'115803','Z':'46670','AA':None,'AB':'0'}}]
        schema={'X':{'label':'Предельная цена, руб.'},'Z':{'label':'Цена реализации, руб.'},'AA':{'label':'На складе Ozon'},'AB':{'label':'На моих складах'}}
        with patch('catalog_capture.read_xlsx'),patch('catalog_capture.price_records',return_value=(records,schema,{})),patch.object(Path,'read_bytes',return_value=b'fixture'):
            r=catalog_capture(Path('x.xlsx'),'2026-11-04T20:00:00+03:00','вечер',1)['items'][0]
        self.assertEqual(r['buyer'],46670);self.assertAlmostEqual(r['gap_pct'],59.6987988221)
        self.assertIsNone(r['stock_ozon']);self.assertEqual(r['stock_seller'],0)
        self.assertNotIn('cost_input',r)

if __name__=='__main__':unittest.main()
