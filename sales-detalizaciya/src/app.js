/* ==========================================================================
   Детализация ОП GLASS-MEMORY: работа кабинетов Авито неделя к неделе.
   Данные: window.DATA из data/page.json (собирает build_page_data.py).
   Каркас, компоненты и графики: Контур DS из макета «Разбор недели».
   ========================================================================== */
const F = KS.F, { nf } = KS.fmt;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const el = id => document.getElementById(id);
const CODES = Object.keys(DATA.cabs);
const CAB = c => DATA.cabs[c];
const DETAIL = CAB(CODES[0]).detail_weeks;                       // 8 полных недель
const ALLW = CAB(CODES[0]).series.map(r => r.week);
const OPENW = ALLW.filter(w => w > DETAIL[DETAIL.length - 1]);   // неполная неделя после разбора
const WEEKS = DETAIL.concat(OPENW);
const SRC = code => 'Авито Мессенджер, кабинет ' + code + ' («' + CAB(code).avito_name + '»), выгрузка ' + CAB(code).exported.slice(0, 10).split('-').reverse().join('.');
const LBL_SRC = 'смысловая разметка диалогов моделью по LABELING_SPEC.md, проверена вручную на выборке';
const AVITO = id => 'https://www.avito.ru/profile/messenger/channel/' + encodeURIComponent(id);
const LOW_N = 15;

let SEL = DETAIL.length - 1, VIEW = 'sum', PICK = 'all';

const row = (code, wk) => CAB(code).series.find(r => r.week === wk) || null;
const seriesTo = (code, wk) => CAB(code).series.filter(r => r.week <= wk);
const selW = () => WEEKS[SEL];
const isOpen = () => OPENW.includes(selW());
const wlabel = wk => { const r = row(CODES[0], wk); return r ? r.from_ + '-' + r.to : wk; };
const prevW = wk => ALLW[ALLW.indexOf(wk) - 1];
const pickCodes = () => PICK === 'all' ? CODES : [PICK];
const cabName = () => PICK === 'all' ? 'оба кабинета' : PICK;

/* ---------- словари разметки ---------- */
const DICT = {
  segment:{ b2c:'Частные клиенты (B2C)', b2b:'Бизнес (B2B)', non_client:'Не клиенты', unclear:'Не понять' },
  category:{ portrait:'Портрет на камень', stela:'Стела из стекла', flowerbed_fence:'Цветник, оградка', stand_frame:'На подставке, в раме',
    turnkey_stone:'Памятник под ключ, камень', wholesale:'Опт, образцы', other_product:'Другое изделие', info_only:'Только адрес, каталог', none:'Нет запроса' },
  questions:{ price:'Цена', size_options:'Размеры', glass_type:'Толщина, вид стекла', durability_fading:'Срок службы, выцветание', mounting_install:'Крепление, установка, камень',
    delivery_region:'Доставка в регион', location_visit:'Адрес, приехать', lead_time:'Сроки', layout_design:'Макет, ретушь, надписи', payment_contract:'Оплата, договор',
    catalog_examples:'Каталог, примеры', double_sided:'Двусторонняя печать', weight:'Вес', wholesale_terms:'Оптовые условия', other:'Другое' },
  objections:{ expensive:'Дорого', cheaper_elsewhere:'У других дешевле', stone_not_included:'Только стекло, без камня', far_delivery:'Далеко, доставка',
    durability_doubt:'Сомнения в сроке службы', lead_time_long:'Долго делать', prepayment:'100% предоплата, дистанционно', think_consult:'Подумаю, посоветуюсь',
    not_now:'Не сейчас', product_mismatch:'Нужно не то, что делаем', other:'Другое' },
  price_reaction:{ accepted:'Принял, идёт дальше', negotiates:'Торгуется', expensive:'Говорит «дорого»', compares:'Сравнивает с другими',
    thinking:'«Подумаем»', silent:'Пропал после цены', no_price_given:'Цену не получил', not_applicable:'Цену не обсуждали' },
  lost_reason:{ price:'Цена', stone_not_included:'Нужен камень, установка', delivery:'Доставка', durability:'Не верит в срок службы', competitor:'Ушёл к другим',
    not_now:'Не сейчас', mismatch:'Нужно другое', silent:'Пропал без объяснений', no_followup:'Ждал от нас действия, не дождался', unknown:'Непонятно' },
  mgr_issues:{ ignored_question:'Вопрос клиента без ответа', no_concrete_price:'Размеры есть, а цены нет', no_next_step:'Ответ без следующего шага',
    argues:'Спорит, поучает', wrong_or_confusing:'Путаница в ответе', promised_not_done:'Обещали и не сделали' },
  stage:{ '0':'Не вступил в разговор', '1':'Задавал вопросы', '2':'Прислал размеры, фото', '3':'Дал телефон, перешёл в мессенджер', '4':'Макет, визит', '5':'Договор, оплата' }
};
const T = (d, k) => (DICT[d] && DICT[d][k]) || k;

/* ---------- сумма разметки по неделям и кабинетам ---------- */
function lab(weeks, key, codes){
  const out = {};
  (codes || pickCodes()).forEach(c => weeks.forEach(w => {
    const d = (CAB(c).labels[w] || {})[key] || {};
    Object.entries(d).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; });
  }));
  return out;
}
const labN = (weeks, codes) => Object.values(lab(weeks, 'segment', codes)).reduce((a, b) => a + b, 0);
const sorted = o => Object.entries(o).sort((a, b) => b[1] - a[1]);
const share = (a, b) => b ? Math.round(a / b * 100) : null;
const sumField = (weeks, f, codes) => (codes || pickCodes()).reduce((s, c) => s + weeks.reduce((t, w) => t + ((row(c, w) || {})[f] || 0), 0), 0);

