import {it,expect,vi,afterEach} from 'vitest';
import {OzonSeller} from './ozon-seller.js';
const response=(body:any,status=200)=>({ok:status<400,status,json:async()=>body,text:async()=>JSON.stringify(body)}) as any;
afterEach(()=>vi.unstubAllGlobals());
it('Problems postings request exact Moscow window and analytics without changing legacy default',async()=>{
 const f=vi.fn().mockResolvedValue(response({postings:[],has_next:false}));vi.stubGlobal('fetch',f);
 await new OzonSeller({clientId:'test',apiKey:'test'}).problemPostings('2026-10-19','2026-10-25');
 const b=JSON.parse(f.mock.calls[0][1].body);expect(b.filter.since).toBe('2026-10-19T00:00:00+03:00');expect(b.with).toEqual({financial_data:false,analytics_data:true});
});
it('Problems returns use last returned id for pagination and never drop a later page',async()=>{
 const f=vi.fn().mockResolvedValueOnce(response({returns:[{id:10}],has_next:true})).mockResolvedValueOnce(response({returns:[{id:11}],has_next:false}));vi.stubGlobal('fetch',f);
 expect(await new OzonSeller({clientId:'test',apiKey:'test'}).problemReturns('2026-10-19','2026-10-25')).toHaveLength(2);
 expect(JSON.parse(f.mock.calls[1][1].body).last_id).toBe(10);
});
it('Returns 403 cannot become complete empty period',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({code:7,message:'forbidden'},403)));
 await expect(new OzonSeller({clientId:'test',apiKey:'test'}).problemReturns('2026-10-19','2026-10-25')).rejects.toThrow('403');
});
it('Returns repeated cursor fails rather than hanging or duplicating refunds',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({returns:[{id:10}],has_next:true})));
 await expect(new OzonSeller({clientId:'test',apiKey:'test'}).problemReturns('2026-10-19','2026-10-25')).rejects.toThrow('stalled');
});
it('Rating defect list cursor follows all pages',async()=>{
 const f=vi.fn().mockResolvedValueOnce(response({errors:[{posting_number:'a'}],has_next:true,cursor:'next'})).mockResolvedValueOnce(response({errors:[{posting_number:'b'}],has_next:false,cursor:''}));vi.stubGlobal('fetch',f);
 expect(await new OzonSeller({clientId:'test',apiKey:'test'}).problemRatingPostings('2026-10-19','2026-10-25')).toHaveLength(2);expect(JSON.parse(f.mock.calls[1][1].body).cursor).toBe('next');
});
it('Broken defect response is not silently zero errors',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({errors:[],hasNext:false})));
 await expect(new OzonSeller({clientId:'test',apiKey:'test'}).problemRatingPostings('2026-10-19','2026-10-25')).rejects.toThrow('contract');
});
