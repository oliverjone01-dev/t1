import csv
import io
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'problems'))
import import_fbs_tariff as fbs
import install_cabinet_hook as hook


def source(**changes):
    r={c:'' for c in fbs.COLUMNS}
    r.update(posting='12345678-0001-1',status='delivered',art='GGT-A',qty='1',price='47900',created='2026-10-18T21:30:00Z',fact_transferred='2026-10-21T06:47:37.8864Z',fact_type='commission',fact_rate='0.02')
    r.update(changes)
    out=io.StringIO();w=csv.DictWriter(out,fieldnames=fbs.COLUMNS,delimiter='|');w.writeheader();w.writerow(r)
    return out.getvalue()


class FbsTariffTests(unittest.TestCase):
    def test_fact_fraction_current_percentage_and_total_not_unit_price(self):
        r=fbs.parse(source(qty='2',price='141800',fact_type='discount',fact_rate='0.03',cur_type='discount',cur_rate='2'),'2026-10-28')[0]
        self.assertEqual((r['amount_cents'],r['rate_bps'],r['current_rate_bps'],r['effect_cents']),(14180000,300,200,-425400))

    def test_unknown_actual_not_imputed_from_current_or_handover(self):
        r=fbs.parse(source(fact_type='',fact_rate='',cur_type='discount',cur_rate='3'),'2026-10-28')[0]
        self.assertIsNone(r['rate_bps']);self.assertIsNone(r['effect_cents'])
        self.assertEqual(r['current_rate_bps'],300)

    def test_explicit_standard_rate_is_zero(self):
        r=fbs.parse(source(fact_type='no_discount',fact_rate=''),'2026-10-28')[0]
        self.assertEqual(r['effect_cents'],0)

    def test_fraction_is_not_confused_with_points(self):
        with self.assertRaisesRegex(ValueError,'rate'): fbs.parse(source(fact_rate='2'),'2026-10-28')

    def test_invalid_amount_and_types_fail(self):
        for kw in ({'price':'NaN'},{'price':'-1'},{'qty':'1.5'},{'fact_type':'other'},{'fact_type':'','fact_rate':'0.02'},{'created':''},{'cur_type':'','cur_rate':'3'},{'fact_type':'no_discount','fact_rate':'0.02'}):
            with self.subTest(kw=kw),self.assertRaises(ValueError):fbs.parse(source(**kw),'2026-10-28')

    def test_truncated_extra_duplicate_and_empty_data_fail(self):
        text=source()
        for bad in (text.splitlines()[0]+'\n',text+text.splitlines()[1]+'\n',text.replace('47900','47900|extra'),text.replace('|2026-10-21T06:47:37.8864Z','')):
            with self.subTest(),self.assertRaises(ValueError):fbs.parse(bad,'2026-10-28')

    def test_partial_steps_fail(self):
        with self.assertRaisesRegex(ValueError,'deadlines'):fbs.parse(source(step1_deadline='2026-10-21T06:00:00Z'),'2026-10-28')

    def test_idempotence_and_old_orders_survive_window_roll(self):
        a=fbs.merge({},fbs.parse(source(),'2026-10-28'),'2026-10-28','abc')
        self.assertEqual(fbs.merge(a,[], '2026-10-28','abc'),a)
        b=fbs.merge(a,fbs.parse(source(posting='99999999-0001-1'),'2026-10-29'),'2026-10-29','def')
        self.assertEqual(len(b['rows']),2)
        with self.assertRaisesRegex(ValueError,'older'):fbs.merge(b,[],'2026-10-27','old')

    def test_missing_fact_preserves_dated_evidence_and_original_basis(self):
        a=fbs.merge({},fbs.parse(source(),'2026-10-28'),'2026-10-28','a')
        b=fbs.merge(a,fbs.parse(source(price='60000',fact_type='',fact_rate=''),'2026-10-29'),'2026-10-29','b')
        r=b['rows'][0]
        self.assertEqual((r['fact_observed'],r['observed'],r['fact_amount_cents'],r['effect_cents']),('2026-10-28','2026-10-29',4790000,95800))
        c=fbs.merge(b,fbs.parse(source(price='60000',fact_type='discount',fact_rate='.02'),'2026-10-30'),'2026-10-30','c')
        self.assertEqual((c['rows'][0]['effect_cents'],c['rows'][0]['fact_observed']),(-120000,'2026-10-30'))

    def test_local_hook_is_narrow_idempotent_and_requires_anchors(self):
        text='cd "$A"\n[ -f data/cabinet_orders_check.ndjson ] && FILES="$FILES data/cabinet_orders_check.ndjson"\n'
        changed=hook.patch(text)
        self.assertEqual(hook.patch(changed),changed)
        self.assertIn('|| fail "FBS tariff import"',changed)
        with self.assertRaises(ValueError):hook.patch('other layout')


if __name__=='__main__':unittest.main()