/* ---------- мелкие детали ---------- */
const SHORT = code => 'Авито, ' + code;
const fD = (v, code, what) => F(v, 'ДАННЫЕ', SHORT(code), CAB(code).exported);
const fH = (v, code, what) => F(v, 'ГИПОТЕЗА', SHORT(code) + ', по тексту', CAB(code).exported);
const lowNote = n => n < LOW_N ? ' <span class="op-muted">(мало данных: ' + nf(n) + ')</span>' : '';
const chatLink = (id, text) => '<a class="op-link" href="' + AVITO(id) + '" target="_blank" rel="noopener">' + esc(text || 'открыть в Авито') + '</a>';
const pctS = v => v == null ? '-' : nf(Math.round(v)) + '%';
const help = t => '<span class="ks-help" tabindex="0" data-tip="' + esc(t) + '">?</span>';
function weekDelta(code, wk, f, goodUp){
  const s = seriesTo(code, wk).slice(-2);
  return KS.delta(KS.series.dyn(s, f, 14), goodUp);
}

/* ==========================================================================
   Экраны
   ========================================================================== */
const NAV = [
  { id:'today', t:'Сегодня', i:'check' },
  { id:'pulse', t:'Пульс ОП', i:'grid' },
  { t:'Разборы', i:'list', ch:[ { id:'week', t:'Разбор недели' }, { id:'lib', t:'Библиотека разборов' } ] },
  { t:'Детализация', i:'chart', ch:[
    { id:'sum', t:'Сводка недели' }, { id:'dyn', t:'Динамика кабинетов' }, { id:'score', t:'Плюсы и косяки' },
    { id:'who', t:'Кто пишет и о чём' }, { id:'obj', t:'Возражения и вопросы' }, { id:'price', t:'Реакция на цену' },
    { id:'phr', t:'Фразы, которые работают' } ] },
  { t:'Обучение', i:'doc', ch:[ { id:'scripts', t:'Скрипты и магниты' } ] },
  { id:'data', t:'Откуда цифры', i:'info' }
];
const TITLES = { today:'Сегодня', pulse:'Пульс ОП', week:'Разбор недели', lib:'Библиотека разборов', scripts:'Скрипты и магниты' };
const WEEK_SCREENS = ['sum', 'score'];

const KPIS = [
  // поле, подпись, хорошо вверх, формат, данные или гипотеза
  ['inbound', 'Обращений', true, 'n', 'D'],
  ['first_resp_work_bmin_med', 'Первый ответ, медиана, раб. мин', false, 'n', 'D'],
  ['fast_pct', 'Ответ за 15 раб. мин, %', true, 'p', 'D'],
  ['no_dozhim_pct', 'Замолчал, не дожали, %', false, 'p', 'D'],
  ['price_named_pct', 'Назвали цену, когда спросили, %', true, 'p', 'H'],
  ['contact_got_pct', 'Получили телефон, %', true, 'p', 'H'],
  ['followup_pct', 'Сами вернулись к клиенту, %', true, 'p', 'D'],
  ['left_hanging', 'Клиент ждёт ответа, шт', false, 'n', 'H']
];

function cabBlock(code){
  const wk = selW(), r = row(code, wk), s = seriesTo(code, wk);
  if(!r) return KS.card({ title:code, body:'<div class="ks-muted">Нет обращений за неделю.</div>' });
  const cm = (CAB(code).comments || {})[wk];
  const tiles = KPIS.slice(0, 4).map(([f, label, up, fmt, k], i) => KS.tile({
    label, f:(k === 'D' ? fD : fH)(r[f] == null ? null : Math.round(r[f] * 10) / 10, code, label.toLowerCase()),
    slot:[3, 1, 2, 4][i], delta:weekDelta(code, wk, f, up), spark:s.slice(-8).map(x => x[f]), drill:'kpi-' + code + '-' + f })).join('');
  const verdict = KS.verdict(s.slice(-2), KPIS.filter(k => k[0] !== 'inbound').map(k => [k[0], k[1].replace(/, (%|шт|раб\. мин)$/, '') + (k[3] === 'p' ? ', %' : ''), k[2]]), 14,
    'неделю ' + wlabel(wk) + ' против ' + wlabel(prevW(wk)));
  const comment = cm ? '<div class="op-cm">'
      + '<p class="op-cm-lead">' + esc(cm.lead) + '</p>'
      + '<div class="ks-grid-2 op-td"><div><div class="op-td-h">Плюсы</div>' + (cm.plus && cm.plus.length ? KS.checks(cm.plus.map(esc), 'ok') : '<p class="op-muted">нет</p>') + '</div>'
      + '<div><div class="op-td-h">Косяки</div>' + (cm.minus && cm.minus.length ? KS.checks(cm.minus.map(esc), 'crit') : '<p class="op-muted">нет</p>') + '</div></div>'
      + (cm.fix ? '<p class="op-hint"><b>Что сделать:</b> ' + esc(cm.fix) + '</p>' : '')
      + '</div>'
    : '<p class="op-muted">Комментарий к этой неделе не написан.' + (isOpen() ? ' Неделя не закрыта.' : '') + '</p>';
  return '<section class="ks-stack op-cab">'
    + '<div class="ks-row op-cab-head"><h2 class="ks-h2">' + esc(code) + '</h2><span class="op-muted">в Авито «' + esc(CAB(code).avito_name) + '»</span>'
    + (r.inbound < LOW_N ? KS.badge('мало данных', 'warn', 'Обращений меньше ' + LOW_N + ': проценты прыгают от одного диалога') : '') + '</div>'
    + '<div class="ks-grid-kpi">' + tiles + '</div>'
    + '<div class="ks-grid-2">' + verdict
    + KS.card({ title:'Комментарий к неделе', sub:'Разбор цифр и диалогов недели · ' + (cm ? cm.by || 'ручной разбор' : 'нет'), body:comment }) + '</div>'
    + '</section>';
}

