/* ==========================================================================
   ОП ГМ v6 на Контур DS 1.5
   Данные: D.av (выгрузка Авито API двух кабинетов) и разделы v3 из legacy.js.
   Все цифры экранов на API считаются здесь, одна версия правды.
   ========================================================================== */
(function(){
const E = KS.fmt.esc, NF = KS.fmt.nf, ic = KS.ic, F = KS.F;
const CABS = ['OLD-G','NEW-B'];
const CABNAME = { 'OLD-G':'OLD-G · старый кабинет', 'NEW-B':'NEW-B · новый кабинет' };
const CABSLOT = { 'OLD-G':1, 'NEW-B':2 };            /* цвет следует за кабинетом, порядок фиксирован */
const DAY = 86400;
const WD = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const MON = { '04':'апр', '05':'май', '06':'июн', '07':'июл', '08':'авг', '09':'сен' };
const OWNER_NOTE = 'Выгрузку обновляет Иван раз в неделю, по понедельникам.';
const MILESTONE = '06.10.2026';

let EXPORT_TS = 0, EXP = {}, AT = '2026-09-22';
const OP = { cab:'all', view:'pulse', days:30, today:14,
  dlg:{ prob:'all', flag:'all', ad:'all', q:'', sort:'recent', kind:'in', limit:40 } };

/* ---------------- правила проблем ---------------- */
const PROB = {
 noresp:{ l:'Не ответили вообще', rule:'Клиент написал текстом, а живого ответа нет: ни сообщения менеджера, ни принятого звонка. Автоответ «Вам ответит первый освободившийся...» ответом не считается.', todo:'Ответить сегодня, даже если прошло время. Извиниться за задержку и сразу ответить по сути.' },
 abandoned:{ l:'Клиент задал вопрос последним, ответа нет', rule:'Последнее сообщение от клиента: вопрос или содержательный текст. Ответа на него нет. «Спасибо», «подумаем», «напишу позже» сюда не попадают.', todo:'Ответить на его последний вопрос. Это самые тёплые клиенты: они уже писали нам сами.' },
 phoneleft:{ l:'Оставил телефон: проверьте перезвон', rule:'Последнее сообщение клиента - номер телефона, после него в чате тишина и нет принятого звонка через Авито. Звонили ли с мобильного, по данным Авито не видно.', todo:'Проверить, что клиенту перезвонили. Если нет, позвонить сегодня.' },
 slow:{ l:'Первый ответ дольше часа', rule:'От первого сообщения клиента до первого ответа живого человека прошло больше 60 минут.', todo:'Цель: первый ответ за 15 минут в рабочее время. Вечерние обращения закрыть первым делом утром.' },
 noprice:{ l:'Спросили цену, суммы нет', rule:'Клиент спросил цену, а в ответах нет суммы («20 000 руб», «32 000р.», «49 000», «40 тыс»). Не считаются: цену отправили на почту, в мессенджер или на калькулятор; клиенту нужен не наш товар; менеджер попросил размер для расчёта, а клиент не ответил.', todo:'Называть цену «от» и за какой размер. Одна утверждённая формулировка на весь отдел.' },
 noquestion:{ l:'Клиенту не задали ни одного вопроса', rule:'В ответах компании нет ни знака «?», ни просьбы «напишите», «пришлите», «уточните».', todo:'В каждом первом ответе один вопрос: размер, фото или срок.' },
 noname:{ l:'Не назвали клиента по имени', rule:'Имя клиента есть в профиле Авито, а в ответах компании его нет.', todo:'Начинать ответ с имени клиента: «Имя, добрый день!»' },
 nofollow:{ l:'Нет дожима', rule:'Компания ответила, клиент замолчал, и больше суток никто не напомнил о себе.', todo:'Через сутки тишины одно короткое напоминание с вопросом.' },
 robotonly:{ l:'Напоминал только робот Авито', rule:'В чате есть заметка Авито «Мы аккуратно напомнили собеседнику о диалоге», а менеджер после паузы больше суток сам не написал.', todo:'Робот не продаёт. После его напоминания менеджер пишет сам, по делу.' },
 misscall:{ l:'Пропущенный звонок без перезвона', rule:'В переписке есть пропущенный входящий звонок, исходящего звонка нет.', todo:'Перезванивать на каждый пропущенный в течение часа.' },
 warranty:{ l:'Срок гарантии назван без опоры на базу', rule:'Менеджер назвал срок гарантии в годах (чаще «5 лет»). В базе знаний (PRL v6) гарантия GLASS-MEMORY записана как «по договору».', todo:'Говорить «гарантия по договору». Срок не называть, пока его не сверят с шаблоном договора.' }
};
const PORDER = ['noresp','abandoned','phoneleft','slow','noprice','noquestion','noname','nofollow','robotonly','misscall','warranty'];
const PRECISION = { noresp:'21 из 22, все случаи', abandoned:'11-13 из 13, 2 спорных', phoneleft:'20 из 20 на выборке', noprice:'14 и 16 из 20 на двух выборках', warranty:'25 из 25, проверка ФЕНИКСА' };
const HOT = ['noresp','abandoned','phoneleft','noprice'];

/* ---------------- помощники ---------------- */
function fL(s){ if(s == null) return '-'; s = Math.round(s); if(s < 3600) return Math.max(1, Math.round(s / 60)) + ' мин';
  if(s < DAY){ const h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60); return h + ' ч' + (m ? ' ' + m + ' мин' : ''); }
  const d = Math.floor(s / DAY), h = Math.round(s % DAY / 3600); return d + ' дн' + (h ? ' ' + h + ' ч' : ''); }
function iso(ts){ return new Date((ts + 10800) * 1000).toISOString(); }
function fD(ts){ const s = iso(ts); return s.slice(8,10) + '.' + s.slice(5,7) + ' ' + s.slice(11,16); }
function fDay(ts){ const s = iso(ts); return s.slice(8,10) + '.' + s.slice(5,7); }
function med(a){ a = a.filter(x => x != null); if(!a.length) return null; a = a.slice().sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m-1] + a[m]) / 2; }
function share(a, b){ return b ? Math.round(a * 1000 / b) / 10 : null; }
function P(v){ return v == null ? '-' : String(v).replace('.', ',') + '%'; }
function firstName(n){ n = (n || '').trim().split(/\s+/)[0] || ''; return n || 'Клиент'; }
function adName(i){ return (D.av.ads[i] || '-'); }
function lastClient(c){ const M = D.av.msgs[c.id] || []; for(let i = M.length - 1; i >= 0; i--){ if(M[i][1] === 'c' && M[i][2] !== 'c' && M[i][3] !== 'Сообщение удалено') return M[i][3]; } return ''; }
function monOf(c){ return iso(c.t).slice(5,7); }
function weekStart(ts){ const d = Math.floor((ts + 10800) / DAY); return (d - ((d + 3) % 7)) * DAY - 10800; }
function cabsIn(){ return OP.cab === 'all' ? CABS : [OP.cab]; }
function cabTag(c){ return '<span class="op-cab" style="--slot:var(--cat-' + CABSLOT[c] + ')">' + E(c) + '</span>'; }
/* 1.3: статус точкой и словом, без цветной плашки */
function chip(t, tone, hint){ return KS.status(t, tone || 'neutral', hint); }
function prec(p){ return PRECISION[p] ? chip('проверено вручную: ' + PRECISION[p], 'ok', 'Правило проверено на живых диалогах: сколько срабатываний оказались верными') : chip('точность вручную не замерялась', 'warn', 'Правило работает, но его точность на живых диалогах не проверяли: используйте как ориентир'); }
function avitoUrl(id){ return 'https://www.avito.ru/profile/messenger/channel/' + encodeURIComponent(id); }
/* 1.4: широкая таблица живёт в своей области прокрутки, тогда липкая шапка держится внутри неё */
function scrollWrap(html){ return html.replace('class="ks-table-wrap"', 'class="ks-table-wrap ks-table-wrap--scroll"'); }
function goAttr(o){ return " data-go='" + JSON.stringify(o).replace(/'/g, '&#39;') + "'"; }

/* ---------------- выборки ---------------- */
function isClient(c){ return c.kind !== 'cold' && c.kind !== 'vendor' && c.nc > 0; }
function win(days){ if(days === 'all') return { from:0, to:EXPORT_TS + 1, pfrom:null, pto:null };
  const to = EXPORT_TS + 1, from = to - days * DAY; return { from, to, pfrom:from - days * DAY, pto:from }; }
function sel(o){ o = Object.assign({ cab:OP.cab, kind:'in' }, Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined)));
  return D.av.chats.filter(c => (o.cab === 'all' || c.cab === o.cab)
    && (o.kind === 'all' ? true : o.kind === 'in' ? isClient(c) : o.kind === 'self' ? (c.kind === 'in' && c.nc > 0) : c.kind === o.kind)
    && (o.from == null || c.t >= o.from) && (o.to == null || c.t < o.to)
    && (o.ad == null || o.ad === 'all' || c.ad === +o.ad)); }
function stats(L){
  const lags = L.map(c => c.lag).filter(x => x != null), n = L.length, pq = L.filter(c => c.pq).length;
  const cnt = k => L.filter(c => c.p.includes(k)).length;
  const hr = c => new Date((c.t + 10800) * 1000).getUTCHours();
  const eve = L.filter(c => hr(c) >= 18 || hr(c) < 9);
  return { n, med:med(lags), f15:share(lags.filter(x => x <= 900).length, n), cnt, pq,
    noresp:cnt('noresp'), quest:cnt('abandoned') + cnt('phoneleft'), noprice_p:share(cnt('noprice'), pq),
    eve_p:share(eve.length, n), eve_med:med(eve.map(c => c.lag)), day_med:med(L.filter(c => !eve.includes(c)).map(c => c.lag)) };
}
function callStats(L){
  const r = { out:0, inn:0, miss:0, durs:[] };
  L.forEach(c => { r.out += c.cout; r.inn += c.cin; r.miss += c.cmiss;
    if(c.cin || c.cout) (D.av.msgs[c.id] || []).forEach(m => { if(m[2] === 'c' && m[4] === 'success') r.durs.push(m[6]); }); });
  r.med = med(r.durs); return r;
}

