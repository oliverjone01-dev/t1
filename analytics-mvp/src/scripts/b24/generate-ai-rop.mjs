// Ночная генерация ИИ-РОП текстов через Anthropic API. Голос: справедливый,
// не токсичный ментор менеджеров с тонким лаконичным чувством юмора (правка Ивана 01.09).
// Каждый прогон гейтится validate-ai-rop.mjs; при FAIL - до 2 поправочных кругов
// с передачей ошибок в промпт; финальный FAIL = exit 1, прежний ai-rop.json остаётся.
// Запуск: ANTHROPIC_API_KEY=... SHEETS=... ARGS=... OUT=dialog/data/ai-rop.json node src/scripts/b24/generate-ai-rop.mjs
// Модель: MODEL env, по умолчанию claude-sonnet-5 (решение Ивана 01.09).
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('generate-ai-rop: нет ANTHROPIC_API_KEY - генерация пропущена'); process.exit(2); }
const MODEL = process.env.MODEL || 'claude-sonnet-5';
const SHEETS_P = process.env.SHEETS, ARGS_P = process.env.ARGS;
const OUT = process.env.OUT || 'dialog/data/ai-rop.json';
const sheets = JSON.parse(readFileSync(SHEETS_P, 'utf-8'));
const args = JSON.parse(readFileSync(ARGS_P, 'utf-8'));

const VOICE = `Ты - ИИ-РОП отдела продаж GENGROUP (стеклянные перегородки, зеркала, премиум). Голос: справедливый и НЕ токсичный ментор менеджеров с 15-летним опытом - говоришь с человеком, а не о статистике; тонкое лаконичное чувство юмора (одна лёгкая улыбка на текст, никогда не за счёт человека); хвалишь конкретно, критикуешь дефект, а не личность; каждый упрёк сопровождаешь первым шагом, который можно сделать сегодня.
ЖЕЛЕЗНЫЕ ПРАВИЛА: 1) Русский, дефис вместо тире, em dash запрещён. 2) Запрещён ИИ-слоп: «в мире современного», «не секрет что», «является неотъемлемой», «позволяет создать», «уникальный», «инновационный», «высокое качество», «индивидуальный подход», «гармонично», «идеальное решение», rule of three, канцелярит; клише «молодец/холодец». 3) Каждая цифра - с делом или именем. 4) Слово «гниёт» запрещено - у нас стекло: «мёрзнет/замёрзло». 5) Плейсхолдер «N» из ярлыков движка не копируй - пиши по-человечески. 6) Даты дд.мм. 7) Числа бери ДОСЛОВНО из переданных фактов - тексты проходят механический валидатор, число без источника роняет сборку; суммы от тысячи пиши с пробелами разрядов (335 588 ₽). 8) МЕТРИКИ: «продажа/предоплата недели» = поле wonWeek (первый вход сделки в оплатную стадию внутри окна); не путай с месячной воронкой funnelAug. 9) ТЕРМИНЫ: lossRub называй только «просадка шанса»; «мёрзнет» - деньги в этапах, «под риском» - очереди. 10) Движение рейтинга - всегда с датами обеих точек. 11) Месячную воронку цитируй только из augustFunnel/funnelAug с явным словом месяца. 12) Никогда не упоминай в тексте имена полей и технические термины данных (wonWeek, dept.bestCR, funnelAug, lossRub и т.п.) - только человеческие слова.`;

async function call(system, user, maxTokens = 1800) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
    if (r.status === 429 || r.status >= 500) { await new Promise((res) => setTimeout(res, 3000 * (i + 1))); continue; }
    if (!r.ok) throw new Error('API ' + r.status + ': ' + (await r.text()).slice(0, 300));
    const j = await r.json();
    return j.content.map((c) => c.text || '').join('');
  }
  throw new Error('API: 3 попытки исчерпаны');
}
const parseJson = (t) => { const m = t.match(/\{[\s\S]*\}/); if (!m) throw new Error('нет JSON в ответе'); return JSON.parse(m[0]); };