function wowTable(){
  const wk = selW(), pw = prevW(wk);
  const cols = [['Показатель']].concat(...CODES.map(c => [[c + ' ' + wlabel(pw), true], [c + ' ' + wlabel(wk), true]]));
  const fmt = (v, p) => v == null ? null : (p === 'p' ? pctS(v) : nf(Math.round(v * 10) / 10));
  const extra = [['mailing_sent', 'Написали первыми', true, 'n'], ['mailing_replied', 'Ответили на наше первое сообщение', true, 'n'],
    ['calls_ok', 'Принято звонков', true, 'n'], ['calls_missed', 'Пропущено звонков', false, 'n'], ['photos_pct', 'Отправили фото примеров, %', true, 'p'],
    ['moved_offline_pct', 'Перевели в телефон или MAX, %', true, 'p'], ['no_dozhim_after_price', 'Не дожали после цены, шт', false, 'n'], ['unanswered', 'Без живого ответа, шт', false, 'n']];
  const rows = KPIS.concat(extra).map(([f, label, up, p]) => [esc(label)].concat(...CODES.map(c => {
    const a = (row(c, pw) || {})[f], b = (row(c, wk) || {})[f];
    const t = a == null || b == null || a === b ? '' : ((b > a) === up ? ' op-good' : ' op-bad');
    return [fmt(a, p), '<span class="op-val' + t + '">' + (fmt(b, p) == null ? '-' : fmt(b, p)) + '</span>'];
  })));
  return KS.card({ title:'Неделя к неделе, оба кабинета', sub:'Зелёным то, что стало лучше, красным то, что хуже. Проценты считаются от обращений недели', body:KS.table(cols, rows, { stack:true }) });
}

