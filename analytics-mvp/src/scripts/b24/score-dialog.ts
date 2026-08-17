// Скоринг диалогов: вероятность успеха сделки, теги, дефекты по Косте, рекомендация
// следующего шага + агрегация в рейтинг менеджера (аспекты в стиле Яндекс.Бизнес).
//
// Вход:  dialog/data/dialog.json (снимок коммуникаций) + rop.json (факты сделок, ветка
//        rop-dashboard-v1; путь через ROP_JSON, если файла нет - работаем без фактов CRM).
// Выход: тот же dialog.json, дополненный блоком scoring.
//
// Вероятность = эмпирическая база стадии x поведенческие коэффициенты. База считана по
// сделкам C49, созданным после переезда (01.04.2026), и живёт в BASE_RATES - это [ДАННЫЕ].
// Коэффициенты и пороги - [ГИПОТЕЗА - калибровка], правятся здесь и только здесь.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DLG = "dialog/data/dialog.json";
const ROP = process.env.ROP_JSON || "/tmp/rop.json";

// --- База стадий: доля выигранных среди закрытых сделок, побывавших на стадии ---
// [ДАННЫЕ] снимок rop.json 2026-08-17, сделки C49 с created >= 2026-04-01.
const BASE_RATES: Record<string, { name: string; n: number; win: number }> = {
  "C49:NEW": { name: "Новая сделка", n: 1036, win: 0.208 },
  "C49:UC_LRFLH9": { name: "Квалификация", n: 841, win: 0.197 },
  "C49:PREPAYMENT_INVOIC": { name: "КП отправлено", n: 472, win: 0.193 },
  "C49:UC_OGZUU0": { name: "Расчёт", n: 233, win: 0.747 },
  "C49:EXECUTING": { name: "Предоплата получена", n: 218, win: 0.945 },
  "C49:PREPARATION": { name: "Формирование ТЗ", n: 182, win: 0.308 },
  "C49:FINAL_INVOICE": { name: "Заказ в производстве", n: 149, win: 0.987 },
  "C49:1": { name: "Заказ произведен", n: 136, win: 1.0 },
  "C49:3": { name: "Принимают решение", n: 95, win: 0.411 },
  "C49:2": { name: "Заказ отправлен", n: 45, win: 0.978 },
  "C49:UC_8JTBV2": { name: "Долгострой", n: 21, win: 0.095 },
};
const BASE_FALLBACK = 0.219;   // [ДАННЫЕ] общий win-rate свежих закрытых сделок C49
const CALIBRATED_AT = "2026-08-17";

// --- Пороги [ГИПОТЕЗА - калибровка] ---
const FAST_ANSWER_MIN = 30;      // быстрый ответ: медиана <= 30 рабочих минут
const SLOW_ANSWER_MIN = 240;     // медленный: медиана > 4 рабочих часов
const BALL_STUCK_MIN = 240;      // «мяч у нас»: клиент ждёт больше 4 рабочих часов
const SILENCE_WARN_D = 2;        // тишина: дней без событий (окно снимка 7 дней,
const SILENCE_BAD_D = 4;         // поэтому пороги внутри него ниже)
const MIN_SAMPLE = 10;           // минимальная выборка для рейтинга менеджера (правило Кости)

const EARLY = new Set(["C49:NEW", "C49:UC_LRFLH9", "C49:PREPAYMENT_INVOIC", "C49:PREPARATION", "C49:3"]); // до расчёта/оплаты

const WORK_FROM = 9, WORK_TO = 19, TZ_SHIFT = 3;  // рабочий день МСК

type Ev = { ts: number; dt: string; stage: string; leadId: string; dealId: string; leadT: string; dealT: string; mgr: string; type: string; dir: string; who: string; body: string; status: string };

const isMsg = (e: Ev) => e.type.startsWith("Сообщение") || e.type === "Письмо" || e.type === "Мессенджер ОЛ";
const isCall = (e: Ev) => e.type === "Звонок";

