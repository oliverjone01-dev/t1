#!/usr/bin/env node
// keyso-serp.mjs - топ-10 органической выдачи и частоты по списку фраз из Keys.so (база Москва).
// Нужно для кластеризации интентов по пересечению выдачи. Read-only, токен из env.
// Запуск: KEYSO_TOKEN=... SERP_PHRASES="фраза1|фраза2" node yandex-direct/dashboard/keyso-serp.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
mkdirSync(DATA, { recursive: true });
const T = process.env.KEYSO_TOKEN || process.env.KEYSSO_API_KEY;
if (!T) { console.error('ERROR: нет KEYSO_TOKEN'); process.exit(1); }
const PHRASES = (process.env.SERP_PHRASES || '').split('|').map(s => s.trim()).filter(Boolean);
const OUT = process.env.SERP_OUT || 'keyso_serp.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const H = { 'X-Keyso-TOKEN': T, 'auth-token': T, Accept: 'application/json' };

const out = { generated_at: new Date().toISOString(), base: 'msk', phrases: {} };
for (const p of PHRASES) {
  const u = `https://api.keys.so/report/simple/keyword_dashboard?base=msk&keyword=${encodeURIComponent(p)}`;
  try {
    const r = await fetch(u, { headers: H }); const t = await r.text();
    if (r.status !== 200) { out.phrases[p] = { status: r.status, error: t.slice(0, 200) }; console.log(`WARN ${p}: ${r.status}`); }
    else { const j = JSON.parse(t);
      out.phrases[p] = { status: 200, ws: j.ws, wsk: j.wsk, adscnt: j.adscnt, wizards: j.wizards,
        top: (j.top || []).slice(0, 10).map(x => ({ pos: x.pos, domain: x.domain, url: x.url })),
        ads: (j.ads || []).flat().map(a => ({ domain: a.domain, header: a.header })).slice(0, 10),
        similars: (j.similars || []).slice(0, 15).map(s => ({ word: s.word, wsk: s.wsk, perc: s.perc })) };
      console.log(`OK ${p}: wsk ${j.wsk}, top ${out.phrases[p].top.length}`); }
  } catch (e) { out.phrases[p] = { error: e.message }; }
  await sleep(800);
}
writeFileSync(join(DATA, OUT), JSON.stringify(out, null, 1));
console.log(`OK ${OUT}`);