const SCREENS = {
  sum(){
    const wk = selW();
    return KS.head({ title:'Детализация: неделя ' + wlabel(wk), sub:'Как отдел продаж отработал обращения в кабинетах Авито OLD-B и OLD-G, в сравнении с неделей ' + wlabel(prevW(wk)) + '.',
        src:SRC(CODES[0]) + ' · ' + SRC(CODES[1]),
        badges:[ KS.kind('ДАННЫЕ'), isOpen() ? KS.badge('неделя не закрыта', 'warn', 'В выгрузке только первые дни недели. Косяки с порогом 2 дня ещё не видны') : '',
          help('Неделя: понедельник-воскресенье по МСК.\nОбращение относится к неделе по первому сообщению или звонку клиента.\nРабочее время: пн-пт 9-13 и 14-18.\nПравила каждого показателя: «Откуда цифры».') ] })
      + '<div class="ks-stack">'
      + (isOpen() ? KS.note('Неделя ' + wlabel(wk) + ' не закрыта', 'Выгрузка сделана 22.09, в неделе два дня. Сравнение с прошлой неделей не честное: смотри его как предварительный сигнал.', 'warn') : '')
      + CODES.map(cabBlock).join('')
      + wowTable()
      + KS.note('По менеджерам разбивки нет', 'Авито отдаёт одного отправителя на весь кабинет, поэтому цифры не делятся на людей. В обоих кабинетах клиентам дают одни и те же прямые номера, похоже, кабинеты ведёт одна команда.', 'info')
      + '</div>';
  },

  dyn(){
    // неполные недели (старт 01.04 и текущая) на графике дают ложный провал, их нет на линиях
    const FULLW = ALLW.filter(w => CODES.every(c => !(row(c, w) || {}).partial));
    const cats = FULLW.map(wlabel);
    const series = f => CODES.map((c, i) => ({ name:c, slot:[3, 1][i], data:FULLW.map(w => { const r = row(c, w); return r && r[f] != null ? Math.round(r[f] * 10) / 10 : null; }) }));
    const twin = (f, p) => KS.table([['Неделя']].concat(CODES.map(c => [c, true])), ALLW.slice().reverse().map(w => [wlabel(w)].concat(CODES.map(c => { const r = row(c, w); return r && r[f] != null ? (p ? pctS(r[f]) : nf(Math.round(r[f] * 10) / 10)) : null; }))));
    const card = (id, title, sub, f, p) => KS.card({ title, sub, body:KS.chart(id, 280), table:twin(f, p) });
    // Ось от нуля: доли и счётчики не бывают отрицательными, у процентов верх 100
    const draw = (id, f, pct) => { KS.charts.multi(id, { cats, series:series(f), h:280 });
      const ch = KS.charts.inst[id]; if(ch) ch.updateOptions({ yaxis:{ min:0, max:pct ? 100 : undefined, forceNiceScale:true, labels:{ style:{ fontSize:'11px' }, formatter:x => nf(Math.round(x)) } } }, false, false); };
    DRAW = () => {
      draw('c-in', 'inbound'); draw('c-lag', 'first_resp_work_bmin_med'); draw('c-fast', 'fast_pct', true);
      draw('c-dz', 'no_dozhim_pct', true); draw('c-pn', 'price_named_pct', true); draw('c-ct', 'contact_got_pct', true);
    };
    return KS.head({ title:'Динамика кабинетов', sub:'Полные недели с апреля по сентябрь 2026. Неполные недели (первая и текущая) есть только в таблицах.', src:SRC(CODES[0]) + ' · ' + SRC(CODES[1]), badges:[KS.kind('ДАННЫЕ')] })
      + '<div class="ks-stack">'
      + KS.anomalyNote(CAB('OLD-B').series.filter(r => !r.partial), 'inbound', 'обращения OLD-B')
      + '<div class="ks-grid-2">'
      + card('c-in', 'Обращений в неделю', 'Чаты, где первым написал или позвонил клиент', 'inbound')
      + card('c-lag', 'Первый ответ, медиана, рабочих минут', 'Меньше значит лучше. Только обращения в рабочее время', 'first_resp_work_bmin_med')
      + card('c-fast', 'Ответ за 15 рабочих минут, %', 'Больше значит лучше. Норматив черновой', 'fast_pct', true)
      + card('c-dz', 'Замолчал после нашего ответа, не дожали, %', 'Меньше значит лучше. Доля от обращений недели', 'no_dozhim_pct', true)
      + card('c-pn', 'Назвали цену, когда спросили, %', 'ГИПОТЕЗА: сумма в рублях в ответе после вопроса о цене', 'price_named_pct', true)
      + card('c-ct', 'Получили телефон клиента, %', 'ГИПОТЕЗА: телефон или почта в сообщении клиента', 'contact_got_pct', true)
      + '</div></div>';
  },

  score(){
    const codes = pickCodes(), wk = selW();
    const ISS = [
      ['unanswered', 'Без живого ответа', 'D'], ['left_hanging', 'Клиент ждёт ответа', 'H'], ['no_dozhim', 'Замолчал, не дожали', 'D'],
      ['no_dozhim_after_price', 'Не дожали после цены', 'H'], ['price_not_named', 'Спросил цену, не назвали и не позвали в звонок', 'H'],
      ['missed_no_reaction', 'Пропущенный звонок без реакции', 'D']
    ];
    const MG = ['ignored_question', 'no_concrete_price', 'no_next_step', 'argues', 'wrong_or_confusing', 'promised_not_done'];
    const inb = w => sumField([w], 'inbound', codes);
    const labn = w => labN([w], codes);
    const rowsI = ISS.map(x => x[1]).concat(MG.map(k => T('mgr_issues', k) + ' *'));
    const matrix = ISS.map(([f]) => DETAIL.map(w => share(sumField([w], f, codes), inb(w)) || 0))
      .concat(MG.map(k => DETAIL.map(w => share(lab([w], 'mgr_issues', codes)[k] || 0, labn(w)) || 0)));
    const PL = [['fast_pct', 'Ответ за 15 раб. мин'], ['price_named_pct', 'Назвали цену, когда спросили'], ['photos_pct', 'Отправили фото примеров'],
      ['contact_got_pct', 'Получили телефон'], ['moved_offline_pct', 'Перевели в телефон или MAX'], ['followup_pct', 'Сами вернулись к клиенту']];
    const avg = (f, w) => { const vals = codes.map(c => [(row(c, w) || {})[f], (row(c, w) || {}).inbound || 0]).filter(v => v[0] != null);
      const n = vals.reduce((a, v) => a + v[1], 0); return n ? Math.round(vals.reduce((a, v) => a + v[0] * v[1], 0) / n) : null; };
    const EXK = ISS.map(x => x[0]).filter(k => k !== 'unanswered').concat(['unanswered']);
    const ex = EXK.map(k => {
      const list = codes.flatMap(c => (CAB(c).examples[k] || []).filter(e => e.w === wk).map(e => Object.assign({ c }, e)));
      if(!list.length) return '';
      const name = (ISS.find(x => x[0] === k) || [0, k])[1];
      return '<div class="op-ex"><div class="op-td-h">' + esc(name) + ' · ' + nf(list.length) + '</div><ul class="op-list">'
        + list.slice(0, 6).map(e => '<li><span class="op-muted">' + e.c + '</span> ' + esc(e.s || 'описание появится после разметки') + ' · ' + chatLink(e.id) + '</li>').join('')
        + (list.length > 6 ? '<li class="op-muted">и ещё ' + nf(list.length - 6) + '</li>' : '') + '</ul></div>';
    }).join('');
    DRAW = () => KS.charts.heat('c-iss', { rows:rowsI, cols:DETAIL.map(wlabel), matrix, ranges:[[0,4],[5,14],[15,29],[30,49],[50,100]], h:420 });
    return KS.head({ title:'Плюсы и косяки: ' + cabName(), sub:'Что получается и что повторяется неделя за неделей. Доля от обращений, %.',
        src:codes.map(SRC).join(' · '), badges:[KS.kind('ДАННЫЕ'), KS.kind('ГИПОТЕЗА')] })
      + '<div class="ks-stack">'
      + KS.card({ title:'Косяки: разовые или системные', sub:'Доля обращений с проблемой, %. Чем темнее, тем чаще. * отмечена смысловая разметка, доля от размеченных диалогов',
          body:KS.chart('c-iss', 420),
          table:KS.table([['Косяк']].concat(DETAIL.map(w => [wlabel(w), true])), rowsI.map((r, i) => [esc(r)].concat(matrix[i].map(v => nf(v))))) })
      + KS.card({ title:'Плюсы по неделям', sub:'Доля обращений, %. Больше значит лучше',
          body:KS.table([['Что делаем хорошо']].concat(DETAIL.map(w => [wlabel(w), true])), PL.map(([f, n]) => [esc(n)].concat(DETAIL.map(w => pctS(avg(f, w)))))) })
      + KS.card({ title:'Диалоги с косяками за неделю ' + wlabel(wk), sub:'Ссылка открывает чат в Авито, если вы вошли в нужный кабинет',
          body: ex || '<p class="op-muted">За неделю косяков по правилам не найдено.</p>' })
      + '</div>';
  },

  who(){
    const codes = pickCodes(), weeks = DETAIL;
    const seg = lab(weeks, 'segment'), n = labN(weeks);
    const cat = sorted(lab(weeks, 'category')).filter(([k]) => k !== 'none');
    const b2b = sorted(lab(weeks, 'b2b_type'));
    const cs = lab(weeks, 'cat_stage');
    const catConv = cat.map(([k, v]) => { let hot = 0; Object.entries(cs).forEach(([key, c]) => { const [ck, st] = key.split('|'); if(ck === k && +st >= 3) hot += c; }); return [k, v, share(hot, v)]; });
    const segKeys = ['b2c', 'b2b', 'non_client', 'unclear'].filter(k => seg[k]);
    const segWeek = k => weeks.map(w => lab([w], 'segment')[k] || 0);
    DRAW = () => {
      KS.charts.donut('c-seg', { labels:segKeys.map(k => T('segment', k)), data:segKeys.map(k => seg[k]), h:300 });
      KS.charts.hbar('c-cat', { cats:cat.map(([k]) => T('category', k)), data:cat.map(x => x[1]), h:Math.max(220, cat.length * 38) });
      KS.charts.multi('c-segw', { cats:weeks.map(wlabel), series:[{ name:'B2C', data:segWeek('b2c'), slot:3 }, { name:'B2B', data:segWeek('b2b'), slot:1 }], h:260 });
    };
    if(!n) return noLabels('Кто пишет и о чём');
    return KS.head({ title:'Кто пишет и о чём: ' + cabName(), sub:'Сегменты и типовые запросы за 8 недель ' + wlabel(weeks[0]) + ' - ' + wlabel(weeks[weeks.length - 1]) + '. Размечено диалогов: ' + nf(n) + '.',
        src:LBL_SRC, badges:[KS.kind('ГИПОТЕЗА')] })
      + '<div class="ks-stack"><div class="ks-grid-2">'
      + KS.card({ title:'B2C и B2B', sub:'Кто пишет в кабинеты', body:KS.chart('c-seg', 300), table:KS.table([['Сегмент'], ['Диалогов', true], ['Доля', true]], segKeys.map(k => [T('segment', k), nf(seg[k]), pctS(share(seg[k], n))])) })
      + KS.card({ title:'B2B по неделям', sub:'Сколько бизнес-запросов в неделю против частных', body:KS.chart('c-segw', 260),
          table:KS.table([['Неделя'], ['B2C', true], ['B2B', true]], weeks.map((w, i) => [wlabel(w), nf(segWeek('b2c')[i]), nf(segWeek('b2b')[i])])) })
      + '</div>'
      + KS.card({ title:'Типовые запросы', sub:'Главная категория каждого диалога', body:KS.chart('c-cat', Math.max(220, cat.length * 38)),
          table:KS.table([['Категория'], ['Диалогов', true]], cat.map(([k, v]) => [T('category', k), nf(v)])) })
      + KS.card({ title:'Какие запросы доходят до контакта', sub:'Доля диалогов категории, где клиент дал телефон, пришёл на макет или к оплате (стадия 3 и выше)',
          body:KS.table([['Категория'], ['Диалогов', true], ['До контакта и дальше', true]], catConv.map(([k, v, p]) => [T('category', k), nf(v), pctS(p) + lowNote(v)])) })
      + (b2b.length ? KS.card({ title:'Кто из бизнеса пишет', body:KS.bars(b2b.map(([k, v]) => [k, v]), 1) }) : '')
      + '</div>';
  },

  obj(){
    const weeks = DETAIL, n = labN(weeks);
    if(!n) return noLabels('Возражения и вопросы');
    const ob = sorted(lab(weeks, 'objections')), qs = sorted(lab(weeks, 'questions')), lost = sorted(lab(weeks, 'lost_reason'));
    const quotes = pickCodes().flatMap(c => (CAB(c).quotes.objection || []).filter(q => weeks.includes(q.w)).map(q => Object.assign({ c }, q)));
    const qBlock = ob.slice(0, 6).map(([k, v]) => {
      const qq = quotes.filter(q => q.o === k).slice(-3).reverse();
      return '<div class="op-ex"><div class="op-td-h">' + esc(T('objections', k)) + ' · ' + nf(v) + '</div>'
        + (qq.length ? '<ul class="op-list">' + qq.map(q => '<li>«' + esc(q.t) + '» <span class="op-muted">' + q.c + ', ' + wlabel(q.w) + '</span> · ' + chatLink(q.id) + '</li>').join('') + '</ul>' : '<p class="op-muted">цитат нет</p>') + '</div>';
    }).join('');
    DRAW = () => {
      KS.charts.hbar('c-ob', { cats:ob.map(([k]) => T('objections', k)), data:ob.map(x => x[1]), slot:4, h:Math.max(200, ob.length * 36) });
      KS.charts.hbar('c-qs', { cats:qs.map(([k]) => T('questions', k)), data:qs.map(x => x[1]), slot:3, h:Math.max(220, qs.length * 32) });
    };
    return KS.head({ title:'Возражения и вопросы: ' + cabName(), sub:'Что спрашивают и что мешает купить. 8 недель, размечено диалогов: ' + nf(n) + '.', src:LBL_SRC, badges:[KS.kind('ГИПОТЕЗА')] })
      + '<div class="ks-stack"><div class="ks-grid-2">'
      + KS.card({ title:'Возражения', sub:'Высказанные клиентом прямо, диалогов', body:KS.chart('c-ob', Math.max(200, ob.length * 36)), table:KS.table([['Возражение'], ['Диалогов', true]], ob.map(([k, v]) => [T('objections', k), nf(v)])) })
      + KS.card({ title:'Вопросы клиентов', sub:'Сколько диалогов с этим вопросом', body:KS.chart('c-qs', Math.max(220, qs.length * 32)), table:KS.table([['Вопрос'], ['Диалогов', true]], qs.map(([k, v]) => [T('questions', k), nf(v)])) })
      + '</div>'
      + KS.card({ title:'Как звучат возражения', sub:'Дословно, свежие сверху. Имена и телефоны скрыты', body:qBlock })
      + (lost.length ? KS.card({ title:'Почему разговор закрылся без движения', sub:'Причина по тексту диалога', body:KS.bars(lost.map(([k, v]) => [T('lost_reason', k), v]), 2) }) : '')
      + '</div>';
  },

  price(){
    const weeks = DETAIL, n = labN(weeks);
    if(!n) return noLabels('Реакция на цену');
    const pr = sorted(lab(weeks, 'price_reaction')).filter(([k]) => k !== 'not_applicable');
    const tot = pr.reduce((a, x) => a + x[1], 0);
    const perW = k => weeks.map(w => { const o = lab([w], 'price_reaction'); const t = Object.entries(o).filter(([x]) => x !== 'not_applicable').reduce((a, x) => a + x[1], 0); return share(o[k] || 0, t); });
    const quotes = pickCodes().flatMap(c => (CAB(c).quotes.price || []).filter(q => weeks.includes(q.w)).map(q => Object.assign({ c }, q)));
    const grp = ['expensive', 'compares', 'negotiates', 'accepted', 'thinking'].map(k => {
      const qq = quotes.filter(q => q.r === k).slice(-4).reverse(); if(!qq.length) return '';
      return '<div class="op-ex"><div class="op-td-h">' + esc(T('price_reaction', k)) + '</div><ul class="op-list">' + qq.map(q => '<li>«' + esc(q.t) + '» <span class="op-muted">' + q.c + ', ' + wlabel(q.w) + '</span> · ' + chatLink(q.id) + '</li>').join('') + '</ul></div>';
    }).join('');
    DRAW = () => {
      KS.charts.hbar('c-pr', { cats:pr.map(([k]) => T('price_reaction', k)), data:pr.map(x => x[1]), slot:2, h:Math.max(200, pr.length * 38) });
      KS.charts.multi('c-prw', { cats:weeks.map(wlabel), series:[{ name:'Принял', data:perW('accepted'), slot:3 }, { name:'Пропал после цены', data:perW('silent'), slot:1 }], h:260 });
    };
    return KS.head({ title:'Реакция на цену: ' + cabName(), sub:'Как клиенты реагируют на названную цену. Диалогов, где обсуждали цену: ' + nf(tot) + '.', src:LBL_SRC, badges:[KS.kind('ГИПОТЕЗА')] })
      + '<div class="ks-stack"><div class="ks-grid-2">'
      + KS.card({ title:'Реакция после цены', sub:'Диалогов', body:KS.chart('c-pr', Math.max(200, pr.length * 38)), table:KS.table([['Реакция'], ['Диалогов', true], ['Доля', true]], pr.map(([k, v]) => [T('price_reaction', k), nf(v), pctS(share(v, tot))])) })
      + KS.card({ title:'Принял или пропал, по неделям', sub:'Доля от диалогов, где обсуждали цену, %', body:KS.chart('c-prw', 260),
          table:KS.table([['Неделя'], ['Принял, %', true], ['Пропал, %', true]], weeks.map((w, i) => [wlabel(w), pctS(perW('accepted')[i]), pctS(perW('silent')[i])])) })
      + '</div>'
      + KS.card({ title:'Что говорят о цене', sub:'Дословно, свежие сверху', body:grp || '<p class="op-muted">цитат нет</p>' })
      + '</div>';
  },

  phr(){
    const weeks = DETAIL;
    const mods = pickCodes().flatMap(c => (CAB(c).modules || []).filter(m => weeks.includes(m.w)).map(m => Object.assign({ cab:c }, m)));
    if(!labN(weeks)) return noLabels('Фразы, которые работают');
    const tech = DATA.techniques || [];
    const byStage = [5, 4, 3, 2].map(st => {
      const list = mods.filter(m => m.st === st).slice(-8).reverse(); if(!list.length) return '';
      return KS.card({ title:'После фразы клиент: ' + T('stage', String(st)).toLowerCase(), sub:nf(mods.filter(m => m.st === st).length) + ' случаев за 8 недель, показаны свежие',
        body:'<div class="op-mods">' + list.map(m => '<div class="op-mod"><div class="op-bub is-m">' + esc(m.m) + '<span class="op-tm">Менеджер · ' + m.cab + ' · ' + wlabel(m.w) + '</span></div>'
          + '<div class="op-bub is-c">' + esc(m.r) + '<span class="op-tm">Клиент · ' + chatLink(m.id) + '</span></div></div>').join('') + '</div>' });
    }).join('');
    return KS.head({ title:'Фразы, которые работают: ' + cabName(), sub:'Реплики менеджеров, после которых клиент сделал шаг к сделке. Сделок из Bitrix24 пока нет, поэтому успех это шаг в диалоге, а не оплата.',
        src:LBL_SRC, badges:[KS.kind('ГИПОТЕЗА')] })
      + '<div class="ks-stack">'
      + (tech.length ? KS.card({ title:'Приёмы, которые повторяются в удачных диалогах', sub:'Обобщение по всем найденным фразам',
          body:KS.table([['Приём'], ['Почему работает'], ['Пример']], tech.map(t => [esc(t.name), esc(t.why), '<span class="op-muted">«' + esc(t.example) + '»</span>']), { stack:true }) }) : '')
      + byStage + '</div>';
  },

  data(){
    return KS.head({ title:'Откуда цифры', sub:'Источник, правила расчёта и ограничения.', src:SRC(CODES[0]) + ' · ' + SRC(CODES[1]) })
      + '<div class="ks-stack">' + KS.card({ title:'Правила', body:METHOD }) + '</div>';
  }
};

