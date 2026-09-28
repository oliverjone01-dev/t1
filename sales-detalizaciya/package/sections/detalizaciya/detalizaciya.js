/* ==========================================================================
   Раздел «Детализация» · оценка работы отдела продаж по кабинетам Авито
   7 подразделов единой анатомии: номер, заголовок, вывод, метка «данные / гипотеза»,
   визуал, действие. Подразделы: Обстановка (стартовая), Куда уходят клиенты,
   Дожим и скорость, Как звучит в чате, Цена, Причины и возражения, Список на понедельник.

   Зависит от: tokens.css, kit.css, icons.js, kit.js (KS.nav, KS.navWire, KS.shell, KS.theme),
   kx.css и kx.js (KS.kx). Данные: window.DETAL_DATA из data.js.

   Подключение:
     GM_DETAL.mount(window.DETAL_DATA, {
       root:  document.getElementById('detal'),   // контейнер с классом .kx
       cab:   document.getElementById('detal-cab'),// место под переключатель кабинета (необязательно)
       nav:   document.getElementById('nav'),     // меню проекта для подсветки пункта при прокрутке (необязательно)
       start: 'detal-sit'                          // куда открыть: Обстановка
     });
   В меню проекта добавить группу GM_DETAL.NAV_GROUP.
   ========================================================================== */
