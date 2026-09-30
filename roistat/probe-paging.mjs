/* Разведка третьего шага: постраничный обход order/list и visit/list.
 *
 * Зачем отдельный скрипт, а не пятый раздел probe-analytics.mjs: тот отвечает на
 * уже закрытые вопросы (имена метрик, период в analytics/data) и тратит на них
 * вызовы. У API есть лимит запросов, поэтому разведка пагинации ходит только за
 * пагинацией.
 *
 * Отвечает на вопросы 2, 5 и 6 раздела «Открытые вопросы» в roistat/API.md:
 *   2. Имя параметра смещения и максимальный размер страницы.
 *   5. Лимит запросов в минуту и код отказа (только при RATE_PROBE=1).
 *   6. Доля заявок с привязкой к визиту по базе, а не по первым 500
 *      (только при COVERAGE_PAGES > 0).
 *
 * Грабли, из-за которых «параметр работает» может оказаться ложью (E018, E020
 * из knowledge/errors/registry.jsonl):
 *   - Ройстат отвечает HTTP 200 всегда. Отсутствие ошибки не значит, что
 *     параметр применён: неизвестное поле тело просто игнорирует.
 *   - Поэтому вердикт выносится по СОСТАВУ id, а не по коду и не по total.
 *   - Если список не упорядочен устойчиво, сравнивать страницы бессмысленно.
 *     Перед пробами идёт проверка устойчивости: два одинаковых запроса подряд.
 *   - Пересечение страниц считается явно: молчаливый дубль это К4 (двойной учёт).
 *
 * Значения клиентских полей не печатаются: только id, размеры и итоги.
 * Запуск: ROISTAT_API=... ROISTAT_PROJECTID=... node roistat/probe-paging.mjs
 */
const KEY = process.env.ROISTAT_API || '';
const PRJ = process.env.ROISTAT_PROJECTID || '';
if (!KEY) { console.error('Нет ROISTAT_API'); process.exit(1); }

const HOST = 'https://cloud.roistat.com/api/v1';
const q = p => HOST + p + '?key=' + encodeURIComponent(KEY) + (PRJ ? '&project=' + encodeURIComponent(PRJ) : '');
const scrub = s => String(s).split(KEY).join('***');
const pause = ms => new Promise(r => setTimeout(r, ms));

const PAUSE = Number(process.env.PAUSE_MS || 1500);
let calls = 0;

/* Один вызов без повторов: нужен, когда мы меряем сам лимит. */
async function raw(path, body) {
  calls++;
  try {
    const r = await fetch(q(path), { method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(body || {}), signal: AbortSignal.timeout(60000) });
    const t = await r.text();
    try { return JSON.parse(t); } catch { return { status:'error', error:'не JSON', description:t.slice(0,200) }; }
  } catch (e) { return { status:'error', error:'сеть', description:e.message }; }
}
const bad = j => !j || j.status === 'error' || !!j.error;
const isLimit = j => bad(j) && /limit/i.test(String(j.error));
const why = j => 'ОТКАЗ ' + scrub(JSON.stringify({ error:j.error, description:j.description }));

/* Рабочий вызов: на лимите ждёт и повторяет, иначе разведка врёт отказом там,
   где данные есть. Три попытки, паузы 5, 15, 30 секунд. */
async function call(path, body) {
  for (const wait of [5000, 15000, 30000, null]) {
    const j = await raw(path, body);
    if (!isLimit(j) || wait === null) return j;
    console.log('    (лимит запросов, пауза ' + wait / 1000 + 'с и повтор)');
    await pause(wait);
  }
}

const ids = j => ((j && j.data) || []).map(r => String(r.id));
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const inter = (a, b) => a.filter(x => b.includes(x)).length;

const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const FROM = process.env.FROM || day(30);
const TO   = process.env.TO   || day(1);
/* Период списки игнорируют (проверено 30.09, run 36677723748), но передаём его
   в том же виде, что и раньше: меняем один параметр за раз. */
const PERIOD = { from: FROM + ' 00:00:00', to: TO + ' 23:59:59' };

const L = 5;                       /* маленькая страница: сравнивать состав проще */
const out = [];                    /* итоговая таблица, печатается последней */
const say = s => { console.log(s); };

console.log('=== Roistat: постраничный обход ===');
console.log('период ' + FROM + ' .. ' + TO + ', проект ' + (PRJ || 'НЕ ЗАДАН') + ', страница ' + L + '\n');