// Рабочие минуты между двумя метками (грубо, по часовым шагам).
function workMinutes(a: number, b: number): number {
  if (b <= a) return 0;
  let tot = 0, cur = a;
  while (cur < b) {
    const nxt = Math.min(b, cur + 3600_000);
    const h = (new Date(cur).getUTCHours() + TZ_SHIFT) % 24;
    if (h >= WORK_FROM && h < WORK_TO) tot += (nxt - cur) / 60000;
    cur = nxt;
  }
  return Math.round(tot);
}
const med = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2); };
const fmtMin = (m: number) => m < 60 ? `${m} мин` : m < 600 ? `${(m / 60).toFixed(1)} ч` : `${Math.round(m / 60)} ч`;

// --- Текстовые сигналы (по телу сообщений) ---
const RE_READY = /выставьте счёт|выставите счет|оплач|оформля|беру\b|готов оплатить|реквизит|когда можно оплатить/i;
const RE_PRICE = /дорого|скидк|дешевле|снизить цену|цена высок|не укладыва|бюджет не/i;
const RE_VAGUE = /в ближайшее время|как только|постараюсь|на днях|ориентировочно позже|буду держать в курсе/i;
const RE_QUAL = /размер|\d+\s*(мм|см|м2|х\d)|адрес|срок|когда нужно|бюджет|замер/i;
const RE_REFUSE = /не актуально|отказыва|передумал|выбрали друг|уже заказал/i;

