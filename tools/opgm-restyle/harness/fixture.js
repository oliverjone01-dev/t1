/* Синтетическая фикстура стенда старых экранов ОП ГМ (основа: стенд ФЕНИКСА 29.09, seed 20260929).
   Никаких реальных данных: имена, тексты и числа сгенерированы детерминированно.
   Параметры через window.__FX_OPTS до загрузки файла: seed, export (ISO), start (ISO), n, extra
   (extra: [{t:ISO, cab:'OLD-G'|'NEW-B', kind:'in'|'cold', lag:сек}] - дополнительные чаты с заданной датой первого сообщения),
   expCab {'OLD-G':ISO,'NEW-B':ISO} (по умолчанию NEW-B выгружен на 18 минут раньше OLD-G: строка источника несёт два разных времени),
   indep: true - режим невозможных сочетаний флагов (флаги независимы, как в стенде iter2), по умолчанию инварианты build_av.py,
   dpack: false - старая форма recon без контракта Д-пакета.
   Инварианты build_av.py (src/build_av.py:110-143 на 24eb500d), режим по умолчанию:
   - noresp только без ответа менеджера: флагов ветки ответа (slow, noprice, noquestion, noname, abandoned, phoneleft, nofollow, warranty) при нём нет, lag = null;
   - phoneleft и abandoned через if/elif (build_av.py:135-137): у одного чата не оба; phone = phoneleft;
   - vendor без флагов (build_av.py:143).
   Контракт Д-пакета (эпизод решений §3, С7 и С9): у чата ad_id (context.value.id), в recon у кабинета layers
   (слой 22.09 с CSV и окно 21.09-29.09 без CSV) и merge (счётчики склейки). Код 24eb500d эти поля не читает.
   Если задан window.__REAL_D (загрузчик harness/realdata.cjs, данные только в памяти), фикстура не строится: D = __REAL_D.
   Структура повторяет поля, которые читают src/opgm.js и src/legacy.js на 24eb500d. */
