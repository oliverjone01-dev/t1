/* Разделы v3: архив по скриншотам июля, разборы, скрипты, план, профили Bitrix. Данные из D (расшифровка).
   Собраны из компонентов Контур DS 1.5: шапка экрана, плитки одной панелью, полосы, таблицы, статус точкой
   и словом, чек-листы. Своей разметки только список диалогов и переписка в разборе (стили в opgm.css).
   note: врезка экрана из opgm.js (архив или отдельный источник), встаёт сразу под шапкой. */
let D = null, FS = { account:'all', speed:'all', outcome:'all', problem:'all', q:'', sort:'worst', limit:60 };
const esc = s => KS.fmt.esc(s == null ? '' : String(s));
const SPD = { fast:'за 10 мин', ok:'10-60 мин', slow:'больше часа', overnight:'на след. день' };
const SPD_T = { fast:'ok', ok:'warn', slow:'crit', overnight:'crit' };
const OUT = { progressing:'живой', stalled:'завис', dropped:'ушёл', ordered:'заказ', unclear:'неясно' };
const OUT_T = { progressing:'ok', ordered:'ok', stalled:'warn', dropped:'crit', unclear:'neutral' };
const SHOTS = 'Скриншоты чатов Авито, июль 2026 · GLASS-MEMORY';

function host(id){ return document.getElementById('p-' + id); }
function lhead(o, note){ return KS.head(Object.assign({ src:SHOTS, badges:[KS.kind('ДАННЫЕ')] }, o)) + (note || ''); }
function shot(v){ return KS.F(v, 'ДАННЫЕ', 'Скриншоты Авито, июль 2026 · архив'); }
function tile(label, v, icon){ return KS.tile({ label, f:shot(v), icon, delta:NOROW }); }
/* широкая таблица прокручивается внутри своей обёртки: липкая шапка не наезжает на строки (как scrollWrap в opgm.js) */
function scrollWrap(html){ return html.replace('class="ks-table-wrap"', 'class="ks-table-wrap ks-table-wrap--scroll"'); }
/* дробные через запятую, как в остальном сайте */
function dec(v){ return String(v).replace('.', ','); }
function plural(n, one, few, many){ const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; }
/* архив это один срез: сравнивать не с чем, и плитка говорит об этом, а не молчит */
const NOROW = '<div class="ks-delta is-na" data-tip="архив это один срез июля: сравнивать не с чем">одна точка</div>';
/* строка про деньги (Контур DS: обязательна на каждом экране). Сумм заказов в скриншотах нет, поэтому без рублей */
const MONEY = {
  problems:'<b>Деньги.</b> Проблемы стоят заказов по-разному: где клиент прочитал и ушёл молча или его не дожали, разговор продолжился в 12-13 переписках из 100, в среднем по архиву в 46. Сумм заказов в скриншотах нет, потеря в рублях не считается.',
  speed:'<b>Деньги.</b> Чем позже первый ответ, тем чаще клиент уже заказал у другого. Сумм заказов в скриншотах нет, потеря в рублях не считается.',
  quality:'<b>Деньги.</b> Напоминание о себе связано с продолжением разговора: где клиента не дожали, продолжились 13 переписок из 100, в остальных 56. Цена сама по себе разницы в архиве не дала: без цены 45 из 100, с ценой 46.',
  dialogues:'<b>Деньги.</b> Сумм заказов в переписках нет: где клиент назвал бюджет или размер, это видно в тексте диалога.',
  teardowns:'<b>Деньги.</b> Где клиенту назвали цену, сумма заказа видна прямо в переписке разбора. Итог в рублях не считается: чем закончился разговор, скриншоты не показывают.',
  scripts:'<b>Деньги.</b> Клиенты из переписок уже пришли по оплаченному объявлению. В архиве, где дожим не пропустили, разговор продолжался в 56 случаях из 100, где пропустили, в 13: скрипты дожима закрывают эту разницу.',
  actions:'<b>Деньги.</b> Первые три шага меняют правила ответа, а не бюджет: денег на них почти не нужно.',
  manager:'<b>Деньги.</b> Суммы сделок этого менеджера в Bitrix24; в разборе аналитика их нет, и с цифрами Авито они не связаны.'
};
function sec(t){ return '<h2 class="ks-h2">' + esc(t) + '</h2>'; }

