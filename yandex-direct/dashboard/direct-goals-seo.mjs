// Директ: конверсии по целям «Все лиды» и «качественные» из кабинета (для честного CPL).
// SEO: лиды по разделам сайта (goal reaches по startURLPath, органика).
// Окно август 24.07-22.08 + окно июнь 8.06-7.07 для сверки. Read-only. Дамп в stderr.
const DTOKEN = process.env.YANDEX_DIRECT_TOKEN, DLOGIN = process.env.YANDEX_DIRECT_LOGIN || '';
const MTOKEN = process.env.YANDEX_METRIKA_TOKEN, COUNTER = process.env.YANDEX_METRIKA_COUNTER || '104369223';
if (!DTOKEN || !MTOKEN) { console.error('нет токенов'); process.exit(1); }
const GOAL_LEADS = 487033158, GOAL_CONTACTS = 477925360;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const WINDOWS = [['август', '2026-07-24', '2026-08-22'], ['июнь-июль', '2026-06-08', '2026-07-07']];

async function ym(params) {
  const qs = new URLSearchParams({ ids: COUNTER, accuracy: 'full', limit: '500', ...params });
  const r = await (await fetch(`https://api-metrika.yandex.net/stat/v1/data?${qs}`, { headers: { Authorization: `OAuth ${MTOKEN}` } })).json();
  if (r.errors) throw new Error(JSON.stringify(r.errors)); return r;
}
async function directGoal(d1, d2, goalId) {
  const params = { SelectionCriteria: { DateFrom: d1, DateTo: d2 }, FieldNames: ['Cost', 'Clicks', 'Conversions'],
    ReportName: `g${goalId}-${d1}-${Date.now()}`, ReportType: 'CAMPAIGN_PERFORMANCE_REPORT',
    DateRangeType: 'CUSTOM_DATE', Format: 'TSV', IncludeVAT: 'YES', IncludeDiscount: 'NO' };
  if (goalId) { params.Goals = [goalId]; params.AttributionModels = ['LSC']; }
  for (let i = 0; i < 15; i++) {
    const res = await fetch('https://api.direct.yandex.com/json/v5/reports', { method: 'POST',
      headers: { Authorization: `Bearer ${DTOKEN}`, ...(DLOGIN ? { 'Client-Login': DLOGIN } : {}),
        'Content-Type': 'application/json; charset=utf-8', 'Accept-Language': 'ru', skipReportHeader: 'true', skipReportSummary: 'true' },
      body: JSON.stringify({ params }) });
    if (res.status === 200) { const tsv = (await res.text()).trim(); let cost = 0, clk = 0, cv = 0;
      for (const l of tsv.split('\n')) { const c = l.split('\t'); if (c.length >= 3) { cost += +c[0] || 0; clk += +c[1] || 0; cv += +c[2] || 0; } }
      return { spend: Math.round(cost / 1e6), clicks: clk, conv: cv }; }
    if (res.status === 201 || res.status === 202) { await sleep(4000); continue; }
    throw new Error(`Direct ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  throw new Error('timeout');
}

(async () => {
  for (const [name, d1, d2] of WINDOWS) {
    const base = await directGoal(d1, d2, null);
    const leads = await directGoal(d1, d2, GOAL_LEADS);
    const qual = await directGoal(d1, d2, GOAL_CONTACTS);
    const cplLead = leads.conv ? Math.round(base.spend / leads.conv) : 0;
    const cplQual = qual.conv ? Math.round(base.spend / qual.conv) : 0;
    console.error(`DIRECT\t${name}\tspend ${base.spend}\tclicks ${base.clicks}\tleads(Все лиды) ${leads.conv}\tCPL ${cplLead}\tкач ${qual.conv}\tCPQL ${cplQual}`);
  }
  const seo = await ym({ date1: '2026-07-24', date2: '2026-08-22', dimensions: 'ym:s:startURLPath',
    filters: "ym:s:lastsignTrafficSource=='organic'", metrics: `ym:s:visits,ym:s:goal${GOAL_LEADS}reaches`, sort: `-ym:s:goal${GOAL_LEADS}reaches`, limit: '200' });
  const cat = u => { u = (u || '').toLowerCase();
    if (/peregorod/.test(u)) return 'Перегородки'; if (/mirror|zerkal/.test(u)) return 'Зеркала';
    if (/stol|table/.test(u)) return 'Столы'; if (/doski|doska|markern/.test(u)) return 'Доски';
    if (/stellazh|polki/.test(u)) return 'Стеллажи/полки'; if (/dushev/.test(u)) return 'Душевые';
    if (u === '/' || u === '') return 'Главная/бренд'; return 'Прочее'; };
  const S = {};
  for (const r of (seo.data || [])) { const c = cat(r.dimensions[0].name); (S[c] = S[c] || { v: 0, l: 0 }); S[c].v += r.metrics[0]; S[c].l += r.metrics[1]; }
  console.error('SEO-разделы (август, органика): категория | визиты | лиды');
  for (const [k, x] of Object.entries(S).sort((a, b) => b[1].l - a[1].l)) console.error(`SEOCAT\t${k}\t${Math.round(x.v)}\t${Math.round(x.l)}`);
})();
