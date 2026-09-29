/* ==========================================================================
   Контур DS 1.4 · расширение kx (доработки для «Детализации»)
   Подключается после kit.js. Добавляет KS.kx: числа с переходом, отлив под
   курсором, переключатель с переезжающей плашкой, кольцо против нормы,
   спарклайн, статус по норме, подсказку, уведомление, панель деталей и
   палитру команд на стекле. Стили в kx.css, всё работает внутри контейнера .kx.

   Правила движения: только transform, opacity, clip-path, stroke-dashoffset,
   grid-template-rows. Без пружин. «Меньше движения» выключает всё.
   Палитра команд kx заменяет KS.cmdk: горячая клавиша ⌘K / Ctrl+K
   перехватывается здесь, чтобы не открывались две палитры.
   ========================================================================== */
(function(g){
const KS = g.KS = g.KS || {};
const $ = id => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const nf = n => n == null ? '-' : String(Math.round(n * 10) / 10).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

/* ---------- переход числа: только при изменении, 450 мс, ease-out по кубу ---------- */
const NUMS = new Map();
function tick(root){
  (root || document).querySelectorAll('[data-n]').forEach(el => {
    const key = el.dataset.key || el.dataset.n, to = parseFloat(el.dataset.n), from = NUMS.has(key) ? NUMS.get(key) : to, suf = el.dataset.suf || '';
    NUMS.set(key, to);
    if(from === to || reduce){ el.textContent = nf(to) + suf; return; }
    const t0 = performance.now(), dur = 450;
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = nf(Math.round((from + (to - from) * e) * 10) / 10) + suf; if(k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
/* число, которое умеет переходить: N(значение, уникальный ключ, суффикс) */
const N = (v, key, suf) => '<span class="num" data-n="' + (v == null ? 0 : v) + '" data-key="' + key + '" data-suf="' + (suf || '') + '">' + nf(v) + (suf || '') + '</span>';

/* ---------- отлив под курсором: класс .spot, 7% акцента, только мышь ---------- */
document.addEventListener('pointermove', e => { if(e.pointerType !== 'mouse') return; const el = e.target.closest && e.target.closest('.kx .spot'); if(!el) return;
  const r = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px'); }, { passive:true });

/* ---------- переключатель .seg: плашка переезжает через clip-path, 250 мс ---------- */
function seg(el, onPick){
  const pill = el.querySelector('.pill');
  const place = () => { const b = el.querySelector('[aria-pressed="true"]'); if(!b || !pill) return; const r = el.getBoundingClientRect(), br = b.getBoundingClientRect();
    pill.style.clipPath = 'inset(0 ' + (r.right - br.right - 3) + 'px 0 ' + (br.left - r.left - 3) + 'px round 7px)'; };
  el.addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); place(); onPick && onPick(b.dataset.v); });
  /* ОП ГМ: наблюдатель отключается сам, когда переключатель убран со страницы (повторный вход в раздел) */
  const ro = new ResizeObserver(() => { if(!el.isConnected){ ro.disconnect(); return; } place(); }); ro.observe(el); requestAnimationFrame(place); return place;
}

/* ---------- кольцо против нормы и спарклайн ---------- */
function ring(v, norm, tone){ const r = 18, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, v || 0)) / 100, a = norm / 100 * 360 - 90;
  const nx = 22 + Math.cos(a * Math.PI / 180) * 18, ny = 22 + Math.sin(a * Math.PI / 180) * 18, nx2 = 22 + Math.cos(a * Math.PI / 180) * 12, ny2 = 22 + Math.sin(a * Math.PI / 180) * 12;
  return '<svg class="ring ' + tone + '" viewBox="0 0 44 44" aria-hidden="true"><circle class="tr" cx="22" cy="22" r="' + r + '"/><circle class="fg" cx="22" cy="22" r="' + r + '" stroke-dasharray="' + c + '" stroke-dashoffset="' + (c * (1 - p)) + '"/><line class="nm" x1="' + nx2 + '" y1="' + ny2 + '" x2="' + nx + '" y2="' + ny + '"/></svg>'; }
function spark(vals, color, w, h, fill){ w = w || 120; h = h || 36; const xs = vals.map((v, i) => [i, v]).filter(p => p[1] != null); if(xs.length < 2) return '';
  const mx = Math.max(...xs.map(p => p[1]), 1), pts = xs.map(([i, v]) => [(i / (vals.length - 1)) * (w - 4) + 2, h - 3 - (v / mx) * (h - 8)]), d = 'M' + pts.map(p => p.map(x => x.toFixed(1)).join(' ')).join('L'), l = pts[pts.length - 1];
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true" style="overflow:visible">' + (fill ? '<path d="' + d + 'L' + l[0] + ' ' + h + 'L' + pts[0][0] + ' ' + h + 'Z" fill="' + color + '" opacity=".1"/>' : '')
    + '<path class="draw" pathLength="1" d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><circle cx="' + l[0] + '" cy="' + l[1] + '" r="3" fill="' + color + '"/></svg>'; }
/* статус против нормы: ok не хуже нормы, warn в пределах 30%, crit хуже, na нет данных */
const statusOf = (v, norm, up) => v == null ? 'na' : (up ? v >= norm : v <= norm) ? 'ok' : (up ? v >= norm * .7 : v <= norm * 1.3) ? 'warn' : 'crit';

/* ---------- слои поверх: создаются один раз в конце body, внутри .kx ---------- */
function layers(){
  if($('kx-tip')) return;
  const w = document.createElement('div'); w.className = 'kx';
  w.innerHTML = '<div class="tip glass" id="kx-tip" role="tooltip"></div>'
    + '<div class="toast glass" id="kx-toast" role="status" aria-live="polite"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="var(--ok)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path pathLength="1" d="M4 10.5 8 14l8-8.5"/></svg><span id="kx-toast-t"></span></div>'
    + '<div class="cmdk-bd" id="kx-cmdk-bd"></div><div class="cmdk glass" id="kx-cmdk" role="dialog" aria-label="Палитра команд"><input id="kx-cmdk-in" role="combobox" aria-expanded="true" aria-controls="kx-cmdk-list" placeholder="Раздел, кабинет или действие"><ul id="kx-cmdk-list" role="listbox"></ul></div>'
    + '<div class="drw-bd" id="kx-drw-bd"></div><aside class="drw glass" id="kx-drw" role="dialog" aria-modal="true" tabindex="-1"></aside>';
  document.body.appendChild(w);
  $('kx-drw-bd').onclick = drawer.close; $('kx-cmdk-bd').onclick = () => cmdk.close();
  $('kx-cmdk-in').oninput = cmdkDraw;
  $('kx-cmdk-in').onkeydown = e => { if(e.key === 'ArrowDown'){ CI = Math.min(CL.length - 1, CI + 1); cmdkDraw(); e.preventDefault(); } if(e.key === 'ArrowUp'){ CI = Math.max(0, CI - 1); cmdkDraw(); e.preventDefault(); } if(e.key === 'Enter' && CL[CI]){ cmdk.close(); CL[CI][2](); } };
  $('kx-cmdk-list').onclick = e => { const li = e.target.closest('[data-i]'); if(li){ cmdk.close(); CL[+li.dataset.i][2](); } };
}

/* подсказка: атрибут data-kx-tip на любом элементе, HTML внутри (ОП ГМ: не data-tip, его ловит подсказка кита) */
const tip = {
  show(e, html){ layers(); const t = $('kx-tip'); t.innerHTML = html; t.classList.add('on'); tip.move(e); },
  move(e){ const t = $('kx-tip'); if(!t) return; t.style.left = Math.min(innerWidth - 280, e.clientX + 14) + 'px'; t.style.top = (e.clientY + 14) + 'px'; },
  hide(){ const t = $('kx-tip'); t && t.classList.remove('on'); } };
/* ОП ГМ: подсказки kx только внутри .kx, на остальных экранах подсказки кита */
document.addEventListener('pointerover', e => { const el = e.target.closest && e.target.closest('.kx [data-kx-tip]'); if(el) tip.show(e, el.dataset.kxTip); });
document.addEventListener('pointermove', e => { if(e.target.closest && e.target.closest('.kx [data-kx-tip]')) tip.move(e); }, { passive:true });
document.addEventListener('pointerout', e => { if(e.target.closest && e.target.closest('.kx [data-kx-tip]')) tip.hide(); });

/* уведомление снизу справа, 2,8 секунды */
function toast(t){ layers(); $('kx-toast-t').textContent = t; const el = $('kx-toast'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2800); }

/* панель деталей справа: open(html, откуда вернуть фокус), close() */
let lastF = null;
const drawer = {
  open(html, from){ layers(); lastF = from || document.activeElement; const d = $('kx-drw');
    d.innerHTML = '<button class="b sec sm" style="position:absolute;top:18px;right:18px" id="kx-drw-x">закрыть <span class="kbd">Esc</span></button>' + html;
    d.classList.add('on'); $('kx-drw-bd').classList.add('on'); d.focus(); $('kx-drw-x').onclick = drawer.close; },
  close(){ const d = $('kx-drw'); if(!d || !d.classList.contains('on')) return; d.classList.remove('on'); $('kx-drw-bd').classList.remove('on'); if(lastF && lastF.focus) lastF.focus(); },
  isOpen(){ const d = $('kx-drw'); return !!(d && d.classList.contains('on')); } };

/* палитра команд: set([[группа, название, действие, клавиша?], ...]) */
let CMDS = [], CI = 0, CL = [];
function cmdkDraw(){ const q = $('kx-cmdk-in').value.toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean);
  CL = CMDS.filter(c => q.every(w => (c[0] + ' ' + c[1]).toLowerCase().replace(/ё/g, 'е').includes(w))); CI = Math.min(CI, Math.max(0, CL.length - 1)); let gr = '';
  $('kx-cmdk-list').innerHTML = CL.map((c, i) => (c[0] !== gr ? (gr = c[0], '<li class="grp" role="presentation">' + esc(c[0]) + '</li>') : '') + '<li role="option" data-i="' + i + '" aria-selected="' + (i === CI) + '"><span>' + esc(c[1]) + '</span>' + (c[3] ? '<span class="kbd">' + c[3] + '</span>' : '') + '</li>').join('') || '<li class="grp">ничего не нашлось</li>'; }
const cmdk = {
  set(list){ CMDS = list || []; },
  open(){ layers(); $('kx-cmdk').classList.add('on'); $('kx-cmdk-bd').classList.add('on'); $('kx-cmdk-in').value = ''; CI = 0; cmdkDraw(); setTimeout(() => $('kx-cmdk-in').focus(), 30); },
  close(){ const c = $('kx-cmdk'); if(!c) return; c.classList.remove('on'); $('kx-cmdk-bd').classList.remove('on'); },
  toggle(){ const c = $('kx-cmdk'); c && c.classList.contains('on') ? cmdk.close() : cmdk.open(); } };

/* ---------- общие действия по атрибутам ----------
   data-copy="текст"  копирует и показывает уведомление
   data-kx-drill="ключ"  зовёт KS.kx.onDrill(ключ, элемент); Enter работает на элементах с tabindex */
const kx = KS.kx = { esc, nf, pct, reduce, tick, N, seg, ring, spark, statusOf, tip, toast, drawer, cmdk, layers, onDrill:null };
document.addEventListener('click', e => { const c = e.target.closest && e.target.closest('.kx [data-copy]');
  if(c){ (navigator.clipboard ? navigator.clipboard.writeText(c.dataset.copy) : Promise.reject()).then(() => toast('Скопировано в буфер'), () => toast('Скопируйте текст вручную')); return; }
  const d = e.target.closest && e.target.closest('.kx [data-kx-drill]'); if(d && kx.onDrill) kx.onDrill(d.dataset.kxDrill, d); });
document.addEventListener('keydown', e => { if(e.key !== 'Enter' || !e.target.closest) return; const d = e.target.closest('.kx [data-kx-drill][tabindex]'); if(d && kx.onDrill) kx.onDrill(d.dataset.kxDrill, d); });
/* ОП ГМ: палитра kx только на экранах «Детализации» (KS.kx.active), на остальных экранах работает палитра кита */
window.addEventListener('keydown', e => {
  if(!kx.active) return;
  if((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'л')){ e.preventDefault(); e.stopImmediatePropagation(); cmdk.toggle(); }
  else if(e.key === 'Escape'){ cmdk.close(); drawer.close(); } }, true);

/* смена темы с кнопки: иконка обновляется после перехода */
kx.themeToggle = btn => { KS.theme.toggle(); setTimeout(() => { if(btn) btn.innerHTML = KS.theme.icon(); }, 0); };
})(window);
