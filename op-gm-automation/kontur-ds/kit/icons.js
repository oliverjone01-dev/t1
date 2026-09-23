/* ==========================================================================
   Контур DS · иконки
   Контурные, штрих 1.7, скругления круглые. Система координат 20×20: все пути
   рисованы в ней, поэтому viewBox="0 0 20 20". В Контуре стоял 24×24, из-за
   чего иконки были мельче на пятую часть и смещены к левому верхнему углу.
   Цвет наследуется от текста: currentColor.
   ========================================================================== */
(function(g){
const P = {
  /* разделы */
  grid:'M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z',
  chart:'M3 16l4-5 3 3 4-6 3 4',
  search:'M9 3a6 6 0 1 0 0 12A6 6 0 0 0 9 3zM17 17l-3.7-3.7',
  doc:'M5 2h7l3 3v13H5zM12 2v3h3',
  layers:'M10 2.5 2.5 6.5 10 10.5l7.5-4zM2.5 10.5 10 14.5l7.5-4M2.5 14 10 18l7.5-4',
  ai:'M10 2.5 12 7l4.5 2-4.5 2-2 4.5L8 11l-4.5-2L8 7zM16 14l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z',
  mega:'M3 8v4l9 4V4zM12 7.5a2.5 2.5 0 0 1 0 5M3 12v3.5h2.5',
  link:'M8.5 11.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1M11.5 8.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1',
  globe:'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM2 10h16M10 2c2 2.4 3 5 3 8s-1 5.6-3 8c-2-2.4-3-5-3-8s1-5.6 3-8z',
  wallet:'M3 6a2 2 0 0 1 2-2h9v3M3 6v9a2 2 0 0 0 2 2h11V7H5a2 2 0 0 1-2-1zM14 11h1.5',
  pen:'M13.5 3.5 16.5 6.5 7 16H4v-3zM12 5l3 3',
  gear:'M10 6.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zM10 1.8l1 2 2.2-.5 1 1.9 2.2.6-.5 2.2 1.5 1.7-1.5 1.7.5 2.2-2.2.6-1 1.9-2.2-.5-1 2-1-2-2.2.5-1-1.9-2.2-.6.5-2.2L1.6 10l1.5-1.7-.5-2.2 2.2-.6 1-1.9 2.2.5z',
  cmp:'M10 3v14M5 7 2.5 12h5zM15 7l-2.5 5h5zM5 7l5-1.5M15 7l-5-1.5',
  plug:'M7 3v4M13 3v4M5 7h10v3a5 5 0 0 1-10 0zM10 15v3',
  /* сущности */
  users:'M7 9a2.6 2.6 0 1 0 0-5.2A2.6 2.6 0 0 0 7 9zM2.5 16c0-2.5 2-4.2 4.5-4.2s4.5 1.7 4.5 4.2M13.5 8.4a2.2 2.2 0 1 0 0-4.4M14 11.9c2 .3 3.5 1.9 3.5 4.1',
  tag:'M9.5 2.5H3v6.5l8 8 6.5-6.5-8-8zM6 6h.01',
  target:'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  db:'M10 2.5c3.6 0 6.5 1.1 6.5 2.5S13.6 7.5 10 7.5 3.5 6.4 3.5 5 6.4 2.5 10 2.5zM3.5 5v10c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V5M3.5 10c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5',
  bolt:'M11 2 4 11h5l-1 7 7-9h-5z',
  eye:'M1.8 10S4.7 4.8 10 4.8 18.2 10 18.2 10 15.3 15.2 10 15.2 1.8 10 1.8 10zM10 12.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z',
  clock:'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM10 5.5V10l3 1.8',
  key:'M12.5 3a4.5 4.5 0 0 0-4.3 5.8L3 14v3h3v-2h2v-2h1.7l.5-.5A4.5 4.5 0 1 0 12.5 3zm1.2 3.3h.01',
  list:'M4 6h12M4 10h12M4 14h8',
  tree:'M10 3v4M10 7H5v3M10 7h5v3M3 10h4v3H3zM8 10h4v3H8zM13 10h4v3h-4z',
  /* динамика и статус */
  up:'M4 13l5-5 3 3 4-5',
  loss:'M3 6l5 5 3-3 6 6M17 14v-4h-4',
  'arrow-up':'M10 16V4M5 9l5-5 5 5',
  'arrow-down':'M10 4v12M5 11l5 5 5-5',
  warn:'M10 3 2.5 16.5h15zM10 8v3.5M10 14h.01',
  check:'M4 10.5 8 14l8-8.5',
  info:'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM10 9v5M10 6h.01',
  bulb:'M7.5 15h5M8 17.5h4M10 2.5a5 5 0 0 0-3 9v1.5h6V11.5a5 5 0 0 0-3-9z',
  /* интерфейс */
  menu:'M3 5h14M3 10h14M3 15h14',
  x:'M5 5l10 10M15 5 5 15',
  chev:'M8 5l5 5-5 5',
  'chev-down':'M5 8l5 5 5-5',
  external:'M11 3h6v6M17 3l-8 8M14 11v5H4V6h5',
  filter:'M3 4h14l-5.5 6.5V16l-3 1.5v-7z',
  calendar:'M4 5h12v12H4zM4 9h12M8 3v4M12 3v4',
  download:'M10 3v10M6 9l4 4 4-4M4 17h12',
  sun:'M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M16 4l-1.4 1.4M5.4 14.6 4 16',
  moon:'M17 11.2A7 7 0 1 1 8.8 3a5.5 5.5 0 0 0 8.2 8.2z',
  quote:'M4 5h5v5H6.5v3H4zM11 5h5v5h-2.5v3H11z',
  /* плотность: три строки просторно, четыре компактно */
  rows:'M3 3.5h14v13H3zM3 7.8h14M3 12.2h14',
  'rows-dense':'M3 3.5h14v13H3zM3 6.75h14M3 10h14M3 13.25h14'
};
/* Имена Lucide (lucide.dev, лицензия ISC): агенты знают их лучше других наборов,
   поэтому ic('trending-up') и ic('up') рисуют одно и то же. */
const ALIAS = {
  'layout-grid':'grid', 'chart-line':'chart', 'file-text':'doc', 'sparkles':'ai', 'megaphone':'mega', 'pencil':'pen',
  'settings':'gear', 'scale':'cmp', 'plug':'plug', 'database':'db', 'zap':'bolt', 'network':'tree', 'list':'list',
  'trending-up':'up', 'trending-down':'loss', 'triangle-alert':'warn', 'lightbulb':'bulb', 'chevron-right':'chev',
  'chevron-down':'chev-down', 'external-link':'external', 'funnel':'filter', 'circle-help':'info', 'rows-3':'rows', 'rows-4':'rows-dense'
};
const BOX = {};
/* Недостающую иконку берём из Lucide как есть, в её сетке 24x24:
   KS.icons.add('truck', '<path d="..."/><circle cx="7" cy="18" r="2"/>', 24)
   Штрих пересчитывается по сетке, поэтому на экране толщина совпадает с родными иконками. */
function add(name, inner, box){ P[name] = inner; if(box && box !== 20) BOX[name] = box; }
/* ic('chart')  ic('warn', 15)  ic('check', 14, 'ks-ic my-class')  ic('trending-up') */
function ic(name, size, cls){
  const s = size || 17, key = P[name] ? name : (ALIAS[name] || name), box = BOX[key] || 20;
  const d = typeof P[key] === 'string' ? P[key] : P.grid, inner = d.charAt(0) === '<' ? d : '<path d="' + d + '"/>';
  return '<svg class="' + (cls || 'ks-ic') + '" width="' + s + '" height="' + s + '" viewBox="0 0 ' + box + ' ' + box + '" fill="none" '
    + 'stroke="currentColor" stroke-width="' + (1.7 * box / 20).toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + inner + '</svg>';
}
g.KS = g.KS || {};
g.KS.icons = P;
/* служебные поля не перечисляются: Object.keys(KS.icons) это только иконки */
Object.defineProperty(P, 'add', { value:add, enumerable:false });
Object.defineProperty(P, 'alias', { value:ALIAS, enumerable:false });
g.KS.ic = ic;
})(window);