function noLabels(title){
  return KS.head({ title, sub:'Смысловая разметка диалогов ещё не загружена.' })
    + KS.note('Нет разметки', 'Этот экран строится из разметки диалогов (data/labels.jsonl). Пересоберите страницу после разметки.', 'warn');
}
function stub(v){
  return KS.head({ title:TITLES[v] || 'Экран', sub:'Этот экран есть в основном дашборде ОП ГМ. В этом файле собран раздел «Детализация».' })
    + KS.action({ what:'Открыть сводку недели', who:'Детализация', when:'сейчас' });
}

/* ---------- панель деталей по плитке ---------- */
CODES.forEach(code => KPIS.forEach(([f, label, up, p, k]) => KS.drawer.register('kpi-' + code + '-' + f, () => {
  const s = CAB(code).series.filter(r => r.week <= selW());
  const cats = s.map(r => r.from_ + '-' + r.to);
  return { title:label, sub:code + ' · все недели до ' + wlabel(selW()), kind:k === 'D' ? 'ДАННЫЕ' : 'ГИПОТЕЗА',
    compose:'<p>' + esc(RULES[f] || 'Правило в разделе «Откуда цифры».') + '</p>',
    trend:KS.chart('c-dr', 240),
    trendTable:KS.table([['Неделя'], ['Значение', true], ['Обращений', true]], s.slice().reverse().map(r => [r.from_ + '-' + r.to, r[f] == null ? null : (p === 'p' ? pctS(r[f]) : nf(Math.round(r[f] * 10) / 10)), nf(r.inbound)])),
    source:'<p>' + esc(SRC(code)) + '. Скрипт build_weekly.py.</p>',
    action:(CAB(code).comments[selW()] || {}).fix ? { what:CAB(code).comments[selW()].fix, who:'РОП ОП ГМ', when:'проверка в понедельник' } : null,
    afterOpen:() => KS.charts.line('c-dr', { cats, data:s.map(r => r[f] == null ? null : Math.round(r[f] * 10) / 10), slot:3, h:240, suffix:p === 'p' ? '%' : '' }) };
})));

