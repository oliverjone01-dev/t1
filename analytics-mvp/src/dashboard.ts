// Рендер самодостаточного HTML-дашборда. Данные инлайнятся, файл открывается
// как локальный (как в текущей системе), но собран из тестируемой витрины.
// Правила DOC_05: бейджи слоя и свежести, провенанс, ДРР по линиям как INDICATIVE.

interface Model {
  generatedAt: string;
  freshness: string;
  windows: { cur: { from: string; to: string }; cmp: { from: string; to: string } };
  totals: Record<string, { cur: number; cmp: number; abs: number; pct: number }>;
  byLine: Array<{ line: string; revenue: { cur: number; pct: number }; units: { cur: number }; share_pct: number }>;
  cardsToFix: Array<{ name: string; line: string; views: number; convOrd: number; rev: number }>;
  price: { cheaper: number; even: number; pricier: number; noIndex: number };
  violations: Array<{ name: string; line: string; rev: number }>;
  adByLineReliable: boolean;
  source: string;
}

export function renderDashboard(model: Model): string {
  const json = JSON.stringify(model);
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GENGLASS - аналитика OZON (MVP)</title>
<style>
  :root { --bg:#0d1117; --panel:#161b22; --line:#21262d; --txt:#e6edf3; --mut:#8b949e; --good:#3fb950; --bad:#f85149; --acc:#58a6ff; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--txt); font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif; }
  .wrap { max-width:1180px; margin:0 auto; padding:24px; }
  header { display:flex; flex-wrap:wrap; align-items:baseline; gap:12px 18px; border-bottom:1px solid var(--line); padding-bottom:16px; }
  h1 { font-size:20px; margin:0; }
  .badges { display:flex; gap:8px; flex-wrap:wrap; }
  .badge { font-size:12px; padding:2px 8px; border-radius:6px; background:var(--panel); border:1px solid var(--line); color:var(--mut); }
  .badge.live { color:var(--acc); border-color:#1f6feb55; }
  .period { color:var(--mut); font-size:13px; }
  h2 { font-size:14px; text-transform:uppercase; letter-spacing:.04em; color:var(--mut); margin:28px 0 12px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px; }
  .kpi { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
  .kpi .label { color:var(--mut); font-size:12px; }
  .kpi .val { font-size:22px; font-weight:600; margin-top:4px; }
  .kpi .delta { font-size:12px; margin-top:4px; }
  .up { color:var(--good); } .down { color:var(--bad); }
  table { width:100%; border-collapse:collapse; }
  th,td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); font-size:13px; }
  th { color:var(--mut); font-weight:500; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  .bar { height:8px; border-radius:4px; background:var(--line); overflow:hidden; display:flex; }
  .bar > span { display:block; height:100%; }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; }
  .warn { background:#3d1d1d; border:1px solid var(--bad); color:#ffb3ae; border-radius:8px; padding:10px 14px; margin:12px 0; }
  .note { color:var(--mut); font-size:12px; margin-top:8px; }
  footer { margin-top:32px; border-top:1px solid var(--line); padding-top:14px; color:var(--mut); font-size:12px; }
  code { background:var(--panel); padding:1px 5px; border-radius:4px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>GENGLASS - аналитика OZON</h1>
    <div class="badges">
      <span class="badge live">оперативный слой T-1</span>
      <span class="badge" id="fresh"></span>
      <span class="badge">источник: <span id="src"></span></span>
    </div>
    <div class="period" id="period"></div>
  </header>

  <div id="violations"></div>

  <h2>Срез периода (текущее окно против предыдущего)</h2>
  <div class="grid" id="kpis"></div>

  <h2>По линиям</h2>
  <div class="panel"><table id="lines"><thead><tr>
    <th>Линия</th><th class="num">Оборот</th><th class="num">Δ оборота</th><th class="num">Доля</th><th class="num">Заказы</th>
  </tr></thead><tbody></tbody></table></div>

  <h2>Позиционирование по цене (SKU против рынка)</h2>
  <div class="panel" id="price"></div>

  <h2>Карточки на ремонт - трафик есть, заказов мало</h2>
  <div class="panel"><table id="cards"><thead><tr>
    <th>Товар</th><th>Линия</th><th class="num">Показы</th><th class="num">CR заказ %</th><th class="num">Оборот</th>
  </tr></thead><tbody></tbody></table></div>

  <footer>
    <div>Метки провенанса: все цифры выше - <b>[ДАННЫЕ]</b> из OZON API (оперативный слой). Чистая прибыль не показана: за незакрытый период запрещена (DOC_05 §1.2).</div>
    <div class="note" id="adwarn"></div>
    <div class="note">Сгенерировано: <span id="gen"></span>. Это MVP-срез из живого среза n8n; после S3 источником станет локальная история (SQLite).</div>
  </footer>
</div>

<script>
const M = ${json};
const rub = n => new Intl.NumberFormat('ru-RU').format(Math.round(n));
const pct = p => (p>=0?'+':'') + (Math.round(p*1000)/10) + '%';
const cls = up => up ? 'up' : 'down';

document.getElementById('fresh').textContent = 'свежесть: ' + M.freshness;
document.getElementById('src').textContent = M.source;
document.getElementById('period').textContent =
  M.windows.cur.from + '..' + M.windows.cur.to + '  против  ' + M.windows.cmp.from + '..' + M.windows.cmp.to;
document.getElementById('gen').textContent = M.generatedAt;

// KPI: goodWhenUp задаёт окраску дельты
const KPI = [
  ['Оборот, ₽', 'revenue', true, rub],
  ['Заказы, шт', 'units', true, rub],
  ['CR показ-заказ, %', 'cr_order', true, v=>v],
  ['Средний чек, ₽', 'aov', true, rub],
  ['ДРР канала, %', 'drr_total', false, v=>v],
  ['Возвраты, шт', 'returns', false, rub],
  ['Склад 0 при продажах', 'oos', false, rub],
  ['SKU с продажами', 'sku_count', true, rub],
];
document.getElementById('kpis').innerHTML = KPI.map(([label,key,goodUp,f])=>{
  const m = M.totals[key];
  const up = m.abs >= 0;
  const good = goodUp ? up : !up;
  return '<div class="kpi"><div class="label">'+label+'</div><div class="val">'+f(m.cur)+
    '</div><div class="delta '+cls(good)+'">'+pct(m.pct)+' к пред. периоду</div></div>';
}).join('');

// По линиям
document.querySelector('#lines tbody').innerHTML = M.byLine.map(l=>
  '<tr><td>'+l.line+'</td><td class="num">'+rub(l.revenue.cur)+'</td><td class="num '+
  cls(l.revenue.pct>=0)+'">'+pct(l.revenue.pct)+'</td><td class="num">'+l.share_pct+'%</td><td class="num">'+
  rub(l.units.cur)+'</td></tr>').join('');

// Цена
const p = M.price, tot = p.cheaper+p.even+p.pricier+p.noIndex;
const seg = (n,c)=> '<span style="width:'+(100*n/tot)+'%;background:'+c+'"></span>';
document.getElementById('price').innerHTML =
  '<div class="bar">'+seg(p.cheaper,'#3fb950')+seg(p.even,'#58a6ff')+seg(p.pricier,'#f85149')+seg(p.noIndex,'#30363d')+'</div>'+
  '<div class="note">дешевле рынка: <b>'+p.cheaper+'</b> (можно поднять цену) &nbsp;|&nbsp; вровень: '+p.even+
  ' &nbsp;|&nbsp; <span class="down">дороже рынка: '+p.pricier+'</span> (риск проседания) &nbsp;|&nbsp; без индекса: '+p.noIndex+'</div>';

// Карточки на ремонт
document.querySelector('#cards tbody').innerHTML = M.cardsToFix.length ? M.cardsToFix.map(s=>
  '<tr><td>'+s.name+'</td><td>'+s.line+'</td><td class="num">'+rub(s.views)+'</td><td class="num down">'+
  s.convOrd+'</td><td class="num">'+rub(s.rev)+'</td></tr>').join('')
  : '<tr><td colspan="5" class="note">нет кандидатов по текущему порогу</td></tr>';

// Нарушения бренда
if (M.violations.length) {
  document.getElementById('violations').innerHTML =
    '<div class="warn"><b>Нарушение позиционирования:</b> на маркетплейсе обнаружены '+
    M.violations.length+' позиций линии VALONTI (перегородки, не для МП). '+
    M.violations.map(v=>v.name).slice(0,3).join('; ')+'</div>';
}

// Предупреждение по ДРР по линиям (G5)
document.getElementById('adwarn').innerHTML = M.adByLineReliable ? '' :
  'ДРР по линиям не показан как факт: таксономии рекламы и аналитики расходятся, надёжен только суммарный ДРР канала (DOC_05 §2, аудит G5).';
</script>
</body>
</html>`;
}
