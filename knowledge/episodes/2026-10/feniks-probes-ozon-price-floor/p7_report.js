// ФЕНИКС проба P7: ИТОГО «Отчета» за сентябрь из собранной страницы katya-report.html (снимок 11.10),
// независимый от floor.py путь: те же функции skuAnalyticsData/anDerive, что рисуют таблицу и «Отчет».
// Только чтение: html читается, скрипты исполняются в песочнице vm с заглушкой DOM.
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync('/home/user/t1/analytics-mvp/public/katya-report.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
function stub(name) {
  const f = function () { return stub(name + '()'); };
  return new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'length') return 0;
      if (k === 'value') return '';
      if (k === 'checked') return false;
      if (k === 'style' || k === 'dataset' || k === 'classList') return stub(name + '.' + String(k));
      if (k === 'querySelectorAll' || k === 'getElementsByClassName' || k === 'getElementsByTagName') return () => [];
      if (k === 'getElementById' || k === 'querySelector') return (id) => stub('el:' + id);
      if (k === 'then') return undefined;
      return stub(name + '.' + String(k));
    },
    set() { return true; },
    apply() { return stub(name + '()'); },
  });
}
const ctx = {
  console, Math, JSON, Date, Number, String, Object, Array, Set, Map, RegExp, parseFloat, parseInt, isNaN, isFinite, Symbol, Proxy, Error,
  setTimeout: () => 0, clearTimeout: () => 0, setInterval: () => 0, requestAnimationFrame: () => 0,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {} },
  location: { hash: '', search: '', href: '', pathname: '/katya-report.html' },
  history: { replaceState: () => {}, pushState: () => {} },
  navigator: { userAgent: 'node' }, fetch: () => new Promise(() => {}),
  addEventListener: () => {}, removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  Intl, encodeURIComponent, decodeURIComponent, Blob: function () {}, URL: { createObjectURL: () => '' },
};
ctx.document = stub('document');
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
let ok = 0, fail = 0;
for (const s of scripts) {
  try { vm.runInContext(s, ctx, { timeout: 60000 }); ok++; } catch (e) { fail++; if (fail < 6) console.log('script err:', String(e).slice(0, 200)); }
}
console.log('scripts ok', ok, 'fail', fail, 'skuAnalyticsData:', typeof ctx.skuAnalyticsData, 'anDerive:', typeof ctx.anDerive);
const run = (from, to) => {
  const D = ctx.skuAnalyticsData({ from, to }); const g = D.grand; const v = ctx.anDerive(g);
  const r = x => Math.round(x || 0);
  console.log(`[P7] ${from}..${to}: начислено ${r(g.acc)}, К выплате ${r(g.amt)}, реклама по SKU ${r(g.adv)}, база АДМ ${r(g.amtS)}, С/С ${r(g.cc)}, наша доставка ${r(g.ship)}, доставка покупателя ${r(g.dinc)}, база налога ${r(g.tb)}, АДМ ${r(v.adm)}, налог ${r(v.tax)}, ЧИСТАЯ ${r(v.net)}, рентаб ${v.rent == null ? '-' : v.rent.toFixed(1)}%`);
  if (D.acct) console.log('     строка «Общие расходы»: К выплате', r(D.acct.amt), 'наша доставка', r(D.acct.ship), 'доставка покупателя', r(D.acct.dinc));
  return { D, g, v };
};
const sep = run('2026-09-01', '2026-09-30');
let skuNet = 0, skuAmt = 0, skuN = 0;
for (const c of sep.D.cats) for (const x of c.arr) { const v = ctx.anDerive(x); skuNet += v.net; skuAmt += x.amt; skuN++; }
console.log('[P7] сумма чистой по', skuN, 'артикулам', Math.round(skuNet), '; их К выплате', Math.round(skuAmt));
fs.writeFileSync('/tmp/feniks-floor/sep_rows.json',
  JSON.stringify(sep.D.cats.flatMap(c => c.arr.map(x => ({ sk: x.sk, off: x.off, units: x.units, acc: x.acc, amt: x.amt, adv: x.adv, amtS: x.amtS, cc: x.cc, ship: x.ship, dinc: x.dinc, tb: x.tb, com: x.com, del: x.del, oth: x.oth, net: ctx.anDerive(x).net })))));
run('2026-08-01', '2026-08-31');
run('2026-10-01', '2026-10-10');