(function(){
  if(window.__REAL_D){ window.__FX = window.__REAL_D; return; }
  const O = window.__FX_OPTS || {};
  let s = O.seed || 20260929;
  const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const EXPORT = O.export || '2026-09-22T09:00:00+03:00', EX = Math.floor(Date.parse(EXPORT) / 1000), START = Math.floor(Date.parse(O.start || '2026-04-01T00:00:00+03:00') / 1000);
  const NAMES = ['Тестовый', 'Образец', 'Пример', 'Демо', 'Проба', 'Макет', 'Шаблон', 'Эскиз'];
  const ADS = ['Объявление 1: стела', 'Объявление 2: табличка', 'Объявление 3: панно', 'Объявление 4: стекло с фото', 'Объявление 5: мемориал', 'Объявление 6: вставка', 'Объявление 7: гравировка', 'Объявление 8: подставка'];
  const chats = [], msgs = {};
  const N = O.n || 1500;
  for(let i = 0; i < N; i++){
    const cab = rnd() < 0.6 ? 'OLD-G' : 'NEW-B';
    const r = rnd(), kind = r < 0.78 ? 'in' : r < 0.88 ? 'cold' : r < 0.95 ? 'cold_reply' : 'vendor';
    /* больше свежих чатов, чем старых */
    const t = Math.floor(START + (EX - START) * Math.pow(rnd(), 0.8));
    const id = 'fx-' + i;
    const nc = kind === 'cold' ? 0 : 1 + Math.floor(rnd() * 5);
    const client = kind !== 'cold' && kind !== 'vendor' && nc > 0;
    let p = [];
    let lag = null;
    if(client){
      const noresp = rnd() < 0.12;
      if(noresp) p.push('noresp'); else lag = Math.floor(Math.pow(rnd(), 2.2) * 30 * 3600) + 30;
      if(lag != null && lag > 3600) p.push('slow');
    }
    const pq = client && rnd() < 0.45;
    if(pq && rnd() < 0.4) p.push('noprice');
    /* случайные числа тянутся в том же порядке в обоих режимах: seed даёт те же чаты, отличаются только флаги */
    const fAb = client && rnd() < 0.2, fPh = client && rnd() < 0.08;
    if(O.indep){ if(fAb) p.push('abandoned'); if(fPh) p.push('phoneleft'); }
    else if(fPh) p.push('phoneleft'); else if(fAb) p.push('abandoned');
    if(client && rnd() < 0.3) p.push('noquestion');
    if(client && rnd() < 0.5) p.push('noname');
    if(client && rnd() < 0.25) p.push('nofollow');
    if(client && rnd() < 0.05) p.push('robotonly');
    if(client && rnd() < 0.04) p.push('warranty');
    if(!O.indep && p.includes('noresp')) p = p.filter(x => !['slow','noprice','noquestion','noname','abandoned','phoneleft','nofollow','warranty'].includes(x));
    const cin = rnd() < 0.08 ? 1 + Math.floor(rnd() * 2) : 0, cout = rnd() < 0.03 ? 1 : 0, cmiss = rnd() < 0.06 ? 1 : 0;
    if(cmiss && !cout) p.push('misscall');
    const M = [];
    let ts = t;
    for(let k = 0; k < Math.max(2, nc + 1); k++){
      const who = k === 0 ? 'c' : rnd() < 0.5 ? 'c' : 'm';
      M.push([ts, who, 't', who === 'c' ? pick(['Здравствуйте, сколько стоит?', 'Какие размеры есть?', 'Можно с фото?', 'Спасибо, подумаем.', 'Когда будет готово?']) : pick(['Добрый день! Уточните размер.', 'Стоимость от 20 000 руб.', 'Пришлите фото, пожалуйста.']), '', 0, 0]);
      ts += Math.floor(rnd() * 20000) + 60;
    }
    if(rnd() < 0.2) M.splice(1, 0, [t + 5, 'a', 't', 'Вам ответит первый освободившийся менеджер.', '', 0, 0]);
    for(let k = 0; k < cin; k++) M.push([ts + k * 100, 'c', 'c', 'Входящий звонок', 'success', 0, 30 + Math.floor(rnd() * 300)]);
    for(let k = 0; k < cmiss; k++) M.push([ts + 500 + k, 'c', 'c', 'Пропущенный звонок', 'missed', 0, 0]);
    for(let k = 0; k < cout; k++) M.push([ts + 900 + k, 'm', 'c', 'Исходящий звонок', 'success', 0, 60 + Math.floor(rnd() * 200)]);
    const last = M[M.length - 1][0], lw = client && (p.includes('noresp') || p.includes('abandoned') || p.includes('phoneleft') || p.includes('noprice') || rnd() < 0.2) ? 'c' : 'm';
    msgs[id] = M;
    if(kind === 'vendor' && !O.indep) p = [];
    chats.push({ id, cab, kind, nc, t, lc: client ? Math.min(last, EX) : null, lw, lag, p, pq, compl: client && rnd() < 0.02, phone: p.includes('phoneleft'), b2b: rnd() < 0.03,
      both: rnd() < 0.02, cn: pick(NAMES) + ' ' + (i % 97), ad: Math.floor(rnd() * ADS.length), cin, cout, cmiss, last: Math.min(last, EX) });
  }
  (O.extra || []).forEach((x, j) => { const t = Math.floor(Date.parse(x.t) / 1000), id = 'fx-extra-' + j, cold = x.kind === 'cold', lag = x.lag || 600;
    msgs[id] = cold ? [[t, 'm', 't', 'Добрый день! Вы просматривали наше объявление.', '', 0, 0]]
      : [[t, 'c', 't', 'Здравствуйте, сколько стоит?', '', 0, 0], [t + lag, 'm', 't', 'Добрый день! От 20 000 руб.', '', 0, 0]];
    chats.push({ id, cab: x.cab || 'OLD-G', kind: cold ? 'cold' : 'in', nc: cold ? 0 : 1, t, lc: cold ? null : t, lw: 'm', lag: cold ? null : lag, p: [], pq: !cold, compl: false, phone: false, b2b: false,
      both: false, cn: 'Добавочный ' + j, ad: 0, cin: 0, cout: 0, cmiss: 0, last: cold ? t : t + lag }); });
  const CABS_FX = ['OLD-G', 'NEW-B'];
  const cnt = c => chats.filter(x => x.cab === c).length, cntm = c => chats.filter(x => x.cab === c).reduce((a, x) => a + msgs[x.id].length, 0);
  if(O.dpack !== false) chats.forEach(c => { c.ad_id = String(7000000000 + c.ad * 1117); });
  const EXC = O.expCab || { 'OLD-G': EXPORT, 'NEW-B': new Date((EX - 18 * 60) * 1000).toISOString() };
  const recon = {
    'OLD-G': { exported: EXC['OLD-G'] || EXPORT, json_chats: cnt('OLD-G'), json_msgs: cntm('OLD-G'), csv_rows: cnt('OLD-G'), csv_max: '2026-09-22' },
    'NEW-B': { exported: EXC['NEW-B'] || EXPORT, json_chats: cnt('NEW-B'), json_msgs: cntm('NEW-B'), csv_rows: cnt('NEW-B') - 40, csv_max: '2026-08-21', miss: { sep: 20, late_aug: 12, mid: 6, old: 2 } }
  };
  if(O.dpack !== false) CABS_FX.forEach((c, j) => { const n = cnt(c);
    recon[c].layers = [{ name: 'full-2026-09-22', csv: true, chats: n - 30 - j * 5 }, { name: 'window-2026-09-21', csv: false, chats: 60 + j * 7 }];
    recon[c].merge = { kept_old: n - 30 - j * 5, replaced: 25 + j, added: 30 + j * 5, truncated_100: 1, restored_from_old: 2 + j, overlap_missing: 0, t_changed: 1, both_changed: 0, ad_title_changed: j, mapping_overlap: 0, window_missing: 0 };
    recon[c].before_apr = 0; });
  const PS = ['slow_reply', 'no_name', 'no_followup', 'left_on_read', 'no_price', 'no_qualify', 'no_greeting'];
  const dialogues = Array.from({ length: 120 }, (_, i) => ({ id: 'A-' + (100 + i), account: i % 2 ? 'old' : 'new', speed: pick(['fast', 'ok', 'slow', 'overnight']),
    outcome: pick(['progressing', 'stalled', 'dropped', 'ordered', 'unclear']), problems: PS.filter(() => rnd() < 0.3), summary: 'Синтетическая сводка переписки ' + i + '.',
    quote: 'Синтетическая цитата ' + i, manager: '', empty: false }));
  window.__FX = {
    av: { chats, msgs, ads: ADS, recon },
    metrics: { name: 12.5, follow: 18.2, left: 31.4, lag_median: 42, greet: 64.1, qual: 38.9, price: 55.3,
      outcomes: { stalled: 27.5, progressing: 21.1, ordered: 6.2 }, speed_buckets: { fast: 22.4, ok: 26.1, slow: 30.2, overnight: 21.3 },
      accounts: { old: { n: 70, lag_median: 48, left: 33.1, follow: 16.4, stalled: 29.2 }, new: { n: 50, lag_median: 36, left: 29.5, follow: 20.1, stalled: 25.3 } } },
    meta: { total: 150, processed: 120, valid: 118, old: 70, new: 50 },
    problem_scale: PS.map((k, i) => ({ key: k, label: 'Проблема ' + (i + 1), count: 10 + i * 7, pct: 8.5 + i * 5.1 })),
    dialogues,
    talks: {
      hero: { line: 'Синтетическая строка героя архива.' },
      speed: { title: 'Скорость первого ответа (архив)', sub: 'Синтетический подзаголовок.' },
      quality: { title: 'Как общаемся (архив)', sub: 'Синтетический подзаголовок.', punch: 'Синтетический вывод.' },
      funnel: { title: 'Куда уходят деньги (архив)', sub: 'Синтетический подзаголовок.', punch: 'Синтетический вывод воронки.',
        steps: [{ lab: 'Написали', val: 100, drop: '' }, { lab: 'Получили ответ', val: 81, drop: '-19' }, { lab: 'Узнали цену', val: 55 }, { lab: 'Живые и заказы', val: 27 }] },
      redflags: { title: 'Красные флаги', items: [{ t: 'Флаг 1', d: 'Описание 1', freq: 'часто' }, { t: 'Флаг 2', d: 'Описание 2', freq: 'редко' }] },
      teardowns: [1, 2, 3].map(i => ({ cli: 'Клиент разбора ' + i, acc: i % 2 ? 'старый' : 'новый', date: '0' + i + '.07', sev: ['red', 'yellow', 'green'][i - 1],
        chat: [{ who: 'Клиент', tx: 'Сколько стоит?', tm: '10:0' + i }, { who: 'Менеджер', tx: 'От 20 000 руб.', tm: '10:1' + i }], wrong: ['Нет вопроса клиенту'], right: ['Назвали цену'], fix: 'Задать вопрос о размере.' })),
      actions: [1, 2, 3, 4, 5].map(i => ({ t: 'Шаг ' + i, pr: i <= 3 ? 'P1' : 'P2', why: 'Почему шаг ' + i, how: 'Как сделать шаг ' + i, who: 'РОП' }))
    },
    scripts: { core: { categories: [{ title: 'Первый ответ', scripts: [{ case: 'Клиент спросил цену', text: '[Имя], добрый день! Стоимость от 20 000 руб.', note: 'Синтетика' }] }] },
      objections: { objections: [{ name: 'Дорого', trigger: 'Дорого', psych: 'Синтетика', response: 'Синтетический ответ', then: 'Синтетика' }] } },
    magnets: { magnets: [{ name: 'Каталог', when: 'после цены', format: 'PDF', what: 'Синтетический магнит', pitch: 'Синтетический текст' }] },
    MGRS: { m1: { name: 'Менеджер А (синтетика)', oneliner: 'Синтетический профиль', deals: 24, profile: 'Синтетический текст профиля.', strong: ['Быстро отвечает'], weak: ['Не дожимает'], sign: 'Синтетика', fix: 'Синтетика' } },
    ORDER: ['m1']
  };
})();