function renderOverview(note){
  const M = D.metrics, m = D.meta, T = D.talks, sb = M.speed_buckets, slow = Math.round((sb.slow || 0) + (sb.overnight || 0));
  host('overview').innerHTML = lhead({ title:'Как мы теряем клиентов в переписке', sub:T.hero.line,
      lead:'<b>Почему это деньги.</b> На Авито из обращения в заказ доходит обычно 3-5 человек из 100 ' + KS.kind('ГИПОТЕЗА')
        + ' <span class="ks-muted">бенчмарк рынка</span>. Мы роняем людей раньше этой точки: на скорости ответа и молчании после цены.' }, note)
    + '<div class="ks-grid-kpi">'
      + tile('Обращаются по имени', dec(M.name) + '%', 'users') + tile('Отвечают дольше часа', slow + '%', 'clock')
      + tile('Напоминают о себе', dec(M.follow) + '%', 'target') + tile('Прочитал и ушёл молча', dec(M.left) + '%', 'warn') + '</div>'
    + KS.note('Как читать', 'Верхний ряд: доля переписок, где менеджер сделал нужное или клиент ушёл. Нижний: объём выборки и скорость. Всё по скриншотам июля, поэтому это архив для сравнения с API.', 'info')
    + sec('Коротко о цифрах')
    + '<div class="ks-grid-kpi">'
      + tile('Всего переписок', m.total, 'quote') + tile('Разобрано подробно', m.processed, 'list')
      + tile('Первый ответ, медиана', M.lag_median + ' мин', 'clock') + tile('Зависшие переписки', dec(M.outcomes.stalled || 0) + '%', 'loss') + '</div>'
    + KS.card({ title:'Что внутри выборки', body:'<p class="op-hint">В разборе ' + m.processed + ' ' + plural(m.processed, 'переписка', 'переписки', 'переписок') + ': ' + m.old + ' в старом кабинете и ' + m.new + ' в новом, '
      + m.valid + ' с читаемым текстом. Имя менеджера в чате Авито не видно, поэтому разбор по кабинету и по диалогу. '
      + 'Время ответа восстановлено по скриншотам и местами приблизительно; поведение (имя, дожим, приветствие) видно точно.</p>' });
}

function renderProblems(note){
  const P = D.problem_scale;
  host('problems').innerHTML = lhead({ title:'Типовые проблемы', sub:'Каждая полоса это ошибка в переписке и число диалогов, где она встретилась.', lead:MONEY.problems }, note)
    + KS.card({ title:'Сколько диалогов задето', sub:'из ' + D.meta.valid + ' разобранных, в скобках доля',
        body:KS.bars(P.map(p => [p.label, p.count, '(' + String(p.pct).replace('.', ',') + '%)'])) });
}

function renderSpeed(note){
  const S = D.talks.speed, sb = D.metrics.speed_buckets;
  const map = [['fast', 'За 10 минут', 'так и надо'], ['ok', 'За 10-60 минут', 'поздновато'], ['slow', 'Дольше часа, в тот же день', 'клиент уже пишет другим'], ['overnight', 'На следующий день или позже', 'заказ чаще всего ушёл']];
  host('speed').innerHTML = lhead({ title:S.title, sub:S.sub, lead:MONEY.speed }, note)
    + KS.card({ title:'Когда пришёл первый ответ', sub:'доля переписок, %', body:KS.bars(map.map(([k, n, t]) => [n, sb[k] || 0, t])) })
    + KS.note('Главное', 'За 10 минут ответили в ' + dec(sb.fast || 0) + '% переписок. Дольше часа в тот же день в ' + dec(sb.slow || 0) + '%, на следующий день или позже в ' + dec(sb.overnight || 0) + '%: это почти каждая вторая переписка.', 'info');
}

