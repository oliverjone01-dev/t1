import copy
import datetime as dt
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from capture import make_capture, merge_capture, atomic_json, number
from prepare import prepare
from import_report import analytics_records

NOW=dt.datetime(2026,10,29,10,tzinfo=dt.timezone.utc)
STAMP='2026-10-29T09:18:00+00:00'

def record():
    return {'sku':'123','scheme':'','source_values':{'Q':'12','S':'7','W':'3','AA':'1','AC':'0','P':'0'}}

def checks():
    return {'source_company':'Продавец: GENGLASS','period_from':'2026-10-29','period_to':'2026-10-29',
            'internal_controls':{c:{'reported':v} for c,v in record()['source_values'].items()}}

class CaptureTests(unittest.TestCase):
    def test_every_used_column_header_is_checked_before_rows(self):
        labels={'G':'Схема работы','H':'SKU','I':'Артикул','J':'День',
                'P':'Позиция в поиске\nи каталоге','Q':'Показы всего',
                'S':'Показы в поиске и\nкаталоге','W':'Посещения карточки товара',
                'AA':'Добавления в\nкорзину всего','AC':'Заказано товаров'}
        rows=[{'row':10,'cells':{c:{'value':v} for c,v in labels.items() if c in 'GHIJ'}},
              {'row':11,'cells':{c:{'value':v} for c,v in labels.items() if c not in 'GHIJ'}}]
        for col in labels:
            changed=copy.deepcopy(rows)
            for row in changed:
                if col in row['cells']:row['cells'][col]['value']='different metric'
            with self.assertRaisesRegex(ValueError,'Unexpected analytics schema at '+col):
                analytics_records([{'sheet':'По товарам','rows':changed}])

    def build(self,rows=None,meta=None,stamp=STAMP):
        with patch('capture.read_xlsx',return_value=[]),patch('capture.analytics_records',return_value=(rows or [record()],{},meta or checks())):
            return make_capture('unused.xlsx',['123','456'],stamp,'once',NOW)

    def test_missing_is_not_zero(self):
        r=self.build();self.assertEqual(r['scope']['missing'],1);self.assertEqual(r['totals']['ordered_units'],0)
        self.assertEqual(len(r['items']),1);self.assertTrue(r['day_in_progress'])

    def test_wrong_company_fails_before_write(self):
        c=checks();c['source_company']='Продавец: other'
        with self.assertRaisesRegex(ValueError,'company'):self.build(meta=c)

    def test_old_or_future_capture_rejected(self):
        for stamp in ['2026-10-29T05:00:00+00:00','2026-10-29T11:00:00+00:00']:
            with self.assertRaises(ValueError):self.build(stamp=stamp)

    def test_nonfinite_and_negative_source_values_rejected(self):
        for v in ['NaN','Infinity','-1','1.5']:
            with self.assertRaises(ValueError):number(v,integer=True)

    def test_total_mismatch_cannot_touch_previous_result(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'result.json';p.write_text('previous good snapshot')
            c=checks();c['internal_controls']['Q']['reported']='13'
            with self.assertRaises(ValueError):atomic_json(p,self.build(meta=c))
            self.assertEqual(p.read_text(),'previous good snapshot')

    def test_shrinking_same_snapshot_is_rejected(self):
        fresh=self.build();old=copy.deepcopy(fresh);old['items'].append(dict(old['items'][0],sku='456'))
        with self.assertRaisesRegex(ValueError,'loses'):merge_capture({'version':1,'company':'GENGLASS','snapshots':[old]},fresh)

    def test_unknown_scheme_can_be_refined_without_reusing_old_metrics(self):
        previous=self.build()
        untouched=copy.deepcopy(previous);untouched['day']='2026-10-28'
        stored={'version':1,'company':'GENGLASS','snapshots':[untouched,previous]}
        original=copy.deepcopy(stored)
        for scheme in ['FBS','FBO','FBS, FBO','FBO, FBS']:
            with self.subTest(scheme=scheme):
                fresh=copy.deepcopy(previous);fresh['items'][0]['scheme']=scheme
                fresh['items'][0]['views']=20;fresh['totals']['views']=20
                fresh['captured_at']='2026-10-30T06:56:00+00:00';fresh['day_in_progress']=False
                result=merge_capture(stored,fresh)
                self.assertEqual(result['snapshots'],[untouched,fresh])
                self.assertEqual(stored,original)

    def test_known_scheme_changes_and_loss_of_known_scheme_still_fail(self):
        for old_scheme,new_scheme in [('FBS','FBO'),('FBS','FBS, FBO'),('FBS',None)]:
            with self.subTest(old_scheme=old_scheme,new_scheme=new_scheme):
                previous=self.build();previous['items'][0]['scheme']=old_scheme
                fresh=copy.deepcopy(previous);fresh['items'][0]['scheme']=new_scheme
                with self.assertRaisesRegex(ValueError,'loses'):
                    merge_capture({'version':1,'company':'GENGLASS','snapshots':[previous]},fresh)

    def test_unknown_scheme_cannot_split_into_multiple_scheme_rows(self):
        previous=self.build();fresh=copy.deepcopy(previous)
        fresh['items']=[dict(previous['items'][0],scheme=s) for s in ['FBO','FBS']]
        with self.assertRaisesRegex(ValueError,'loses'):
            merge_capture({'version':1,'company':'GENGLASS','snapshots':[previous]},fresh)

    def test_refinement_cannot_collapse_an_existing_multirow_sku(self):
        previous=self.build();previous['items'].append(dict(previous['items'][0],scheme='FBS'))
        fresh=self.build();fresh['items'][0]['scheme']='FBS'
        with self.assertRaisesRegex(ValueError,'loses'):
            merge_capture({'version':1,'company':'GENGLASS','snapshots':[previous]},fresh)

    def test_unknown_scheme_cannot_be_refined_to_invalid_labels(self):
        previous=self.build()
        for scheme in ['', ' ', 'unknown', 'FBS,', 'FBS, FBS', 'FBS, unknown']:
            with self.subTest(scheme=scheme):
                fresh=copy.deepcopy(previous);fresh['items'][0]['scheme']=scheme
                with self.assertRaisesRegex(ValueError,'loses'):
                    merge_capture({'version':1,'company':'GENGLASS','snapshots':[previous]},fresh)

    def test_refinement_does_not_allow_an_older_capture(self):
        previous=self.build();fresh=copy.deepcopy(previous)
        fresh['items'][0]['scheme']='FBS';fresh['captured_at']='2026-10-29T08:00:00+00:00'
        with self.assertRaisesRegex(ValueError,'Older capture'):
            merge_capture({'version':1,'company':'GENGLASS','snapshots':[previous]},fresh)

    def test_other_day_and_morning_observation_survive_evening(self):
        old=self.build();old['day']='2026-10-28';old['phase']='утро'
        fresh=self.build();fresh['phase']='вечер'
        result=merge_capture({'version':1,'company':'GENGLASS','snapshots':[old]},fresh)
        self.assertEqual(len(result['snapshots']),2);self.assertEqual(result['snapshots'][0],old)

    def test_repeat_is_idempotent(self):
        r=self.build();a=merge_capture(None,r);self.assertEqual(merge_capture(a,r),a)

    def test_truncated_catalog_cannot_create_or_change_package(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);a=root/'analytics';p=root/'prices';a.write_text('source');p.write_text('10 rows instead of 467')
            with patch('prepare.registry',side_effect=ValueError('Coverage mismatch: 10 != 467')):
                with self.assertRaisesRegex(ValueError,'Coverage mismatch'):
                    prepare(a,p,467,root,'2026-10-29',STAMP,'once',root/'run',now=NOW)
            self.assertFalse((root/'run/prepared').exists())

    def test_failed_capture_retains_existing_ready_directory(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);a=root/'analytics';p=root/'prices';a.write_text('source');p.write_text('catalog')
            ready=root/'run/prepared';ready.mkdir(parents=True);(ready/'READY.json').write_text('previous good package')
            with patch('prepare.registry',return_value=['123']),patch('prepare.make_capture',side_effect=ValueError('conflicting duplicate')):
                with self.assertRaises(ValueError):prepare(a,p,1,root,'2026-10-29',STAMP,'once',root/'run',now=NOW)
            self.assertEqual((ready/'READY.json').read_text(),'previous good package')

if __name__=='__main__':unittest.main()
