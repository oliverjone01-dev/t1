// Ежедневный ИИ-разбор коммуникаций по сделкам: читает хронологию из dialog.json,
// оценивает её по регламенту сильного продавца и пишет вердикты в dialog/data/ai-review.json.
// Результат подхватывает score-dialog.ts (теги, рекомендация, поправка вероятности).
//
// Запуск: ANTHROPIC_API_KEY=... npx tsx src/scripts/b24/ai-review.ts
// Без ключа скрипт молча выходит - остальной пайплайн работает на детерминированных правилах.
//
// Экономия: разбираются только диалоги с новой активностью (кэш по ключу lastTs), не больше
// AI_LIMIT за прогон, модель по Protocol 11 - sonnet для содержательного анализа.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.AI_MODEL || "claude-sonnet-5";
const LIMIT = Number(process.env.AI_LIMIT || 120);
const CONC = 4;
const DLG = "dialog/data/dialog.json";
const OUT = "dialog/data/ai-review.json";

if (!KEY) { console.log("ANTHROPIC_API_KEY не задан - ИИ-слой пропущен (это не ошибка)"); process.exit(0); }

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
  "verdict": "одна фраза: что происходит в сделке",
  "politeness": 0-5,
  "regulation": 0-5,
  "deadlines": 0-5,
  "result": 0-5,
  "tags": [{"t":"короткий тег","sec":"speed|qual|deadline|polite|process|result","tone":"good|warn|bad"}],
  "recommendation": "одно конкретное действие с датой",
  "probDelta": -30..20,
  "quotes": ["до 2 цитат из переписки, подтверждающих вердикт"]
}`;

type Ev = { ts: number; dt: string; dealId: string; leadId: string; mgr: string; type: string; dir: string; who: string; body: string; dealT: string; leadT: string };

async function callAI(prompt: string): Promise<any> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: MODEL, max_tokens: 900, system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(90000),
      });
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue; }
      const j: any = await res.json();
      if (j.error) { console.log("  ошибка API:", j.error.message || j.error.type); return null; }
      const txt = (j.content || []).map((c: any) => c.text || "").join("").trim();
      const m = txt.match(/\{[\s\S]*\}/);
      return m ? JSON.parse(m[0]) : null;
    } catch (e: any) { if (attempt === 3) { console.log("  сбой:", e.message); return null; } await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); }
  }
  return null;
}

function transcript(evs: Ev[]): string {
  const lines = evs.slice(-40).map((e) => {
    const who = e.dir === "входящее" ? "КЛИЕНТ" : e.dir === "исходящее" ? "МЕНЕДЖЕР" : "CRM";
    const body = String(e.body || "").replace(/\s+/g, " ").slice(0, 400);
    return `${e.dt.slice(5, 16).replace("T", " ")} [${e.type}] ${who}: ${body}`;
  });
  return lines.join("\n").slice(0, 12000);
}

async function main() {
  const dlg = JSON.parse(readFileSync(DLG, "utf8"));
  const events: Ev[] = dlg.events || [];
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { reviews: {} };
  const reviews: Record<string, any> = prev.reviews || {};

  const byKey: Record<string, Ev[]> = {};
  for (const e of events) (byKey[e.dealId ? "D" + e.dealId : "L" + e.leadId] ||= []).push(e);

  // разбираем только диалоги с новой активностью и с реальной перепиской
  const queue = Object.entries(byKey)
    .map(([k, evs]) => { evs.sort((a, b) => a.ts - b.ts); return { k, evs, last: evs[evs.length - 1]!.ts }; })
    .filter((x) => x.evs.filter((e) => e.type.startsWith("Сообщение") || e.type === "Письмо").length >= 2)
    .filter((x) => !reviews[x.k] || reviews[x.k].lastTs !== x.last)
    .sort((a, b) => b.last - a.last)
    .slice(0, LIMIT);

  console.log(`ИИ-разбор: в очереди ${queue.length} диалогов (модель ${MODEL}, лимит ${LIMIT})`);
  let done = 0, failed = 0, qi = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    for (;;) {
      const idx = qi++; if (idx >= queue.length) break;
      const { k, evs, last } = queue[idx]!;
      const head = evs[evs.length - 1]!;
      const prompt = `Сделка: ${head.dealT || head.leadT || k}\nМенеджер: ${head.mgr}\n\nХронология:\n${transcript(evs)}\n\nВерни JSON строго такой формы:\n${SCHEMA}`;
      const r = await callAI(prompt);
      if (r) { reviews[k] = { ...r, lastTs: last, at: new Date().toISOString(), model: MODEL }; done++; }
      else failed++;
      if ((done + failed) % 20 === 0) console.log(`  разобрано ${done}, сбоев ${failed} из ${queue.length}`);
    }
  }));

  mkdirSync("dialog/data", { recursive: true });
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), model: MODEL, reviews }));
  console.log(`Готово: новых разборов ${done}, сбоев ${failed}, всего в базе ${Object.keys(reviews).length} -> ${OUT}`);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
