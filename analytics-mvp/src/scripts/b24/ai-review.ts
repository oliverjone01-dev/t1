// Ежедневный ИИ-разбор коммуникаций по сделкам: читает хронологию из dialog.json,
// оценивает её по регламенту сильного продавца и пишет вердикты в dialog/data/ai-review.json.
// Результат подхватывает score-dialog.ts (теги, рекомендация, поправка вероятности).
//
// Запуск: ANTHROPIC_API_KEY=... npx tsx src/scripts/b24/ai-review.ts
// Без ключа скрипт молча выходит - остальной пайплайн работает на детерминированных правилах.
//
// Экономия: разбираются только диалоги с новой активностью (кэш по ключу lastTs), не больше
// AI_LIMIT за прогон, модель по Protocol 11 - sonnet для содержательного анализа.
//
// Batch API (AI_BATCH=1, по умолчанию): разбор сделок уходит одним пакетом в
// https://api.anthropic.com/v1/messages/batches - это -50% к стоимости токенов. Качество не
// меняется: та же модель, тот же system, тот же prompt, что и в синхронном режиме (buildBody
// строит тело запроса в одном месте для обоих путей). Пакет ждём не дольше AI_BATCH_WAIT_MIN
// минут; всё, что не успело/сломалось в пакете, добираем синхронно - прогон всегда завершается
// с полными данными. AI_BATCH=0 полностью возвращает старый синхронный режим.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

// Параметры прогона. Воркфлоу b24-dialog-cron живёт на main и прокидывает только AI_LIMIT и
// AI_BATCH, поэтому модель, менеджер и путь вывода берём ещё и из необязательного файла
// dialog/ai-run.json в этой же ветке данных: задать их можно коммитом, не трогая main.
// Приоритет: переменная окружения -> файл -> значение по умолчанию. Нет файла - прежнее поведение.
function runCfg(): Record<string, string> {
  try { return JSON.parse(readFileSync("dialog/ai-run.json", "utf8")) || {}; } catch { return {}; }
}
const CFG = runCfg();
const pick = (env: string, key: string, def = "") => (process.env[env] || CFG[key] || def).toString().trim();

const KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = pick("AI_MODEL", "model", "claude-sonnet-5");
const LIMIT = Number(process.env.AI_LIMIT || 120);
// AI_MGR="Имя Фамилия" - разобрать только сделки этого менеджера и принудительно ре-разобрать
// их даже если разбор уже есть (пилот стоимости по одному менеджеру). Пусто = обычный режим.
// AI_MGR="Имя Фамилия" ограничивает разбор одним менеджером и принудительно ре-разбирает
// его сделки (пилот стоимости). Пусто = обычный режим по всему отделу.
// AI_MGR / mgr - один менеджер или несколько через «;». Список нужен, чтобы переразобрать
// уже прогнанных на исправленном промпте одним прогоном, а не по одному.
const MGR_LIST = pick("AI_MGR", "mgr").split(";").map((x) => x.trim()).filter(Boolean);
const MGR_ONLY = MGR_LIST.length === 1 ? MGR_LIST[0]! : "";
// AI_FORCE=1 (или force в ai-run.json) - переразобрать даже то, что уже разобрано.
// Нужно для замера на одном и том же наборе: другой промпт, те же сделки.
const FORCE = pick("AI_FORCE", "force") === "1";
const CONC = 4;
// Учёт токенов для отчёта о стоимости (Protocol 9). Считаем по всем ответам API.
const usage = { in: 0, out: 0, cacheR: 0, cacheW: 0 };
function addUsage(u: any) {
  if (!u) return;
  usage.in += u.input_tokens || 0; usage.out += u.output_tokens || 0;
  usage.cacheR += u.cache_read_input_tokens || 0; usage.cacheW += u.cache_creation_input_tokens || 0;
}
const USE_BATCH = (process.env.AI_BATCH ?? "1") !== "0";
// Ожидание пакета. 30 минут оказалось мало даже на 83 диалогах: прогон свалился в
// синхронный добор, а он без скидки 50%. Значение задаётся в ai-run.json полем wait.
const BATCH_WAIT_MIN = Number(pick("AI_BATCH_WAIT_MIN", "wait", "30"));
const DLG = "dialog/data/dialog.json";
// AI_OUT - куда писать разбор. По умолчанию боевой файл, который читает score-dialog.
// Отдельный путь нужен для замера: прогнать тот же набор сделок другой моделью и сравнить,
// не перетирая то, что уже стоит в дашборде.
const OUT = pick("AI_OUT", "out", "dialog/data/ai-review.json");