function renderQuality(note){
  const Q = D.talks.quality, M = D.metrics, a = M.accounts;
  const bars = [['Поздоровались', M.greet], ['Назвали по имени', M.name], ['Спросили, что нужно', M.qual], ['Назвали цену', M.price], ['Напомнили о себе', M.follow], ['Клиент прочитал и ушёл молча', M.left]];
  host('quality').innerHTML = lhead({ title:Q.title, sub:Q.sub, lead:MONEY.quality }, note)
    + KS.card({ title:'Что делают в переписке', sub:'доля переписок, %', body:KS.bars(bars) })
    + KS.card({ title:'Старый кабинет против нового', body:scrollWrap(KS.table([['Показатель'], ['Старый (' + a.old.n + ')', true], ['Новый (' + a.new.n + ')', true]], [
        ['Первый ответ, медиана', a.old.lag_median + ' мин', a.new.lag_median + ' мин'],
        ['Прочитал и ушёл молча', dec(a.old.left) + '%', dec(a.new.left) + '%'],
        ['Напомнили о себе', dec(a.old.follow) + '%', dec(a.new.follow) + '%'],
        ['Переписок зависло', dec(a.old.stalled) + '%', dec(a.new.stalled) + '%']])) })
    + KS.note('Главное', esc(Q.punch), 'info');
}

function renderFunnel(note){
  const F = D.talks.funnel, R = D.talks.redflags, M = D.metrics, ST = F.steps;
  /* шаги 1-2 из разбора (ответ видно только на скриншоте), 3-4 из счётчиков архива: те же числа, что на «Как общаемся» */
  const steps = [[ST[0].lab, ST[0].val, ''], [ST[1].lab, ST[1].val, ST[1].drop ? '(' + ST[1].drop + ')' : ''],
    [ST[2].lab, Math.round(M.price), '(' + dec(M.price) + '%, цену назвали)'], [ST[3].lab, Math.round((M.outcomes.progressing || 0) + (M.outcomes.ordered || 0)), '(живые и заказы)']];
  host('funnel').innerHTML = lhead({ title:F.title, sub:F.sub, lead:'<b>Где утекают деньги.</b> ' + esc(F.punch) }, note)
    + KS.card({ title:'Из 100 написавших', sub:'первые два шага по разбору, два последних по счётчикам архива', body:KS.bars(steps) })
    + KS.card({ title:R.title, body:scrollWrap(KS.table([['Что происходит'], ['Почему теряем'], ['Как часто, оценка разбора']], R.items.map(f => [esc(f.t), esc(f.d), esc(f.freq)]), { stack:true })) });
}

/* ---------- все переписки с фильтрами ---------- */
const PROBSHORT = { slow_reply:'медленно', no_name:'без имени', no_followup:'не дожали', left_on_read:'ушёл молча', no_price:'без цены', no_qualify:'без вопросов', no_greeting:'без приветствия',
  scope_refusal:'«не работаем с камнем»', template_only:'шаблон', redirect_calculator:'на калькулятор', phone_instead_of_answer:'просил телефон', objection_unhandled:'возражение' };