/* ---------------- дельта к прошлому периоду ---------------- */
/* число с согласованным словом: 1 диалог, 2 диалога, 5 диалогов */
function dlgN(n){ const a = Math.abs(n) % 100, b = a % 10; return NF(n) + ' ' + (a > 10 && a < 20 ? 'диалогов' : b === 1 ? 'диалог' : b >= 2 && b <= 4 ? 'диалога' : 'диалогов'); }
const MIN_N = 10;   /* меньше 10 диалогов в прошлом периоде: сравнение это шум, дельту не показываем */
function dlt(now, was, fmt, goodUp, nPrev){
  if(OP.days === 'all') return '<div class="ks-delta is-na">весь ряд: сравнивать не с чем</div>';
  if(nPrev != null && nPrev < MIN_N) return '<div class="ks-delta is-na" data-tip="в прошлом периоде ' + dlgN(nPrev) + ', для сравнения нужно от ' + MIN_N + '">мало диалогов для сравнения</div>';
  if(now == null || was == null) return '<div class="ks-delta is-na">нет данных за прошлый период</div>';
  const abs = Math.round((now - was) * 10) / 10;
  if(abs === 0) return '<div class="ks-delta is-flat">без изменений</div>';
  const t = (abs > 0) === (goodUp !== false) ? 'good' : 'bad';
  const rel = Math.abs(was) >= MIN_N ? ' (' + (abs > 0 ? '+' : '') + Math.round(abs / was * 100) + '%)' : '';   /* процент от базы меньше 10 это шум */
  const title = 'было ' + fmt(was) + ' за прошлые ' + OP.days + ' дн, стало ' + fmt(now);
  return '<div class="ks-delta is-' + t + '" data-tip="' + E(title) + '">' + ic(abs > 0 ? 'arrow-up' : 'arrow-down', 12)
    + '<span class="ks-num">' + (abs > 0 ? '+' : '-') + fmt(Math.abs(abs)) + rel + '</span></div>';
}
const pp = v => String(v).replace('.', ',') + ' п.п.';
function env(v, cab, n){ return F(v, 'ДАННЫЕ', 'Авито API · ' + cab + (n != null ? ' · ' + n + ' диал.' : ''), AT); }
function periodLabel(){ return OP.days === 'all' ? 'весь ряд' : OP.days + ' дней до выгрузки'; }

/* ---------------- недели для графиков ---------------- */
function fullWeeks(k){ const last = weekStart(EXPORT_TS), out = []; for(let i = k; i >= 1; i--) out.push(last - i * 7 * DAY); return out; }
function weekSeries(fn, cab, kind){ return fullWeeks(12).map(w => fn(sel({ cab, kind, from:w, to:w + 7 * DAY }))); }

/* ---------------- отложенная отрисовка графиков ---------------- */
let JOBS = [], _raf = 0;
function job(f){ JOBS.push(f); }
/* счётчики и минуты не бывают отрицательными: у готового графика кита задаём низ оси 0 */
function floor0(ch){ if(ch && ch.updateOptions) ch.updateOptions({ yaxis:{ min:0, forceNiceScale:true, labels:{ style:{ fontSize:'11px' }, formatter:x => NF(Math.round(x)) } } }, false, false); }
function scheduleDraw(){ cancelAnimationFrame(_raf); _raf = requestAnimationFrame(() => { const j = JOBS; JOBS = []; j.forEach(f => { try{ f(); }catch(e){ console.error(e); } }); }); }

/* ==========================================================================
   ЭКРАНЫ
   ========================================================================== */
function head(o){ return KS.head(Object.assign({ badges:[KS.kind('ДАННЫЕ')] }, o)); }
function srcLine(){ return 'Авито API · ' + CABS.map(c => c + ' ' + fD(EXP[c])).join(', ') + ' МСК · ' + periodLabel(); }
function fresh(){
  const now = Math.max(Math.floor(Date.now() / 1000), EXPORT_TS), age = Math.floor((now - EXPORT_TS) / DAY);
  return KS.note(age >= 1 ? 'С выгрузки прошло ' + age + ' дн' : 'Данные свежие',
    'Выгрузка: ' + CABS.map(c => E(c) + ' ' + fD(EXP[c])).join(', ') + '. Перед ответом откройте чат в Авито: возможно, клиенту уже ответили. ' + E(OWNER_NOTE), age >= 1 ? 'warn' : 'info');
}