(function(g){
const { esc, nf, pct, reduce, tick, N, seg, ring, spark, statusOf, toast } = KS.kx;
const $ = id => document.getElementById(id);
const GM = g.GM_DETAL = {};
GM.SECTIONS = [['detal-sit', 'Обстановка'], ['detal-flow', 'Куда уходят клиенты'], ['detal-dyn', 'Дожим и скорость'], ['detal-chat', 'Как звучит в чате'], ['detal-price', 'Цена'], ['detal-obj', 'Причины и возражения'], ['detal-todo', 'Список на понедельник']];
GM.NAV_GROUP = { t:'Детализация', i:'chart', ch:GM.SECTIONS.map(s => ({ id:s[0], t:s[1] })) };
GM.START = 'detal-sit';

GM.mount = function(D, o){
  o = o || {};
  const root = o.root;
  root.classList.add('kx');
  root.innerHTML = GM.SECTIONS.map(s => '<section class="hs" id="' + s[0] + '" aria-label="' + s[1] + '"></section>').join('');
  let CAB = 'all', STEP = 1;
  const CODES = Object.keys(D.cabs);
  const wl = w => { const [y, n] = w.split('-W'); const d = new Date(Date.UTC(+y, 0, 4)); const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + (n - 1) * 7);
    const f = x => String(x.getUTCDate()).padStart(2, '0') + '.' + String(x.getUTCMonth() + 1).padStart(2, '0'); return f(mon); };
  const cabs = () => CAB === 'all' ? CODES : [CAB];
  const W = D.weeks.length - 1;
  function agg(f, i){ let num = 0, den = 0; cabs().forEach(c => { const r = D.cabs[c].series[i]; if(r[f] != null && r.n){ num += r[f] * r.n; den += r.n; } }); return den ? Math.round(num / den * 10) / 10 : null; }
  const fun = () => [0, 1, 2, 3, 4, 5].map(i => cabs().reduce((s, c) => s + D.cabs[c].fun.all[i], 0));
  const STG = ['Обращение', 'Вопрос по делу', 'Прислал размеры', 'Дал телефон', 'Макет, визит', 'Договор'];
  const STEP_SAY = ['Клиент не написал ничего по делу. Первое сообщение должно предлагать выбор.', 'Получил ответ и пропал. Возражений почти нет: это молчание, лечится дожимом 24 и 72 часа.',
    'Прислал размеры, но не дал номер. Сразу после расчёта просить номер в обмен на макет.', 'Разговор ушёл в телефон, в чате не видно. Нужна связка с Bitrix24.', 'Макет есть, договора нет. Фиксация цены и оплата 70/30.'];
  const HEALTH = [ ['fast', 'Скорость ответа', 70, true, 'ответ за 15 минут'], ['price', 'Цена в ответе', 85, true, 'назвали на запрос'], ['fu', 'Дожим', 30, true, 'вернулись к молчащему'], ['ph', 'Телефон', 20, true, 'клиент дал номер'] ];
  /* ===================== общие детали разделов ===================== */
  const cabName = () => CAB === 'all' ? 'оба кабинета' : CAB;
  function half(k){ const r = (a, b) => { let num = 0, den = 0; cabs().forEach(c => D.cabs[c].series.slice(a, b).forEach(x => { if(x[k] != null && x.n){ num += x[k] * x.n; den += x.n; } })); return den ? Math.round(num / den * 10) / 10 : null; };
    return [r(0, 4), r(4, 8)]; }
  const trendWord = h => h[1] > h[0] + 2 ? 'Лучше' : h[1] < h[0] - 2 ? 'Хуже' : 'Без изменений';
  const delta = (h, up) => { const d = Math.round((h[1] - h[0]) * 10) / 10, good = up ? d >= 0 : d <= 0; return '<span class="dl ' + (Math.abs(d) < 2 ? '' : good ? 'good' : 'bad') + '">' + (d > 0 ? '+' : d < 0 ? '−' : '') + nf(Math.abs(d)) + '</span>'; };
  const TAG = { d:'<span class="bdg"><i class="dot ok"></i>данные</span>', g:'<span class="bdg" data-tip="<b>Гипотеза</b><br>Число из смысловой разметки диалогов. Проверено вручную на выборке."><i class="dot warn"></i>гипотеза</span>' };
  const SH = (idx, title, say, tag) => '<header class="sh rise"><div><span class="idx">' + idx + '</span><h2>' + title + '</h2><p class="say">' + say + '</p></div>' + TAG[tag] + '</header>';
  const REASON = { silent:'пропали молча', not_now:'не сейчас', mismatch:'нужно другое', unknown:'непонятно', no_followup:'ждали нашего шага' };
  const ICO = { copy:'<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7"/></svg>' };
  const idCell = id => '<span class="idc">' + esc(id) + '<button data-copy="' + esc(id) + '" aria-label="Скопировать ID">' + ICO.copy + '</button></span>';
  const DECIDE = [['Дожим через 24 и 72 часа', 'вернуть 20% молчащих: +44 клиента до расчёта', 'fu', 'g'], ['Номер в обмен на фото и макет', '57% против 44% у «менеджер перезвонит»', 'ph', 'g'], ['На «а камень?» партнёр и крепление', 'второй по частоте вопрос клиентов', 'stone', 'g']];

  /* ===================== 01 · обстановка ===================== */
  function sSit(){
    const f = fun(), lost = f[1] - f[2], hf = half('fu'), hs = half('fast');
    const stats = HEALTH.map(([k, t, norm, up, sub], i) => { const v = agg(k, W), st = statusOf(v, norm, up), h = half(k);
      return '<div class="stat spot click lift rise" style="--i:' + (i + 3) + '" data-drill="' + k + '" tabindex="0"><div class="k"><span>' + t + '</span><span class="st ' + st + '"><i class="dot ' + st + '"></i>' + ({ ok:'норма', warn:'близко', crit:'проблема', na:'нет' })[st] + '</span></div>'
        + '<div style="display:flex;align-items:center;gap:12px">' + ring(v, norm, st) + '<div><div class="v">' + N(v, 'a' + k, '%') + '</div><div class="s muted">' + sub + '<br>норма ' + norm + '%</div></div></div>'
        + '<div class="s">' + nf(h[0]) + '% → ' + nf(h[1]) + '% за 8 недель ' + delta(h, up) + '</div></div>'; }).join('');
    const parts = [[f[0] - f[1], 'var(--neutral-bar)', 'без вопроса'], [lost, 'var(--crit)', 'пропали после ответа'], [f[2] - f[3], 'var(--warn)', 'размеры без телефона'], [f[3] - f[5], 'var(--cat-3)', 'ушли в телефон'], [f[5], 'var(--ok)', 'договор']];
    $('detal-sit').innerHTML = SH('01', 'Обстановка', 'Что происходит в отделе продаж и что сделать на этой неделе.', 'd')
      + '<div class="grid12">'
      + '<article class="card c8 hero rise" style="--i:1"><div class="meta"><span class="st crit"><i class="dot crit"></i>требует решения</span><span>Неделя ' + wl(D.weeks[W]) + '</span><span>' + cabName() + '</span><span>Авито, 1 355 диалогов</span></div>'
      + '<h1>Клиенты уходят не из-за цены. <em>Мы перестали им писать второй раз.</em></h1>'
      + '<p class="lede">' + pct(lost, f[1]) + '% клиентов получают ответ и пропадают. Скорость ответа выросла с ' + nf(hs[0]) + '% до ' + nf(hs[1]) + '%, а повторное касание упало с ' + nf(hf[0]) + '% до ' + nf(hf[1]) + '%.</p>'
      + '<div class="hero-row"><div class="hero-n"><span class="big">' + N(f[5], 'ah5') + '</span><span class="of">из ' + N(f[0], 'ah0') + '</span></div><div class="hero-cap">дошли до договора в чате за 8 недель. Остальные сделки ушли в телефон, в чате их не видно.</div></div>'
      + '<div class="ratio" role="img" aria-label="Куда ушли обращения">' + parts.map((x, i) => '<i style="--i:' + i + ';flex:' + Math.max(x[0], 0.5) + ';background:' + x[1] + '"></i>').join('') + '</div>'
      + '<div class="ratio-leg">' + parts.map(x => '<span><i style="background:' + x[1] + '"></i>' + x[2] + ' ' + N(x[0], 'rl' + x[2]) + '</span>').join('') + '</div></article>'
      + '<aside class="card c4 rise fill" style="--i:2"><div class="hd"><span class="cap">3 решения на неделю</span><span class="m">клавиши 1 2 3</span></div><div class="acts grow">'
      + DECIDE.map((a, i) => '<div class="act"><span class="kbd">' + (i + 1) + '</span><div><b>' + a[0] + '</b><span>' + a[1] + '</span></div><button class="b gh sm" data-drill="' + a[2] + '">открыть</button></div>').join('') + '</div>'
      + '<button class="b pri" style="justify-content:center;margin-top:16px" data-copy="Разбор недели ' + wl(D.weeks[W]) + ': клиенты уходят не из-за цены, мы перестали писать второй раз. ' + pct(lost, f[1]) + '% пропадают после первого ответа, дожим упал с ' + nf(hf[0]) + '% до ' + nf(hf[1]) + '%. На неделю: дожим 24 и 72 часа, номер в обмен на фото и макет, партнёр по камню.">Скопировать вывод для чата</button></aside>'
      + '<div style="grid-column:1/-1"><div class="stats">' + stats + '</div></div></div>';
  }

  /* ===================== 02 · куда уходят клиенты ===================== */
  function sFlow(){
    const f = fun(), Wd = 900, H = 440, colX = [16, 172, 328, 484, 640, 796], nodeW = 14, maxH = 230, sc = maxH / Math.max(1, f[0]), base = H - 44;
    const nodes = f.map((v, si) => ({ si, x:colX[si], h:Math.max(3, v * sc), y:40 }));
    const shape = (x0, y0, h0, x1, y1, h1) => { const mx = (x0 + x1) / 2; return 'M' + x0 + ' ' + y0 + ' C' + mx + ' ' + y0 + ' ' + mx + ' ' + y1 + ' ' + x1 + ' ' + y1 + ' L' + x1 + ' ' + (y1 + h1) + ' C' + mx + ' ' + (y1 + h1) + ' ' + mx + ' ' + (y0 + h0) + ' ' + x0 + ' ' + (y0 + h0) + ' Z'; };
    let big = 1; for(let k = 1; k < 5; k++) if(f[k] - f[k + 1] > f[big] - f[big + 1]) big = k;
    let g = '<line x1="0" x2="' + Wd + '" y1="' + (base + .5) + '" y2="' + (base + .5) + '" stroke="var(--grid)"/>';
    for(let k = 0; k < 5; k++){ const a = nodes[k], b = nodes[k + 1], keep = b.h, lost = f[k] - f[k + 1];
      g += '<path class="band kp" data-s="' + k + '" data-tip="<b>' + STG[k] + ' → ' + STG[k + 1] + '</b><br>дошли ' + f[k + 1] + ' из ' + f[k] + ' (' + pct(f[k + 1], f[k]) + '%)" d="' + shape(a.x + nodeW, a.y, keep, b.x, b.y, keep) + '"/>';
      if(lost > 0){ const ex = a.x + nodeW + 96, dh = Math.max(2, a.h - keep), ey = base - dh, sel = k === STEP ? ' sel' : '';
        g += '<path class="band dr' + sel + '" data-s="' + k + '" tabindex="0" role="button" aria-label="Потери на шаге ' + STG[k] + ': ' + lost + '" data-tip="<b>Ушли на шаге «' + STG[k] + '»</b><br>' + lost + ' клиентов, ' + pct(lost, f[k]) + '% шага. Нажмите, чтобы разобрать." d="' + shape(a.x + nodeW, a.y + keep, dh, ex, ey, dh) + '"/>';
        g += '<rect class="cap-r' + sel + '" x="' + ex + '" y="' + ey + '" width="4" height="' + dh + '" rx="1"/>';
        g += '<text class="sk-n sk-l' + sel + '" x="' + ex + '" y="' + (base + 20) + '">−' + nf(lost) + '</text><text class="sk-s" x="' + ex + '" y="' + (base + 36) + '">' + pct(lost, f[k]) + '% шага</text>'; } }
    nodes.forEach(nd => { g += '<rect class="node" x="' + nd.x + '" y="' + nd.y + '" width="' + nodeW + '" height="' + nd.h + '" rx="3"/><text class="sk-n" x="' + nd.x + '" y="' + (nd.y - 12) + '">' + nf(f[nd.si]) + '</text><text class="sk-s" x="' + (nd.x + nodeW + 6) + '" y="' + (nd.y + 12) + '">' + STG[nd.si] + '</text>'; });
    $('detal-flow').innerHTML = SH('02', 'Куда уходят клиенты', '<b>' + pct(f[big] - f[big + 1], f[big]) + '% теряем на шаге «' + STG[big] + '»</b>: ' + (f[big] - f[big + 1]) + ' клиентов за 8 недель. Нажмите на красный поток, справа разбор шага и что с ним делать.', 'g')
      + '<div class="grid12"><div class="card c8 sankey rise" id="detal-sk" style="--i:1"><div class="hd"><span class="cap">Поток по стадиям · 8 недель</span><span class="m">синий: идут дальше · серый и красный: ушли</span></div><div class="scx"><svg viewBox="0 0 ' + Wd + ' ' + H + '" role="img" aria-label="Поток клиентов по стадиям" style="display:block;width:100%;height:auto;overflow:visible">' + g + '</svg></div></div>'
      + '<aside class="card c4 rise fill" style="--i:2" id="detal-flow-side"></aside></div>';
    side();
    const sk = $('detal-sk'), pickS = s => { STEP = s; sk.querySelectorAll('.dr, .cap-r, .sk-l').forEach(el => el.classList.remove('sel')); sk.querySelectorAll('.dr[data-s="' + s + '"]').forEach(el => { el.classList.add('sel'); el.nextElementSibling.classList.add('sel'); el.nextElementSibling.nextElementSibling.classList.add('sel'); }); side(); };
    sk.onclick = e => { const p = e.target.closest('.band'); if(p) pickS(+p.dataset.s); };
    sk.onkeydown = e => { const p = e.target.closest('.dr'); if(p && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); pickS(+p.dataset.s); } };
  }
  function side(){ const f = fun(), s = STEP, lost = f[s] - f[s + 1], rs = (D.stage_reasons[s] || []).filter(r => r[0] !== 'идёт'), rsum = rs.reduce((a, r) => a + r[1], 0);
    $('detal-flow-side').innerHTML = '<div class="hd"><span class="cap">Разбор шага</span><span class="m">' + cabName() + '</span></div><h3 class="t3">' + STG[s] + ' → ' + STG[s + 1] + '</h3>'
      + '<div class="bigloss"><b>−' + N(lost, 'fl') + '</b><span>' + pct(lost, f[s]) + '% шага</span></div><p class="p">' + STEP_SAY[s] + '</p>'
      + '<div class="grow" style="margin-top:16px">' + (rs.length ? '<div class="cap" style="margin-bottom:10px">Почему ушли' + (CAB === 'all' ? '' : ', оба кабинета') + '</div>' + rs.map(r => '<div class="mrow"><div class="k"><span>' + (REASON[r[0]] || r[0]) + '</span><b>' + r[1] + '</b></div><div class="meter" style="--tone:' + (r[0] === 'silent' ? 'var(--crit)' : 'var(--neutral-bar)') + '"><i style="width:' + pct(r[1], rsum) + '%"></i></div></div>').join('') : '') + '</div>'
      + '<div class="foot"><button class="b sec sm" data-drill="stage">Диалоги шага</button><button class="b pri sm" data-copy="' + esc(STEP_FIX[s]) + '">Фраза в скрипт</button></div>'; tick($('detal-flow-side')); }
  const STEP_FIX = ['Добрый день! Подскажите размер и для какого камня нужен портрет: посчитаю два варианта и пришлю фото похожих работ.', 'Посчитала два варианта для вашего размера: 18 и 22 мм. Прислать фото, как они смотрятся на памятнике?',
    'Расчёт готов. Напишите номер, пришлю макет с вашим фото в MAX: так проще согласовать.', 'Отправила макет в MAX. Если удобнее, созвонимся сегодня до 18:00.', 'Цену фиксируем до пятницы. Предоплата 70%, остальное после установки.'];

  /* ===================== 03 · дожим и скорость ===================== */
  function sDyn(){
    const vals = D.weeks.map((_, i) => agg('fu', i)), fast = D.weeks.map((_, i) => agg('fast', i)), hf = half('fu'), hs = half('fast');
    const Wd = 760, H = 300, L = 36, R = 16, T = 20, B = 30, n = vals.length, x = i => L + i * (Wd - L - R) / (n - 1), y = v => T + (1 - v / 100) * (H - T - B);
    const path = arr => { let d = ''; arr.forEach((v, i) => { if(v == null) return; d += (d ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }); return d; };
    let g = [0, 50, 100].map(t => '<line x1="' + L + '" x2="' + (Wd - R) + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="var(--grid)"/><text x="' + (L - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end" font-size="11" fill="var(--text-muted)">' + t + '%</text>').join('');
    g += '<rect x="' + L + '" y="' + y(100) + '" width="' + (Wd - L - R) + '" height="' + (y(30) - y(100)) + '" fill="var(--ok-soft)" opacity=".5"/><text x="' + (Wd - R - 6) + '" y="' + (y(100) + 16) + '" text-anchor="end" font-size="11" fill="var(--ok)">зона нормы дожима: от 30%</text>';
    g += '<path class="draw" pathLength="1" d="' + path(fast) + '" fill="none" stroke="var(--cat-3)" stroke-width="2"/><path class="draw" pathLength="1" d="' + path(vals) + '" fill="none" stroke="var(--crit)" stroke-width="3" stroke-linecap="round"/>';
    D.weeks.forEach((w, i) => { g += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="var(--text-muted)">' + wl(w) + '</text>'; });
    let pk = 0; vals.forEach((v, i) => { if((v || 0) > (vals[pk] || 0)) pk = i; });
    const ann = (i, v, txt, dy) => '<g><circle cx="' + x(i) + '" cy="' + y(v) + '" r="5" fill="var(--surface)" stroke="var(--text-strong)" stroke-width="2"/><line x1="' + x(i) + '" y1="' + y(v) + '" x2="' + x(i) + '" y2="' + (y(v) + dy) + '" stroke="var(--text-strong)"/><text x="' + (x(i) + (i === n - 1 ? -8 : 6)) + '" y="' + (y(v) + dy - 4) + '"' + (i === n - 1 ? ' text-anchor="end"' : '') + ' font-size="12" font-weight="600" fill="var(--text-strong)">' + txt + '</text></g>';
    g += ann(pk, vals[pk] || 0, 'пик дожима ' + nf(vals[pk]) + '%', -26) + ann(n - 1, vals[n - 1] || 0, 'сейчас ' + nf(vals[n - 1]) + '%', -34);
    const cw = (Wd - L - R) / (n - 1);
    D.weeks.forEach((w, i) => { g += '<g class="hc" data-tip="<b>Неделя ' + wl(w) + '</b><br>дожим ' + nf(vals[i]) + '% · ответ за 15 мин ' + nf(fast[i]) + '%"><rect x="' + (x(i) - cw / 2) + '" y="' + T + '" width="' + cw + '" height="' + (H - T - B) + '" fill="transparent"/><line class="gl" x1="' + x(i) + '" x2="' + x(i) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--border-strong)"/>'
      + (vals[i] != null ? '<circle cx="' + x(i) + '" cy="' + y(vals[i]) + '" r="4" fill="var(--crit)"/>' : '') + (fast[i] != null ? '<circle cx="' + x(i) + '" cy="' + y(fast[i]) + '" r="4" fill="var(--cat-3)"/>' : '') + '</g>'; });
    const lad = D.ladder.map(b => { const t = (b.accepted || 0) + (b.thinking || 0) + (b.silent || 0) + (b.other || 0); return pct(b.silent || 0, t); });
    const multi = [['fu', 'Дожим', true], ['fast', 'Ответ за 15 мин', true], ['dz', 'Не дожали', false], ['ph', 'Телефон', true]].map(([k, t, up]) => { const v2 = D.weeks.map((_, i) => agg(k, i)), h = half(k);
      return '<div class="mini" data-drill="' + k + '" tabindex="0"><div class="k"><span>' + t + '</span><span>8 нед.</span></div><div class="v">' + N(v2[W], 'am' + k, '%') + delta(h, up) + '</div>' + spark(v2, 'var(--text-strong)', 220, 34, true) + '</div>'; }).join('');
    $('detal-dyn').innerHTML = SH('03', 'Дожим и скорость', '<b>Отвечаем быстрее, возвращаемся реже.</b> Скорость ответа выросла, а доля диалогов, где менеджер пишет молчащему клиенту второй раз, упала почти до нуля.', 'd')
      + '<div class="grid12"><figure class="card c8 rise" style="--i:1;margin:0"><div class="hd"><span class="cap">Дожим и ответ за 15 минут по неделям</span><span class="m">наведите на неделю</span></div><div class="scx"><svg viewBox="0 0 ' + Wd + ' ' + H + '" style="width:100%;height:auto;overflow:visible;display:block" role="img" aria-label="Дожим и скорость по неделям">' + g + '</svg></div>'
      + '<div class="leg"><span><i style="background:var(--crit)"></i>дожим: менеджер вернулся к молчащему клиенту</span><span><i style="background:var(--cat-3)"></i>живой ответ за 15 рабочих минут</span></div></figure>'
      + '<aside class="card c4 rise stack" style="--i:2;gap:20px"><div class="note"><b>' + N(hf[0], 'nh0', '%') + ' → ' + N(hf[1], 'nh1', '%') + '</b><span>дожим, первые 4 недели против последних 4</span></div>'
      + '<div class="note"><b>' + N(hs[0], 'ns0', '%') + ' → ' + N(hs[1], 'ns1', '%') + '</b><span>ответ за 15 минут за то же время</span></div>'
      + '<div class="note"><b>' + Math.min(...lad) + '-' + Math.max(...lad) + '%</b><span>пропадают после цены при любом чеке, оба кабинета: сумма не решает</span></div></aside>'
      + '<div style="grid-column:1/-1"><div class="minis four">' + multi + '</div></div></div>';
  }

  /* ===================== 04 · как звучит в чате ===================== */
  function sChat(){
    $('detal-chat').innerHTML = SH('04', 'Как звучит в чате', '<b>Первый ответ хороший, второго нет.</b> Слева типичный диалог из выгрузки, справа та же ситуация с дожимом через 24 и 72 часа.', 'd')
      + '<div class="card rise" style="--i:1"><div class="dialog"><div><span class="lab st crit"><i class="dot crit"></i>как сейчас</span><div class="chat" style="margin-top:12px"><div class="bub c">Добрый день. Сколько будет стоить памятник из стекла 60 на 120?<small>Клиент · 21:57</small></div><div class="bub m">Добрый день! Портрет 60х120, толщиной 22 мм от 53 400 р. Стоимость зависит от толщины, размеров и вида стекла.<small>Менеджер · 09:00</small></div><div class="bub c" style="opacity:.55">…<small>Клиент больше не написал. Второго сообщения не было.</small></div></div></div>'
      + '<div><span class="lab st ok"><i class="dot ok"></i>как надо</span><div class="chat" style="margin-top:12px"><div class="bub m">Портрет 60х120 от 53 400 р. Для какого камня и к какой дате нужно?<small>Менеджер · 09:00</small></div><div class="bub m">Посчитала два варианта: 18 и 22 мм. Прислать фото, как они смотрятся на памятнике?<small>Менеджер · через 24 часа</small></div><div class="bub m">Руководство согласовало доп. скидку до пятницы, цену можем зафиксировать сейчас.<small>Менеджер · через 72 часа</small></div></div></div></div>'
      + '<div class="steps3">' + [['01', 'Дожим 24 и 72 часа', 'Каждое утро до 11:00 список «последнее слово наше больше суток». Цель: вернуться в 30% диалогов.'], ['02', 'Номер в обмен на пользу', 'Фото работ, макет, прайс в MAX. Прямая просьба приносит телефон в 57% случаев.'], ['03', 'Камень решаем партнёром', 'На «а камень, установка?» сразу мастерская в городе клиента и крепление к камню.']]
        .map(a => '<div><span class="n">' + a[0] + '</span><h5>' + a[1] + '</h5><p>' + a[2] + '</p></div>').join('') + '</div>'
      + '<div class="foot"><button class="b pri" data-copy="Посчитала два варианта: 18 и 22 мм. Прислать фото, как они смотрятся на памятнике?">Скопировать дожим 24 часа</button><button class="b sec" data-copy="Руководство согласовало доп. скидку до пятницы, цену можем зафиксировать сейчас.">Скопировать дожим 72 часа</button></div></div>';
  }

  /* ===================== 05 · цена ===================== */
  const BANDS = ['до 25 тыс.', '25-60 тыс.', '60-120 тыс.', '120 тыс. и выше'];
  const LK = [['accepted', 'var(--ok)', 'приняли цену'], ['thinking', 'var(--warn)', '«подумаем»'], ['silent', 'var(--crit)', 'пропали'], ['other', 'var(--neutral-bar)', 'торг и другое']];
  function sPrice(){
    const tot = b => LK.reduce((s, k) => s + (b[k[0]] || 0), 0), sil = D.ladder.map(b => pct(b.silent || 0, tot(b))), acc = D.ladder.map(b => pct(b.accepted || 0, tot(b)));
    $('detal-price').innerHTML = SH('05', 'Цена', '<b>Сумма не решает:</b> после цены пропадают ' + Math.min(...sil) + '-' + Math.max(...sil) + '% клиентов при любом чеке. Скидка в первом ответе не лечит молчание, её выгоднее держать для второго касания.', 'g')
      + '<div class="grid12"><div class="card c8 rise" style="--i:1"><div class="hd"><span class="cap">Реакция на названную цену · оба кабинета</span><span class="m">нажмите на строку: диалоги</span></div>'
      + D.ladder.map((b, i) => { const t = tot(b); return '<button class="lrow" data-b="' + i + '" data-tip="<b>' + BANDS[i] + '</b><br>' + LK.map(k => k[2] + ' ' + pct(b[k[0]] || 0, t) + '%').join('<br>') + '"><span>' + BANDS[i] + '</span><span class="lbar">' + LK.map(k => (b[k[0]] ? '<i style="flex:' + b[k[0]] + ';background:' + k[1] + '"></i>' : '')).join('') + '</span><span class="num muted" style="text-align:right;font-size:12.5px">' + t + '</span></button>'; }).join('')
      + '<div class="leg">' + LK.map(k => '<span><i style="background:' + k[1] + ';height:8px;width:8px"></i>' + k[2] + '</span>').join('') + '</div></div>'
      + '<aside class="card c4 rise fill" style="--i:2"><div class="hd"><span class="cap">Средний названный чек</span><span class="m">медиана</span></div><div class="kpi">' + nf(D.median_check) + ' ₽</div>'
      + '<p class="p grow" style="margin-top:12px">Цену принимают ' + Math.min(...acc) + '-' + Math.max(...acc) + '% клиентов в каждом диапазоне. Разница между дешёвым и дорогим заказом в молчании меньше 10 пунктов.</p>'
      + '<div class="foot"><button class="b pri sm" data-copy="Руководство согласовало доп. скидку до пятницы, цену можем зафиксировать сейчас.">Скидка во второе касание</button></div></aside></div>';
    $('detal-price').querySelectorAll('.lrow').forEach(r => r.onclick = () => drill('band:' + r.dataset.b, r));
  }

  /* ===================== 06 · причины и возражения ===================== */
  function sObj(){
    const P = D.pareto.slice(0, 8), mx = P[0][2];
    $('detal-obj').innerHTML = SH('06', 'Причины потерь и возражения', '<b>Возражений почти нет, есть молчание.</b> ' + P[0][2] + ' из ' + D.pareto.reduce((s, p) => s + p[2], 0) + ' потерянных клиентов пропали после нашего ответа без единого слова. Цена как причина: ' + (D.pareto.find(p => p[1] === 'price') || [0, 0, 0])[2] + '.', 'g')
      + '<div class="grid12"><div class="card c6 rise" style="--i:1"><div class="hd"><span class="cap">Почему не купили · оба кабинета</span><span class="m">нажмите: диалоги</span></div>'
      + P.map((p, i) => '<button class="prow" data-p="' + i + '"><div class="mrow"><div class="k"><span>' + p[0] + '</span><b>' + p[2] + '</b></div><div class="meter" style="--tone:' + (i === 0 ? 'var(--crit)' : 'var(--neutral-bar)') + '"><i style="width:' + pct(p[2], mx) + '%"></i></div></div></button>').join('') + '</div>'
      + '<div class="card c6 rise" style="--i:2"><div class="hd"><span class="cap">Что говорят клиенты и как отвечать</span><span class="m">сколько раз</span></div>'
      + D.objections.map((o, i) => '<div class="acc"><button aria-expanded="' + (i === 0) + '">' + esc(o.t) + '<span class="n">' + o.n + '</span><svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l5 5 5-5"/></svg></button><div class="pn' + (i === 0 ? ' open' : '') + '"><div><div class="ans"><p class="p">' + esc(o.fb || o.best) + '</p><button class="b sec sm" data-copy="' + esc(o.fb || o.best) + '">Скопировать ответ</button></div></div></div></div>').join('') + '</div></div>';
    $('detal-obj').querySelectorAll('.prow').forEach(r => r.onclick = () => drill('par:' + r.dataset.p, r));
    $('detal-obj').querySelectorAll('.acc > button').forEach(b => b.onclick = () => { const on = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(on)); b.nextElementSibling.classList.toggle('open', on); });
  }

  /* ===================== 07 · список на понедельник ===================== */
  let TF = 'all';
  function sTodo(){
    const L = D.todo.filter(t => CAB === 'all' || t.c === CAB), whys = [...new Set(D.todo.map(t => t.why))];
    const tone = w => /ждёт/.test(w) ? 'crit' : /цены/.test(w) ? 'warn' : 'na';
    const rows = L.filter(t => TF === 'all' || t.why === TF);
    $('detal-todo').innerHTML = SH('07', 'Список на понедельник', '<b>' + L.length + ' клиентов, которым можно написать сегодня.</b> Последнее слово наше или клиент ждёт ответа. ID диалога для поиска в Авито и связки с Bitrix24.', 'd')
      + '<div class="card rise" style="--i:1;padding:0"><div class="hd" style="padding:16px 20px 0"><div class="seg" id="detal-tf"><span class="pill"></span><button data-v="all" aria-pressed="' + (TF === 'all') + '">все ' + L.length + '</button>' + whys.map(w => '<button data-v="' + esc(w) + '" aria-pressed="' + (TF === w) + '">' + w + ' ' + L.filter(t => t.why === w).length + '</button>').join('') + '</div><span class="m">' + cabName() + '</span></div>'
      + '<div style="overflow:auto;max-height:440px;margin-top:12px"><table class="tbl"><thead><tr><th>Кабинет</th><th>Неделя</th><th>Почему</th><th>Что было</th><th>ID диалога</th></tr></thead><tbody>'
      + (rows.length ? rows.map(t => '<tr><td>' + t.c + '</td><td class="num">' + wl(t.w) + '</td><td><span class="st ' + tone(t.why) + '" style="white-space:nowrap"><i class="dot ' + tone(t.why) + '"></i>' + t.why + '</span></td><td class="s">' + esc(t.s) + '</td><td>' + idCell(t.id) + '</td></tr>').join('')
        : '<tr><td colspan="5"><div class="empty"><b>Список пуст</b><span>В этом кабинете некому писать по этой причине.</span></div></td></tr>') + '</tbody></table></div></div>';
    seg($('detal-tf'), v => { TF = v; sTodo(); });
  }

  /* ===================== панель деталей ===================== */
  const DRILL = { fu:['Дожим', 'Доля диалогов, где менеджер сам вернулся к молчащему клиенту через 20+ часов.', 'Через 24 часа новый повод: второй вариант размера, фото, звонок. Через 72 часа вторая часть скидки с дедлайном.'],
    fast:['Скорость ответа', 'Доля клиентов, получивших живой ответ за 15 рабочих минут.', 'Дежурный на кабинет и шаблон первого ответа: цена «от», 2-3 размера, один вопрос.'],
    price:['Цена в ответе', 'Назвали ли сумму, когда клиент спросил цену.', 'Вилка из 2-3 реальных размеров и один вопрос. Не спорить о цене конкурента.'],
    ph:['Телефон клиента', 'Доля обращений, где клиент прислал номер. На «напишите номер» телефон присылали в 57% случаев (40 из 70), на «менеджер вам перезвонит» в 44% (59 из 135).', 'Просить номер прямо, в обмен на фото работ и макет. Не «менеджер перезвонит».'],
    dz:['Не дожали', 'Доля диалогов, где последнее слово наше и клиент молчит 2 дня и больше.', 'Утренний список из раздела 07: написать каждому до 11:00.'],
    stone:['Камень и установка', 'Второй по частоте вопрос клиентов: «а камень, установка?». Сейчас отвечаем «мы делаем только стекло», и клиент уходит искать мастерскую.', 'Партнёрская мастерская в городе клиента и крепление к камню: в первом же ответе, с фото установки.'] };
  const dl = items => items.length ? '<ul class="dlist">' + items.map(t => '<li><div class="top"><span class="bdg">' + t.c + '</span><span>неделя ' + wl(t.w) + '</span>' + (t.p ? '<span>' + nf(t.p) + ' ₽</span>' : '') + '<span style="margin-left:auto">' + idCell(t.id) + '</span></div><p>' + esc(t.s) + '</p></li>').join('') + '</ul>'
    : '<div class="empty"><b>Нет диалогов</b><span>В этом кабинете за 8 недель таких не было.</span></div>';
  const byCab = a => a.filter(t => CAB === 'all' || t.c === CAB);
  /* ---------- панель деталей по data-drill ---------- */
  function drill(k, from){ let h;
    if(k === 'stage'){ const it = byCab(D.stage_lists[STEP] || []); h = '<div class="cap">Разбор шага</div><h3>' + STG[STEP] + ' → ' + STG[STEP + 1] + '</h3><p class="sub">Клиенты, которые остановились на шаге «' + STG[STEP] + '». Последние ' + it.length + ', ' + cabName() + '.</p>' + dl(it); }
    else if(k.startsWith('band:')){ const i = +k.slice(5), it = byCab(D.band_lists[i]); h = '<div class="cap">Цена</div><h3>Чек ' + BANDS[i] + '</h3><p class="sub">Диалоги, где назвали цену в этом диапазоне. Последние ' + it.length + ', ' + cabName() + '.</p>' + dl(it); }
    else if(k.startsWith('par:')){ const p = D.pareto[+k.slice(4)], it = byCab(p[3] || []); h = '<div class="cap">Причина потери</div><h3>' + p[0] + '</h3><p class="sub">' + p[2] + ' клиентов за 8 недель. Примеры диалогов, ' + cabName() + '.</p>' + dl(it); }
    else { const d = DRILL[k] || DRILL.fu, m = k === 'stone' ? null : D.weeks.map((_, i) => agg(k, i)), hh = m ? half(k) : null;
      h = '<div class="cap">Показатель</div><h3>' + d[0] + '</h3><p class="sub">' + d[1] + '</p>'
        + (m ? '<div class="card" style="margin:0 0 16px"><div class="hd"><span class="cap">8 недель · ' + cabName() + '</span><span class="m">' + nf(hh[0]) + '% → ' + nf(hh[1]) + '%</span></div>' + spark(m, 'var(--text-strong)', 440, 110, true) + '</div>' : '')
        + '<div class="cap" style="margin-bottom:8px">Что делать</div><div class="alert ok"><div>' + d[2] + '</div></div>'; }
    KS.kx.drawer.open(h, from); }
  KS.kx.onDrill = drill;

  /* ---------- переход к подразделу и подсветка пункта меню ---------- */
  const go = id => { const el = $(id); if(el){ el.scrollIntoView({ behavior:reduce ? 'auto' : 'smooth', block:'start' }); KS.shell && KS.shell.close && KS.shell.close(); return true; } return false; };
  let ACTIVE = o.start || GM.START;
  if(o.nav){ const spy = new IntersectionObserver(es => { es.forEach(e => { if(e.isIntersecting && e.target.id !== ACTIVE){ ACTIVE = e.target.id;
    o.nav.querySelectorAll('[data-view]').forEach(b => { const on = b.dataset.view === ACTIVE; b.classList.toggle('is-active', on); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'); }); } }); }, { rootMargin:'-30% 0px -60% 0px' });
    root.querySelectorAll('.hs').forEach(s => spy.observe(s)); }

  /* ---------- кабинет ---------- */
  let cabPlace = null;
  if(o.cab){ o.cab.innerHTML = '<div class="seg" role="group" aria-label="Кабинет"><span class="pill" aria-hidden="true"></span><button data-v="all" aria-pressed="true">оба кабинета</button>' + CODES.map(c => '<button data-v="' + c + '" aria-pressed="false">' + c + '</button>').join('') + '</div>';
    cabPlace = seg(o.cab.firstChild, v => { CAB = v; TF = 'all'; render(); }); }
  function cabSet(v){ CAB = v; TF = 'all'; if(o.cab){ o.cab.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); cabPlace && cabPlace(); } render(); }

  /* ---------- палитра команд и клавиши: 1 2 3 решения недели ---------- */
  KS.kx.cmdk.set([ ...GM.SECTIONS.map(s => ['Детализация', s[1], () => go(s[0])]),
    ['Кабинет', 'Оба кабинета', () => cabSet('all')], ...CODES.map(c => ['Кабинет', c, () => cabSet(c)]),
    ...DECIDE.map((a, i) => ['Решения', a[0], () => drill(a[2]), String(i + 1)]), ...(o.commands || []) ]);
  window.addEventListener('keydown', e => { const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if(!typing && !e.metaKey && !e.ctrlKey && !e.altKey && ['1', '2', '3'].includes(e.key) && root.offsetParent !== null) drill(DECIDE[+e.key - 1][2]); });

  function render(){ sSit(); sFlow(); sDyn(); sChat(); sPrice(); sObj(); sTodo(); tick(root); }
  render();
  if(o.start && o.start !== GM.START) go(o.start);
  return { render, cabSet, go };
};
})(window);
