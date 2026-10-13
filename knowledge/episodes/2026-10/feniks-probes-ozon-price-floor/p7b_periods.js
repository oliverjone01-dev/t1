// ФЕНИКС проба B2: строки таблицы по артикулам «Отчета» за август (закрыт), сентябрь (закрыт), 01-10.10 (открыт)
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
      if (k === 'querySelectorAll' || k === 'getElementsByClassName' || k === 'getElementsByTagName') return () => [];
      if (k === 'getElementById' || k === 'querySelector') return (id) => stub('el:' + id);
      if (k === 'then') return undefined;
      return stub(name + '.' + String(k));
    },
    set() { return true; },
    apply() { return stub(name + '()'); },
  });
}
const ctx = { console, Math, JSON, Date, Number, String, Object, Array, Set, Map, RegExp, parseFloat, parseInt, isNaN, isFinite, Symbol, Proxy, Error,
  setTimeout: () => 0, clearTimeout: () => 0, setInterval: () => 0, requestAnimationFrame: () => 0,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, sessionStorage: { getItem: () => null, setItem: () => {} },
  location: { hash: '', search: '', href: '', pathname: '/katya-report.html' }, history: { replaceState: () => {}, pushState: () => {} },
  navigator: { userAgent: 'node' }, fetch: () => new Promise(() => {}), addEventListener: () => {}, removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {} }), getComputedStyle: () => ({ getPropertyValue: () => '' }),
  Intl, encodeURIComponent, decodeURIComponent, Blob: function () {}, URL: { createObjectURL: () => '' } };
ctx.document = stub('document'); ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const s of scripts) { try { vm.runInContext(s, ctx, { timeout: 60000 }); } catch (e) { console.log('err', String(e).slice(0, 120)); } }
const out = {};
for (const [lab, from, to] of [['aug', '2026-08-01', '2026-08-31'], ['sep', '2026-09-01', '2026-09-30'], ['oct', '2026-10-01', '2026-10-10']]) {
  const D = ctx.skuAnalyticsData({ from, to });
  out[lab] = D.cats.flatMap(c => c.arr.map(x => ({ sk: x.sk, units: x.units, acc: x.acc, amt: x.amt, adv: x.adv, amtS: x.amtS, cc: x.cc, ship: x.ship, dinc: x.dinc, tb: x.tb, net: ctx.anDerive(x).net })));
}
fs.writeFileSync('/tmp/feniks-floor/periods_rows.json', JSON.stringify(out));
console.log('ok', Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