const RULES = {
  inbound:'Чаты, где первым написал или позвонил клиент. Неделя по дате первого обращения, МСК.',
  first_resp_work_bmin_med:'От первого обращения в рабочее время до первого живого сообщения или принятого звонка, в рабочих минутах (пн-пт 9-13, 14-18). Автоответ не в счёт. Медиана.',
  fast_pct:'Доля отвеченных обращений, где первый живой ответ пришёл за 15 рабочих минут. Ночное сообщение, отвеченное до 9:00, считается быстрым.',
  no_dozhim_pct:'Последнее слово наше, клиент молчит 2 дня и больше, повторного касания через 20+ часов нет. Напоминание бота Авито не в счёт.',
  price_named_pct:'Клиент спросил «сколько», «цена», «стоимость», и после этого в нашем ответе есть сумма в рублях.',
  contact_got_pct:'Клиент прислал в чат телефон или почту.',
  followup_pct:'Доля обращений, где мы написали повторно через 20+ часов, пока клиент молчал.',
  left_hanging:'Последним написал клиент, прошло больше 8 рабочих часов. «Спасибо», «подумаю», «позвоню» и оставленный телефон не в счёт.'
};
const METHOD = KS.table([['Показатель'], ['Как считается'], ['Класс']], [
  ['Обращение', esc(RULES.inbound), KS.kind('ДАННЫЕ')],
  ['Написали первыми', 'Чат открыт нашим шаблоном: «Вы просматривали наше объявление», акция, «Выбор памятника». Тот же шаблон в ответ клиенту считается ответом', KS.kind('ДАННЫЕ')],
  ['Первый ответ', esc(RULES.first_resp_work_bmin_med), KS.kind('ДАННЫЕ')],
  ['Ответ за 15 раб. мин', esc(RULES.fast_pct) + ' Норматив черновой.', KS.kind('ГИПОТЕЗА')],
  ['Назвали цену', esc(RULES.price_named_pct), KS.kind('ГИПОТЕЗА')],
  ['Не дожали', esc(RULES.no_dozhim_pct), KS.kind('ДАННЫЕ')],
  ['Клиент ждёт ответа', esc(RULES.left_hanging), KS.kind('ГИПОТЕЗА')],
  ['Пропущенный звонок без реакции', 'После пропущенного за 4 рабочих часа ни сообщения, ни принятого звонка', KS.kind('ДАННЫЕ')],
  ['Сегмент, категория, возражения, реакция на цену, фразы', 'Смысловая разметка каждого диалога моделью по LABELING_SPEC.md. Разметка проверена вручную на выборке. Успех это шаг клиента в диалоге (размеры, телефон, макет, оплата), а не сделка', KS.kind('ГИПОТЕЗА')],
  ['Ограничения', 'Один отправитель на кабинет, поэтому разбивки по менеджерам нет. Исходящие звонки не видны. До 100 последних сообщений на чат. Имена, отчества, телефоны и даты в цитатах скрыты', '']
], { stack:true });