async function genMgr(name, sh, fixNote) {
  const sys = VOICE + '\nОтвечай ТОЛЬКО валидным JSON без пояснений: {"mini": "...", "move": "...", "full": "..."}. mini - 2 строки для сводки отдела, начинается с фамилии-имени, до 200 знаков. move - почему рейтинг сдвинулся (обе даты!) + фокус недели, до 350 знаков. full - персональный срез 700-1400 знаков: заголовок с именем и рейтингом со звездой, «что держит уровень», «что мёрзнет», 2-3 сделки из badDeals с бюджетом и первым шагом (перефразируй next по-человечески), «фокус недели». Если в досье есть блок pamyatka (улики недели по памятке менеджера с цитатами из переписки) - возьми в full одну-две самые денежные улики как конкретику: цитату копируй ДОСЛОВНО из pamyatka.top.quote (валидатор сверяет цитаты с досье, искажённая роняет сборку), назови правило по-человечески и дай замену; свои формулировки-замены пиши без ёлочек или короче 35 знаков; поле pamyatka и коды правил в тексте не упоминай. Эмодзи умеренно, plain text с \\n.';
  const user = `Досье менеджера ${name} за окно ${args.window}:\n${JSON.stringify(sh)}\n` +
    (sh.role === 'office' ? 'Это офисная роль (документооборот): регламент продаж не применяется - mini одна строка про роль и объём, move «офисная роль, рейтинг не применяется», full короткий без продажных оценок.\n' : '') +
    ((sh.deals || 0) < 10 ? 'Диалогов меньше порога - данных мало: без негативных выводов, скажи это прямо.\n' : '') +
    (fixNote ? `\nПРОШЛЫЙ ВАРИАНТ НЕ ПРОШЁЛ ВАЛИДАТОР, исправь ровно это и ничего не ломай:\n${fixNote}\n` : '');
  return parseJson(await call(sys, user));
}
async function genDept(minis, fixNote) {
  const sys = VOICE + '\nОтвечай ТОЛЬКО валидным JSON: {"summary","compare","pulseNote","funnelNote","freezeNote"}. summary - TG-пост недели отдела 900-1600 знаков: воронка недели, что горит, что мёрзнет, похвала по имени, фокус, затем блок «Команда» одной строкой на человека из мини-срезов; ОБЯЗАТЕЛЬНО строка вида «Продажи недели: {N} сделок на {СУММА} ₽» с числами из weekSales.total. compare - сравнение граничных дней недель из queuesBorders и deptRatingMedian, до 600 знаков, направления не переворачивай. pulseNote - 2-4 предложения про waiting/silent/fakedone. funnelNote - где теряем конверсию в weekCohortFunnel (или явно про месяц из augustFunnel). freezeNote - почему frozen это резерв прибыли и с чего начать.';
  const user = `Факты отдела (единственный источник чисел):\n${JSON.stringify(args.dept)}\n\nМини-срезы команды:\n${minis}\n` + (fixNote ? `\nПРОШЛЫЙ ВАРИАНТ НЕ ПРОШЁЛ ВАЛИДАТОР, исправь ровно это:\n${fixNote}\n` : '');
  return parseJson(await call(sys, user, 2500));
}
async function genDeals(queue, items) {
  const sys = VOICE + '\nОтвечай ТОЛЬКО валидным JSON: {"items":[{"id":число,"note":"1-2 предложения: что происходит и один следующий шаг"}]}.';
  return parseJson(await call(sys, `Топ-сделки очереди «${queue}»:\n${JSON.stringify(items)}`)).items;
}

// пишем во временный файл: боевой OUT заменяется ТОЛЬКО после PASS,
// иначе ночной провал оставил бы на странице невалидные тексты
const TMP = OUT + '.new';
const validate = (out) => {
  writeFileSync(TMP, JSON.stringify(out, null, 1));
  try { execSync(`SHEETS=${SHEETS_P} ARGS=${ARGS_P} AI=${TMP} node src/scripts/b24/validate-ai-rop.mjs`, { stdio: 'pipe' }); return null; }
  catch (e) { return (e.stdout || Buffer.from('')).toString(); }
};

const today = new Date().toISOString().slice(0, 10);
const run = async () => {
  const mgrs = {};
  for (const [name, sh] of Object.entries(sheets)) { mgrs[name] = await genMgr(name, sh); console.log('  срез:', name); }
  const minis = Object.values(mgrs).map((m) => m.mini).join('\n');
  const dept = await genDept(minis); console.log('  срез отдела');
  // канон недельного итога - ДЕТЕРМИНИРОВАННО из фактов, не выпрашиваем у модели (гонка формулировок)
  const wsT = args.dept?.weekSales?.total;
  // Вариант модели убираем целиком, иначе сводка открывается дублем (G5 ФЕНИКСА)
  if (wsT) {
    const body = (dept.summary || '').split('\n').filter((l) => !/^\s*Продажи\s+недели\s*:/i.test(l)).join('\n').replace(/^\n+/, '');
    dept.summary = ('Продажи недели: ' + wsT.n + ' сделок на ' + Math.round(wsT.rub).toLocaleString('ru-RU').replace(/\u00a0/g, ' ') + ' ₽.\n\n' + body).replace(/\n{3,}/g, '\n\n');
  }
  const deals = {};
  for (const [q, items] of Object.entries(args.topDeals || {})) { deals[q] = await genDeals(q, items); console.log('  сделки:', q); }
  let out = { generatedAt: today, window: args.window, mgrs, dept, deals };

  for (let round = 1; round <= 3; round++) {
    const errs = validate(out);
    if (!errs) { writeFileSync(OUT, readFileSync(TMP)); console.log(`generate-ai-rop: AI-VALIDATE PASS (круг ${round}, модель ${MODEL}) -> ${OUT}`); return; }
    console.log(`круг ${round}: валидатор вернул ошибки, чиню точечно:\n${errs}`);
    if (round === 3) { console.error('generate-ai-rop: валидатор не прошёл за 3 круга - старый ai-rop.json НЕ заменён'); process.exit(1); }
    // точечная регенерация только провалившихся секций
    const failedMgrs = new Set([...errs.matchAll(/^FAIL ([А-ЯЁа-яё-]+ [А-ЯЁа-яё-]+):/gm)].map((m) => m[1]));
    const deptFailed = /^FAIL dept:/m.test(errs) || /^FAIL inputs:/m.test(errs);
    for (const name of failedMgrs) if (sheets[name]) {
      const myErrs = errs.split('\n').filter((l) => l.startsWith('FAIL ' + name)).join('\n');
      out.mgrs[name] = await genMgr(name, sheets[name], myErrs); console.log('  перегенерирован:', name);
    }
    if (deptFailed) {
      const dErrs = errs.split('\n').filter((l) => l.startsWith('FAIL dept') || l.startsWith('FAIL inputs') || l.startsWith('FAIL corpus')).join('\n');
      out.dept = await genDept(Object.values(out.mgrs).map((m) => m.mini).join('\n'), dErrs); console.log('  перегенерирован: отдел');
    }
  }
};
run().catch((e) => { console.error('generate-ai-rop:', e.message); process.exit(1); });
