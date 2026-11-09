import copy
import datetime as dt
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from cpo_capture import prepare, money
from accept_capture import accept

class CpoTest(unittest.TestCase):
    def test_money_strict(self):
        self.assertEqual(money('135863,10'),13586310)
        for bad in [None,'',float('nan'),'bad',-.01,.001]:
            with self.assertRaises(ValueError):money(bad)
    def test_freshness_and_history(self):
        now=dt.datetime(2026,11,9,12,tzinfo=dt.timezone.utc)
        c={'from':'2026-11-01','to':'2026-11-08','captured_at':now.isoformat(),'settings':{'captured_at':now.isoformat()}}
        base={'version':1,'company':'GENGLASS','snapshots':[]}
        result,_=accept(base,dict(base,cpo=c),now);self.assertEqual(result['cpo'],c)
        old=copy.deepcopy(result);new=copy.deepcopy(result);new['cpo']['to']='2026-11-07'
        with self.assertRaisesRegex(ValueError,'roll back'):accept(old,new,now)
        new=copy.deepcopy(base);new['cpo']=copy.deepcopy(c);new['cpo']['settings']['captured_at']='2026-11-08T12:00:00+00:00'
        with self.assertRaisesRegex(ValueError,'fresh'):accept(base,new,now)
    def test_funnel_cannot_silently_leave_cpo_stale(self):
        now=dt.datetime(2026,11,9,12,tzinfo=dt.timezone.utc)
        c={'from':'2026-11-01','to':'2026-11-08','captured_at':now.isoformat(),'settings':{'captured_at':now.isoformat()}}
        old={'version':1,'company':'GENGLASS','snapshots':[],'cpo':c}
        fresh={'day':'2026-11-09','phase':'once','captured_at':now.isoformat(),'day_in_progress':True,'items':[]}
        for incoming in [dict(old,snapshots=[fresh]),{'version':1,'company':'GENGLASS','snapshots':[fresh]}]:
            with self.assertRaisesRegex(ValueError,'fresh CPO'):accept(old,incoming,now)
    def test_raw_dimension_pair_check_and_private_join(self):
        import openpyxl
        with tempfile.TemporaryDirectory() as tmp:
            t=Path(tmp);archive=t/'archive';archive.mkdir();data=t/'data';data.mkdir()
            (data/'cpo_orders.ndjson').write_text('')
            (data/'orders_daily.ndjson').write_text(json.dumps({'order':'001-001-1','d':'2026-10-31','status':'delivered','revenue':200,'units':1})+'\n')
            def workbook(p,rows):
                w=openpyxl.Workbook();s=w.active;s.title='Statistics'
                for r in rows:s.append(r)
                w.save(p)
            hdr=['Дата','ID заказа','Номер заказа','SKU','SKU продвигаемого товара','Артикул','Название товара','Количество','Стоимость продажи, ₽','Стоимость, ₽','Ставка, %','Ставка, ₽','Расход, ₽']
            order=[['Период: 01.11.2026 - 02.11.2026'],['Оплата за заказ'],hdr,['02.11.2026',1,'001-001',12,12,'A','Thing',1,200,200,6,12,12]]
            daily=[order[0],order[1],['Дата','Продвижение','Расход, ₽'],['01.11.2026','Включено',0],['02.11.2026','Включено',12]]
            workbook(archive/'a.orders.xlsx',order);workbook(archive/'a.daily.xlsx',daily)
            c=prepare(archive,data,'2026-11-03T08:00:00+03:00',{})
            self.assertEqual(c['order_days'],[{'d':'2026-10-31','sp':12,'rev':200,'units':1}]);self.assertNotIn('001-001',json.dumps(c));self.assertEqual(len(c['report_days']),2)
            daily[-1][-1]=13;workbook(archive/'a.daily.xlsx',daily)
            with self.assertRaisesRegex(ValueError,'disagreement'):prepare(archive,data,'2026-11-03T08:00:00+03:00',{})

if __name__=='__main__':unittest.main()