/* ---------- 1. устойчив ли порядок ---------- */
say('--- порядок записей устойчив? (два одинаковых запроса подряд) ---');
const base1 = await call('/project/integration/order/list', { period: PERIOD, limit: L });
if (bad(base1)) { say('базовый запрос: ' + why(base1)); process.exit(1); }
await pause(PAUSE);
const base2 = await call('/project/integration/order/list', { period: PERIOD, limit: L });
const B = ids(base1);
const stable = !bad(base2) && eq(B, ids(base2));
say('  total в ответе: ' + base1.total + ', в выборке: ' + B.length);
say('  порядок ' + (stable ? 'устойчив, страницы сравнивать можно' : 'НЕУСТОЙЧИВ - вердикты ниже недостоверны'));
out.push(['устойчивость порядка', stable ? 'да' : 'НЕТ']);
if (B.length < L) say('  ВНИМАНИЕ: вернулось меньше ' + L + ' записей, пробы смещения будут слепыми');

/* ---------- 2. какое поле двигает окно ---------- */
/* Кандидаты из практики: смещение в записях, номер страницы, курсор.
   Значение 1 выбрано нарочно: оно различает семантику. Смещение в записях
   сдвинет окно на одну запись (первая страница без первого id), номер
   страницы отдаст непересекающийся набор. */
const CANDS = ['offset', 'page', 'skip', 'from', 'start', 'shift', 'page_number', 'pageNumber', 'p'];
say('\n--- чем задаётся смещение (значение 1, страница ' + L + ') ---');
say('  база: ' + B.join(', '));
const verdicts = {}, ignored = [];
for (const name of CANDS) {
  await pause(PAUSE);
  const j = await call('/project/integration/order/list', { period: PERIOD, limit: L, [name]: 1 });
  let verdict;
  if (bad(j)) verdict = why(j);
  else {
    const P = ids(j);
    const ov = inter(P, B);
    if (eq(P, B)) { verdict = 'игнорируется (тот же набор)'; ignored.push(name); }
    else if (P.length && eq(P.slice(0, L - 1), B.slice(1))) verdict = 'СМЕЩЕНИЕ В ЗАПИСЯХ (сдвиг на 1)';
    else if (P.length && ov === 0) verdict = 'НОМЕР СТРАНИЦЫ с нуля (набор не пересекается)';
    else if (!P.length) verdict = 'пустой ответ';
    else verdict = 'прочее: пересечение ' + ov + ' из ' + P.length;
  }
  verdicts[name] = verdict;
  say('  ' + name.padEnd(13) + verdict);
}

/* Второй проход по «игнорируется». Если нумерация страниц идёт с единицы, то
   значение 1 это первая страница, то есть та же база - и параметр выглядит
   проигнорированным. Отличить можно только значением 2. */
if (ignored.length) {
  say('\n--- второй проход по «игнорируется» (значение 2: нумерация с единицы?) ---');
  for (const name of ignored) {
    await pause(PAUSE);
    const j = await call('/project/integration/order/list', { period: PERIOD, limit: L, [name]: 2 });
    if (bad(j)) { say('  ' + name.padEnd(13) + why(j)); continue; }
    const P = ids(j);
    const ov = inter(P, B);
    if (eq(P, B)) { say('  ' + name.padEnd(13) + 'по-прежнему тот же набор - параметра нет'); continue; }
    if (P.length && eq(P.slice(0, L - 1), B.slice(2))) verdicts[name] = 'СМЕЩЕНИЕ В ЗАПИСЯХ (сдвиг на 2)';
    else if (P.length && ov === 0) verdicts[name] = 'НОМЕР СТРАНИЦЫ с единицы (набор не пересекается)';
    else verdicts[name] = 'прочее при значении 2: пересечение ' + ov + ' из ' + P.length;
    say('  ' + name.padEnd(13) + verdicts[name]);
  }
}

/* ---------- 3. подтверждение победителя ---------- */
const byRow   = CANDS.find(n => /СМЕЩЕНИЕ/.test(verdicts[n] || ''));
const byPage0 = CANDS.find(n => /НОМЕР СТРАНИЦЫ с нуля/.test(verdicts[n] || ''));
const byPage1 = CANDS.find(n => /НОМЕР СТРАНИЦЫ с единицы/.test(verdicts[n] || ''));
const winner = byRow || byPage0 || byPage1;
/* Значение, которое даёт вторую страницу, и значение первой страницы. */
const stepTwo  = byRow ? L : (byPage0 ? 1 : 2);
const stepOne  = byRow ? 0 : (byPage0 ? 0 : 1);
const kind = byRow ? 'в записях' : (byPage0 ? 'номер страницы с нуля' : 'номер страницы с единицы');
out.push(['параметр смещения', winner ? winner + ' (' + kind + ')' : 'НЕ НАЙДЕН']);