function main() {
  const dlg = JSON.parse(readFileSync(DLG, "utf8"));
  const events: Ev[] = dlg.events || [];
  const now = Date.parse(dlg.to) || Math.max(...events.map((e) => e.ts));

  // Факты сделок из снимка РОПа (если он доступен)
  const facts: Record<string, any> = {};
  if (existsSync(ROP)) {
    const rop = JSON.parse(readFileSync(ROP, "utf8"));
    for (const d of (rop.deals || [])) if (String(d.category) === "49") facts[String(d.id)] = d;
    console.log(`Факты CRM: ${Object.keys(facts).length} сделок C49 (снимок ${rop.generated_at || "?"})`);
  } else console.log(`ВНИМАНИЕ: ${ROP} не найден - скоринг без стадий и бюджета`);

  // --- Группировка событий по диалогу (лид сливается в сделку) ---
  const byKey: Record<string, Ev[]> = {};
  for (const e of events) {
    const k = e.dealId ? "D" + e.dealId : "L" + e.leadId;
    (byKey[k] ||= []).push(e);
  }

  const deals: any[] = [];
  for (const [key, evs] of Object.entries(byKey)) {
    evs.sort((a, b) => a.ts - b.ts);
    const last = evs[evs.length - 1]!;
    const dealId = last.dealId || "", leadId = last.leadId || "";
    const f = dealId ? facts[dealId] : null;
    if (f && (f.won || f.lost)) continue;                      // закрытые не оцениваем
    const msgs = evs.filter(isMsg);
    const title = last.dealT || last.leadT || (dealId ? "Сделка " + dealId : "Лид " + leadId);

    // --- сигналы ---
    const resp: number[] = [];
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i]!.dir !== "входящее") continue;
      const nxt = msgs.slice(i + 1).find((m) => m.dir === "исходящее");
      if (nxt) resp.push(workMinutes(msgs[i]!.ts, nxt.ts));
    }
    const respMed = med(resp);
    const lastMsg = msgs[msgs.length - 1];
    const ballWait = lastMsg && lastMsg.dir === "входящее" ? workMinutes(lastMsg.ts, now) : 0;
    const silenceD = Math.floor((now - last.ts) / 864e5);
    const text = msgs.map((m) => m.body || "").join("\n");
    const inText = msgs.filter((m) => m.dir === "входящее").map((m) => m.body || "").join("\n");
    const outText = msgs.filter((m) => m.dir === "исходящее").map((m) => m.body || "").join("\n");
    const hasReady = RE_READY.test(inText), hasPrice = RE_PRICE.test(inText), hasRefuse = RE_REFUSE.test(inText);
    const hasVague = RE_VAGUE.test(outText), hasQual = RE_QUAL.test(text);
    const calls = evs.filter(isCall).length;
    const nextStep = f ? (f.tasksOpen || 0) > 0 : evs.some((e) => e.type === "Дело" && e.status === "запланировано");
    const overdue = f && f.taskDue ? Date.parse(f.taskDue) < now && (f.tasksOpen || 0) > 0 : false;

    // --- вероятность ---
    const code = f ? String(f.stageCode || "") : "";
    const base = BASE_RATES[code]?.win ?? BASE_FALLBACK;
    const factors: { label: string; mult: number }[] = [];
    const push = (label: string, mult: number) => factors.push({ label, mult });
    if (hasReady) push("клиент говорит об оплате", 1.3);
    if (respMed !== null && respMed <= FAST_ANSWER_MIN) push(`отвечаем быстро (${fmtMin(respMed)})`, 1.1);
    if (respMed !== null && respMed > SLOW_ANSWER_MIN) push(`отвечаем медленно (${fmtMin(respMed)})`, 0.8);
    if (ballWait > BALL_STUCK_MIN) push(`клиент ждёт ответа ${fmtMin(ballWait)}`, 0.7);
    if (silenceD >= SILENCE_BAD_D) push(`тишина ${silenceD} дн`, 0.6);
    else if (silenceD >= SILENCE_WARN_D) push(`тишина ${silenceD} дн`, 0.85);
    if (!nextStep) push("нет следующего шага", 0.85);
    if (overdue) push("просрочено дело", 0.85);
    if (hasPrice) push("возражение по цене", 0.9);
    if (hasRefuse) push("клиент говорит об отказе", 0.5);
    let prob = base;
    for (const x of factors) prob *= x.mult;
    prob = Math.max(0.03, Math.min(0.97, prob));

    // --- теги (аспекты сделки) ---
    const tags: { t: string; tone: "good" | "bad" | "warn" }[] = [];
    if (respMed !== null && respMed <= FAST_ANSWER_MIN) tags.push({ t: `Быстрый ответ · ${fmtMin(respMed)}`, tone: "good" });
    if (respMed !== null && respMed > SLOW_ANSWER_MIN) tags.push({ t: `Медленный ответ · ${fmtMin(respMed)}`, tone: "bad" });
    if (ballWait > BALL_STUCK_MIN) tags.push({ t: `Мяч у нас · клиент ждёт ${fmtMin(ballWait)}`, tone: "bad" });
    if (silenceD >= SILENCE_WARN_D) tags.push({ t: `Тишина ${silenceD} дн`, tone: silenceD >= SILENCE_BAD_D ? "bad" : "warn" });
    if (!nextStep) tags.push({ t: "Нет следующего шага", tone: "bad" });
    if (overdue) tags.push({ t: "Просрочено дело", tone: "bad" });
    if (hasReady) tags.push({ t: "Сигнал готовности к оплате", tone: "good" });
    if (hasPrice) tags.push({ t: "Возражение по цене", tone: "warn" });
    if (hasRefuse) tags.push({ t: "Риск отказа", tone: "bad" });
    if (hasQual) tags.push({ t: "Квалификация собрана", tone: "good" });
    if (hasVague) tags.push({ t: "Размытый срок в ответе", tone: "warn" });
    if (calls) tags.push({ t: `Звонков: ${calls}`, tone: "good" });

    // --- рекомендация следующего шага (формулировки фразебука Кости) ---
    let next = "";
    if (hasRefuse) next = "Клиент назвал причину отказа. Не благодарить и закрывать тему, а отработать причину: спросить, что должно измениться, чтобы решение стало другим.";
    else if (ballWait > BALL_STUCK_MIN) next = `Ответить сегодня: клиент ждёт ${fmtMin(ballWait)}. В ответе дать конкретный срок («отвечу сегодня до 18:00»), а не «в ближайшее время».`;
    else if (hasReady) next = "Клиент говорит об оплате. Выставить счёт сегодня и назвать срок готовности датой, а не «на днях».";
    else if (hasPrice) next = "Отработать цену: показать состав стоимости и альтернативу дешевле, назвать конкретный срок ответа.";
    else if (silenceD >= SILENCE_BAD_D) next = `Тишина ${silenceD} дн. Написать с новым поводом (готовность, сроки, вариант), закончить вопросом и зафиксировать дату следующего контакта.`;
    else if (overdue) next = `Дело просрочено${f && f.taskSubj ? " («" + String(f.taskSubj).slice(0, 40) + "»)" : ""}. Либо закрыть его сегодня, либо перенести с новой датой: просроченное дело в CRM означает, что сделкой никто не занят.`;
    else if (!nextStep) next = "Поставить дело с датой и временем: без следующего шага сделка выпадает из работы.";
    else if (hasVague) next = "Заменить размытый срок на дату: «подготовлю расчёт завтра до обеда» вместо «в ближайшее время».";
    else next = "Держать темп: следующий шаг зафиксирован, ответы в норме.";

    deals.push({
      key, dealId, leadId, title, mgr: last.mgr || "(не указан)",
      stage: f ? f.stage : "", stageCode: code, budget: f ? f.budget : 0,
      prob: Math.round(prob * 100), base: Math.round(base * 100), factors,
      tags, next, msgs: msgs.length, calls, respMed, ballWait, silenceD, nextStep, overdue,
      lastTs: last.ts, lastDt: last.dt,
    });
  }

  // --- Агрегация в менеджера: аспекты в стиле Яндекс.Бизнес ---
  const ASPECTS = [
    { key: "speed", label: "Скорость ответа", ok: (d: any) => d.respMed === null ? null : d.respMed <= FAST_ANSWER_MIN },
    { key: "ball", label: "Не оставляет клиента без ответа", ok: (d: any) => d.ballWait <= BALL_STUCK_MIN },
    { key: "next", label: "Следующий шаг зафиксирован", ok: (d: any) => !!d.nextStep },
    { key: "silence", label: "Без затяжных пауз", ok: (d: any) => d.silenceD < SILENCE_BAD_D },
    { key: "qual", label: "Квалификация собрана", ok: (d: any) => EARLY.has(d.stageCode) || !d.stageCode ? d.tags.some((t: any) => t.t === "Квалификация собрана") : null },
    { key: "concrete", label: "Конкретные сроки в ответах", ok: (d: any) => !d.tags.some((t: any) => t.t === "Размытый срок в ответе") },
  ];
  const byMgr: Record<string, any[]> = {};
  for (const d of deals) (byMgr[d.mgr] ||= []).push(d);
  const managers = Object.entries(byMgr).map(([mgr, ds]) => {
    const aspects = ASPECTS.map((a) => {
      const vals = ds.map(a.ok).filter((v) => v !== null) as boolean[];
      const pos = vals.filter(Boolean).length;
      return { label: a.label, key: a.key, n: vals.length, pos: vals.length ? Math.round(pos / vals.length * 100) : null };
    });
    const scored = aspects.filter((a) => a.pos !== null);
    // Минимальная выборка 10 диалогов - требование методики Кости (на 5 сделках вывод
    // «носит ограниченный характер»). Роботы портала в рейтинг не идут: это не люди.
    const isBot = /^Системный пользователь/i.test(mgr) || mgr === "(не указан)";
    const enough = ds.length >= MIN_SAMPLE && !isBot;
    const rating = enough && scored.length ? Number((scored.reduce((s, a) => s + (a.pos as number), 0) / scored.length / 20).toFixed(1)) : null;
    return {
      mgr, deals: ds.length, rating, aspects, bot: isBot,
      noRating: !enough ? (isBot ? "робот портала" : `мало данных (${ds.length} из ${MIN_SAMPLE})`) : "",
      probAvg: Math.round(ds.reduce((s, d) => s + d.prob, 0) / ds.length),
      pipeline: ds.reduce((s, d) => s + (d.budget || 0), 0),
      alerts: ds.filter((d) => d.tags.some((t: any) => t.tone === "bad")).length,
    };
  }).sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.deals - a.deals);

  dlg.scoring = {
    calibratedAt: CALIBRATED_AT, baseFallback: Math.round(BASE_FALLBACK * 100),
    baseRates: BASE_RATES,
    thresholds: { FAST_ANSWER_MIN, SLOW_ANSWER_MIN, BALL_STUCK_MIN, SILENCE_WARN_D, SILENCE_BAD_D },
    deals: deals.sort((a, b) => b.prob - a.prob), managers,
  };
  writeFileSync(DLG, JSON.stringify(dlg));
  console.log(`Скоринг: сделок/лидов ${deals.length}, менеджеров ${managers.length}`);
  for (const m of managers.slice(0, 20)) console.log(`   ${m.rating ? m.rating + " ★" : "  -  "}  ${m.mgr} - ${m.deals} диалогов, вероятность ${m.probAvg}%, тревог ${m.alerts}${m.noRating ? " [" + m.noRating + "]" : ""}`);
}
main();