function fsel(id, label, dim, opts){
  return '<div class="ks-field"><label class="ks-field-label" for="' + id + '">' + esc(label) + '</label><select class="ks-select" id="' + id + '" data-dim="' + dim + '">'
    + opts.map(([v, l]) => '<option value="' + esc(v) + '"' + (FS[dim] === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></div>';
}
function buildFilterUI(note){
  const h = host('dialogues');
  h.innerHTML = lhead({ title:'Разбор всех диалогов', sub:D.meta.valid + ' ' + plural(D.meta.valid, 'переписка', 'переписки', 'переписок') + ' с читаемым текстом из ' + D.meta.processed + '. Фильтры пересобирают список сразу.', lead:MONEY.dialogues }, note)
    + KS.card({ body:'<div class="op-filters">'
      + fsel('lf-acc', 'Кабинет', 'account', [['all', 'Оба'], ['old', 'Старый'], ['new', 'Новый']])
      + fsel('lf-spd', 'Скорость ответа', 'speed', [['all', 'Любая']].concat(Object.keys(SPD).map(k => [k, SPD[k]])))
      + fsel('lf-out', 'Исход', 'outcome', [['all', 'Любой'], ['progressing', 'Живой'], ['stalled', 'Завис'], ['dropped', 'Ушёл'], ['ordered', 'Заказ']])
      + fsel('lf-prob', 'Проблема', 'problem', [['all', 'Любая']].concat(D.problem_scale.map(p => [p.key, p.label + ' (' + p.count + ')'])))
      + '<div class="ks-field"><label class="ks-field-label" for="lf-q">Поиск</label><input class="ks-input" id="lf-q" placeholder="слово в переписке" value="' + esc(FS.q) + '"></div>'
      + fsel('lf-sort', 'Порядок', 'sort', [['worst', 'Худшие сверху'], ['default', 'По порядку']])
      + '</div>' })
    + '<div class="op-count" id="fcount" aria-live="polite"></div><div id="dlist"></div><div class="op-more" id="morewrap"></div>';
  h.querySelectorAll('select[data-dim]').forEach(s => s.addEventListener('change', () => { FS[s.dataset.dim] = s.value; FS.limit = 60; applyF(); }));
  h.querySelector('#lf-q').addEventListener('input', e => { FS.q = e.target.value; FS.limit = 60; applyF(); });
  applyF();
}
const SEVRANK = { overnight:0, slow:1, ok:2, fast:3 };
function applyF(){
  let list = D.dialogues.filter(d => !d.empty);
  if(FS.account !== 'all') list = list.filter(d => d.account === FS.account);
  if(FS.speed !== 'all') list = list.filter(d => d.speed === FS.speed);
  if(FS.outcome !== 'all') list = list.filter(d => d.outcome === FS.outcome);
  if(FS.problem !== 'all') list = list.filter(d => d.problems.includes(FS.problem));
  if(FS.q.trim()){ const q = FS.q.toLowerCase(); list = list.filter(d => (d.summary + ' ' + d.quote + ' ' + d.id).toLowerCase().includes(q)); }
  if(FS.sort === 'worst') list = list.slice().sort((a, b) => (SEVRANK[a.speed] - SEVRANK[b.speed]) || (b.problems.length - a.problems.length));
  const total = list.length, shown = list.slice(0, FS.limit);
  document.getElementById('fcount').innerHTML = 'Найдено <b>' + total + '</b> переписок' + (total > FS.limit ? ', показаны первые ' + FS.limit : '');
  document.getElementById('dlist').innerHTML = shown.length ? KS.card({ body:'<div class="op-list">' + shown.map(dRow).join('') + '</div>' })
    : KS.note('Ничего не найдено', 'Ослабьте фильтры или очистите поиск.', 'info');
  const mw = document.getElementById('morewrap');
  mw.innerHTML = total > FS.limit ? '<button type="button" class="ks-btn ks-btn--secondary" id="moreb">Показать ещё ' + Math.min(60, total - FS.limit) + '</button>' : '';
  if(total > FS.limit) document.getElementById('moreb').addEventListener('click', () => { FS.limit += 60; applyF(); });
}
function dRow(d){
  const probs = d.problems.map(p => PROBSHORT[p] || p).join(' · ');
  return '<div class="op-li"><div class="op-dlg-head"><span class="op-dlg-name">' + esc(d.id) + '</span><span>' + (d.account === 'old' ? 'старый кабинет' : 'новый кабинет') + '</span>'
    + KS.status(SPD[d.speed] || '?', SPD_T[d.speed], 'первый ответ') + KS.status(OUT[d.outcome] || d.outcome, OUT_T[d.outcome], 'исход переписки')
    + (d.manager ? '<span>' + esc(d.manager) + '</span>' : '') + '</div>'
    + (d.summary ? '<div class="op-dlg-said">' + esc(d.summary) + '</div>' : '')
    + (d.quote ? '<div class="op-quote">«' + esc(d.quote) + '»</div>' : '')
    + (probs ? '<div class="op-muted">Проблемы: ' + esc(probs) + '</div>' : '') + '</div>';
}

/* ---------- детальные разборы ---------- */
function renderTeardowns(note){
  const SEV = { red:['потеряли', 'crit'], yellow:['спорно', 'warn'], green:['хороший пример', 'ok'] };
  const cards = D.talks.teardowns.map(t => {
    const chat = t.chat.map(m => '<div class="op-bub is-' + (m.who === 'Клиент' ? 'c' : 'm') + '">' + esc(m.tx) + '<span class="op-tm">' + esc(m.who) + (m.tm ? ' · ' + esc(m.tm) : '') + '</span></div>').join('');
    const s = SEV[t.sev] || SEV.yellow;
    return KS.card({ title:t.cli, sub:t.acc + ' кабинет · ' + t.date, actions:KS.status(s[0], s[1]),
      body:'<div class="op-tl">' + chat + '</div>'
        + '<div class="ks-grid-2 op-td"><div><div class="op-td-h">Что не так</div>' + ((t.wrong || []).length ? KS.checks(t.wrong, 'crit') : '<p class="op-muted">нет</p>') + '</div>'
        + '<div><div class="op-td-h">Что хорошо</div>' + ((t.right || []).length ? KS.checks(t.right, 'ok') : '<p class="op-muted">нет</p>') + '</div></div>'
        + '<p class="op-hint op-fix"><b>Как надо:</b> ' + esc(t.fix) + '</p>' });
  }).join('');
  host('teardowns').innerHTML = lhead({ title:'Разбор диалогов: что пошло не так', sub:D.talks.teardowns.length + ' показательных переписок. Статус у заголовка: потеряли, спорно или хороший пример. Внизу каждой: как надо было.', lead:MONEY.teardowns }, note)
    + cards;
}

/* ---------- скрипты и лид-магниты ---------- */
const COPY = '<button type="button" class="ks-btn ks-btn--secondary ks-btn--sm" data-copy>скопировать</button>';
function tpl(text){ return '<div class="op-tpl">' + esc(text) + '</div>'; }
function renderScripts(note){
  const core = (D.scripts && D.scripts.core && D.scripts.core.categories) || [];
  const objs = (D.scripts && D.scripts.objections && D.scripts.objections.objections) || [];
  const mags = (D.magnets && D.magnets.magnets) || [];
  const groups = core.map((c, i) => ['sc' + i, c.title + ' (' + (c.scripts || []).length + ')',
      (c.scripts || []).map(s => KS.card({ title:s.case, actions:COPY, body:tpl(s.text) + (s.note ? '<p class="op-muted op-after">' + esc(s.note) + '</p>' : '') })).join('')])
    .concat([['obj', 'Возражения (' + objs.length + ')', objs.map(o => KS.card({ title:o.name, actions:COPY,
      body:'<p class="op-hint">Клиент: «' + esc(o.trigger) + '»</p>' + (o.psych ? '<p class="op-muted op-after">' + esc(o.psych) + '</p>' : '') + tpl(o.response)
        + (o.then ? '<p class="op-hint op-after"><b>Дальше:</b> ' + esc(o.then) + '</p>' : '') })).join('')],
      ['mag', 'Лид-магниты (' + mags.length + ')', KS.note('Как пользоваться', 'Каждый магнит один раз собрать (каталог, гайд, видео, образец договора), дальше менеджер высылает готовый файл с подводкой. Начать с первых трёх: они закрывают самые частые сомнения.', 'info')
        + mags.map(m => KS.card({ title:m.name, sub:[m.when, m.format].filter(Boolean).join(' · '), actions:m.pitch ? COPY : '',
          body:'<p class="op-hint">' + esc(m.what) + '</p>' + (m.pitch ? tpl(m.pitch) : '') })).join('')]]);
  const h = host('scripts');
  h.innerHTML = lhead({ title:'Скрипты и лид-магниты', sub:'Готовые фразы: менеджер копирует и отправляет. [Имя] заменить на имя клиента из чата.', badges:[], lead:MONEY.scripts }, note)
    + KS.card({ body:'<div class="ks-field"><label class="ks-field-label" for="sc-grp">Раздел</label><select class="ks-select" id="sc-grp">'
      + groups.map(g => '<option value="' + g[0] + '">' + esc(g[1]) + '</option>').join('') + '</select></div>' })
    + groups.map((g, i) => '<div class="ks-stack" data-grp="' + g[0] + '"' + (i ? ' hidden' : '') + '>' + g[2] + '</div>').join('');
  h.querySelector('#sc-grp').addEventListener('change', e => { h.querySelectorAll('[data-grp]').forEach(x => { x.hidden = x.dataset.grp !== e.target.value; }); });
  h.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]'); if(!b) return;
    const t = b.closest('.ks-card').querySelector('.op-tpl'); if(!t || !navigator.clipboard) return;
    navigator.clipboard.writeText(t.innerText).then(() => KS.toast('Скопировано', 'ok'), () => KS.toast('Не удалось скопировать', 'warn'));
  });
}