if (!winner) {
  say('\n--- подтверждение пропущено: ни один кандидат окно не сдвинул ---');
} else {
  say('\n--- подтверждение параметра ' + winner + ' ---');
  /* Проба 1: значение первой страницы должно вернуть базу. Если нет -
     параметр значит не то, что мы решили, и весь обход построен на песке. */
  await pause(PAUSE);
  const z = await call('/project/integration/order/list', { period: PERIOD, limit: L, [winner]: stepOne });
  const zOk = !bad(z) && eq(ids(z), B);
  say('  ' + winner + '=' + stepOne + ' равно базе: ' + (zOk ? 'да' : 'НЕТ' + (bad(z) ? ' (' + why(z) + ')' : ' -> ' + ids(z).join(', '))));
  out.push([winner + '=' + stepOne + ' равно базе', zOk ? 'да' : 'нет']);

  /* Проба 2: вторая страница не должна пересекаться с первой. Это прямой тест
     на К4: если страницы перекрываются, обход посчитает часть записей дважды. */
  await pause(PAUSE);
  const p2 = await call('/project/integration/order/list', { period: PERIOD, limit: L, [winner]: stepTwo });
  const P2 = bad(p2) ? [] : ids(p2);
  const ov2 = inter(P2, B);
  say('  вторая страница (' + winner + '=' + stepTwo + '): ' + (bad(p2) ? why(p2) : P2.join(', ')));
  say('  пересечение с первой: ' + ov2 + (ov2 === 0 ? ' - дублей при обходе не будет' : ' - ДУБЛИ, обход посчитает записи дважды'));
  out.push(['страницы не пересекаются', bad(p2) ? 'не проверено' : (ov2 === 0 ? 'да' : 'НЕТ, пересечение ' + ov2)]);

  /* Проба 3: хвост базы. Если смещение считается от всей базы, у total-2
     останется ровно 2 записи. Заодно это проверка, что total - не выдумка. */
  if (byRow && Number(base1.total) > 10) {
    await pause(PAUSE);
    const tail = Number(base1.total) - 2;
    const t = await call('/project/integration/order/list', { period: PERIOD, limit: L, [winner]: tail });
    const n = bad(t) ? -1 : ids(t).length;
    say('  хвост (' + winner + '=total-2=' + tail + '): вернулось ' + (n < 0 ? why(t) : n + ' записей, ожидали 2'));
    out.push(['total сходится с хвостом', n === 2 ? 'да' : 'нет (' + n + ')']);
  }
}

/* ---------- 4. максимальный размер страницы ---------- */
/* E018: размер страницы не угадывать. Просим больше и смотрим, сколько дали:
   молчаливое усечение до потолка - обычное поведение, ошибки не будет.
   Если усечения не случилось ни разу, потолок НЕ найден, и в итоге это должно
   быть написано именно так, а не «максимум = последнее проверенное» (К10). */
say('\n--- максимальный размер страницы ---');
const SIZES = [100, 500, 1000, 2000, 5000, 10000, 20000];
let maxOk = null, ceiling = null;
for (const want of SIZES) {
  await pause(PAUSE);
  const j = await call('/project/integration/order/list', { period: PERIOD, limit: want });
  const got = bad(j) ? -1 : ids(j).length;
  say('  limit=' + String(want).padEnd(6) + (got < 0 ? why(j) : 'вернулось ' + got + (got < want ? ' (усечено)' : '')));
  if (got < 0) { say('  дальше не идём: отказ'); break; }
  if (got > 0) maxOk = Math.max(maxOk || 0, got);
  if (got < want) { ceiling = got; break; }   /* потолок найден */
}
out.push(['записей на страницу', ceiling != null ? 'потолок ' + ceiling
  : (maxOk == null ? 'не определено' : 'не менее ' + maxOk + ' (потолок не найден, выше не просили)')]);
const maxPage = maxOk;