/* ---------- Пульс ОП ---------- */
function tilesFor(cab){
  const w = win(OP.days), cur = stats(sel({ cab, from:w.from, to:w.to })), prv = w.pfrom != null ? stats(sel({ cab, from:w.pfrom, to:w.pto })) : null;
  /* спарклайн: 12 полных недель, минуты для медианы; пропуск недели рвёт линию */
  const sp = fn => weekSeries(L => L.length ? fn(stats(L)) : null, cab);
  return '<div class="ks-grid-kpi">'
    + KS.tile({ label:'Медиана первого ответа · ' + cab, f:env(fL(cur.med), cab, cur.n), slot:CABSLOT[cab], icon:'clock', drill:'speed-' + cab, spark:sp(x => x.med == null ? null : Math.round(x.med / 60)),
        delta:dlt(cur.med, prv && prv.med, fL, false, prv && prv.n) })
    + KS.tile({ label:'Ответ за 15 минут · ' + cab, f:env(P(cur.f15), cab, cur.n), slot:CABSLOT[cab], icon:'bolt', drill:'f15-' + cab, spark:sp(x => x.f15),
        delta:dlt(cur.f15, prv && prv.f15, pp, true, prv && prv.n) })
    + KS.tile({ label:'Не ответили вообще · ' + cab, f:env(cur.noresp, cab, cur.n), slot:CABSLOT[cab], icon:'warn', drill:'noresp-' + cab, spark:sp(x => x.noresp),
        delta:dlt(cur.noresp, prv && prv.noresp, NF, false, prv && prv.n) })
    + KS.tile({ label:'Вопрос или телефон без ответа · ' + cab, f:env(cur.quest, cab, cur.n), slot:CABSLOT[cab], icon:'users', drill:'quest-' + cab, spark:sp(x => x.quest),
        delta:dlt(cur.quest, prv && prv.quest, NF, false, prv && prv.n) })
    + '</div>';
}
function verdict(){
  const w = win(OP.days); if(w.pfrom == null) return KS.note('Сравнить не с чем', 'Выбран весь ряд. Для вердикта выберите 7, 30 или 90 дней в шапке.', 'warn');
  /* третья точка: отрезок той же длины перед прошлым. Видно, не шум ли разница между двумя соседними отрезками */
  const p2from = w.pfrom - (w.pto - w.pfrom);
  const rows = [], add = (cab, name, now, was, pre, goodUp, fmt) => { if(now == null || was == null) return;
    const t = now === was ? 'flat' : ((now > was) === goodUp ? 'good' : 'bad'); rows.push({ cab, name, now, was, pre, t, fmt, goodUp }); };
  const few = [];
  cabsIn().forEach(cab => { const c = stats(sel({ cab, from:w.from, to:w.to })), p = stats(sel({ cab, from:w.pfrom, to:w.pto }));
    const q = stats(sel({ cab, from:p2from, to:w.pfrom })), qq = q.n >= MIN_N ? q : null;
    if(p.n < MIN_N || c.n < MIN_N){ few.push(cab + ' (' + p.n + ' и ' + c.n + ')'); return; }
    add(cab, 'медиана первого ответа', c.med, p.med, qq && qq.med, false, fL); add(cab, 'ответ за 15 минут', c.f15, p.f15, qq && qq.f15, true, P);
    add(cab, 'не ответили вообще', c.noresp, p.noresp, qq && qq.noresp, false, NF); add(cab, 'вопрос или телефон без ответа', c.quest, p.quest, qq && qq.quest, false, NF); });
  if(!rows.length) return KS.note('Сравнить не с чем', 'Меньше ' + MIN_N + ' диалогов в одном из периодов: ' + E(few.join(', ')) + '. Выберите период длиннее.', 'warn');
  const good = rows.filter(r => r.t === 'good').length, bad = rows.filter(r => r.t === 'bad').length;
  const headT = bad === 0 ? 'Стало лучше' : good === 0 ? 'Стало хуже' : 'Разнонаправленно';
  const tone = bad === 0 ? 'ok' : good === 0 ? 'crit' : 'warn';
  const body = rows.map(r => '<div class="ks-verdict-row">'
    + '<span class="ks-verdict-name">' + cabTag(r.cab) + ' ' + E(r.name) + '</span>'
    + '<span class="ks-verdict-path" data-tip="' + E('было ' + r.fmt(r.was) + ' за ' + fDay(w.pfrom) + '-' + fDay(w.pto - 1) + ', стало ' + r.fmt(r.now) + ' за ' + fDay(w.from) + '-' + fDay(w.to - 1)) + '">'
    +   '<span>' + E(r.fmt(r.was)) + '</span><span class="ks-muted">с ' + fDay(w.pfrom) + '</span><span class="ks-muted" aria-hidden="true">→</span>'
    +   '<b style="font-weight:var(--fw-semi)">' + E(r.fmt(r.now)) + '</b><span class="ks-muted">с ' + fDay(w.from) + '</span></span>'
    + '<span class="ks-delta-cell">' + dlt(r.now, r.was, r.fmt === fL ? fL : r.fmt === P ? pp : NF, r.goodUp) + '</span>'
    + '<span class="ks-verdict-prev"' + (r.pre == null ? ' data-tip="' + E('за ' + fDay(p2from) + '-' + fDay(w.pfrom - 1) + ' меньше ' + MIN_N + ' диалогов или выгрузка не доходит') + '">отрезком раньше: нет' : '>отрезком раньше ' + E(r.fmt(r.pre))) + '</span></div>').join('');
  return '<section class="ks-verdict ks-verdict--' + tone + '" aria-label="Вердикт">'
    + '<div class="ks-verdict-head">' + ic(tone === 'ok' ? 'up' : tone === 'crit' ? 'loss' : 'cmp', 18)
    + '<span class="ks-verdict-title">' + headT + '</span>'
    + '<span class="ks-verdict-per">за ' + OP.days + ' дней к прошлым ' + OP.days + ' · по каждому кабинету отдельно</span></div>'
    + '<div class="ks-verdict-rows">' + body + '</div>'
    + (few.length ? '<div class="ks-verdict-note">В вердикт не вошли: ' + E(few.join(', ')) + '. Меньше ' + MIN_N + ' диалогов в одном из периодов, сравнение было бы шумом.</div>' : '')
    + '</section>';
}
function weekCats(){ return fullWeeks(12).map(w => fDay(w)); }
const SCREENS = {};
SCREENS.pulse = function(){
  const cats = weekCats(), cabs = cabsIn();
  const medS = cabs.map(cab => ({ name:cab, slot:CABSLOT[cab], data:weekSeries(L => { const m = stats(L).med; return m == null ? null : Math.round(m / 60); }, cab) }));
  const cntS = cabs.map(cab => ({ name:cab, slot:CABSLOT[cab], data:weekSeries(L => L.length, cab) }));
  job(() => floor0(KS.charts.multi('ch-med', { cats, series:medS, h:260 })));
  job(() => floor0(KS.charts.multi('ch-cnt', { cats, series:cntS, h:260 })));
  const twin = S => KS.table([['Неделя с']].concat(S.map(s => [s.name, true])), cats.map((c, i) => [c].concat(S.map(s => s.data[i] == null ? null : NF(s.data[i])))));
  const w = win(OP.days);
  const priceCard = KS.card({ title:'Спросили цену, суммы нет', sub:'Доля от тех, кто спросил про цену · ' + periodLabel(),
    body:'<div class="ks-stack" style="gap:var(--sp-2)">' + cabs.map(cab => { const s = stats(sel({ cab, from:w.from, to:w.to }));
      return '<div class="ks-row" style="justify-content:space-between">' + cabTag(cab) + '<span><b class="ks-strong">' + P(s.noprice_p) + '</b> <span class="ks-muted">' + s.cnt('noprice') + ' из ' + s.pq + '</span></span></div>'; }).join('')
      + '<div>' + prec('noprice') + '</div><div class="op-hint">Утвердить один ответ про цену с числом. Через неделю сравнить в таблице по неделям.</div></div>',
    actions:'<button type="button" class="ks-btn ks-btn--ghost ks-btn--sm"' + goAttr({ view:'dlg', prob:'noprice' }) + '>диалоги</button>' });
  const callCard = KS.card({ title:'Звонки через Авито', sub:'Все чаты, включая те, где клиент только звонил · ' + periodLabel(),
    body:KS.table([['Кабинет'],['Исходящих', true],['Принято входящих', true],['Пропущено входящих', true],['Медиана разговора', true]],
      cabs.map(cab => { const r = callStats(sel({ cab, kind:'all', from:w.from, to:w.to }));
        return [cabTag(cab), NF(r.out), NF(r.inn), NF(r.miss) + ' <span class="ks-muted">из ' + NF(r.inn + r.miss) + '</span>', r.med == null ? null : Math.round(r.med) + ' с']; }))
      + '<div class="op-hint" style="margin-top:var(--sp-2)">Звонки с мобильного Авито не видит: их надо проверять по телефону или в Bitrix24. Правило: на каждый пропущенный перезвонить в течение часа.</div>',
    actions:'<button type="button" class="ks-btn ks-btn--ghost ks-btn--sm"' + goAttr({ view:'calls' }) + '>подробнее</button>' });
  const ads = D.av.ads.map((a, i) => ({ i, a, L:sel({ ad:i, from:w.from, to:w.to }) })).filter(x => x.L.length >= 10).sort((x, y) => y.L.length - x.L.length).slice(0, 7);
  const probs = ['slow','noprice','noquestion','nofollow'];
  const mtx = '<div class="ks-table-wrap ks-table-wrap--scroll"><table class="ks-table"><thead><tr><th scope="col">Объявление</th><th class="is-num" scope="col">Диалогов</th>'
    + probs.map(p => '<th class="is-num" scope="col" data-tip="' + E(PROB[p].rule) + '">' + E({ slow:'Ответ дольше часа', noprice:'Цена без суммы', noquestion:'Без вопроса клиенту', nofollow:'Нет дожима' }[p]) + '</th>').join('') + '</tr></thead><tbody>'
    + ads.map(x => { const pq = x.L.filter(c => c.pq).length;
      return '<tr class="is-interactive" tabindex="0"' + goAttr({ view:'dlg', ad:String(x.i), prob:'all' }) + '><td>' + E(x.a) + '</td><td class="is-num">' + x.L.length + '</td>'
        + probs.map(p => '<td class="is-num">' + P(share(x.L.filter(c => c.p.includes(p)).length, p === 'noprice' ? pq : x.L.length)) + '</td>').join('') + '</tr>'; }).join('')
    + '</tbody></table></div>';
  const warn = cabs.map(cab => cabTag(cab) + ' ' + sel({ cab, from:w.from, to:w.to }).filter(c => c.p.includes('warranty')).length).join(' · ');
  return head({ title:'Пульс отдела продаж', sub:'Где теряем клиентов в переписке Авито и стало ли лучше за выбранный период. ' + OWNER_NOTE, src:srcLine(),
      lead:'Денег в чатах Авито нет: переписка не знает, чем закончилась сделка. Сумма заказов появится после связки с Bitrix24 по телефону клиента. Каждый клиент на этом экране уже сам пришёл в объявление.' })
    + '<div class="ks-stack">'
    + verdict()
    + cabs.map(tilesFor).join('')
    + '<div class="ks-grid-2">'
    + KS.card({ title:'Медиана первого ответа по неделям', sub:'Минут · 12 полных недель, пн-вс · одна ось', body:KS.chart('ch-med', 260), table:twin(medS) })
    + KS.card({ title:'Обращений в неделю', sub:'Клиенты, которые писали сами или ответили на рассылку', body:KS.chart('ch-cnt', 260), table:twin(cntS) })
    + '</div>'
    + '<div class="ks-grid-2">' + priceCard + callCard + '</div>'
    + KS.card({ title:'Объявления и проблемы', sub:'Доля диалогов с проблемой по объявлению, от 10 диалогов за период. Строка открывает диалоги.', body:ads.length ? mtx : '<div class="ks-muted">За период мало диалогов.</div>' })
    + KS.note('Срок гарантии называют без опоры на базу', 'Диалогов с гарантией в годах за период: ' + warn + '. В базе знаний (PRL v6) гарантия GLASS-MEMORY «по договору». Говорить «гарантия по договору», срок не называть, пока его не сверят с шаблоном договора. ' + prec('warranty'), 'warn')
    + KS.action({ what:'Сравнить неделю 14-20.09 с неделей 28.09-04.10: медиана первого ответа, «не ответили вообще», вопрос или телефон без ответа, перезвон по оставленным телефонам.',
        who:'Иван и РОП', when:MILESTONE, crit:'медиана первого ответа ниже, чем 14-20.09, в обоих кабинетах, и ни одного диалога «не ответили вообще» старше суток' })
    + KS.card({ title:'Как читать экран', body:KS.steps([
        ['Сначала вердикт', 'он сравнивает выбранный период с таким же периодом раньше, по каждому кабинету отдельно'],
        ['Кабинеты не складываются', 'OLD-G и NEW-B считаются раздельно: у них разные объявления и разная динамика'],
        ['Любая плитка открывает детали', 'из чего сложилась цифра, как менялась по неделям, откуда взята и что делать'] ]) })
    + '</div>';
};

