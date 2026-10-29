import {describe,it,expect} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateCaptureFile} from './cabinet-capture.js';
import {captureDays,captureIsOpen,nativeFunnel,mergeCabinetViews,mergeCabinetTotals,cabinetTestRows} from './cabinet-funnel.js';
import {readFunnelTests} from '../funnel-tests.js';

function fixture(){return validateCaptureFile({version:1,company:'GENGLASS',snapshots:[{
  version:1,company:'GENGLASS',day:'2026-10-28',captured_at:'2026-10-29T09:18:00Z',phase:'once',day_in_progress:false,
  scope:{expected:2,received:1,matched:1,missing:1,extra:0,status:'partial'},
  totals:{views:12,search_views:7,pdp_views:3,cart:1,ordered_units:0},
  items:[{sku:'123',scheme:null,search_position:0,views:12,search_views:7,pdp_views:3,cart:1,ordered_units:0}],
  source:'ozon-native-daily-product-report',not_refreshed:['card_price']}]});}
describe('shared cabinet funnel adapter',()=>{
  it('overrides measured SKU/day fields without changing money, other days or unobserved SKUs',()=>{
    const api=[{date:'2026-10-28',sku:'123',views:1,units:9,revenue:333,ret:2},
      {date:'2026-10-28',sku:'456',views:6},{date:'2026-10-27',sku:'123',views:4}];
    const saved=structuredClone(api), rows=mergeCabinetViews(api,fixture());
    expect(rows[0]).toMatchObject({views:12,units:0,revenue:333,ret:2});
    expect(rows.slice(1)).toEqual(api.slice(1));expect(api).toEqual(saved);
  });
  it('does not invent zeros for a missing measure',()=>{
    const f=fixture();f.snapshots[0]!.items[0]!.cart=null;f.snapshots[0]!.totals.cart=null;
    expect(mergeCabinetViews([{date:'2026-10-28',sku:'123',cart:9}],f)[0].cart).toBe(9);
  });
  it('keeps channel and SKU funnel counts equal without rewriting financial totals',()=>{
    const f=fixture();
    const views=mergeCabinetViews([{date:'2026-10-28',sku:'123',views:1,vsearch:1,pdp:1,cart:0,units:4}],f);
    const totals=mergeCabinetTotals([{date:'2026-10-28',views:1,revenue:333,returns:2}],views,f);
    expect(totals[0]).toEqual({date:'2026-10-28',views:12,views_search:7,pdp_views:3,to_cart:1,units:0,revenue:333,returns:2});
  });
  it('keeps open-day measurements out of closed-day windows',()=>{
    const f=fixture();f.snapshots[0]!.day='2026-10-29';
    expect(captureIsOpen(f.snapshots[0]!)).toBe(true);
    expect(nativeFunnel(f)[0]!.partial).toBe(true);expect(mergeCabinetViews([],f)).toEqual([]);
  });
  it('uses the Moscow date at 23:30, even if the UTC day is earlier',()=>{
    const f=fixture();const r=f.snapshots[0]!;r.captured_at='2026-10-28T20:30:00Z';
    expect(captureIsOpen(r)).toBe(true);r.captured_at='2026-10-28T21:01:00Z';
    expect(captureIsOpen(r)).toBe(false);
  });
  it('selects latest observation by actual instant and never sums phases',()=>{
    const f=fixture(),r=structuredClone(f.snapshots[0]!);r.phase='вечер';r.captured_at='2026-10-29T12:00:00+03:00';
    r.items[0]!.views=99;r.totals.views=99;f.snapshots.push(r);
    expect(captureDays(f)).toHaveLength(1);expect(nativeFunnel(f)[0]!.views).toBe(12);
  });
  it('fails on ambiguous schemes or duplicate API keys rather than double counting',()=>{
    const f=fixture();f.snapshots[0]!.items.push({...f.snapshots[0]!.items[0]!,scheme:'FBS'});
    expect(()=>nativeFunnel(f)).toThrow('multiple scheme');
    const r={date:'2026-10-28',sku:'123'};
    expect(()=>mergeCabinetViews([r,r],null)).toThrow('duplicate API');
  });
  it('feeds an existing experiment article, normalizes zero position to missing, and retains partial rows',()=>{
    const dir=mkdtempSync(join(tmpdir(),'native-tests-'));
    try {
      const p=join(dir,'absent.ndjson'),base=readFunnelTests(p),f=fixture();
      const extra=cabinetTestRows(f,{'123':'ART'},base,new Map([['ART','test_ad']]));
      const closed=readFunnelTests(p,extra);
      expect(closed.byArt.get('ART')?.get('2026-10-28')).toMatchObject({search_position:null,search_views:7,ordered_units:0});
      expect(closed.byArt.get('ART')?.get('2026-10-28')?.ts).toBe('2026-10-29T12:18:00.000+03:00');
      f.snapshots[0]!.day_in_progress=true;
      const open=readFunnelTests(p,cabinetTestRows(f,{'123':'ART'},base,new Map([['ART','test_ad']])));
      expect(open.rows).toHaveLength(0);expect(open.partial).toHaveLength(1);
      expect(cabinetTestRows(f,{},base,new Map())).toEqual([]);
    } finally {rmSync(dir,{recursive:true,force:true});}
  });
  it('delivers three approved real report rows without changing their counters',()=>{
    const f=fixture(),s=f.snapshots[0]!;
    s.items=[
      {sku:'3564832777',scheme:'FBS',views:120,search_views:27,pdp_views:16,cart:1,ordered_units:2,search_position:134},
      {sku:'4865595688',scheme:'FBS',views:720,search_views:439,pdp_views:30,cart:0,ordered_units:1,search_position:114},
      {sku:'3492791704',scheme:'FBS',views:216,search_views:40,pdp_views:24,cart:3,ordered_units:1,search_position:61},
    ];
    s.scope={expected:3,received:3,matched:3,missing:0,extra:0,status:'complete'};
    s.totals={views:1056,search_views:506,pdp_views:70,cart:4,ordered_units:4};
    const rows=mergeCabinetViews([],validateCaptureFile(f));
    expect(rows.map(r=>[r.views,r.vsearch,r.pdp,r.cart,r.units])).toEqual([[120,27,16,1,2],[720,439,30,0,1],[216,40,24,3,1]]);
  });
  it('uses current test membership instead of a stale historical control role',()=>{
    const base=readFunnelTests('/no-such-funnel-source',[
      {date:'2026-10-27',art:'ART',role:'control',search_position:10,search_views:7,pdp_views:3,hits_to_cart:1,ordered_units:0},
    ]);
    const rows=cabinetTestRows(fixture(),{'123':'ART'},base,new Map([['ART','test_ad']]));
    expect(rows[0]).toMatchObject({art:'ART',role:'test_ad'});
  });
  it('removes superseded aggregates only on the replaced date',()=>{
    const aggregate={role:'agg_sum',test_id:'test',n:1,n_nonzero:1,search_position:10,search_views:7,pdp_views:3,hits_to_cart:1,ordered_units:0};
    const read=readFunnelTests('/no-such-funnel-source',[
      {...aggregate,date:'2026-10-27'},{...aggregate,date:'2026-10-28'},
    ],new Set(['2026-10-28']));
    expect(read.rows.map(r=>r.date)).toEqual(['2026-10-27']);
  });
});
