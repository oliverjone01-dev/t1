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

const KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.AI_MODEL || "claude-sonnet-5";
const LIMIT = Number(process.env.AI_LIMIT || 120);
const CONC = 4;
const USE_BATCH = (process.env.AI_BATCH ?? "1") !== "0";
const BATCH_WAIT_MIN = Number(process.env.AI_BATCH_WAIT_MIN || 30);
const DLG = "dialog/data/dialog.json";
const OUT = "dialog/data/ai-review.json";

if (!KEY) { console.log("ANTHROPIC_API_KEY не задан - ИИ-слой пропущен (это не ошибка)"); process.exit(0); }

const API = "https://api.anthropic.com/v1";
const HEADERS = { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" };

const SYSTEM = `Ты аудитор отдела продаж мебельного производства (стекло, зеркала, металл, изделия на заказ).
Оцениваешь переписку менеджера с клиентом по регламенту сильного продавца:
1. ОТКЛИК: первый ответ в течение 15 рабочих минут, клиент никогда не ждёт дольше 4 часов.
2. КВАЛИФИКАЦИЯ: до расчёта выяснены задача, размеры/ТЗ, срок и бюджет.
3. СРОКИ: любое обещание с конкретной датой, обещанное выполнено в срок.
4. ВЕЖЛИВОСТЬ: приветствие с обращением, извинение без жаргона («закрутился», «забыл») и без защиты («вы не уточнили»).
5. ВЕДЕНИЕ: следующий шаг всегда назначен, после КП идёт дожим, стадия отражает реальность.
6. РЕЗУЛЬТАТ: возражение отработано аргументом, сигнал оплаты доведён до счёта, отказ разобран, а не принят молча.

Правила вывода:
- Оценивай действие, а не человека. Факт, потом вывод.
- Опирайся только на приведённую хронологию. Не додумывай того, чего в ней нет.
- Рекомендация - одно конкретное действие на завтра с датой или сроком, без «в ближайшее время».
- Запрещены: em dash, «выглядит хорошо», «в целом неплохо», канцелярит.
- Отвечай ТОЛЬКО валидным JSON без markdown-обёртки.`;

const SCHEMA = `{
  "verdict": "одна фраза: что происходит в сделке и куда она идёт",
  "problem": "главная проблема в работе менеджера одной фразой, или пустая строка если всё ведётся правильно",
  "recommendation": "одно конкретное действие на завтра с датой или сроком",
  "tone": "good|warn|bad — светофор сделки: good всё правильно, warn есть риск, bad грубая ошибка",
  "scores": {"polite":0-5,"qual":0-5,"deadline":0-5,"process":0-5,"result":0-5},
  "msgTags": [{"i": номер строки хронологии, "tone":"good|warn|bad", "t":"короткий тег с префиксом 'ИИ · '", "quote":"дословная фраза из этой строки, по которой сработал тег"}],
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
    model: MODEL, max_tokens: 900,
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

async function callAI(prompt: string, system: string = SYSTEM): Promise<any> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${API}/messages`, {
        method: "POST", headers: HEADERS,
        body: JSON.stringify(buildBody(prompt, system)),
        signal: AbortSignal.timeout(90000),
      });
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue; }
      const j: any = await res.json();
      if (j.error) { console.log("  ошибка API:", j.error.message || j.error.type); return null; }
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
    const who = e.dir === "входящее" ? "КЛИЕНТ" : e.dir === "исходящее" ? "МЕНЕДЖЕР" : "CRM";
    const body = String(e.body || "").replace(/\s+/g, " ").slice(0, 400);
    return `[${n}] ${e.dt.slice(5, 16).replace("T", " ")} [${e.type}] ${who}: ${body}`;
  });
  return { text: lines.join("\n").slice(0, 12000), srcs };
}

// Записываем разбор сделки в reviews с переводом msgTags.i -> src сообщения.
function applyReview(reviews: Record<string, any>, it: Item, r: any) {
  const msgTags = Array.isArray(r.msgTags)
    ? r.msgTags.map((t: any) => ({ src: it.srcs[Number(t.i)] || "", tone: t.tone, t: t.t, quote: t.quote })).filter((t: any) => t.src)
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
        if (row?.result?.type === "succeeded") { const r = parseReview(row.result.message); if (r) out[row.custom_id] = r; }
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
  const reviews: Record<string, any> = prev.demo ? {} : (prev.reviews || {});
  const mgrOf: Record<string, string> = {};

  const byKey: Record<string, Ev[]> = {};
  for (const e of events) (byKey[e.dealId ? "D" + e.dealId : "L" + e.leadId] ||= []).push(e);

  // разбираем только диалоги с новой активностью и с реальной перепиской
  const raw = Object.entries(byKey)
    .map(([k, evs]) => { evs.sort((a, b) => a.ts - b.ts); return { k, evs, last: evs[evs.length - 1]!.ts }; })
    .filter((x) => x.evs.filter((e) => e.type.startsWith("Сообщение") || e.type === "Письмо").length >= 2)
    .filter((x) => !reviews[x.k] || reviews[x.k].lastTs !== x.last)
    .sort((a, b) => b.last - a.last)
    .slice(0, LIMIT);

  // Готовим prompt один раз на сделку: и пакет, и синхронный добор берут ровно этот текст.
  const items: Item[] = raw.map((x, i) => {
    const head = x.evs[x.evs.length - 1]!;
    mgrOf[x.k] = head.mgr || "";
    const tr = transcript(x.evs);
    const prompt = `Сделка: ${head.dealT || head.leadT || x.k}\nМенеджер: ${head.mgr}\n\nХронология (строки пронумерованы):\n${tr.text}\n\nВерни JSON строго такой формы:\n${SCHEMA}`;
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
  const managers: Record<string, any> = {};
  const mgrList = Object.entries(byMgr).filter(([, rs]) => rs.length >= 1);
  let mdone = 0;
  await Promise.all(mgrList.map(async ([mgr, rs]) => {
    const digest = rs.slice(0, 40).map((r: any, i: number) => `${i + 1}. [${r.tone || "?"}] ${r.verdict || ""}${r.problem ? " Проблема: " + r.problem : ""}`).join("\n");
    const prompt = `Менеджер: ${mgr}\nИтоги ИИ по его сделкам:\n${digest}\n\nВерни JSON строго такой формы:\n${MGR_SCHEMA}`;
    const r = await callAI(prompt, MGR_SYSTEM);
    if (r) { managers[mgr] = { ...r, deals: rs.length, at: new Date().toISOString() }; mdone++; }
  }));

  mkdirSync("dialog/data", { recursive: true });
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), model: MODEL, reviews, managers }));
  console.log(`Готово: разборов сделок ${done}, менеджеров ${mdone}, сбоев ${failed} -> ${OUT}`);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
