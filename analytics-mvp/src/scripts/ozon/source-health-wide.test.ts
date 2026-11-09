import {describe,it,expect} from 'vitest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sourceHealth} from './source-health.js';
describe('independent dashboard source dates',()=>{
 it('keeps Reaction field dates separate and reports stale delivery even when money is fresh',()=>{
  const d=mkdtempSync(join(tmpdir(),'ozon-health-'));
  try {
   writeFileSync(join(d,'reakciya.json'),JSON.stringify({updated:'2026-10-28',data_until:'2026-11-08',prices_until:'2026-11-07'}));
   writeFileSync(join(d,'delivery_timeline.json'),JSON.stringify({source_date:'2026-11-07',loaded_at:'2026-11-07T00:00:00Z',rows:[]}));
   const rows=sourceHealth(d,new Date('2026-11-09T09:00:00Z'));
   expect(rows.find(r=>r.source==='Реакция: журнал действий')?.through).toBe('2026-10-28');
   expect(rows.find(r=>r.source==='Реакция: архив воронки')?.through).toBe('2026-11-08');
   expect(rows.find(r=>r.source==='Реакция: архив цен')?.through).toBe('2026-11-07');
   expect(rows.find(r=>r.source==='Наша доставка: сроки и статусы')?.status).toBe('error');
   writeFileSync(join(d,'delivery_timeline.json'),JSON.stringify({source_date:'2026-11-09',loaded_at:'2026-11-09T08:00:00Z',rows:[{issues:['incomplete_order']}]}));
   expect(sourceHealth(d,new Date('2026-11-09T09:00:00Z')).find(r=>r.source==='Наша доставка: сроки и статусы')?.status).toBe('warning');
  } finally {rmSync(d,{recursive:true});}
 });
});