function renderActions(note){
  const cards = D.talks.actions.map((a, i) => KS.card({ title:(i + 1) + '. ' + a.t, actions:KS.badge(a.pr, 'neutral', a.pr === 'P1' ? 'P1: первым делом' : 'P2: после P1'),
    body:'<p class="op-hint">' + esc(a.why) + '</p><dl class="ks-action-meta"><dt>что делать:</dt><dd>' + esc(a.how) + '</dd><dt>кто:</dt><dd>' + esc(a.who) + '</dd></dl>' })).join('');
  host('actions').innerHTML = lhead({ title:'Что делать дальше', sub:D.talks.actions.length + ' шагов. Первые три с пометкой P1 самые важные и почти ничего не стоят.', badges:[], lead:MONEY.actions }, note) + cards;
}

/* ---------- профили менеджеров (Bitrix24, отдельный источник) ---------- */
function renderNavNames(){ document.querySelectorAll('.nm').forEach(sp => { sp.textContent = D.MGRS[sp.getAttribute('data-mgr')].name; }); }
function renderManager(key, note){
  const m = D.MGRS[key], h = host(key); if(!h) return;
  h.innerHTML = KS.head({ title:m.name, sub:m.oneliner, src:'Bitrix24 · разбор штатного аналитика · ' + m.deals + ' ' + plural(m.deals, 'сделка', 'сделки', 'сделок'), lead:MONEY.manager }) + (note || '')
    + KS.card({ title:'Профиль', body:'<p class="op-hint">' + esc(m.profile) + '</p>' })
    + '<div class="ks-grid-2">' + KS.card({ title:'Сильные стороны', body:KS.checks(m.strong, 'ok') }) + KS.card({ title:'Провалы', body:KS.checks(m.weak, 'crit') }) + '</div>'
    + KS.card({ title:'Поведенческая подпись', body:'<p class="op-hint">' + esc(m.sign) + '</p>' })
    + KS.card({ title:'Что чинить', body:'<p class="op-hint">' + esc(m.fix) + '</p>' });
}