/* ---------- Сегодня ---------- */
SCREENS.today = function(){
  const since = OP.today === 'all' ? 0 : EXPORT_TS - OP.today * DAY;
  const now = Math.max(Math.floor(Date.now() / 1000), EXPORT_TS), age = t => Math.floor((now - t) / DAY);
  const base = D.av.chats.filter(c => (OP.cab === 'all' || c.cab === OP.cab) && isClient(c) && c.lw === 'c' && (c.lc || c.t) >= since);
  const st = [
    { k:'compl', t:'Жалоба клиента', why:'Клиент пишет о проблеме с изделием. На это отвечают первым.', hint:'Извинитесь, попросите фото, скажите, когда перезвоните. Передайте РОПу.' },
    { k:'noresp', t:'Клиент ждёт ответа', why:'Написал нам, а живого ответа не получил.', hint:'Назовите клиента по имени, извинитесь за паузу и ответьте на его вопрос. В конце задайте один вопрос: размер или фото.' },
    { k:'abandoned', t:'Клиент задал вопрос последним', why:'Мы отвечали, клиент спросил ещё, и тишина.', hint:'Ответьте на его последнее сообщение. Если вопрос про цену, назовите «от» и за какой размер.' },
    { k:'phoneleft', t:'Оставил телефон', why:'Прислал номер, после этого в чате тишина. Звонок с мобильного Авито не видит.', hint:'Проверьте, что клиенту перезвонили. Если нет, позвоните сегодня.' },
    { k:'noprice', t:'Спросил цену, суммы не было', why:'Спросил, сколько стоит, и написал последним.', hint:'Назовите цену «от» и за какой размер, по утверждённому ответу отдела. Спросите размер, чтобы посчитать точно.' } ];
  const seen = new Set();
  const stacks = st.map(x => { const L = base.filter(c => (x.k === 'compl' ? c.compl : c.p.includes(x.k)) && !seen.has(c.id)).sort((a, b) => (b.lc || b.t) - (a.lc || a.t)); L.forEach(c => seen.add(c.id)); return Object.assign({ L }, x); });
  const total = stacks.reduce((a, x) => a + x.L.length, 0);
  const card = (c, x) => { const said = lastClient(c), t = c.lc || c.t;
    return '<section class="ks-card op-q"><div class="op-q-name">' + E(firstName(c.cn)) + ' ' + cabTag(c.cab) + '</div>'
      + '<div class="op-q-wait">написал ' + fD(t) + ', ' + (age(t) < 1 ? 'меньше суток назад' : age(t) + ' дн назад') + '</div>'
      + (said ? '<div class="op-q-said">«' + E(said.slice(0, 220)) + (said.length > 220 ? '...' : '') + '»</div>' : '')
      + '<div class="op-q-hint"><b>Что сделать:</b> ' + E(x.hint) + '</div>'
      + '<div class="op-q-meta">' + E(adName(c.ad)) + '</div>'
      + '<div class="ks-row"><a class="ks-btn ks-btn--secondary" href="' + avitoUrl(c.id) + '" target="_blank" rel="noopener">' + ic('external', 15) + 'Открыть в Авито</a>'
      + '<button type="button" class="ks-btn ks-btn--ghost" data-th="' + E(c.id) + '">Посмотреть переписку</button></div></section>'; };
  const seg = [[3,'3 дня'],[14,'2 недели'],[30,'месяц'],['all','всё время']].map(([v, l]) => '<button type="button" data-today="' + v + '" aria-pressed="' + (String(OP.today) === String(v)) + '">' + l + '</button>').join('');
  return head({ title:'Сегодня', sub:'Кому ответить в первую очередь. Здесь только чаты, где последним написал клиент.', src:srcLine(),
      lead:'Каждый клиент в этой очереди уже сам написал нам. Сумма заказа видна в Bitrix24, не в Авито.' })
    + '<div class="ks-stack">' + fresh()
    + '<div class="ks-row"><span class="op-muted">Клиент писал за</span><div class="ks-seg" role="group" aria-label="Срок">' + seg + '</div>'
    + '<span class="op-count">всего ответить: <b>' + total + '</b></span></div>'
    + stacks.map(x => '<div class="op-queue"><div class="op-stack-head"><h2 class="ks-h2">' + E(x.t) + '</h2>' + KS.badge(String(x.L.length), x.L.length ? 'crit' : 'ok') + '</div>'
      + '<p class="op-stack-why">' + E(x.why) + '</p>'
      + (x.L.length ? x.L.slice(0, 10).map(c => card(c, x)).join('') : '<div class="op-muted">За выбранный срок здесь пусто.</div>')
      + (x.L.length > 10 ? '<div><button type="button" class="ks-btn ks-btn--secondary ks-btn--sm"' + goAttr({ view:'dlg', prob:x.k === 'compl' ? 'all' : x.k, flag:x.k === 'compl' ? 'compl' : 'all' }) + '>показать все ' + x.L.length + '</button></div>' : '')
      + '</div>').join('')
    + '</div>';
};

/* ---------- Скорость ответа ---------- */
SCREENS.speed2 = function(){
  const cabs = cabsIn(), w = win(OP.days), mons = Object.keys(MON), cats = mons.map(m => MON[m] + (m === '09' ? ' (до 22)' : ''));
  const byMon = cabs.map(cab => ({ name:cab, slot:CABSLOT[cab], data:mons.map(m => { const L = sel({ cab }).filter(c => monOf(c) === m); const v = stats(L).med; return v == null ? null : Math.round(v / 60); }) }));
  job(() => floor0(KS.charts.multi('ch-mon', { cats, series:byMon, h:260 })));
  const Lall = sel({ from:w.from, to:w.to }), cell = {};
  Lall.forEach(c => { const d = new Date((c.t + 10800) * 1000), k = ((d.getUTCDay() + 6) % 7) + '_' + d.getUTCHours(); (cell[k] = cell[k] || []).push(c.lag); });
  const hours = Array.from({ length:24 }, (_, h) => String(h)), matrix = WD.map((_, d) => hours.map((__, h) => (cell[d + '_' + h] || []).length));
  const mx = Math.max(1, ...matrix.flat()), q = Math.max(1, Math.ceil(mx / 5));
  const ranges = [0,1,2,3,4].map(i => [i === 0 ? 0 : i * q + 1, i === 4 ? Math.max(mx, 4 * q + 1) : (i + 1) * q]);
  job(() => KS.charts.heat('ch-heat', { rows:WD, cols:hours, matrix, ranges, h:300 }));
  const bk = [[0,900,'до 15 мин'],[900,3600,'15-60 мин'],[3600,14400,'1-4 часа'],[14400,DAY,'4-24 часа'],[DAY,1e12,'больше суток']];
  const dist = cabs.map(cab => { const L = sel({ cab, from:w.from, to:w.to }), n = L.length;
    return KS.card({ title:'Как быстро отвечаем · ' + cab, sub:dlgN(n) + ' · ' + periodLabel(),
      body:KS.bars(bk.map(([a, b, l]) => { const k = L.filter(c => c.lag != null && c.lag >= a && c.lag < b).length; return [l, k, P(share(k, n))]; })
        .concat([[ 'живого ответа не было', L.filter(c => c.p.includes('noresp')).length, P(share(L.filter(c => c.p.includes('noresp')).length, n)) ]]), CABSLOT[cab]) }); }).join('');
  const tiles = cabs.map(cab => { const s = stats(sel({ cab, from:w.from, to:w.to })), p = w.pfrom != null ? stats(sel({ cab, from:w.pfrom, to:w.pto })) : null;
    return '<div class="ks-grid-kpi">'
      + KS.tile({ label:'Медиана · ' + cab, f:env(fL(s.med), cab, s.n), slot:CABSLOT[cab], icon:'clock', drill:'speed-' + cab, delta:dlt(s.med, p && p.med, fL, false, p && p.n) })
      + KS.tile({ label:'Днём, 9-18 · ' + cab, f:env(fL(s.day_med), cab), slot:CABSLOT[cab], icon:'sun', delta:dlt(s.day_med, p && p.day_med, fL, false, p && p.n) })
      + KS.tile({ label:'Вечер и ночь · ' + cab, f:env(fL(s.eve_med), cab), slot:CABSLOT[cab], icon:'moon', delta:dlt(s.eve_med, p && p.eve_med, fL, false, p && p.n) })
      + KS.tile({ label:'Обращений вечером и ночью · ' + cab, f:env(P(s.eve_p), cab), slot:CABSLOT[cab], icon:'calendar', delta:dlt(s.eve_p, p && p.eve_p, pp, false, p && p.n) })
      + '</div>'; }).join('');
  return head({ title:'Скорость первого ответа', sub:'Сколько клиент ждал от первого своего сообщения до первого ответа живого человека. Автоответы и напоминания робота Авито ответом не считаются.', src:srcLine(),
      lead:'Денег по скорости ответа посчитать нельзя: исход сделки в Авито не виден. Связь «скорость ответа - деньги» появится после связки с Bitrix24.' })
    + '<div class="ks-stack">' + tiles
    + '<div class="ks-grid-2">'
    + KS.card({ title:'Медиана по месяцам', sub:'Минут · сентябрь неполный, до 22.09 · весь ряд', body:KS.chart('ch-mon', 260),
        table:KS.table([['Месяц']].concat(byMon.map(s => [s.name, true])), cats.map((c, i) => [c].concat(byMon.map(s => s.data[i] == null ? null : NF(s.data[i]) + ' мин')))) })
    + KS.card({ title:'Когда пишут клиенты', sub:'Число обращений по дню недели и часу, МСК · ' + periodLabel(), body:KS.chart('ch-heat', 300),
        table:scrollWrap(KS.table([['День']].concat(hours.map(h => [h, true])), WD.map((d, i) => [d].concat(matrix[i].map(NF))), { stack:false })) })
    + '</div><div class="ks-grid-2">' + dist + '</div>'
    + KS.note('Что значат цифры', 'Медиана: половина клиентов ждала меньше, половина дольше. Среднее не используем: один ответ через неделю испортил бы всё. Вечер и ночь: с 18:00 до 9:00 по Москве.', 'info')
    + KS.action({ what:'Сравнить медиану первого ответа и долю ответов за 15 минут: неделя 28.09-04.10 против 14-20.09, по каждому кабинету.', who:'Иван и РОП', when:MILESTONE, crit:'медиана ниже и доля за 15 минут выше в обоих кабинетах' })
    + '</div>';
};