/* ---------- 5. те же вопросы к visit/list ---------- */
say('\n--- visit/list: тот же параметр? ---');
if (!winner) say('  пропущено: параметр смещения не найден');
else {
  await pause(PAUSE);
  const v1 = await call('/project/site/visit/list', { period: PERIOD, limit: L });
  if (bad(v1)) { say('  база визитов: ' + why(v1)); out.push(['visit/list: ' + winner, 'не проверено']); }
  else {
    const VB = ids(v1);
    await pause(PAUSE);
    const v2 = await call('/project/site/visit/list', { period: PERIOD, limit: L, [winner]: stepTwo });
    const V2 = bad(v2) ? [] : ids(v2);
    const ovv = inter(V2, VB);
    const ok = !bad(v2) && V2.length > 0 && ovv === 0;
    say('  total визитов: ' + v1.total);
    say('  первая страница: ' + VB.join(', '));
    say('  вторая страница: ' + (bad(v2) ? why(v2) : V2.join(', ')) + ', пересечение ' + ovv);
    out.push(['visit/list: ' + winner + ' работает', ok ? 'да' : 'НЕТ']);
  }
}

/* ---------- 6. доля заявок с привязкой к визиту по базе ---------- */
/* Открытый вопрос 6. Первые 500 записей дали 40%, но это начало базы, а не
   выборка: доля может ехать по годам. Берём COVERAGE_PAGES окон, равномерно
   разнесённых по всей базе. Это оценка по выборке, а не точная цифра (К14):
   печатаем и долю, и размер выборки, и сами смещения. */
const COV = Number(process.env.COVERAGE_PAGES || 0);
if (COV > 0 && winner && byRow) {
  const size = Math.min(maxPage || 100, 200);
  const total = Number(base1.total) || 0;
  say('\n--- покрытие: доля заявок с привязкой к визиту (' + COV + ' окон по ' + size + ') ---');
  let seen = 0, withVisit = 0;
  const marks = [];
  for (let i = 0; i < COV; i++) {
    const off = Math.floor(total * i / COV);
    await pause(PAUSE);
    const j = await call('/project/integration/order/list', { period: PERIOD, limit: size, [winner]: off });
    if (bad(j)) { say('  смещение ' + off + ': ' + why(j)); continue; }
    const rows = j.data || [];
    const w = rows.filter(r => r.visit_id || r.visit).length;
    seen += rows.length; withVisit += w;
    marks.push(off);
    say('  смещение ' + String(off).padEnd(7) + 'записей ' + String(rows.length).padEnd(5) +
        'с визитом ' + String(w).padEnd(5) + (rows.length ? Math.round(100 * w / rows.length) + '%' : ''));
  }
  const share = seen ? Math.round(1000 * withVisit / seen) / 10 : 0;
  say('  ИТОГО по выборке: ' + withVisit + ' из ' + seen + ' = ' + share + '%');
  say('  это оценка по ' + marks.length + ' окнам, а не точная цифра по базе');
  out.push(['привязка к визиту (выборка ' + seen + ')', share + '%']);
}

/* ---------- 8. где обрывается привязка к визиту ---------- */
/* Прогон 36680662106 дал не плавное снижение, а обрыв: 37%, 33%, 29%, 21%, а
   дальше восемь окон подряд по нулю. Средняя по всей базе (9.9%) в таком виде
   бессмысленна - это К2, числитель и знаменатель из разных популяций. Пока
   граница не найдена, доля привязки не цифра, а два разных числа.
   Ищем границу делением пополам и печатаем даты по краям.
   Заодно раскладываем по типу записи: order/list несёт и lead_, и deal_,
   и привязка к визиту у них разная по природе. Считать их вместе - та же К2.
   Даты и тип записи - метаданные, клиентских полей в лог не идёт.
   Включение: CLIFF=1. */
