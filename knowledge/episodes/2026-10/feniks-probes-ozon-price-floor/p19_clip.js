// ФЕНИКС проба P19: из чего состоит отсечка базы АДМ «Отчета» (дни с минусом = 0): реклама дней без продаж или возвраты
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync('/home/user/t1/analytics-mvp/public/katya-report.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
function stub(name) {
  const f = function () { return stub(name + '()'); };
  return new Proxy(f, { get(t, k) {
      if (k === Symbol.toPrimitive) return () => ''; if (k === 'length') return 0; if (k === 'value') return ''; if (k === 'checked') return false;
      if (k === 'querySelectorAll' || k === 'getElementsByClassName' || k === 'getElementsByTagName') return () => [];
      if (k === 'getElementById' || k === 'querySelector') return (id) => stub('el:' + id); if (k === 'then') return undefined;
      return stub(name + '.' + String(k)); }, set() { return true; }, apply() { return stub(name + '()'); } });
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
const code = `
(function(from,to){
  var tot={clip:0,ads_clip:0,ret_clip:0,ads:0,base:0,days_neg:0,days_neg_noSale:0};
  for(var sk in AN_META){
    var fin={},ad={};
    var add=function(rows,idx,sgn,dst){if(!rows)return;for(var i=0;i<rows.length;i++){var r=rows[i];if(r[0]<from||r[0]>to)continue;dst[r[0]]=(dst[r[0]]||0)+sgn*(r[idx]||0);}};
    add(AN_FIN[sk],7,1,fin);add(AN_FIN[sk],4,-1,fin);add(AN_FIN[sk],5,-1,fin);add(AN_ACQSKU[sk],1,1,fin);add(AN_STOSKU[sk],1,1,fin);
    add(AN_ADSSKU[sk],1,1,ad);add(AN_CPOSKU[sk],1,1,ad);
    var days={};for(var k in fin)days[k]=1;for(var k2 in ad)days[k2]=1;
    for(var d in days){var f=fin[d]||0,a=ad[d]||0,v=f-a;tot.ads+=a;
      if(v>0){tot.base+=v;continue;}
      tot.days_neg++; if(f<=0&&a>0&&!(fin[d]))tot.days_neg_noSale++;
      var c=-v;tot.clip+=c;var ac=Math.min(a,c);tot.ads_clip+=ac;tot.ret_clip+=c-ac;}
  }
  return tot;})`;
const fn = vm.runInContext(code, ctx);
for (const [from, to] of [['2026-08-01', '2026-08-31'], ['2026-09-01', '2026-09-30'], ['2026-10-01', '2026-10-10']]) {
  const t = fn(from, to); const R = x => Math.round(x).toLocaleString('ru');
  console.log(`[P19] ${from}..${to}: реклама по SKU ${R(t.ads)}; отсечено из базы АДМ ${R(t.clip)}: из них реклама ${R(t.ads_clip)} (${(t.ads_clip / t.ads * 100).toFixed(0)}% всей рекламы), прочее (возвраты и т.п.) ${R(t.ret_clip)}; дней с минусом ${t.days_neg}, из них без начислений по продаже ${t.days_neg_noSale}`);
}