/* ---------- Типовые проблемы ---------- */
SCREENS.probs = function(){
  const cabs = cabsIn(), w = win(OP.days), all = sel({ from:w.from, to:w.to });
  const order = PORDER.slice().sort((a, b) => all.filter(c => c.p.includes(b)).length - all.filter(c => c.p.includes(a)).length);
  return head({ title:'Типовые проблемы', sub:'Каждая проблема найдена программой по правилу, а не на глаз. Вверху самые частые.', src:srcLine(),
      lead:'Сколько денег теряет каждая проблема, по Авито не посчитать: исход сделки в чате не виден. Счёт в диалогах, не в рублях.' })
    + '<div class="ks-grid-2">'
    + order.map(p => { const items = cabs.map(cab => { const L = sel({ cab, from:w.from, to:w.to }), base = p === 'noprice' ? L.filter(c => c.pq).length : L.length, k = L.filter(c => c.p.includes(p)).length;
        return [cab, k, P(share(k, base)) + (p === 'noprice' ? ' спросивших' : ' диалогов')]; });
      return KS.card({ title:PROB[p].l, sub:PROB[p].rule,
        body:'<div class="ks-stack" style="gap:var(--sp-3)">' + KS.bars(items, 3) + '<div>' + prec(p) + '</div><div class="op-hint"><b>Что делать:</b> ' + E(PROB[p].todo) + '</div></div>',
        actions:'<button type="button" class="ks-btn ks-btn--ghost ks-btn--sm"' + goAttr({ view:'dlg', prob:p }) + '>диалоги</button>' }); }).join('')
    + KS.action({ what:'Сверить счётчики трёх самых частых проблем: неделя 28.09-04.10 против 14-20.09. Кнопка «диалоги» у проблемы открывает сами переписки.', who:'Иван и РОП', when:MILESTONE, crit:'каждый из трёх счётчиков за неделю ниже, чем 14-20.09' })
    + '</div>';
};

/* ---------- Объявления ---------- */
SCREENS.ads = function(){
  const w = win(OP.days);
  const rows = D.av.ads.map((a, i) => { const L = sel({ ad:i, kind:'all', from:w.from, to:w.to }), T = L.filter(isClient); if(!L.length) return null;
    const pq = T.filter(c => c.pq).length;
    return { i, a, n:L.length, t:T.length, g:L.filter(c => c.cab === 'OLD-G').length, b:L.filter(c => c.cab === 'NEW-B').length, med:med(T.map(c => c.lag)),
      np:share(T.filter(c => c.p.includes('noprice')).length, pq), q:share(T.filter(c => c.p.includes('abandoned') || c.p.includes('phoneleft')).length, T.length), nf:share(T.filter(c => c.p.includes('nofollow')).length, T.length) }; })
    .filter(Boolean).sort((x, y) => y.n - x.n);
  const tbl = '<div class="ks-table-wrap ks-table-wrap--scroll"><table class="ks-table"><thead><tr>' + ['Объявление','Всего чатов','OLD-G','NEW-B','Клиенты','Медиана ответа','Цена без суммы','Вопрос без ответа','Нет дожима']
      .map((h, i) => '<th scope="col"' + (i ? ' class="is-num"' : '') + '>' + h + '</th>').join('') + '</tr></thead><tbody>'
    + rows.map(r => '<tr class="is-interactive" tabindex="0"' + goAttr({ view:'dlg', ad:String(r.i), prob:'all' }) + '><td>' + E(r.a) + '</td><td class="is-num">' + r.n + '</td><td class="is-num">' + r.g + '</td><td class="is-num">' + r.b
      + '</td><td class="is-num">' + r.t + '</td><td class="is-num">' + fL(r.med) + '</td><td class="is-num">' + P(r.np) + '</td><td class="is-num">' + P(r.q) + '</td><td class="is-num">' + P(r.nf) + '</td></tr>').join('')
    + '</tbody></table></div>';
  return head({ title:'Объявления', sub:'С какого объявления пришёл клиент и как с ним поговорили. Строка открывает диалоги этого объявления.', src:srcLine(),
      lead:'Расход на объявления в выгрузку не входит, поэтому цену клиента по объявлению посчитать нельзя. Нужна выгрузка расходов Авито.' })
    + KS.card({ title:'Все объявления', sub:'Всего чатов включает холодную рассылку и не клиентов · «Цена без суммы» от тех, кто спросил цену', body:tbl });
};

/* ---------- Звонки ---------- */
SCREENS.calls = function(){
  const cabs = cabsIn(), w = win(OP.days);
  const tiles = cabs.map(cab => { const r = callStats(sel({ cab, kind:'all', from:w.from, to:w.to })), p = w.pfrom != null ? callStats(sel({ cab, kind:'all', from:w.pfrom, to:w.pto })) : null;
    return '<div class="ks-grid-kpi">'
      + KS.tile({ label:'Исходящих через Авито · ' + cab, f:env(r.out, cab), slot:CABSLOT[cab], icon:'arrow-up', delta:dlt(r.out, p && p.out, NF, true) })
      + KS.tile({ label:'Принято входящих · ' + cab, f:env(r.inn, cab), slot:CABSLOT[cab], icon:'arrow-down', delta:dlt(r.inn, p && p.inn, NF, true) })
      + KS.tile({ label:'Пропущено входящих · ' + cab, f:env(r.miss, cab), slot:CABSLOT[cab], icon:'warn', delta:dlt(r.miss, p && p.miss, NF, false) })
      + KS.tile({ label:'Медиана разговора · ' + cab, f:env(r.med == null ? null : Math.round(r.med) + ' с', cab), slot:CABSLOT[cab], icon:'clock', delta:dlt(r.med, p && p.med, x => Math.round(x) + ' с', true) })
      + '</div>'; }).join('');
  const L = sel({ kind:'all', from:w.from, to:w.to }).filter(c => c.cin || c.cmiss || c.cout).sort((a, b) => b.last - a.last);
  return head({ title:'Звонки', sub:'Звонки через Авито: клиент нажал «позвонить» в объявлении, и наши звонки клиенту.', src:srcLine(),
      lead:'Сумм по звонкам нет: итог разговора Авито не сохраняет.' })
    + '<div class="ks-stack">' + tiles
    + KS.note('Главное', 'Через Авито менеджеры почти не звонят сами. Звонки с мобильного Авито не видит, их надо проверять по телефону или в Bitrix24. Пропущенный входящий без перезвона - это клиент, который уже набрал нас и ушёл.', 'warn')
    + KS.card({ title:'Диалоги со звонками', sub:(L.length > 40 ? 'последние 40 из ' + L.length : L.length) + ' за период · нажмите строку, чтобы открыть переписку',
        body:L.length ? '<div class="op-list">' + L.slice(0, 40).map(dcard).join('') + '</div>' : '<div class="ks-muted">Звонков за период нет.</div>' })
    + KS.action({ what:'Сравнить число пропущенных входящих: неделя 28.09-04.10 против 14-20.09. Перезвоны сверить по Bitrix24: Авито звонки с мобильного не видит.', who:'Иван и РОП', when:MILESTONE, crit:'пропущенных меньше, по каждому есть перезвон в Bitrix24' })
    + '</div>';
};

/* строки диалогов одним списком внутри одной карточки, без карточек в карточке */
function dlist(L){ return KS.card({ body:'<div class="op-list">' + L.map(dcard).join('') + '</div>' }); }

/* ---------- Холодная рассылка ---------- */
SCREENS.cold = function(){
  const cabs = cabsIn(), w = win(OP.days), mons = Object.keys(MON), cats = mons.map(m => MON[m] + (m === '09' ? ' (до 22)' : ''));
  const sent = L => L.filter(c => c.kind === 'cold' || c.kind === 'cold_reply').length;
  const S = cabs.map(cab => ({ name:cab, slot:CABSLOT[cab], data:mons.map(m => sent(sel({ cab, kind:'all' }).filter(c => monOf(c) === m))) }));
  job(() => floor0(KS.charts.multi('ch-cold', { cats, series:S, h:260 })));
  const tiles = cabs.map(cab => { const L = sel({ cab, kind:'all', from:w.from, to:w.to }), s = sent(L), r = L.filter(c => c.kind === 'cold_reply').length;
    const Lp = w.pfrom != null ? sel({ cab, kind:'all', from:w.pfrom, to:w.pto }) : null, sp = Lp && sent(Lp), rp = Lp && Lp.filter(c => c.kind === 'cold_reply').length;
    return '<div class="ks-grid-kpi">'
      + KS.tile({ label:'Отправлено · ' + cab, f:env(s, cab), slot:CABSLOT[cab], icon:'mega', delta:dlt(s, sp, NF, true) })
      + KS.tile({ label:'Клиент ответил · ' + cab, f:env(r, cab), slot:CABSLOT[cab], icon:'users', delta:dlt(r, rp, NF, true) })
      + KS.tile({ label:'Доля ответивших · ' + cab, f:env(P(share(r, s)), cab), slot:CABSLOT[cab], icon:'target', delta:dlt(share(r, s), sp ? share(rp, sp) : null, pp, true) })
      + '</div>'; }).join('');
  return head({ title:'Холодная рассылка', sub:'Сообщение тем, кто смотрел объявление, но не написал. Считается отдельно от входящих, иначе портит скорость ответа.', src:srcLine(),
      lead:'Стоимость рассылки в выгрузку не входит, поэтому окупаемость посчитать нельзя.' })
    + '<div class="ks-stack">' + tiles
    + KS.card({ title:'Сколько отправили по месяцам', sub:'Весь ряд · сентябрь до 22.09', body:KS.chart('ch-cold', 260),
        table:KS.table([['Месяц']].concat(S.map(s => [s.name, true])), cats.map((c, i) => [c].concat(S.map(s => NF(s.data[i]))))) })
    + KS.card({ title:'Шаблон, который уходит', body:'<div class="op-tpl">Добрый день! Вы просматривали наше объявление, можем подробно рассказать о производимых нами изделиях...</div>' })
    + '</div>';
};