if (process.env.CLIFF === '1' && winner && byRow) {
  const W = Number(process.env.CLIFF_WINDOW || 100);
  const total = Number(base1.total) || 0;
  say('\n--- где обрывается привязка к визиту (окно ' + W + ') ---');

  /* Разбор одного окна: сколько lead_ и deal_, у скольких есть визит, даты. */
  const look = async off => {
    const j = await call('/project/integration/order/list', { period: PERIOD, limit: W, [winner]: off });
    if (bad(j)) return { off, err: why(j) };
    const rows = j.data || [];
    const g = { lead: { n:0, v:0 }, deal: { n:0, v:0 }, other: { n:0, v:0 } };
    let dMin = null, dMax = null;
    for (const r of rows) {
      const id = String(r.id);
      const k = id.startsWith('lead_') ? 'lead' : (id.startsWith('deal_') ? 'deal' : 'other');
      g[k].n++;
      if (r.visit_id || r.visit) g[k].v++;
      const d = String(r.creation_date || '').slice(0, 10);
      if (d) { if (!dMin || d < dMin) dMin = d; if (!dMax || d > dMax) dMax = d; }
    }
    const v = g.lead.v + g.deal.v + g.other.v;
    return { off, n: rows.length, v, g, dMin, dMax };
  };
  const show = w => w.err ? '  смещение ' + w.off + ': ' + w.err
    : '  смещение ' + String(w.off).padEnd(7) + 'даты ' + (w.dMin || '?') + '..' + (w.dMax || '?') +
      '  всего ' + String(w.n).padEnd(4) + 'с визитом ' + String(w.v).padEnd(4) +
      ' | lead ' + w.g.lead.v + '/' + w.g.lead.n + '  deal ' + w.g.deal.v + '/' + w.g.deal.n +
      (w.g.other.n ? '  прочие ' + w.g.other.v + '/' + w.g.other.n : '');

  await pause(PAUSE);
  const head = await look(0);
  say(show(head));
  await pause(PAUSE);
  const tail = await look(Math.max(0, total - W));
  say(show(tail));

  if (head.err || tail.err) say('  деление пополам пропущено: край не прочитался');
  else if (head.v === 0) say('  привязки нет даже в начале базы - границу искать не в смещении');
  else if (tail.v > 0) say('  привязка есть и в хвосте - обрыва нет, предыдущий прогон надо перепроверить');
  else {
    /* Инвариант деления: слева всегда есть привязка, справа всегда нет. */
    let lo = 0, hi = Math.max(0, total - W), steps = 0;
    while (hi - lo > W && steps < 20) {
      const mid = Math.floor((lo + hi) / 2);
      await pause(PAUSE);
      const w = await look(mid);
      steps++;
      if (w.err) { say(show(w)); break; }
      say(show(w));
      if (w.v > 0) lo = mid; else hi = mid;
    }
    say('  граница между смещениями ' + lo + ' и ' + hi + ', шагов ' + steps);
    await pause(PAUSE);
    const L2 = await look(lo);
    await pause(PAUSE);
    const R2 = await look(hi);
    say('  последнее окно с привязкой:  ' + (L2.err || (L2.dMin + '..' + L2.dMax + ', с визитом ' + L2.v + ' из ' + L2.n)));
    say('  первое окно без привязки:    ' + (R2.err || (R2.dMin + '..' + R2.dMax + ', с визитом ' + R2.v + ' из ' + R2.n)));
    /* Список идёт от новых к старым, поэтому граница - самая РАННЯЯ дата,
       у которой привязка ещё встречается. */
    out.push(['привязка к визиту кончается', (L2.dMin ? 'около ' + L2.dMin + ', ' : '') +
      'смещение между ' + lo + ' и ' + hi]);
    out.push(['записей с привязкой (от начала)', 'примерно ' + lo + ' из ' + total]);
  }
}

/* ---------- 7. лимит запросов ---------- */
/* Открытый вопрос 5. Выключено по умолчанию нарочно: проба упирается в лимит,
   и если гонять её вместе с остальным, лимит съест полезные вызовы.
   Включать отдельным прогоном: RATE_PROBE=1. */
if (process.env.RATE_PROBE === '1') {
  say('\n--- лимит запросов: серия без пауз ---');
  const t0 = Date.now();
  let okCount = 0, hit = null;
  for (let i = 1; i <= 40; i++) {
    const j = await raw('/project/integration/status/list', {});
    if (isLimit(j)) { hit = { i, ms: Date.now() - t0, err: j.error, desc: j.description }; break; }
    if (bad(j)) { say('  запрос ' + i + ': ' + why(j)); break; }
    okCount++;
  }
  if (hit) {
    say('  лимит поймали на запросе ' + hit.i + ' за ' + hit.ms + ' мс');
    say('  код отказа: ' + scrub(JSON.stringify({ error: hit.err, description: hit.desc })));
    out.push(['лимит запросов', hit.i - 1 + ' подряд за ' + hit.ms + ' мс, дальше ' + hit.err]);
    say('  пауза 60с, чтобы не оставить ключ в блокировке');
    await pause(60000);
  } else {
    say('  ' + okCount + ' запросов подряд за ' + (Date.now() - t0) + ' мс, лимит не пойман');
    out.push(['лимит запросов', 'не пойман на ' + okCount + ' подряд']);
  }
} else {
  say('\n--- лимит запросов: пропущено (включить RATE_PROBE=1 отдельным прогоном) ---');
}

/* ---------- итог ---------- */
/* Печатается последней: логи Actions читаются с хвоста (get_job_logs отдаёт
   tail_lines). Не переставлять выше. */
console.log('\n=== ИТОГ ===');
for (const [k, v] of out) console.log('  ' + String(k).padEnd(38) + v);
console.log('  ' + 'вызовов к API'.padEnd(38) + calls);
