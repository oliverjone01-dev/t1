/* Витрина Контур DS. Всё отрисовано самим китом: витрина это и документация, и тест. */
(function(){
const { esc, nf, money, ruDate } = KS.fmt, F = KS.F, ic = KS.ic;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---------- пример данных: ряд Контура по GENGLASS, для иллюстрации ---------- */
const SER = [{"date":"2026-08-20","top10":410,"vis":39},{"date":"2026-08-25","top10":423,"vis":38},{"date":"2026-08-26","top10":423,"vis":38},{"date":"2026-08-28","top10":417,"vis":37},{"date":"2026-08-29","top10":417,"vis":37},{"date":"2026-08-30","top10":417,"vis":37},{"date":"2026-08-31","top10":417,"vis":37},{"date":"2026-09-01","top10":434,"vis":37},{"date":"2026-09-02","top10":434,"vis":37},{"date":"2026-09-05","top10":444,"vis":17},{"date":"2026-09-06","top10":444,"vis":17},{"date":"2026-09-07","top10":444,"vis":17},{"date":"2026-09-10","top10":426,"vis":17},{"date":"2026-09-13","top10":428,"vis":17},{"date":"2026-09-15","top10":426,"vis":17},{"date":"2026-09-18","top10":432,"vis":23},{"date":"2026-09-19","top10":432,"vis":23}];
const YM = [{"date":"2026-09-05","v":373,"s":52},{"date":"2026-09-06","v":423,"s":68},{"date":"2026-09-07","v":435,"s":94},{"date":"2026-09-08","v":455,"s":90},{"date":"2026-09-09","v":444,"s":90},{"date":"2026-09-10","v":375,"s":58},{"date":"2026-09-11","v":372,"s":74},{"date":"2026-09-12","v":350,"s":64},{"date":"2026-09-13","v":393,"s":77},{"date":"2026-09-14","v":432,"s":87},{"date":"2026-09-15","v":417,"s":98},{"date":"2026-09-16","v":444,"s":111},{"date":"2026-09-17","v":416,"s":91},{"date":"2026-09-18","v":420,"s":90}];
const CAMP = [["Поиск, высокочастотные",26798],["Поиск, среднечастотные",43641],["Поиск, низкочастотные",51594],["Ретаргет",15043],["РСЯ, десктоп",35469],["РСЯ, мобильные",0]];
const SRC = 'пример: ряд Контура по GENGLASS, keys.so';
const cats = SER.map(r => ruDate(r.date).slice(0,5));

/* ---------- контраст из живых токенов ---------- */
const lin = c => { c/=255; return c<=0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
const lum = h => { h=h.replace('#',''); const r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16); return .2126*lin(r)+.7152*lin(g)+.0722*lin(b); };
const ratio = (a,b) => { if(!/^#[0-9a-f]{6}$/i.test(a)||!/^#[0-9a-f]{6}$/i.test(b)) return null; const x=lum(a), y=lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
/* подпись на цветной плашке: белая или почти чёрная, что контрастнее */
const onColor = c => (ratio(c,'#FFFFFF')||0) >= (ratio(c,'#0A0C0E')||0) ? '#FFFFFF' : '#0A0C0E';
const pxOf = t => { const d = document.createElement('span'); d.style.fontSize = 'var(' + t + ')'; document.body.appendChild(d); const v = getComputedStyle(d).fontSize; d.remove(); return v; };
const mixHex = (fg,bg,a) => '#'+[0,2,4].map(i=>Math.round(parseInt(fg.slice(1+i,3+i),16)*a+parseInt(bg.slice(1+i,3+i),16)*(1-a)).toString(16).padStart(2,'0')).join('');

/* ================= шапка ================= */
function hero(){
  document.getElementById('sp-theme').innerHTML = KS.theme.icon() + '<span>' + (KS.theme.isDark() ? 'Светлая тема' : 'Тёмная тема') + '</span>';
  const facts = [['53','цветовых токена на тему, все проверены'],['16','компонентов с состояниями'],['24 из 24','испорченных версий ловит сторож'],['5','ширин проверены: 360, 390, 768, 1024, 1440']];
  document.getElementById('sp-facts').innerHTML = facts.map(f => '<div class="sp-fact"><b>'+f[0]+'</b><span>'+esc(f[1])+'</span></div>').join('');
  const rules = [
    ['Деньги первыми','На каждом экране строка про рубли. Если цифры нет, так и написано, а не нарисовано.'],
    ['Цифра в конверте','Значение, класс ДАННЫЕ, ГИПОТЕЗА или ДЕМО, источник, дата. Выгрузки нет, значит прочерк.'],
    ['Сравнение важнее абсолюта','Каждая плитка с дельтой за период. Первый экран отвечает, стало лучше или хуже.'],
    ['Цвет вычислен','Контраст и различимость палитры считаются скриптом, а не оцениваются на глаз.'],
    ['Провал виден','Разрыв в ряду, скачок, совпавшие выгрузки выводятся на экран, а не подчищаются.']];
  document.getElementById('sp-rules').innerHTML = rules.map(r => '<div class="sp-rule"><b>'+esc(r[0])+'</b><p>'+esc(r[1])+'</p></div>').join('');
}

/* ================= цвет ================= */
function sw(token, role, opts){
  const o = opts || {}, val = css(token);
  const on = o.on ? css(o.on) : null;
  const r = o.against ? o.against.map(a => [a, ratio(val, css(a))]).filter(x => x[1]) : [];
  const worst = r.length ? Math.min(...r.map(x => x[1])) : null;
  const need = o.need || 0;
  const badge = worst == null ? '' : KS.badge(worst.toFixed(1).replace('.',',') + ':1', worst >= need ? 'ok' : 'crit', 'худший контраст на ' + r.map(x=>x[0]+' '+x[1].toFixed(2)).join(', '));
  const chipStyle = (o.text||o.icon) ? 'background:var(--surface);color:'+val : 'background:'+val+';color:'+(on||'var(--text-strong)');
  return '<div class="sp-sw"><div class="sp-sw-chip" style="'+chipStyle+'">'+(o.text ? 'Текст 13' : o.icon ? ic('chev',18)+ic('x',16) : (o.label||''))+'</div>'
    + '<div class="sp-sw-meta"><div class="ks-row" style="justify-content:space-between"><span class="sp-sw-name">'+token+'</span>'+badge+'</div>'
    + '<span class="sp-sw-hex">'+esc(val)+'</span><span class="sp-sw-role">'+esc(role)+'</span></div></div>';
}
function color(){
  const S = ['--bg','--surface','--surface-2'];
  document.getElementById('sw-surface').innerHTML = [
    sw('--bg','фон страницы'), sw('--surface','карточка, плитка, меню'), sw('--surface-2','подложка, наведение'),
    sw('--surface-3','поле ввода, код'), sw('--border','граница карточки'), sw('--border-strong','граница при наведении, пунктир строки денег')].join('');
  document.getElementById('sw-text').innerHTML = [
    sw('--text-strong','заголовки и значения, не ниже 7:1',{text:1,against:S,need:7}),
    sw('--text','основной текст, не ниже 4,5:1',{text:1,against:S,need:4.5}),
    sw('--text-muted','подписи, источник, дата, не ниже 4,5:1',{text:1,against:S,need:4.5}),
    sw('--text-faint','не для чтения: выключенное и значки-указатели, не ниже 3:1',{icon:1,against:S,need:3}),
    sw('--text-link','ссылка',{text:1,against:S,need:4.5})].join('');
  const bg = css('--surface'), tx = css('--text');
  const op = [80,70,55,40].map(a => { const c = mixHex(tx, bg, a/100), r = ratio(c, bg); return [a, r]; });
  document.getElementById('sp-opacity').innerHTML = KS.note('Почему нет прозрачности на тексте',
    'В Контуре подписи приглушались классами opacity-40..70, это полсотни мест. В текущей теме основной текст с прозрачностью даёт: '
    + op.map(x => '<span class="ks-num">'+x[0]+'% → '+x[1].toFixed(2).replace('.',',')+':1</span>').join(', ')
    + '. Для мелкого текста нужно 4,5:1, так что большая часть этих подписей не читалась. Прозрачность заменена текстовыми ступенями; самая бледная, --text-faint, для чтения не используется вовсе.', 'warn');
  document.getElementById('sw-status').innerHTML = [
    sw('--primary','кнопка, фокус, активный пункт',{on:'--primary-foreground',label:'Кнопка'}),
    sw('--ok','хорошо: рост, данные подтверждены',{text:1,against:['--surface'],need:4.5}),
    sw('--warn','внимание: гипотеза, сборка',{text:1,against:['--surface'],need:4.5}),
    sw('--serious','серьёзно: подсказка, риск',{text:1,against:['--surface'],need:4.5}),
    sw('--crit','критично: демо, провал, стоп',{text:1,against:['--surface'],need:4.5})].join('');
  const ramp = (pref, n, label) => '<div style="margin-bottom:var(--sp-3)"><div class="ks-row" style="justify-content:space-between;margin-bottom:var(--sp-1-5)"><span class="sp-sw-name">'+label+'</span></div><div class="sp-ramp">'
    + Array.from({length:n},(_,i)=>{ const t=pref+(i+1), c=css(t); return '<div style="background:'+c+';color:'+onColor(c)+'" title="'+t+' '+c+'">'+c+'</div>'; }).join('') + '</div></div>';
  document.getElementById('sw-charts').innerHTML =
    ramp('--cat-',5,'Категориальные --cat-1..5: фиолетовый, бирюзовый, синий, янтарный, голубой. Порядок фиксирован, по кругу не идут')
    + ramp('--seq-',5,'Последовательная --seq-1..5: один тон, для тепловых карт и величины')
    + '<div class="ks-row" style="gap:var(--sp-2)"><span class="sp-sw-name">Расходящаяся:</span>'
    + ['--div-warm','--div-mid','--div-cool'].map(t => '<span class="ks-badge ks-badge--neutral" style="background:'+css(t)+';color:'+onColor(css(t))+'">'+t.slice(6)+' '+css(t)+'</span>').join('') + '</div>'
    + '<div style="margin-top:var(--sp-3)">' + KS.note('Палитра дизайн-системы не равна палитре графиков',
      'Исходные цвета TailwindAdmin хороши для интерфейса и проваливают проверки для меток на графике: синий #5D87FF и голубой #49BEFF при обычном зрении различаются на ΔE 14,4 при пороге 15. Поэтому графики красятся отдельной пятёркой, прошедшей валидатор в обеих темах.', 'info') + '</div>';
}

/* ================= типографика, отступы, иконки ================= */
function foundations(){
  const ts = [['--fs-hero','Значение плитки','444','hero'],['--fs-h1','Заголовок экрана','Стало лучше или хуже'],['--fs-h2','Раздел внутри экрана','Разбор по метрикам'],
    ['--fs-base','Заголовок карточки','Запросы в топ-10 по дням'],['--fs-body','Основной текст','Три звена из пяти это гипотезы, поэтому итог тоже гипотеза.'],
    ['--fs-small','Таблицы, врезки','Отрезком раньше было 410'],['--fs-caption','Подпись плитки','Запросов в топ-10'],['--fs-micro','Источник, оси','keys.so · снято 19.09.2026'],['--fs-badge','Бейдж, только капс','ГИПОТЕЗА']];
  document.getElementById('sp-typescale').innerHTML = ts.map(t => '<div class="sp-ts-row"><span class="sp-ts-name">'+t[0]+'</span><span class="sp-ts-px">'+(css(t[0]).indexOf('clamp')===0 ? pxOf(t[0])+' плавно' : css(t[0]))+'</span>'
    + '<span class="sp-ts-sample'+(t[3]?' ks-hero':'')+'" style="font-size:var('+t[0]+');'+(t[0]==='--fs-badge'?'font-weight:700;letter-spacing:.04em':'')+(t[0]==='--fs-hero'||t[0]==='--fs-h1'?';font-weight:700':'')+'">'+esc(t[2])+'</span></div>').join('')
    + '<div class="ks-row" style="gap:var(--sp-6);margin-top:var(--sp-3);font-size:var(--fs-small)"><span>Вес: <b style="font-weight:400">400</b> · <b style="font-weight:500">500</b> · <b style="font-weight:600">600</b> · <b style="font-weight:700">700</b></span>'
    + '<span>Числа в столбик: <span class="ks-num">1 234 567</span></span><span>Одиночное число: <span class="ks-hero" style="font-weight:700;color:var(--text-strong)">1 234 567</span></span></div>';
  const sp = ['--sp-0-5','--sp-1','--sp-1-5','--sp-2','--sp-2-5','--sp-3','--sp-3-5','--sp-4','--sp-5','--sp-6','--sp-8','--sp-10'];
  document.getElementById('sp-space').innerHTML = sp.map(t => '<div class="sp-space-row"><span>'+t+'</span><span>'+css(t)+'</span><div class="sp-space-bar" style="width:'+css(t)+'"></div></div>').join('')
    + '<div class="ks-muted" style="font-size:var(--fs-caption);margin-top:var(--sp-2)">Между соседями отступ задаёт gap родителя, а не margin ребёнка.</div>';
  document.getElementById('sp-radii').innerHTML = [['--r-xs','бейдж'],['--r-sm','чип'],['--r-md','кнопка'],['--r-lg','карточка'],['--r-full','полоса']]
    .map(r => '<div class="sp-radius"><div style="border-radius:var('+r[0]+')"></div>'+r[0].slice(4)+' · '+r[1]+'</div>').join('');
  document.getElementById('sp-motion').innerHTML = [['--dur-fast','наведение'],['--dur-base','подъём карточки'],['--dur-slow','аккордеон, панель'],['--dur-enter','появление экрана']]
    .map(m => '<div class="sp-motion-row"><span>'+esc(m[1])+'</span><code>'+css(m[0])+'</code><div class="sp-motion-track"><div class="sp-motion-dot" style="transition:transform var('+m[0]+') var(--ease-std)"></div></div></div>').join('')
    + '<div class="ks-muted" style="font-size:var(--fs-caption);margin-top:var(--sp-2)">Наведи на строку. Кривая --ease-std. При включённом «уменьшить движение» все длительности становятся нулём.</div>';
  document.getElementById('sp-icons').innerHTML = Object.keys(KS.icons).map(n => '<div class="sp-icon" title="KS.ic(\''+n+'\')">'+ic(n,20)+'<span>'+n+'</span></div>').join('');
}

/* ================= компоненты ================= */
const comp = (name, api, when, stage) => '<div><div class="sp-comp-head"><span class="sp-comp-name">'+esc(name)+'</span><span class="sp-comp-api">'+esc(api)+'</span></div>'
  + '<p class="sp-comp-when">'+when+'</p><div class="sp-stage">'+stage+'</div></div>';
function components(){
  const d10 = KS.series.dyn(SER,'top10',30), dvis = KS.series.dyn(SER,'vis',30);
  const html = [
    comp('Шапка экрана','KS.head({title, sub, src, badges, prio, lead})',
      'Открывает каждый экран. Строка lead про деньги обязательна: если рубля нет, в ней написано почему.',
      KS.head({ title:'Стало лучше или хуже', sub:'Экран, который открывают перед собственником: начало периода, конец и предыдущий отрезок такой же длины.',
        src:'наш ряд positions.ndjson плюс history из keysso.json', badges:[KS.badge('API','ok')], prio:'P0',
        lead:'План H2 по проекту: <b class="ks-strong">240 000 000 ₽</b>. Сколько из него закрывает поиск, пока не считается: нет среднего чека.' })),
    comp('Плитка показателя','KS.tile({label, f, slot, icon, delta, drill})',
      'Число, класс, дельта за период, подпись, источник с датой. Четыре состояния: подтверждено, гипотеза, нет выгрузки, одна точка. Плитка с drill кликается и открывает панель деталей: попробуй первую.',
      '<div class="ks-grid-kpi">'
      + KS.tile({ label:'Запросов в топ-10', f:F(432,'ДАННЫЕ',SRC,'2026-09-19'), slot:3, icon:'target', delta:KS.delta(d10), drill:'sp-top10' })
      + KS.tile({ label:'Видимость в ИИ, %', f:F(23,'ДАННЫЕ',SRC,'2026-09-19'), slot:1, icon:'ai', delta:KS.delta(dvis) })
      + KS.tile({ label:'Конверсия визита в лид, %', f:F(3,'ГИПОТЕЗА','бенчмарк 2-5%, своей выгрузки нет'), slot:4, icon:'users', delta:KS.delta({one:true,now:3}) })
      + KS.tile({ label:'Визитов за неделю', f:F(null,'ДЕМО'), slot:2, icon:'globe', delta:KS.delta({abs:null}) })
      + '</div>'),
    comp('Бейджи','KS.badge(text, tone) · KS.kind(k)',
      'Класс цифры по Протоколу 9, статус раздела, приоритет. Статусные цвета никогда не используются как цвет серии графика.',
      '<div class="ks-row">' + ['ДАННЫЕ','ГИПОТЕЗА','ДЕМО'].map(KS.kind).join('') + '<span style="width:var(--sp-4)"></span>'
      + [['API','ok'],['СБОРКА','warn'],['НЕТ','crit'],['P0','neutral'],['НОВОЕ','info'],['РИСК','serious']].map(b=>KS.badge(b[0],b[1])).join('') + '</div>'),
    comp('Карточка с графиком и таблицей-двойником','KS.card({title, sub, body, actions, table, drill})',
      'Контейнер для графика или таблицы. У каждого графика есть таблица-двойник: кнопка «таблица» в шапке карточки. Это требование доступности, а не украшение.',
      KS.card({ title:'Запросы в топ-10 по дням', sub:'Одна серия, подпись только на конце', actions:KS.badge('API','ok'), body:KS.chart('sp-c-line',240),
        table:KS.table([['Дата'],['Топ-10',true]], SER.map(r=>[ruDate(r.date), nf(r.top10)])) })),
    comp('Таблица','KS.table(cols, rows, {foot, interactive})',
      'Числовые столбцы вправо, моноширинные табличные цифры, пустое значение прочерком. Широкая таблица прокручивается в своём контейнере, страница вбок не едет никогда.',
      KS.table([['Метрика'],['Было',true],['Стало',true],['Изменение',true],['Отрезком раньше',true]], [
        ['Запросов в топ-10', nf(423), nf(432), '<span style="color:var(--ok)">+9</span>', nf(410)],
        ['Запросов в топ-50', nf(2145), nf(2118), '<span style="color:var(--crit)">-27</span>', null],
        ['Видимость в ИИ, %', nf(38), nf(23), '<span style="color:var(--crit)">-15</span>', nf(39)],
        ['Ответов ИИ с упоминанием', null, nf(104), '<span class="ks-faint">одна точка</span>', null]], { interactive:true })),
    comp('Полосы','KS.bars(items, slot)',
      'Сравнение нескольких величин одной природы. Один ряд, один цвет: длина уже несёт величину, раскраска по величине тратит цвет впустую.',
      KS.bars(CAMP.map(c=>[c[0],c[1],'₽']), 3)),
    comp('Врезки','KS.note(title, body, tone)',
      'Четыре тона: ok, warn, crit, info. crit получает role="alert". Врезка объясняет, что значит цифра и что с ней делать, а не повторяет её.',
      '<div class="ks-grid-2">'
      + KS.note('Ряд без разрывов','Последняя точка 19.09, свежесть 0 дней. Съём идёт по регламенту.','ok')
      + KS.note('Резкий скачок в ряду','С 02.09 по 05.09 видимость упала с 37 до 17. Проверь у источника, не менялась ли методика.','warn')
      + KS.note('Выгрузки совпадают побайтно','Два проекта отдают один и тот же файл. Верной может быть в лучшем случае одна.','crit')
      + KS.note('Почему индекс, а не две оси','Две оси Y рисуют корреляцию, которой в данных нет. Разные ряды сводятся к сотне на старте.','info')
      + '</div>'),
    comp('Вердикт','KS.verdict(series, fields, days, label)',
      'Одна строка для собственника: «Стало лучше», «Стало хуже» или «Разнонаправленно». Метрики с одной точкой в периоде в вердикт не входят и названы отдельно.',
      KS.verdict(SER, [['top10','запросы в топ-10'],['vis','видимость в ИИ']], 30, '30 дней')),
    comp('Следующий шаг','KS.action({what, who, when, crit})',
      'Без исполнителя и даты не рисуется: вместо него предупреждение. Шаг без имени и срока это пожелание, а не план.',
      '<div class="ks-grid-2">' + KS.action({ what:'Настроить три цели в Метрике: форма, звонок, мессенджер', who:'Иван ставит задачу разработчику', when:'до 26.09', crit:'цели видны в интерфейсе и отдают данные по API' })
      + KS.action({ what:'Разобраться со скачком видимости' }) + '</div>'),
    comp('Шаги и чек-лист','KS.steps(items) · KS.checks(items, tone)',
      'Нумерация только там, где порядок действительно важен. Чек-лист в тоне ok для выполненного, crit для запретов.',
      '<div class="ks-grid-2"><div>' + KS.steps([['Снять выгрузку','keyso-collect.yml, понедельник'],['Записать точку в ряд','tools/snapshot.py'],['Собрать данные и страницу','build_data.py, build.py'],['Проверить сторожем','check_ds.py должен быть зелёным']]) + '</div><div class="ks-stack" style="gap:var(--sp-3)">'
      + KS.checks(['мета-описание в пределах длины','каждая цифра со ссылкой на источник'],'ok') + KS.checks(['гарантия сверх двенадцати месяцев','цена без подтверждённого прайса'],'crit') + '</div></div>'),
    comp('Кнопки и поля','.ks-btn--primary · --secondary · --ghost · --sm · --icon · .ks-seg · .ks-select · .ks-input',
      'Основная кнопка одна на экран. Сегмент для переключения проектов и режимов, выбранный отмечен aria-pressed. Поля моноширинные: в них вводят числа.',
      '<div class="ks-stack"><div class="ks-row"><button type="button" class="ks-btn ks-btn--primary">Сохранить</button><button type="button" class="ks-btn ks-btn--secondary">Отмена</button>'
      + '<button type="button" class="ks-btn ks-btn--ghost">Подробнее</button><button type="button" class="ks-btn ks-btn--secondary ks-btn--sm">таблица</button>'
      + '<button type="button" class="ks-btn ks-btn--ghost ks-btn--icon" aria-label="Меню">'+ic('menu',17)+'</button><button type="button" class="ks-btn ks-btn--primary" disabled>Недоступно</button></div>'
      + '<div class="ks-row"><div class="ks-seg" role="group" aria-label="Проект"><button type="button" aria-pressed="false">GLASS-MEMORY</button><button type="button" aria-pressed="true">GENGLASS</button></div>'
      + '<select class="ks-select" id="sp-sel" aria-label="Период"><option>7 дней</option><option selected>30 дней</option><option>90 дней</option><option>весь ряд</option></select></div>'
      + '<div class="ks-grid-2"><label class="ks-field" for="sp-in1"><span class="ks-field-label">Средний чек '+KS.kind('ГИПОТЕЗА')+'</span><input class="ks-input" id="sp-in1" placeholder="не заполнено"><span class="ks-field-hint">подтверждённой цифры нет, ждём от владельца</span></label>'
      + '<label class="ks-field" for="sp-in2"><span class="ks-field-label">Конверсия лид в сделку '+KS.kind('ДАННЫЕ')+'</span><input class="ks-input" id="sp-in2" value="11"><span class="ks-field-hint">Roistat, нижняя граница коридора 11-15%</span></label></div></div>'),
    comp('Панель деталей','KS.drawer.register(key, provider) · data-drill="key" · KS.drawer.open(key)',
      'Проваливание в виджет. Открывается кликом, Enter или ссылкой вида #проект.экран.период.показатель. Четыре обязательных блока: из чего сложилась цифра, как менялась, откуда взята, что делать. Закрывается Esc, кликом мимо и крестиком, фокус возвращается туда, откуда пришёл. Один уровень вложенности: панель из панели не открывается.',
      '<div class="ks-row"><button type="button" class="ks-btn ks-btn--primary" data-drill="sp-top10">'+ic('eye',16)+'Открыть панель деталей</button>'
      + '<button type="button" class="ks-btn ks-btn--secondary" data-drill="sp-missing">Показатель без разложения</button></div>'),
    comp('Меню','KS.nav(tree, active) · KS.navWire(root, onGo)',
      'Два уровня, аккордеон. Бейдж раздела зависит от проекта и пересчитывается при каждой отрисовке. Активный пункт получает aria-current="page".',
      '<div style="max-width:280px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg)"><nav class="ks-nav" id="sp-nav" style="max-height:none"></nav></div>')
  ];
  document.getElementById('sp-components').innerHTML = html.join('');
  const tree = [{id:'o',t:'Обзор',i:'grid'},{t:'Динамика',i:'up',ch:[{id:'d1',t:'Стало лучше или хуже'},{id:'d2',t:'Позиции по дням'}]},
    {t:'Метрика',i:'globe',badge:()=>KS.badge('ДАННЫЕ','ok'),ch:[{id:'m1',t:'Визиты по дням'}]},{t:'Директ',i:'bolt',badge:()=>KS.badge('НЕТ','crit'),ch:[{id:'y1',t:'Кампании'}]}];
  let act = 'd1'; const nav = document.getElementById('sp-nav');
  const drawNav = () => { nav.innerHTML = KS.nav(tree, act); };
  drawNav(); KS.navWire(nav, v => { act = v; drawNav(); });
}
KS.drawer.register('sp-top10', () => ({
  title:'Запросов в топ-10', kind:'ДАННЫЕ', sub:'GENGLASS · период 30 дней · пример',
  compose: KS.table([['Запрос'],['Позиция',true],['Частотность',true]], [['стеклянные перегородки','4','9 870'],['зеркало на заказ','2','5 410'],['душевая перегородка цена','7','3 120'],['стол из стекла','9','2 880']]),
  composeMissing:'', trend: KS.chart('sp-dr-line',200),
  trendTable: KS.table([['Дата'],['Топ-10',true]], SER.slice(-8).map(r=>[ruDate(r.date), nf(r.top10)])),
  source: KS.table([['Что'],['Значение']], [['Метод','<span class="ks-mono">GET /report/simple/organic/summary</span>'],['Класс',KS.kind('ДАННЫЕ')],['Снято','19.09.2026'],['Чего не даёт','ретроспективы нет, ряд ведём сами']]),
  action:{ what:'Разобрать просадки с 444 до 426 после 07.09', who:'контент-подряд', when:'волна 1' },
  afterOpen: () => KS.charts.line('sp-dr-line', { cats:SER.slice(-8).map(r=>ruDate(r.date).slice(0,5)), data:SER.slice(-8).map(r=>r.top10), slot:3, h:200 })
}));
KS.drawer.register('sp-missing', () => ({ title:'Визитов из рекламы', missing:true, need:'Нужна разметка utm и выгрузка Метрики по каналам.' }));

/* ================= графики ================= */
function charts(){
  const c = (id, title, sub, api, h, table) => KS.card({ title, sub:sub + ' · ' + api, body:KS.chart(id,h), table });
  document.getElementById('sp-charts').innerHTML =
    '<div class="ks-grid-2">'
    + c('sp-g1','Линия','одна серия, подпись на конце','KS.charts.line',240, KS.table([['Дата'],['Топ-10',true]], SER.map(r=>[ruDate(r.date),nf(r.top10)])))
    + c('sp-g2','Площадь, две серии','легенда обязательна','KS.charts.multi({area})',240, KS.table([['Дата'],['Визиты',true],['Из поиска',true]], YM.map(r=>[ruDate(r.date),nf(r.v),nf(r.s)])))
    + c('sp-g3','Индекс вместо двух осей','старт периода это 100','KS.charts.index',260, KS.table([['Дата'],['Топ-10',true],['Видимость',true]], SER.map(r=>[ruDate(r.date),nf(r.top10),nf(r.vis)])))
    + c('sp-g4','Горизонтальные полосы','число вынесено за торец','KS.charts.hbar',240, KS.table([['Ступень'],['Запросов',true]], [['топ-1','16'],['топ-3','79'],['топ-10','432'],['топ-50','2 118']]))
    + c('sp-g5','Выделение одного столбца','наш цветом, остальные нейтральны','KS.charts.emphasis',260, KS.table([['Домен'],['Объявлений',true]], [['мы','8'],['лидер','314'],['второй','186'],['третий','70']]))
    + c('sp-g6','Пончик','до пяти долей, зазор цвета фона','KS.charts.donut',280, KS.table([['Источник'],['Доля, %',true]], [['Свой сайт','38'],['Подборки','27'],['Каталоги','18'],['Маркетплейсы','11'],['Прочее','6']]))
    + c('sp-g7','Тепловая карта','один тон, классы в легенде','KS.charts.heat',280, KS.table([['Пара'],['Общих URL',true]], [['1 и 2','6'],['2 и 3','5'],['3 и 4','6']]))
    + c('sp-g8','Кольцо доли','один показатель','KS.charts.gauge',240, KS.table([['Показатель'],['%',true]], [['в индексе','84']]))
    + '</div>'
    + KS.card({ title:'Пустой ряд', sub:'вместо рамки с размерами NaN честная пустая область · автоматически в KS.charts.render', body:KS.chart('sp-g9',140) });
}
function drawCharts(){
  KS.charts.line('sp-c-line', { cats, data:SER.map(r=>r.top10), name:'Топ-10', slot:3, h:240 });
  KS.charts.line('sp-g1', { cats, data:SER.map(r=>r.top10), name:'Топ-10', slot:3, h:240 });
  KS.charts.multi('sp-g2', { cats:YM.map(r=>ruDate(r.date).slice(0,5)), area:true, h:240, series:[{name:'Визиты',data:YM.map(r=>r.v),slot:3},{name:'Из поиска',data:YM.map(r=>r.s),slot:2}] });
  KS.charts.index('sp-g3', { cats, h:260, series:[{name:'Топ-10',data:SER.map(r=>r.top10),slot:3},{name:'Видимость',data:SER.map(r=>r.vis),slot:1}] });
  KS.charts.hbar('sp-g4', { cats:['топ-1','топ-3','топ-10','топ-50'], data:[16,79,432,2118], name:'Запросов', slot:3, h:240 });
  KS.charts.emphasis('sp-g5', { cats:['мы','лидер','второй','третий'], data:[8,314,186,70], focus:0, slot:3, h:260 });
  KS.charts.donut('sp-g6', { labels:['Свой сайт','Подборки','Каталоги','Маркетплейсы','Прочее'], data:[38,27,18,11,6], h:280 });
  KS.charts.heat('sp-g7', { rows:['запрос 1','запрос 2','запрос 3','запрос 4'], cols:['запрос 1','запрос 2','запрос 3','запрос 4'], matrix:[[10,6,4,2],[6,10,5,3],[4,5,10,6],[2,3,6,10]], h:280 });
  KS.charts.gauge('sp-g8', { value:84, label:'в индексе', h:240 });
  KS.charts.line('sp-g9', { cats:[], data:[], h:140 });
  KS.charts.line('pl-c', { cats, data:SER.map(r=>r.top10), name:'Топ-10', slot:3, h:180 });
  KS.charts.line('pd-c', { cats, data:SER.map(r=>r.top10), name:'Топ-10', slot:3, h:180 });
}

/* ================= две темы рядом ================= */
function pair(){
  const one = (id, label) => '<div class="sp-pane-label">'+label+'</div>'
    + '<div class="ks-grid-kpi" style="grid-template-columns:repeat(2,minmax(0,1fr))">'
    + KS.tile({ label:'Запросов в топ-10', f:F(432,'ДАННЫЕ',SRC,'2026-09-19'), slot:3, icon:'target', delta:KS.delta(KS.series.dyn(SER,'top10',30)) })
    + KS.tile({ label:'Визитов за неделю', f:F(null,'ДЕМО'), slot:2, icon:'globe' }) + '</div>'
    + KS.card({ title:'Топ-10 по дням', body:KS.chart(id,180) })
    + KS.note('Стало разнонаправленно','Топ-10 плюс 9, видимость минус 15.','warn');
  document.getElementById('pane-light').innerHTML = one('pl-c','Светлая');
  document.getElementById('pane-dark').innerHTML  = one('pd-c','Тёмная');
}

/* ================= адаптивность ================= */
function adaptive(){
  const bp = [
    ['до 340','складной и узкий телефон','плитки по одной, когда контейнер уже 300'],
    ['340-639','телефон','меню за краем по кнопке, фильтры шапки лентой вбок, заголовок экрана 16, панель деталей во весь экран, таблицы от четырёх колонок карточками, графики ниже на 16% и с четырьмя подписями оси'],
    ['640-1023','планшет','меню за краем по кнопке; плитки по две, по четыре от контейнера 680; графики парами от 720'],
    ['1024-1279','ноутбук','меню у края 258, кнопка сворачивает его в полосу иконок 72'],
    ['от 1280','монитор','графики тройками от контейнера 1080, поле 24, ширина содержимого до 1480']];
  document.getElementById('sp-bp').innerHTML = KS.card({ title:'Точки перелома', sub:'Каркас меняется по ширине окна, сетки внутри по ширине контейнера',
    body:KS.table([['Ширина окна'],['Устройство'],['Что меняется']], bp.map(b => ['<span class="ks-num ks-strong">'+b[0]+'</span>', esc(b[1]), esc(b[2])]), { stack:true }) });
  const rows = [['Поиск, высокочастотные', nf(1284), nf(26798), '20,9'], ['Поиск, среднечастотные', nf(2107), nf(43641), '20,7'], ['РСЯ, ретаргетинг', nf(912), nf(43896), '48,1']];
  const t = () => KS.table([['Кампания'], ['Клики', 1], ['Расход, ₽', 1], ['Цена клика, ₽', 1]], rows, { foot:['Итого', nf(4303), nf(114335), '26,6'] });
  document.getElementById('sp-stack').innerHTML = '<div class="sp-stack-demo"><div><div class="sp-pane-label">Контейнер 340</div><div class="sp-narrow">' + t() + '</div></div>'
    + '<div><div class="sp-pane-label">Широкий контейнер</div><div class="sp-wide">' + t() + '</div></div></div>';
  document.getElementById('sp-touch').innerHTML = '<div class="ks-grid-2">'
    + KS.card({ title:'Касание', body:KS.checks([
        'кнопки, пункты меню и значки 44 пикселя, мелкие кнопки и сегменты 36: так на экране с пальцем, мышь видит прежние размеры',
        'поля ввода и выпадающие списки 16 пикселей: мельче Safari на iPhone увеличивает страницу при фокусе',
        'подъём карточки по наведению только там, где есть мышь; на касании отклик нажатием, иначе плитка залипает приподнятой',
        'без серой вспышки и задержки двойного тапа на кнопках и плитках']) })
    + KS.card({ title:'Экран телефона', body:KS.checks([
        'шапка, меню и панель деталей учитывают вырез и полосу жестов: безопасные зоны env(safe-area-inset-*)',
        'открыты меню или панель: страница под ними не прокручивается, прокрутка не утекает наружу',
        'высота экрана через 100dvh: адресная строка не съедает низ',
        'повернули телефон или расширили окно: открытое поверх меню закрывается само',
        'настройка «повышенный контраст» делает подписи основным цветом текста']) })
    + '</div>';
  devices();
}
/* Рамки устройств: стартер целиком внутри iframe, ширина рамки задаёт его экран */
function devices(){
  const box = document.getElementById('sp-devices');
  if(!window.SP_STARTER){ box.innerHTML = KS.note('Превью каркаса недоступно', 'Витрина собрана без стартера. Пересобери её командой python3 tools/build_specimen.py.', 'warn'); return; }
  const dev = [['Телефон', 390, 780, 'phone'], ['Планшет', 820, 1080, 'tablet']];
  box.innerHTML = dev.map(d => '<figure class="sp-dev sp-dev--' + d[3] + '" style="--w:' + d[1] + ';--h:' + d[2] + '"><div class="sp-dev-screen">'
    + '<iframe title="Стартовый шаблон на ширине ' + d[1] + ' пикселей" loading="lazy"></iframe></div><figcaption>' + esc(d[0]) + ' · ' + d[1] + ' пикселей</figcaption></figure>').join('');
  box.querySelectorAll('iframe').forEach(f => { f.addEventListener('load', () => syncFrame(f)); f.srcdoc = window.SP_STARTER; });
}
function syncFrame(f){
  try{ const t = document.documentElement.getAttribute('data-theme'), r = f.contentDocument.documentElement;
    if(t) r.setAttribute('data-theme', t); else r.removeAttribute('data-theme'); }catch(e){}
}
function fontNow(){
  const apple = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  document.getElementById('sp-fontnow').innerHTML = KS.note(apple ? 'У вас сейчас SF' : 'У вас сейчас Golos Text',
    apple ? 'Устройство Apple: браузер взял системный SF. На Windows и Android тот же экран будет набран Golos Text.'
          : 'Не устройство Apple: работает Golos Text. На Mac и iPhone тот же экран будет набран системным SF.', 'info');
}

/* ================= запреты и перенос ================= */
function rules(){
  const bans = [['TOKENS','текстовая роль или бейдж ниже нужного контраста','так уже было: бейдж «ГИПОТЕЗА» 4,06:1, «серьёзно» 4,33:1'],
    ['PALETTE','категориальная палитра не проходит валидатор','синий с голубым: ΔE 14,4 при пороге 15'],
    ['HEX','цвет записан в компоненте или графике мимо токенов','тема меняется, а этот цвет остаётся'],
    ['OPACITY','текст приглушён прозрачностью','opacity-55 на светлой карточке даёт 2,26:1'],
    ['DUALAXIS','две оси Y на одном графике','выдуманная корреляция'],
    ['CVD','синий и голубой соседними сериями','неразличимы при дейтеранопии'],
    ['EMDASH','длинное тире в тексте','правило humanizer, только дефис'],
    ['ENVELOPE','цифра ДАННЫЕ без источника или даты, пустое значение как ДАННЫЕ','заглушка рядом с фактом перестаёт читаться как заглушка'],
    ['LAYOUTANIM','анимация ширины, высоты, отступов','перерасчёт раскладки на каждом кадре'],
    ['BOUNCE','пружинящая кривая движения','мешает читать цифры'],
    ['FONTFLOOR','текст мельче 11 пикселей','было 9,5 и 10,5'],
    ['FAINTTEXT','самая бледная ступень на тексте для чтения','3,3:1'],
    ['SYNC','две копии тёмной темы разошлись','разные цвета у зрителей с настройкой и без'],
    ['CONTRAST','реальный текст на реальном фоне ниже WCAG, ключ --live','ловит подложку поверх подложки и подписи на плашках'],
    ['VIEWPORT','у страницы нет meta viewport','телефон показывает страницу уменьшенной копией десктопа'],
    ['HOVERLIFT','подъём по наведению вне @media (hover:hover)','на касании плитка залипает приподнятой'],
    ['MONONUM','цифры в столбик моноширинным','в 1.2 цифры идут шрифтом интерфейса с табличными цифрами']];
  document.getElementById('sp-bans').innerHTML = KS.table([['Код'],['Что ловит'],['Почему']], bans.map(b=>['<span class="ks-mono ks-strong">'+b[0]+'</span>', esc(b[1]), '<span class="ks-muted">'+esc(b[2])+'</span>']))
    + '<div class="ks-grid-2" style="margin-top:var(--sp-4)">'
    + KS.card({ title:'Чего система не делает сама', body:KS.checks(['не проверяет, что у каждого графика есть таблица-двойник: это на приёмке глазами','не оценивает смысл строки про деньги, только её наличие','не видит графиков, отрисованных вне пресетов'],'warn') })
    + KS.card({ title:'Ограничения среды артефакта', body:KS.checks(['печать не работает: window.print() в артефакте ничего не делает, кнопку «Печать» оставляй только для Pages и локального файла','в адресе выживают только буквы, цифры и . _ ~ -, поэтому маршрут через точку','внешние файлы блокируются: tokens.css и кит вставляются внутрь страницы'],'warn') })
    + '</div>';
  document.getElementById('sp-transfer').innerHTML = '<div class="ks-grid-2"><div>' + KS.steps([
      ['Скопировать папку kontur-ds в проект','токены, кит, графики, шаблон, сторож'],
      ['Начать со templates/starter.html','каркас с меню, периодом, темой, плитками, панелью деталей'],
      ['Заменить блок DB своими данными в конверте','значение, класс, источник, дата'],
      ['Прогнать сторожа','python3 tools/check_ds.py путь/к/странице.html'],
      ['Для Claude: сохранить скилл kontur-design-system','тогда Claude применит систему в любом новом проекте сам']]) + '</div>'
    + '<div class="sp-code">&lt;link rel="stylesheet" href="kontur-ds/tokens/tokens.css"&gt;\n&lt;link rel="stylesheet" href="kontur-ds/kit/kit.css"&gt;\n&lt;script src="https://cdnjs.cloudflare.com/ajax/libs/\n        apexcharts/3.54.1/apexcharts.min.js"&gt;&lt;/script&gt;\n&lt;script src="kontur-ds/kit/icons.js"&gt;&lt;/script&gt;\n&lt;script src="kontur-ds/kit/kit.js"&gt;&lt;/script&gt;\n&lt;script src="kontur-ds/kit/charts.js"&gt;&lt;/script&gt;\n\n// Tailwind: presets: [require(\'./kontur-ds/tokens/tailwind.preset.js\')]\n// Figma и прочее: kontur-ds/tokens/tokens.json</div></div>';
}

/* ================= оглавление ================= */
function toc(){
  const secs = [['top','Обзор'],['principles','Правила'],['color','Цвет'],['type','Типографика'],['space','Отступы и движение'],['icons','Иконки'],['components','Компоненты'],['charts','Графики'],['themes','Две темы'],['adaptive','Адаптивность'],['rules','Запреты'],['transfer','Перенос']];
  const nav = document.getElementById('toc');
  nav.innerHTML = secs.map(s => '<a href="#'+s[0]+'" data-sec="'+s[0]+'">'+esc(s[1])+'</a>').join('');
  nav.addEventListener('click', e => { const a = e.target.closest('a'); if(!a) return; e.preventDefault();
    document.getElementById(a.dataset.sec).scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
  const io = new IntersectionObserver(es => es.forEach(en => { if(en.isIntersecting){
    nav.querySelectorAll('a').forEach(a => a.classList.toggle('is-active', a.dataset.sec === en.target.id)); } }), { rootMargin:'-30% 0px -60% 0px' });
  secs.forEach(s => { const el = document.getElementById(s[0]); if(el) io.observe(el); });
}

function all(){ hero(); color(); foundations(); fontNow(); components(); charts(); pair(); adaptive(); rules();
  requestAnimationFrame(drawCharts); }
KS.charts.onTheme = () => { color(); hero(); document.querySelectorAll('#sp-devices iframe').forEach(syncFrame); requestAnimationFrame(drawCharts); };
document.getElementById('sp-theme').addEventListener('click', () => KS.theme.toggle());
KS.theme.init(); toc(); all();
})();