/* ---------- Все диалоги ---------- */
function dcard(c){
  const said = lastClient(c), M = D.av.msgs[c.id] || [];
  const marks = [c.compl ? chip('жалоба', 'crit') : '', c.phone ? chip('оставил телефон', 'warn') : '', c.cin || c.cmiss ? chip('звонок') : '',
    c.b2b ? chip('партнёр или опт', 'info') : '', c.both ? chip('писал в оба кабинета', 'info') : '', c.kind === 'vendor' ? chip('не клиент') : ''].join('');
  return '<div class="op-li is-interactive" role="button" tabindex="0" data-th="' + E(c.id) + '">'
    + '<div class="op-dlg-head"><span class="op-dlg-name">' + E(firstName(c.cn)) + '</span>' + cabTag(c.cab) + '<span>' + fD(c.t) + '</span><span>' + E(adName(c.ad).slice(0, 44)) + '</span>'
    + (c.lag != null ? '<span>первый ответ через ' + fL(c.lag) + '</span>' : '') + '</div>'
    + (said ? '<div class="op-dlg-said">«' + E(said.slice(0, 180)) + (said.length > 180 ? '...' : '') + '»</div>' : '')
    + '<div class="op-chips">' + c.p.map(p => chip(PROB[p].l, HOT.includes(p) ? 'crit' : 'neutral', PROB[p].rule)).join('') + (c.p.length ? '' : chip('без замечаний', 'ok')) + marks
    + '<span class="op-muted">' + M.length + ' сообщ.</span></div></div>';
}
SCREENS.dlg = function(){
  const f = OP.dlg, w = win(OP.days);
  let L = sel({ kind:f.kind, ad:f.ad, from:w.from, to:w.to });
  if(f.prob !== 'all') L = L.filter(c => c.p.includes(f.prob));
  const FL = { call:c => c.cin || c.cmiss || c.cout, last:c => c.p.includes('abandoned'), phone:c => c.phone, both:c => c.both, b2b:c => c.b2b, compl:c => c.compl, clean:c => c.nc > 0 && !c.p.length };
  if(FL[f.flag]) L = L.filter(FL[f.flag]);
  if(f.q.trim()){ const q = f.q.toLowerCase(); L = L.filter(c => (c.cn + ' ' + (D.av.msgs[c.id] || []).map(m => m[3]).join(' ')).toLowerCase().includes(q)); }
  const SORT = { recent:(a, b) => b.t - a.t, wait:(a, b) => (b.lag == null ? -1 : b.lag) - (a.lag == null ? -1 : a.lag), worst:(a, b) => b.p.length - a.p.length || b.t - a.t, old:(a, b) => a.t - b.t };
  L = L.slice().sort(SORT[f.sort] || SORT.recent);
  const opt = (arr, cur) => arr.map(([v, l]) => '<option value="' + E(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + E(l) + '</option>').join('');
  const field = (label, id, html) => '<label class="ks-field"><span class="ks-field-label">' + label + '</span>' + html.replace('<select', '<select id="' + id + '"') + '</label>';
  return head({ title:'Все диалоги Авито', sub:'Каждая переписка с точным временем сообщений. Карточка открывает переписку целиком.', src:srcLine(),
      lead:'Сумма сделки в переписке не видна: её надо смотреть в Bitrix24.' })
    + '<div class="ks-stack">'
    + KS.card({ title:'Фильтры', body:'<div class="op-filters">'
        + field('Проблема', 'f-prob', '<select class="ks-select">' + opt([['all','любая']].concat(PORDER.map(p => [p, PROB[p].l])), f.prob) + '</select>')
        + field('Объявление', 'f-ad', '<select class="ks-select">' + opt([['all','все объявления']].concat(D.av.ads.map((a, i) => [String(i), a.slice(0, 60)])), f.ad) + '</select>')
        + field('Отметка', 'f-flag', '<select class="ks-select">' + opt([['all','любая'],['compl','жалоба'],['last','клиент задал вопрос последним'],['phone','оставил телефон'],['call','был звонок'],['b2b','партнёр или опт'],['both','писал в оба кабинета'],['clean','без замечаний']], f.flag) + '</select>')
        + field('Кто начал', 'f-kind', '<select class="ks-select">' + opt([['in','все клиенты'],['self','клиент написал сам'],['cold_reply','ответил на рассылку'],['all','все чаты, включая не клиентов']], f.kind) + '</select>')
        + field('Порядок', 'f-sort', '<select class="ks-select">' + opt([['recent','сначала свежие'],['wait','дольше ждали ответа'],['worst','больше проблем'],['old','сначала старые']], f.sort) + '</select>')
        + '<label class="ks-field" style="grid-column:span 1"><span class="ks-field-label">Поиск</span><input class="ks-input" id="f-q" placeholder="слово в переписке или имя" value="' + E(f.q) + '"></label>'
        + '</div>' })
    + '<div class="op-count">Найдено: <b>' + L.length + '</b> · ' + periodLabel() + (OP.cab === 'all' ? ' · оба кабинета' : ' · ' + E(CABNAME[OP.cab])) + '</div>'
    + (L.length ? dlist(L.slice(0, f.limit)) : KS.note('Ничего не нашлось', 'Попробуйте период «весь ряд» в шапке или снимите фильтры.', 'info'))
    + (L.length > f.limit ? '<div class="op-more"><button type="button" class="ks-btn ks-btn--secondary" id="f-more">показать ещё ' + Math.min(40, L.length - f.limit) + '</button></div>' : '')
    + '</div>';
};
function wireDlg(){
  const f = OP.dlg, on = (id, ev, fn) => { const n = document.getElementById(id); if(n) n.addEventListener(ev, fn); };
  ['prob','ad','flag','kind','sort'].forEach(k => on('f-' + k, 'change', e => { f[k] = e.target.value; f.limit = 40; render(); }));
  on('f-more', 'click', () => { f.limit += 40; render(); });
  on('f-q', 'input', e => { f.q = e.target.value; f.limit = 40; clearTimeout(wireDlg._t);
    wireDlg._t = setTimeout(() => { render(); const n = document.getElementById('f-q'); if(n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 300); });
}

/* ---------- Откуда цифры ---------- */
SCREENS.data = function(){
  const R = D.av.recon, nAuto = D.av.chats.reduce((a, c) => a + (D.av.msgs[c.id] || []).filter(m => m[1] === 'a').length, 0);
  const vendors = D.av.chats.filter(c => c.kind === 'vendor').length, b2b = D.av.chats.filter(c => c.b2b && c.kind !== 'vendor').length;
  const miss = R['NEW-B'].miss || {};
  return head({ title:'Откуда цифры', sub:'Что есть в выгрузке, как считаем и чего в данных нет.', src:srcLine(),
      lead:'Деньги в эту выгрузку не входят. Чтобы они появились, нужна связка чатов с Bitrix24 по телефону клиента.' })
    + '<div class="ks-stack">'
    + KS.card({ title:'Источники', body:KS.table([['Кабинет'],['Аккаунт Авито'],['Чатов в JSON', true],['Сообщений', true],['Строк в CSV', true],['Выгружено']],
        CABS.map(c => [cabTag(c), c === 'OLD-G' ? 'GLASS MEMORY (старый)' : 'Glass Memory (новый)', NF(R[c].json_chats), NF(R[c].json_msgs), NF(R[c].csv_rows), fD(EXP[c]) + ' МСК']), { stack:true }) })
    + KS.note('Сверка', 'У OLD-G число чатов в JSON и CSV совпадает: ' + R['OLD-G'].json_chats + ' = ' + R['OLD-G'].csv_rows + '. У NEW-B CSV обрывается на ' + E(R['NEW-B'].csv_max)
        + ', поэтому в нём ' + R['NEW-B'].csv_rows + ' строк против ' + R['NEW-B'].json_chats + ' в JSON. Чатов, которых нет в CSV, ' + (R['NEW-B'].json_chats - R['NEW-B'].csv_rows)
        + ': созданы в сентябре ' + (miss.sep || 0) + ', с 22 по 31 августа ' + (miss.late_aug || 0) + ', в середине августа ' + (miss.mid || 0) + ', раньше апреля ' + (miss.old || 0)
        + '. Почему часть августовских чатов не попала в CSV, по файлам установить нельзя. Везде на сайте используется JSON. В выгрузку попали и старые чаты: OLD-G ' + R['OLD-G'].before_apr + ', NEW-B ' + R['NEW-B'].before_apr
        + '. В каждом чате хранится не больше 100 последних сообщений.', 'info')
    + KS.card({ title:'Что считаем и как', body:'<dl class="op-defs">'
        + '<div><dt>Клиент</dt><dd>Написал нам сам или ответил на рассылку. Не клиенты: поставщики, соискатели и тесты (' + vendors + ' чатов) и холодная рассылка без ответа. Партнёрские и оптовые запросы (' + b2b + ') остаются клиентами с отметкой.</dd></div>'
        + '<div><dt>Первый ответ</dt><dd>От первого текстового сообщения клиента до первого сообщения живого человека. Автоответы (' + nAuto + ' шт.), звонки и напоминания робота Авито ответом не считаются. Удалённые сообщения клиента не считаются его текстом.</dd></div>'
        + '<div><dt>Медиана</dt><dd>Половина клиентов ждала меньше, половина дольше. Среднее не используем: один ответ через неделю испортил бы всё.</dd></div>'
        + '<div><dt>Период и дельта</dt><dd>Период в шапке отсчитывается назад от момента выгрузки по первому сообщению клиента. Дельта сравнивает его с таким же отрезком раньше.</dd></div>'
        + PORDER.map(p => '<div><dt>' + E(PROB[p].l) + ' ' + prec(p) + '</dt><dd>' + E(PROB[p].rule) + '</dd></div>').join('')
        + '</dl>' })
    + KS.note('Чего в данных нет', '<b>Кто из менеджеров отвечал.</b> Авито отдаёт одного отправителя на весь кабинет, в текстах в обоих кабинетах представляются одни и те же люди. Цифры Авито по менеджерам не делятся. Профили в разделе «Менеджеры (Bitrix)» построены по разборам штатного аналитика по сделкам Bitrix24, это отдельный источник.<br><b>Сделки и деньги.</b> Чем закончился разговор, в Авито не видно.', 'warn')
    + KS.card({ title:'Как обновляются данные', body:KS.steps([
        ['Выгрузка обоих кабинетов', OWNER_NOTE + ' JSON важнее CSV.'],
        ['Сборка', 'src/build_av.py собирает слой данных, src/build.cjs шифрует и собирает сайт; пароль только из переменной окружения'],
        ['Проверка', 'сверка цифр с независимым пересчётом, сторож Контур DS, Step 12.5 ФЕНИКСА'],
        ['Первая проверка эффекта', MILESTONE + ', Иван и РОП'] ]) })
    + KS.card({ title:'Что исправлено против скриншотов', body:'<p class="op-hint">По скриншотам июля выходило «в среднем 46 минут» до ответа, «по имени 0,6%», «цену не назвали 48%». Точные цифры из API на этом сайте. Разделы по скриншотам лежат в группе «Архив» для сравнения.</p>' })
    + '</div>';
};

/* ---------- разделы v3 ---------- */
const LEGACY = { overview:renderOverview, problems:renderProblems, speed:renderSpeed, quality:renderQuality, funnel:renderFunnel,
  dialogues:buildFilterUI, teardowns:renderTeardowns, scripts:renderScripts, actions:renderActions };
const ARCHIVE = ['overview','problems','speed','quality','funnel','dialogues'];
function legacyNote(id){
  return ARCHIVE.includes(id)
    ? KS.note('Архив: цифры по скриншотам июля', 'Они частью неточны. Актуальные цифры по API на экране «Пульс ОП», правила подсчёта на экране «Откуда цифры».', 'warn')
    : (D.MGRS[id] ? KS.note('Отдельный источник', 'Профиль построен штатным аналитиком по сделкам Bitrix24. С цифрами Авито он не связан.', 'info')
      : KS.note('Раздел составлен в июле по скриншотам переписок', 'Цифры в нём не пересчитаны по выгрузке API. Актуальные цифры на экране «Пульс ОП».', 'info'));
}
/* разделы v3 рисуют себя сами (legacy.js): шапка экрана, под ней врезка, дальше компоненты кита */
function legacyScreen(id){ return '<div class="ks-stack" id="p-' + E(id) + '"></div>'; }

/* ==========================================================================
   ПАНЕЛЬ ДЕТАЛЕЙ
   ========================================================================== */
function drillProvider(metric, cab){
  return () => {
    const w = win(OP.days), L = sel({ cab, from:w.from, to:w.to }), cats = weekCats();
    const M = { speed:{ t:'Медиана первого ответа', fn:X => { const m = stats(X).med; return m == null ? null : Math.round(m / 60); }, unit:'мин', key:'slow' },
                f15:{ t:'Ответ за 15 минут', fn:X => stats(X).f15, unit:'%', key:'slow' },
                noresp:{ t:'Не ответили вообще', fn:X => stats(X).noresp, unit:'диал.', key:'noresp' },
                quest:{ t:'Вопрос или телефон без ответа', fn:X => stats(X).quest, unit:'диал.', key:'abandoned' } }[metric];
    const series = weekSeries(M.fn, cab), id = 'dr-' + metric;
    let compose;
    if(metric === 'speed' || metric === 'f15'){
      const bk = [[0,900,'до 15 мин'],[900,3600,'15-60 мин'],[3600,14400,'1-4 часа'],[14400,DAY,'4-24 часа'],[DAY,1e12,'больше суток']];
      compose = KS.bars(bk.map(([a, b, l]) => { const k = L.filter(c => c.lag != null && c.lag >= a && c.lag < b).length; return [l, k, P(share(k, L.length))]; }), CABSLOT[cab]);
    } else {
      const X = L.filter(c => metric === 'noresp' ? c.p.includes('noresp') : (c.p.includes('abandoned') || c.p.includes('phoneleft'))).sort((a, b) => b.t - a.t);
      compose = X.length ? KS.table([['Клиент'],['Написал'],['Объявление']], X.slice(0, 10).map(c => [E(firstName(c.cn)), fD(c.lc || c.t), E(adName(c.ad).slice(0, 40))]), { stack:false })
        + '<div style="margin-top:var(--sp-3)"><button type="button" class="ks-btn ks-btn--secondary ks-btn--sm"' + goAttr({ view:'dlg', prob:M.key, cab }) + '>все ' + X.length + ' в «Все диалоги»</button></div>'
        : '<div class="ks-muted">За период таких диалогов нет.</div>';
    }
    return { title:M.t + ' · ' + cab, kind:'ДАННЫЕ', sub:periodLabel() + ' · ' + dlgN(L.length),
      compose, trend:KS.chart(id, 220), afterOpen:() => floor0(KS.charts.line(id, { cats, data:series, name:M.t, slot:CABSLOT[cab], h:220, suffix:' ' + M.unit })),
      trendTable:KS.table([['Неделя с'],[M.unit, true]], cats.map((c, i) => [c, series[i] == null ? null : NF(series[i])])),
      source:'<div class="op-hint">Авито API, кабинет ' + E(cab) + ', выгрузка ' + fD(EXP[cab]) + ' МСК. ' + E(PROB[M.key].rule) + '</div><div style="margin-top:var(--sp-2)">' + prec(M.key) + '</div>',
      action:{ what:PROB[M.key].todo, who:'менеджеры кабинета ' + cab + ', контроль РОП', when:'ежедневно; сверка ' + MILESTONE } };
  };
}
CABS.forEach(cab => ['speed','f15','noresp','quest'].forEach(m => KS.drawer.register(m + '-' + cab, drillProvider(m, cab))));

function openThread(id){
  const c = D.av.chats.find(x => x.id === id); if(!c) return;
  const M = D.av.msgs[id] || [], PQ = /(сколько|стоимост|цена|цены|ценник|почём|почем|прайс)/i;
  let h = '<div class="ks-drawer-head"><div><div class="op-path">' + E(c.cab) + ' › ' + E(monOf(c)) + '.2026 › ' + E(adName(c.ad)) + '</div>'
    + '<h2 class="ks-h2" id="ks-drawer-title">' + E(c.cn || 'Клиент') + '</h2>'
    + '<div class="ks-card-sub">' + (c.lag != null ? 'первый ответ через ' + fL(c.lag) : (c.nc > 0 ? 'живого ответа не было' : 'клиент не писал текстом')) + ' · начало ' + fD(M.length ? M[0][0] : c.t) + '</div></div>'
    + '<button type="button" class="ks-btn ks-btn--ghost ks-btn--icon" aria-label="Закрыть" onclick="KS.drawer.close()">' + ic('x', 18) + '</button></div><div class="ks-drawer-body">'
    + '<div><a class="ks-btn ks-btn--primary" href="' + avitoUrl(c.id) + '" target="_blank" rel="noopener">' + ic('external', 15) + 'Открыть в Авито</a></div>';
  if(c.p.length) h += KS.card({ title:'Что пошло не так', body:'<div class="ks-stack" style="gap:var(--sp-2)">' + c.p.map(p => '<div><div class="ks-strong" style="font-weight:var(--fw-semi)">' + E(PROB[p].l) + '</div><div class="op-hint">' + E(PROB[p].rule) + '</div><div class="op-hint"><b>Как надо:</b> ' + E(PROB[p].todo) + '</div></div>').join('') + '</div>' });
  let tl = '<div class="op-tl">', prev = null, prevWho = null;
  M.forEach(m => { const [ts, who, tp, tx] = m;
    if(prev != null && (who === 'c' || who === 'm') && ts - prev >= 3600){ const bad = prevWho === 'c' && who === 'm';
      tl += '<div class="op-gap' + (bad ? ' is-bad' : '') + '">' + (bad ? 'клиент ждал ответа ' : 'прошло ') + fL(ts - prev) + '</div>'; }
    if((who === 'c' || who === 'm') && who !== prevWho) tl += '<div class="op-who' + (who === 'm' ? ' is-r' : '') + '">' + (who === 'm' ? 'GLASS-MEMORY (' + E(c.cab) + ')' : 'Клиент') + '</div>';
    const flag = who === 'c' && c.p.includes('noprice') && PQ.test(tx) ? ' is-flag' : '';
    tl += '<div class="op-bub is-' + who + flag + '">' + (who === 'a' ? 'Автоответ: ' : '') + (tp === 'c' ? 'Звонок. ' : '') + E(tx) + '<span class="op-tm">' + fD(ts) + '</span></div>';
    if(who === 'c' || who === 'm'){ prev = ts; prevWho = who; } });
  h += KS.card({ title:'Переписка', sub:M.length + ' сообщений', body:tl + '</div>' }) + '</div>';
  KS.drawer.ensure();
  const el = document.getElementById('ks-drawer'); el.innerHTML = h;
  document.getElementById('ks-drawer-bd').hidden = false; el.classList.add('is-open');
  KS.drawer.last = document.activeElement; el.focus(); document.documentElement.classList.add('ks-lock');
}

/* ==========================================================================
   КАРКАС, НАВИГАЦИЯ, ОТРИСОВКА
   ========================================================================== */
function navTree(){
  return [
    { id:'today', t:'Сегодня', i:'check' },
    { id:'pulse', t:'Пульс ОП', i:'grid' },
    { t:'Аналитика Авито', i:'chart', ch:[ { id:'speed2', t:'Скорость ответа' }, { id:'probs', t:'Типовые проблемы' }, { id:'ads', t:'Объявления' }, { id:'calls', t:'Звонки' }, { id:'cold', t:'Холодная рассылка' } ] },
    { t:'Разборы', i:'list', ch:[ { id:'dlg', t:'Все диалоги' }, { id:'teardowns', t:'Детальные разборы' } ] },
    { t:'Обучение', i:'doc', ch:[ { id:'scripts', t:'Скрипты и магниты' }, { id:'actions', t:'Что делать дальше' } ] },
    { t:'Менеджеры (Bitrix)', i:'users', ch:D.ORDER.map(k => ({ id:k, t:D.MGRS[k].name })) },
    { id:'data', t:'Откуда цифры', i:'info' },
    { t:'Архив: скриншоты июля', i:'layers', ch:[ { id:'overview', t:'Обзор' }, { id:'problems', t:'Проблемы' }, { id:'speed', t:'Скорость' }, { id:'quality', t:'Как общаемся' }, { id:'funnel', t:'Куда уходят деньги' }, { id:'dialogues', t:'Диалоги' } ] }
  ];
}
function isLegacy(v){ return !!(LEGACY[v] || (D.MGRS && D.MGRS[v])); }
function render(){
  const v = OP.view, view = document.getElementById('view');
  JOBS = []; cancelAnimationFrame(_raf);
  /* графики уничтожаем до замены экрана: иначе недорисованный график дорисуется в удалённый узел с размерами NaN */
  KS.charts.destroyAll();
  view.innerHTML = '<div class="ks-fade">' + (isLegacy(v) ? legacyScreen(v) : (SCREENS[v] || SCREENS.pulse)()) + '</div>';
  KS.charts.prune();
  if(LEGACY[v]) LEGACY[v](legacyNote(v)); else if(D.MGRS[v]) renderManager(v, legacyNote(v));
  if(v === 'dlg') wireDlg();
  document.getElementById('nav').innerHTML = KS.nav(navTree(), v);
  /* 1.3: сегмент строится один раз, экран только переключает aria-pressed; плашка переезжает сама */
  document.querySelectorAll('#seg [data-cab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cab === OP.cab)));
  view.querySelectorAll('.ks-seg').forEach(el => KS.seg.wire(el));
  document.getElementById('tools').hidden = isLegacy(v);
  document.getElementById('stamp').textContent = 'Авито API · выгрузка ' + fDay(EXPORT_TS) + '.2026';
  document.getElementById('theme').innerHTML = KS.theme.icon();
  KS.route.set({ project:OP.cab, view:v, period:String(OP.days) });
  KS.ticker.run(view);
  scheduleDraw();
}
/* 1.4: переход между экранами через View Transitions, при «меньше движения» сразу */
function go(v){ return KS.vt(() => { OP.view = v; render(); window.scrollTo(0, 0); }); }
function setCab(c){ OP.cab = c; OP.dlg.limit = 40; render(); }
function setDays(d){ OP.days = d; document.getElementById('per').value = String(d); render(); }
function densUi(){ const b = document.getElementById('dens'); b.innerHTML = KS.density.icon(); b.setAttribute('data-tip', 'Плотность: ' + KS.density.label().toLowerCase()); }
function cmdkItems(){
  const V = [['today','Сегодня','check'],['pulse','Пульс ОП','grid'],['speed2','Скорость ответа','clock'],['probs','Типовые проблемы','warn'],['ads','Объявления','tag'],
    ['calls','Звонки','bolt'],['cold','Холодная рассылка','mega'],['dlg','Все диалоги','list'],['data','Откуда цифры','info'],['teardowns','Детальные разборы','doc'],
    ['scripts','Скрипты и магниты','pen'],['actions','Что делать дальше','target']].concat(D.ORDER.map(k => [k, D.MGRS[k].name, 'users']))
    .concat([['overview','Архив: обзор'],['problems','Архив: проблемы'],['speed','Архив: скорость'],['quality','Архив: как общаемся'],['funnel','Архив: куда уходят деньги'],['dialogues','Архив: диалоги']]
      .map(([id, t]) => [id, t + ' по скриншотам', 'layers']));
  return V.map(([id, label, icon]) => ({ group:'Экраны', label, icon, run:() => go(id) }))
    .concat([['all','Оба кабинета'],['OLD-G','OLD-G, старый кабинет'],['NEW-B','NEW-B, новый кабинет']].map(([c, label]) => ({ group:'Кабинет', label, icon:'layers', run:() => setCab(c) })))
    .concat([[7,'7 дней'],[30,'30 дней'],[90,'90 дней'],['all','весь ряд']].map(([d, label]) => ({ group:'Период', label:'Период: ' + label, icon:'calendar', run:() => setDays(d) })))
    .concat(PORDER.map(p => ({ group:'Диалоги по проблеме', label:PROB[p].l, icon:'filter', keywords:'диалоги список', run:() => { Object.assign(OP.dlg, { prob:p, ad:'all', flag:'all', limit:40 }); go('dlg'); } })))
    .concat(CABS.flatMap(cab => [['speed','Медиана первого ответа'],['f15','Ответ за 15 минут'],['noresp','Не ответили вообще'],['quest','Вопрос или телефон без ответа']]
      .map(([m, label]) => ({ group:'Детали', label:label + ' · ' + cab, hint:'по неделям', icon:'chart', keywords:'панель детали график', run:() => { go('pulse'); KS.drawer.open(m + '-' + cab); } }))))
    .concat([{ group:'Действия', label:'Сменить тему', icon:'moon', keywords:'тёмная светлая', run:() => KS.theme.toggle() },
             { group:'Действия', label:'Переключить плотность', hint:'просторно или компактно', icon:'rows', keywords:'компактно просторно строки таблица', run:() => KS.density.toggle() },
             { group:'Действия', label:'Скопировать ссылку на экран', hint:'откроется за паролем', icon:'link', run:() => {
                 const ok = () => KS.toast('Ссылка на экран скопирована'), no = () => KS.toast('Не удалось скопировать: выделите адрес вручную', 'warn');
                 try{ navigator.clipboard.writeText(location.href).then(ok, no); }catch(e){ no(); } } },
             { group:'Действия', label:'Выйти', icon:'x', run:() => location.reload() }]);
}

function start(){
  const cs = D.av.recon; CABS.forEach(c => { EXP[c] = Math.floor(Date.parse(cs[c].exported) / 1000); });
  EXPORT_TS = Math.max(...CABS.map(c => EXP[c])); AT = iso(EXPORT_TS).slice(0, 10);
  const r = KS.route.state || KS.route.parse();
  if(r.project && (r.project === 'all' || CABS.includes(r.project))) OP.cab = r.project;
  if(r.view && (SCREENS[r.view] || isLegacy(r.view))) OP.view = r.view;
  if(r.period) OP.days = r.period === 'all' ? 'all' : (+r.period || 30);
  document.getElementById('per').value = String(OP.days);
  KS.charts.onTheme = () => render();
  KS.navWire(document.getElementById('nav'), go);
  KS.shell.init({ sidebar:'#sb', backdrop:'#bd', menu:'#menu' });
  const seg = document.getElementById('seg');
  seg.innerHTML = [['all','Оба']].concat(CABS.map(c => [c, c])).map(([k, l]) => '<button type="button" data-cab="' + k + '" aria-pressed="' + (OP.cab === k) + '">' + l + '</button>').join('');
  KS.seg.wire(seg);
  seg.addEventListener('click', e => { const b = e.target.closest('[data-cab]'); if(b) setCab(b.dataset.cab); });
  document.getElementById('per').addEventListener('change', e => setDays(e.target.value === 'all' ? 'all' : +e.target.value));
  document.getElementById('theme').addEventListener('click', () => KS.theme.toggle());
  /* телефон: тема и плотность в меню (.ks-sidebar-tools в shell.html), их включает кит 1.5.1 */
  if(matchMedia('(max-width:639px)').matches) [...document.getElementById('per').options].forEach(o => { o.textContent = { '7':'7 дн', '30':'30 дн', '90':'90 дн', all:'всё' }[o.value]; });
  document.getElementById('cmdkb').outerHTML = KS.cmdk.button();
  KS.cmdk.set(cmdkItems());
  document.getElementById('dens').addEventListener('click', () => KS.density.toggle());
  document.addEventListener('ks:density', densUi); densUi();
  /* переходы из карточек, строк таблиц и панели: data-go='{"view":"dlg","prob":"noresp"}' */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-today]'); if(t){ OP.today = t.dataset.today === 'all' ? 'all' : +t.dataset.today; render(); return; }
    const th = e.target.closest('[data-th]'); if(th){ openThread(th.dataset.th); return; }
    const g = e.target.closest('[data-go]'); if(g){ const o = JSON.parse(g.dataset.go);
      if(document.getElementById('ks-drawer') && document.getElementById('ks-drawer').classList.contains('is-open')) KS.drawer.close();
      if(o.cab) OP.cab = o.cab;
      Object.assign(OP.dlg, { prob:o.prob || 'all', ad:o.ad || 'all', flag:o.flag || 'all', limit:40 });
      go(o.view); }
  });
  document.addEventListener('keydown', e => { if(e.key !== 'Enter' && e.key !== ' ') return;
    const th = e.target.closest && e.target.closest('[data-th]'); if(th){ e.preventDefault(); openThread(th.dataset.th); return; }
    const g = e.target.closest && e.target.closest('tr[data-go]'); if(g){ e.preventDefault(); g.click(); } });
  render();
  if(r.drill && KS.drawer.providers[r.drill]) KS.drawer.open(r.drill);
}
window.OPGM = { start, render, openThread };
})();