if (!KEY) { console.log("ANTHROPIC_API_KEY не задан - ИИ-слой пропущен (это не ошибка)"); process.exit(0); }

const API = "https://api.anthropic.com/v1";
const HEADERS = { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" };

const SYSTEM = `Ты аудитор отдела продаж мебельного производства (стекло, зеркала, металл, изделия на заказ).
Разбираешь переписку менеджера с клиентом по КАТАЛОГУ ДЕФЕКТОВ КОСТИ, слой B (тексты сообщений).
Слой A (зависание на стадии, тишина, просроченные дела, пустые поля) считается механически до тебя -
его НЕ дублируй, твоя работа только там, где нужно прочитать текст.

ДЕФЕКТЫ, слой B. Код обязателен в поле k:
T01 ПУСТОЕ_ПИСЬМО - вложение без единого слова в теле.
T02 БЕЗ_ИМЕНИ - нет приветствия и обращения по имени, включая пересылку файла.
T03 РАЗМЫТЫЙ_СРОК - «в ближайшее время», «постараюсь сегодня», «как только», «после выходных».
T04 ЖАРГОН_В_ИЗВИНЕНИИ - «закрутился», «забылся», «был в запаре».
T05 ОБЕЗЛИЧЕННОЕ_КАСАНИЕ - касание после паузы без «кто я, какая компания, о чём договаривались».
T06 ЗАЩИТА_ВМЕСТО_ИЗВИНЕНИЯ - на претензию отвечает «вы не указали», восклицательными знаками, спором.
T07 ОРФОГРАФИЯ - опечатки, пробел перед запятой, слипшиеся предложения.
T08 ОБЕЩАЛ_НЕ_СДЕЛАЛ - обещание в тексте, которого потом не видно в переписке.
T09 ШТАМП_НЕ_К_МЕСТУ - «благодарю за длительное ожидание» после 20 минут, канцелярские обороты.

СИЛЬНЫЕ СТОРОНЫ, ищи их так же внимательно, как дефекты, код G:
G01 быстрая первая реакция · G02 расчёт в считанные минуты · G03 настойчивость в касаниях
G04 честность про брак или срыв · G05 признание ошибки без защиты · G06 отработка возражения аргументом
G07 предупреждение о риске заранее · G08 чистое завершение цикла, договорённости зафиксированы.

КТО ЗА ЧТО ОТВЕЧАЕТ. В каждой строке указан её автор. Оцениваемый менеджер назван в задании.
- ВЕДЕНИЕ СДЕЛКИ - всегда на оцениваемом менеджере, даже если строку писал клиент, коллега,
  бот или менеджер до него. Он принял сделку и обязан её подогревать при любой температуре:
  клиент ждёт ответа, вопрос повис, отказ не разобран, договорённость не зафиксирована,
  наследство от прежнего менеджера не подхвачено - это его зона, тег ставится ему.
- КАЧЕСТВО ТЕКСТА (T01-T09: пустое письмо, без имени, размытый срок, жаргон в извинении,
  обезличенное касание, защита вместо извинения, орфография, обещал не сделал, штамп) -
  ТОЛЬКО на строках, автор которых совпадает с оцениваемым менеджером. Нельзя ставить ему
  опечатку или обращение, написанное другим человеком, ботом или клиентом.
- Строку с пометкой «…[обрезано скриптом]» обрезали мы, а не менеджер: тег «оборванное
  сообщение» на ней не ставится. «[ВЛОЖЕНИЕ, тело не выгружено]» - это отправленный файл,
  а не пустое письмо; T01 ставится только для типа «Письмо».

Правила вывода:
- Оценивай действие, а не человека. Факт, потом вывод.
- Опирайся только на приведённую хронологию. Не додумывай того, чего в ней нет.
- Каждый тег к КОНКРЕТНОЙ строке хронологии и с дословной цитатой из неё. Без цитаты тег не ставится.
- Баланс обязателен: если в диалоге есть сильные места, их надо отметить, а не только дефекты.
- Рекомендация - одно конкретное действие на завтра с датой или сроком, без «в ближайшее время».
- Запрещены: em dash, «выглядит хорошо», «в целом неплохо», канцелярит.
- КОМПАКТНО: verdict/problem/recommendation - по одной короткой фразе (<=25 слов). Тегов до 8 на
  длинный диалог и до 4 на короткий, только там, где код каталога действительно сработал; quote -
  дословный фрагмент до 10 слов. quotes - до 2 коротких. Длинный ответ обрезается и теряется целиком.
- Отвечай ТОЛЬКО валидным JSON без markdown-обёртки.`;

const SCHEMA = `{
  "verdict": "одна фраза: что происходит в сделке и куда она идёт",
  "problem": "главная проблема в работе менеджера одной фразой, или пустая строка если всё ведётся правильно",
  "recommendation": "одно конкретное действие на завтра с датой или сроком",
  "tone": "good|warn|bad — светофор сделки: good всё правильно, warn есть риск, bad грубая ошибка",
  "scores": {"polite":0-5,"qual":0-5,"deadline":0-5,"process":0-5,"result":0-5},
  "msgTags": [{"i": номер строки хронологии, "k":"код каталога: T01..T09 для дефекта, G01..G08 для сильной стороны", "tone":"good|warn|bad", "t":"короткий тег с префиксом 'ИИ · '", "quote":"дословная фраза из этой строки, по которой сработал тег"}],
  "probDelta": -30..20,
  "quotes": ["до 2 цитат из переписки, подтверждающих вердикт"]
}`;

// Разбор на уровне менеджера: сводка по всем его сделкам за окно.
const MGR_SYSTEM = `Ты РОП. По списку кратких итогов ИИ о сделках одного менеджера сделай сводную оценку его работы.
Оцениваешь действия, а не человека. Пиши конкретно, без канцелярита и без «в целом». Запрещён em dash.
Отвечай ТОЛЬКО валидным JSON без markdown.`;
const MGR_SCHEMA = `{
  "verdict": "одна фраза: как менеджер работает в целом",
  "strengths": ["1-3 сильные стороны, каждая с опорой на факт из сделок"],
  "weaknesses": ["1-3 повторяющиеся слабые места"],
  "action": "одно главное, что менеджеру нужно чинить"
}`;

type Ev = { ts: number; dt: string; dealId: string; leadId: string; mgr: string; type: string; dir: string; who: string; body: string; dealT: string; leadT: string; src?: string };
type Item = { k: string; cid: string; mgr: string; last: number; prompt: string; srcs: Record<number, string> };

// Тело запроса к Messages API. Одна точка сборки на оба режима (sync + batch), чтобы модель,
// system и prompt были байт-в-байт одинаковыми и качество разбора не зависело от способа отправки.
function buildBody(prompt: string, system: string) {
  return {
    model: MODEL, max_tokens: Number(process.env.AI_MAXTOK || 3000),
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  };
}

// Достаём JSON-вердикт из ответа модели (content[].text -> первый {...} -> parse).
function parseReview(message: any): any {
  const txt = (message?.content || []).map((c: any) => c.text || "").join("").trim();
  const m = txt.match(/\{[\s\S]*\}/);
  try { return m ? JSON.parse(m[0]) : null; } catch { return null; }
}

// Ошибки, после которых повторять запросы бессмысленно: ключ, доступ, деньги. Раньше при
// пустом балансе скрипт честно отправлял все 600 запросов, каждый получал один и тот же отказ,
// прогон заканчивался нулём разборов и рапортовал success. Первый такой ответ гасит прогон.
let FATAL = "";
const isFatal = (m: string) => /credit balance|billing|invalid x-api-key|authentication|permission|not_found_error/i.test(m);

async function callAI(prompt: string, system: string = SYSTEM): Promise<any> {
  if (FATAL) return null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${API}/messages`, {
        method: "POST", headers: HEADERS,
        body: JSON.stringify(buildBody(prompt, system)),
        signal: AbortSignal.timeout(90000),
      });
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue; }
      const j: any = await res.json();
      if (j.error) {
        const msg = String(j.error.message || j.error.type || "");
        if (!FATAL && isFatal(msg)) { FATAL = msg; console.log("::error::Прогон остановлен, ответ API:", msg); }
        else console.log("  ошибка API:", msg);
        return null;
      }
      addUsage(j.usage);
      return parseReview(j);
    } catch (e: any) { if (attempt === 3) { console.log("  сбой:", e.message); return null; } await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); }
  }
  return null;
}

// Нумеруем строки, чтобы ИИ мог привязать msgTags к конкретному сообщению по номеру,
// а мы потом перевели номер обратно в src. srcs[номер] = src события.
function transcript(evs: Ev[]): { text: string; srcs: Record<number, string> } {
  const slice = evs.slice(-40);
  const srcs: Record<number, string> = {};
  const lines = slice.map((e, idx) => {
    const n = idx + 1; srcs[n] = e.src || "";
    // Кто написал строку. Раньше сюда шла только роль по dir, и модель не знала автора:
    // теги за орфографию и обращение уезжали на текущего менеджера, хотя текст писал другой
    // сотрудник, бот или клиент. Поле who заполнено в выгрузке у всех событий.
    const role = e.dir === "входящее" ? "КЛИЕНТ" : e.dir === "исходящее" ? "МЕНЕДЖЕР" : "CRM";
    const author = String(e.who || "").trim();
    const head = author ? `${author} (${role})` : role;
    const raw = String(e.body || "").replace(/\s+/g, " ");
    // Заглушка вложения - это не пустое сообщение, а невыгруженное тело файла.
    const att = /^(Отправлено|Принято|Получено)\s+(Файл|Изображение|Видео|Документ|Аудио)\.?$/i.test(raw.trim());
    // Обрезаем мы сами. Без маркера модель принимала обрыв за оборванную фразу менеджера.
    const body = att ? "[ВЛОЖЕНИЕ, тело не выгружено]"
      : (raw.length > 400 ? raw.slice(0, 400) + " …[обрезано скриптом]" : raw);
    return `[${n}] ${e.dt.slice(5, 16).replace("T", " ")} [${e.type}] ${head}: ${body}`;
  });
  return { text: lines.join("\n").slice(0, 12000), srcs };
}

// Записываем разбор сделки в reviews с переводом msgTags.i -> src сообщения.
function applyReview(reviews: Record<string, any>, it: Item, r: any) {
  const msgTags = Array.isArray(r.msgTags)
    ? r.msgTags.map((t: any) => ({ src: it.srcs[Number(t.i)] || "", k: t.k || "", tone: t.tone, t: t.t, quote: t.quote })).filter((t: any) => t.src)
    : [];
  reviews[it.k] = { ...r, msgTags, mgr: it.mgr, lastTs: it.last, at: new Date().toISOString(), model: MODEL };
}

// --- Batch API: создать пакет, дождаться, забрать результаты ------------------------
async function batchCreate(requests: any[]): Promise<any | null> {
  try {
    const res = await fetch(`${API}/messages/batches`, {
      method: "POST", headers: HEADERS, body: JSON.stringify({ requests }), signal: AbortSignal.timeout(120000),
    });
    const j: any = await res.json();
    if (j.error || !j.id) { console.log("  batch не создан:", j.error?.message || j.error?.type || res.status); return null; }
    return j;
  } catch (e: any) { console.log("  batch не создан:", e.message); return null; }
}

async function batchGet(id: string): Promise<any | null> {
  try {
    const res = await fetch(`${API}/messages/batches/${id}`, { headers: HEADERS, signal: AbortSignal.timeout(60000) });
    const j: any = await res.json();
    return j.error ? null : j;
  } catch { return null; }
}

async function batchCancel(id: string): Promise<void> {
  try { await fetch(`${API}/messages/batches/${id}/cancel`, { method: "POST", headers: HEADERS, signal: AbortSignal.timeout(60000) }); } catch { /* best-effort */ }
}

// Результаты приходят в формате JSONL по results_url; порядок произвольный - ключуем по custom_id.
async function batchResults(url: string): Promise<Record<string, any>> {
  const out: Record<string, any> = {};
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(120000) });
    const text = await res.text();
    for (const line of text.split("\n")) {
      const s = line.trim(); if (!s) continue;
      try {
        const row: any = JSON.parse(s);
        if (row?.result?.type === "succeeded") { addUsage(row.result.message?.usage); const r = parseReview(row.result.message); if (r) out[row.custom_id] = r; }
      } catch { /* пропускаем битую строку */ }
    }
  } catch (e: any) { console.log("  результаты пакета не забраны:", e.message); }
  return out;
}

// Синхронный добор оставшихся сделок пулом из CONC воркеров.
async function reviewSync(items: Item[], reviews: Record<string, any>): Promise<{ done: number; failed: number }> {
  let done = 0, failed = 0, qi = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    for (;;) {
      const idx = qi++; if (idx >= items.length) break;
      const it = items[idx]!;
      const r = await callAI(it.prompt);
      if (r) { applyReview(reviews, it, r); done++; } else failed++;
      if ((done + failed) % 20 === 0) console.log(`  синхронно разобрано ${done}, сбоев ${failed} из ${items.length}`);
    }
  }));
  return { done, failed };
}

async function main() {
  const dlg = JSON.parse(readFileSync(DLG, "utf8"));
  const events: Ev[] = dlg.events || [];
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { reviews: {} };
  // Демо-файл (разбор вручную) не перетираем: если ключа нет, скрипт вообще не доходит сюда,
  // а если дошёл - обновляем только реальные разборы, демо остаётся как есть.
  // При таргет-прогоне по менеджеру (AI_MGR) сохраняем уже сделанные разборы (демо и чужих
  // менеджеров) и мёржим - иначе фильтр по одному менеджеру стёр бы остальные карточки.
  const reviews: Record<string, any> = MGR_LIST.length ? (prev.reviews || {}) : (prev.demo ? {} : (prev.reviews || {}));
  const mgrOf: Record<string, string> = {};

  const byKey: Record<string, Ev[]> = {};
  for (const e of events) (byKey[e.dealId ? "D" + e.dealId : "L" + e.leadId] ||= []).push(e);

  // разбираем только диалоги с новой активностью и с реальной перепиской
  const raw = Object.entries(byKey)
    .map(([k, evs]) => { evs.sort((a, b) => a.ts - b.ts); const head = evs[evs.length - 1]!; return { k, evs, last: head.ts, mgr: head.mgr || "" }; })
    .filter((x) => x.evs.filter((e) => e.type.startsWith("Сообщение") || e.type === "Письмо").length >= 2)
    .filter((x) => !MGR_LIST.length || MGR_LIST.includes(x.mgr))
    // Форс-переразбор только по явному флагу. Раньше его включал сам AI_MGR, и тогда прогон
    // пачками топтался на месте: каждый следующий брал те же первые LIMIT сделок. Теперь
    // менеджера можно закрывать порциями - каждая порция берёт ещё не разобранное.
    .filter((x) => FORCE ? true : (!reviews[x.k] || reviews[x.k].lastTs !== x.last))
    .sort((a, b) => b.last - a.last)
    .slice(0, LIMIT);

  // Готовим prompt один раз на сделку: и пакет, и синхронный добор берут ровно этот текст.
  const items: Item[] = raw.map((x, i) => {
    const head = x.evs[x.evs.length - 1]!;
    mgrOf[x.k] = head.mgr || "";
    const tr = transcript(x.evs);
    const prompt = `Сделка: ${head.dealT || head.leadT || x.k}\nОцениваемый менеджер: ${head.mgr}\n\nХронология (строки пронумерованы, у каждой указан автор):\n${tr.text}\n\nВерни JSON строго такой формы:\n${SCHEMA}`;
    return { k: x.k, cid: "q" + i, mgr: head.mgr || "", last: x.last, prompt, srcs: tr.srcs };
  });

  console.log(`ИИ-разбор: в очереди ${items.length} диалогов (модель ${MODEL}, лимит ${LIMIT}, режим ${USE_BATCH ? "batch" : "sync"})`);

  let done = 0, failed = 0;

  if (USE_BATCH && items.length) {
    const byCid: Record<string, Item> = {};
    for (const it of items) byCid[it.cid] = it;
    const requests = items.map((it) => ({ custom_id: it.cid, params: buildBody(it.prompt, SYSTEM) }));

    const batch = await batchCreate(requests);
    if (batch) {
      const id = batch.id;
      const deadline = Date.now() + BATCH_WAIT_MIN * 60_000;
      let st = batch;
      console.log(`  batch ${id} создан, жду до ${BATCH_WAIT_MIN} мин`);
      while (st && st.processing_status !== "ended" && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 30_000));
        st = (await batchGet(id)) || st;
        const c = st.request_counts || {};
        console.log(`  batch ${st.processing_status}: готово ${c.succeeded || 0}, в работе ${c.processing || 0}, ошибок ${c.errored || 0}`);
      }
      if (st && st.processing_status !== "ended") { console.log("  окно ожидания истекло - отменяю пакет, добор синхронно"); await batchCancel(id); st = (await batchGet(id)) || st; }

      const url = st?.results_url || `${API}/messages/batches/${id}/results`;
      const got = await batchResults(url);
      for (const [cid, r] of Object.entries(got)) { const it = byCid[cid]; if (it) { applyReview(reviews, it, r); done++; } }
      console.log(`  из пакета получено разборов: ${done}`);

      const remaining = items.filter((it) => !got[it.cid]);
      if (remaining.length) {
        console.log(`  добор синхронно: ${remaining.length}`);
        const s = await reviewSync(remaining, reviews);
        done += s.done; failed += s.failed;
      }
    } else {
      console.log("  batch недоступен - весь разбор синхронно");
      const s = await reviewSync(items, reviews); done = s.done; failed = s.failed;
    }
  } else if (items.length) {
    const s = await reviewSync(items, reviews); done = s.done; failed = s.failed;
  }

  // --- Разбор на уровне менеджера: сводим итоги ИИ по всем его сделкам --------------
  // Объём небольшой (по одному запросу на менеджера) и зависит от результатов сделок,
  // поэтому идёт синхронно после основного пакета.
  const byMgr: Record<string, any[]> = {};
  for (const [k, r] of Object.entries(reviews)) { const mg = (r as any).mgr || mgrOf[k]; if (mg) (byMgr[mg] ||= []).push(r); }
  const managers: Record<string, any> = MGR_ONLY ? { ...(prev.managers || {}) } : {};
  const mgrList = Object.entries(byMgr).filter(([mg, rs]) => rs.length >= 1 && (!MGR_LIST.length || MGR_LIST.includes(mg)));
  let mdone = 0;
  await Promise.all(mgrList.map(async ([mgr, rs]) => {
    const digest = rs.slice(0, 40).map((r: any, i: number) => `${i + 1}. [${r.tone || "?"}] ${r.verdict || ""}${r.problem ? " Проблема: " + r.problem : ""}`).join("\n");
    const prompt = `Менеджер: ${mgr}\nИтоги ИИ по его сделкам:\n${digest}\n\nВерни JSON строго такой формы:\n${MGR_SCHEMA}`;
    const r = await callAI(prompt, MGR_SYSTEM);
    if (r) { managers[mgr] = { ...r, deals: rs.length, at: new Date().toISOString() }; mdone++; }
  }));

  // Пустой разбор не записываем: файл из нулей перетёр бы боевой, а в отдельном файле он
  // выглядит как «ИИ отработал и ничего не нашёл». Очередь была, разборов нет - это сбой.
  const wipe = items.length > 0 && done === 0;
  if (!wipe) {
    mkdirSync("dialog/data", { recursive: true });
    writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), model: MODEL, reviews, managers }));
  }
  console.log(`Готово: разборов сделок ${done}, менеджеров ${mdone}, сбоев ${failed} -> ${wipe ? "файл НЕ записан" : OUT}`);

  // --- Отчёт о стоимости (Protocol 9). Прайс $/1М по модели, batch = -50%. -----------
  const PRICE: Record<string, { in: number; out: number; cr: number; cw: number }> = {
    "claude-sonnet-5": { in: 2, out: 10, cr: 0.2, cw: 2.5 },
    "claude-haiku-4-5": { in: 1, out: 5, cr: 0.1, cw: 1.25 },
    "claude-opus-4-8": { in: 5, out: 25, cr: 0.5, cw: 6.25 },
  };
  const p = PRICE[MODEL] || PRICE["claude-sonnet-5"]!;
  const B = USE_BATCH ? 0.5 : 1;
  const RUB = Number(process.env.USD_RUB || 95);
  const usd = ((usage.in * p.in + usage.out * p.out + usage.cacheR * p.cr + usage.cacheW * p.cw) / 1e6) * B;
  const rub = usd * RUB;
  const perDeal = done ? rub / done : 0;
  console.log("===== СТОИМОСТЬ ПРОГОНА =====");
  console.log(`Менеджер-фильтр: ${MGR_LIST.length ? MGR_LIST.join(", ") : "(весь отдел)"}`);
  console.log(`Модель: ${MODEL}${USE_BATCH ? " (Batch API, -50%)" : " (sync)"} · курс ${RUB} ₽/$`);
  console.log(`Токены: input ${usage.in}, output ${usage.out}, cache_read ${usage.cacheR}, cache_write ${usage.cacheW}`);
  console.log(`Итого: $${usd.toFixed(4)} = ${rub.toFixed(2)} ₽ за ${done} сделок`);
  console.log(`НА 1 СДЕЛКУ: ${perDeal.toFixed(2)} ₽`);
  console.log("============================");

  // Шаг workflow должен краснеть, когда разбор не состоялся. Молчаливый success здесь уже
  // однажды выдал пустой прогон за выполненную задачу.
  if (FATAL) { console.log(`::error::ИИ-разбор не выполнен: ${FATAL}`); process.exit(1); }
  if (wipe) { console.log(`::error::ИИ-разбор не выполнен: очередь ${items.length}, разборов 0, сбоев ${failed}`); process.exit(1); }
  if (failed > done) { console.log(`::error::Сбоев больше, чем разборов: ${failed} против ${done}`); process.exit(1); }
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