/* ==========================================================================
   Каркас
   ========================================================================== */
let DRAW = null;
function render(){
  DRAW = null;
  el('view').innerHTML = '<div class="ks-fade">' + (SCREENS[VIEW] ? SCREENS[VIEW]() : stub(VIEW)) + '</div>';
  KS.charts.prune();
  el('nav').innerHTML = KS.nav(NAV, VIEW);
  el('seg').querySelectorAll('[data-w]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.w === SEL)));
  el('cab').querySelectorAll('[data-c]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.c === PICK)));
  el('arch').value = String(SEL);
  el('cab').hidden = ['sum', 'dyn', 'data'].includes(VIEW) || !SCREENS[VIEW];
  el('stamp').textContent = 'неделя ' + wlabel(selW()) + (isOpen() ? ', не закрыта' : '');
  el('foot').textContent = 'Детализация ОП GLASS-MEMORY. Данные Авито по 22.09.2026, пересборка скриптами в sales-detalizaciya.';
  el('theme').innerHTML = KS.theme.icon();
  KS.ticker.run(el('view'));
  requestAnimationFrame(() => { if(DRAW) DRAW(); });
}
KS.charts.onTheme = () => render();
const go = v => KS.vt(() => { VIEW = v; render(); window.scrollTo(0, 0); });
KS.navWire(el('nav'), go);
KS.shell.init({ sidebar:'#sb', backdrop:'#bd', menu:'#menu' });
const last = DETAIL.length - 1;
el('seg').innerHTML = [[last, 'прошлая'], [last - 1, '2 нед. назад'], [last - 2, '3 нед. назад']]
  .map(([k, t]) => '<button type="button" data-w="' + k + '" aria-pressed="false">' + t + '</button>').join('');
KS.seg.wire(el('seg'));
el('cab').innerHTML = [['all', 'оба'], ...CODES.map(c => [c, c])].map(([k, t]) => '<button type="button" data-c="' + k + '" aria-pressed="false">' + t + '</button>').join('');
KS.seg.wire(el('cab'));
el('arch').innerHTML = WEEKS.map((w, i) => '<option value="' + i + '">' + wlabel(w) + (OPENW.includes(w) ? ' (не закрыта)' : '') + '</option>').reverse().join('');
const pick = v => { SEL = +v; if(!WEEK_SCREENS.includes(VIEW)) VIEW = 'sum'; render(); };
el('seg').addEventListener('click', e => { const b = e.target.closest('[data-w]'); if(b) pick(b.dataset.w); });
el('cab').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if(b){ PICK = b.dataset.c; render(); } });
el('arch').addEventListener('change', e => pick(e.target.value));
el('theme').addEventListener('click', () => KS.theme.toggle());
el('cmdkb').outerHTML = KS.cmdk.button();
KS.cmdk.set([
  { group:'Детализация', label:'Сводка недели', icon:'grid', run:() => go('sum') },
  { group:'Детализация', label:'Динамика кабинетов', icon:'chart', run:() => go('dyn') },
  { group:'Детализация', label:'Плюсы и косяки', icon:'warn', run:() => go('score') },
  { group:'Детализация', label:'Кто пишет и о чём', icon:'users', run:() => go('who') },
  { group:'Детализация', label:'Возражения и вопросы', icon:'quote', run:() => go('obj') },
  { group:'Детализация', label:'Реакция на цену', icon:'wallet', run:() => go('price') },
  { group:'Детализация', label:'Фразы, которые работают', icon:'bulb', run:() => go('phr') },
  { group:'Действия', label:'Сменить тему', icon:'moon', keywords:'тёмная светлая', run:() => KS.theme.toggle() },
  { group:'Действия', label:'Переключить плотность', icon:'rows', keywords:'компактно просторно', run:() => KS.density.toggle() }
]);
KS.theme.init();
render();
const densUi = () => { const b = el('dens'); b.innerHTML = KS.density.icon(); b.setAttribute('data-tip', 'Плотность: ' + KS.density.label().toLowerCase()); };
el('dens').addEventListener('click', () => KS.density.toggle());
document.addEventListener('ks:density', densUi);
densUi();
