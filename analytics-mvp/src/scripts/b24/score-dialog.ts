// Разбор ведения сделок: теги по разделам регламента, оценка коммуникации, вероятность
// успеха, рекомендация следующего шага + сводная таблица по менеджерам.
//
// Источники: dialog.json (переписка, звонки, дела, комментарии, резюме BitrixGPT) и
// rop.json (стадии, история стадий, открытые дела, бюджет; путь через ROP_JSON).
// Если рядом лежит ai-review.json (слой ИИ, скрипт ai-review.ts) - его вердикты
// подмешиваются в разделы и в рекомендацию.
//
// РЕГЛАМЕНТ, по которому оцениваем (общепринятый цикл сильного продавца):
//   1. Отклик: первый ответ в течение 15 рабочих минут, клиент не ждёт дольше 4 часов.
//   2. Квалификация: до расчёта выяснены задача, размеры/ТЗ, срок и бюджет.
//   3. Сроки: обещание всегда с датой, обещанное выполнено, дела в CRM не просрочены.
//   4. Вежливость: приветствие с обращением, извинение без жаргона и оправданий.
//   5. Ведение: следующий шаг зафиксирован всегда, стадия отражает реальность, после КП дожим.
//   6. Результат: возражение отработано, сигнал оплаты доведён до счёта, отказ разобран.
//
// Вероятность = эмпирическая база стадии [ДАННЫЕ] x поведенческие коэффициенты [ГИПОТЕЗА].
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DLG = "dialog/data/dialog.json";
const ROP = process.env.ROP_JSON || "/tmp/rop.json";
const AIF = "dialog/data/ai-review.json";
const TRD = "dialog/data/trend.json";

// [ДАННЫЕ] rop.json 2026-08-17, сделки C49 с created >= 2026-04-01: побывал на стадии -> доля выигранных
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
const BASE_FALLBACK = 0.219;
const CALIBRATED_AT = "2026-08-17";

// --- Пороги [ГИПОТЕЗА - калибровка] ---
const FIRST_ANSWER_MIN = 15;   // норматив первого ответа
const FAST_ANSWER_MIN = 30;
const SLOW_ANSWER_MIN = 240;
const BALL_STUCK_MIN = 240;
const SILENCE_WARN_D = 2;
const SILENCE_BAD_D = 4;
const OVERDUE_GRACE_D = 3;     // просрочка - дефект менеджера только после 3 дней: роботы
const MIN_SAMPLE = 10;
const MIN_SEC_N = 5;           // раздел не оценивается, если он затронут меньше чем в 5 сделках:
                               // процент по двум диалогам - это не оценка человека, а шум         // штампуют дела ежедневно, это системный шум, а не халатность
const EARLY = new Set(["C49:NEW", "C49:UC_LRFLH9", "C49:PREPAYMENT_INVOIC", "C49:PREPARATION", "C49:3"]);
const WORK_FROM = 9, WORK_TO = 19, TZ_SHIFT = 3;

// Кого не показывать в таблице рейтинга: роботы портала, числовые ID вместо имени,
// уволенные (список firedManagers из снимка РОПа) и явно названные Иваном не-наши.
// KEEP_MGR - исключения из списка уволенных: числится уволенным в CRM, но работает.
const EXCLUDE_MGR = new Set(["Лысенко Ольга", "Сячинова Александра", "Мавлина Юлия", "Ерина Екатерина", "Королькова Наталья"]);
// Лобова: в портале два пользователя с этим ФИО. ID 7999 - рабочая (активна, вход
// ежедневно, 15 сделок C49, 60 активностей), ID 8001 - ошибочный дубль (отключена,
// ноль сделок). В firedManagers попал дубль, поэтому по имени фильтр снёс бы живого
// человека. Проверено пробой 18.08.2026.
const KEEP_MGR = new Set(["Лобова Надежда"]);
const swapName = (n: string) => { const p = n.trim().split(/\s+/); return p.length === 2 ? p[1] + " " + p[0] : n; };
function isHidden(mgr: string, fired: Set<string>): string {
  if (KEEP_MGR.has(mgr)) return "";
  if (/^Системный пользователь/i.test(mgr) || mgr === "(не указан)") return "робот портала";
  if (!/[A-Za-zА-Яа-яЁё]/.test(mgr)) return "ID без имени";
  if (EXCLUDE_MGR.has(mgr)) return "не в отделе продаж";
  if (fired.has(mgr) || fired.has(swapName(mgr))) return "уволен";
  return "";
}

type Ev = { ts: number; dt: string; stage: string; leadId: string; dealId: string; leadT: string; dealT: string; mgr: string; type: string; dir: string; who: string; body: string; title: string; status: string };
const isMsg = (e: Ev) => e.type.startsWith("Сообщение") || e.type === "Письмо" || e.type === "Мессенджер ОЛ";
// Антигейминг: «Хорошо, спасибо!» за 2 минуты не ответ клиенту. Ответом по существу считаем
// сообщение от 25 символов либо с цифрой, датой или вопросом (16% исходящих - короткие отписки).
const MIN_ANSWER_LEN = 25;
const isRealAnswer = (e: Ev) => { const b = String(e.body || "").trim(); return b.length >= MIN_ANSWER_LEN || /\d|\?/.test(b); };

function workMinutes(a: number, b: number): number {
  if (b <= a) return 0;
  let tot = 0, cur = a;
  while (cur < b) { const nxt = Math.min(b, cur + 3600_000); const h = (new Date(cur).getUTCHours() + TZ_SHIFT) % 24; if (h >= WORK_FROM && h < WORK_TO) tot += (nxt - cur) / 60000; cur = nxt; }
  return Math.round(tot);
}
const med = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2); };
const fmtMin = (m: number) => m < 60 ? `${m} мин` : m < 600 ? `${(m / 60).toFixed(1)} ч` : `${Math.round(m / 60)} ч`;

// --- Словари сигналов ---
const RE = {
  ready: /выставьте счёт|выставите счет|оплач|оформля|беру\b|готов оплатить|реквизит|когда можно оплатить|счёт на оплату/i,
  price: /дорого|скидк|дешевле|снизить цену|цена высок|не укладыва|бюджет не|подешевле/i,
  refuse: /не актуально|отказыва|передумал|выбрали друг|уже заказал|не интересует|не будем/i,
  vague: /в ближайшее время|как только|постараюсь|на днях|в течение недели|буду держать в курсе|ориентировочно/i,
  dated: /\b\d{1,2}[.\/]\d{1,2}\b|завтра|сегодня до|понедельник|вторник|среду|четверг|пятницу|до \d{1,2}[:.]\d{2}|в течение дня/i,
  hello: /здравствуйте|добрый день|доброе утро|добрый вечер|приветствую/i,
  budget: /бюджет|стоимость|цена|прайс|сколько будет стоить|в какую сумму/i,
  term: /срок|когда нужно|к какой дате|когда планир|готовность/i,
  spec: /размер|\d+\s*(мм|см|м2)|\d+\s*[хx]\s*\d+|чертеж|эскиз|замер|тз\b|техзадан/i,
  jargon: /закрутил|замотал|забыл|запар|не успел|вылетело из головы|извиняюсь/i,
  apology: /прошу прощения|извините|приношу извинения|сожалею/i,
  defense: /я же (писал|говорил)|вы не (сказали|уточнили)|это не (моя|наша) вина|у нас так принято/i,
  thanks: /спасибо|благодар/i,
  kp: /кп\b|коммерческое предложение|направил.{0,12}предложени|отправил.{0,12}расч|расчёт во вложении/i,
};

// Разделы регламента и их вес в итоговом рейтинге [ГИПОТЕЗА - калибровка]
const SECTIONS = [
  { key: "speed", label: "Отклик", weight: 0.22 },
  { key: "qual", label: "Квалификация", weight: 0.18 },
  { key: "deadline", label: "Сроки", weight: 0.20 },
  { key: "polite", label: "Вежливость", weight: 0.10 },
  { key: "process", label: "Ведение", weight: 0.20 },
  { key: "result", label: "Результат", weight: 0.10 },
];

type Tag = { t: string; sec: string; tone: "good" | "bad" | "warn" };

function main() {
  const dlg = JSON.parse(readFileSync(DLG, "utf8"));
  const events: Ev[] = dlg.events || [];
  const now = Date.parse(dlg.to) || Math.max(...events.map((e) => e.ts));

  const facts: Record<string, any> = {};
  let fired = new Set<string>();
  if (existsSync(ROP)) {
    const rop = JSON.parse(readFileSync(ROP, "utf8"));
    fired = new Set((rop.firedManagers || []) as string[]);
    for (const d of (rop.deals || [])) if (String(d.category) === "49") facts[String(d.id)] = d;
    console.log(`Факты CRM: ${Object.keys(facts).length} сделок C49 (снимок ${rop.generated_at || "?"})`);
  } else console.log(`ВНИМАНИЕ: ${ROP} не найден - разбор без стадий и дел`);
  const ai: Record<string, any> = existsSync(AIF) ? (JSON.parse(readFileSync(AIF, "utf8")).reviews || {}) : {};
  if (Object.keys(ai).length) console.log(`Слой ИИ: разборов ${Object.keys(ai).length}`);

  const byKey: Record<string, Ev[]> = {};
  for (const e of events) (byKey[e.dealId ? "D" + e.dealId : "L" + e.leadId] ||= []).push(e);

  const deals: any[] = [];
  for (const [key, evs] of Object.entries(byKey)) {
    evs.sort((a, b) => a.ts - b.ts);
    const last = evs[evs.length - 1]!;
    const dealId = last.dealId || "", leadId = last.leadId || "";
    const f = dealId ? facts[dealId] : null;
    if (f && (f.won || f.lost)) continue;
    const msgs = evs.filter(isMsg);
    const outs = msgs.filter((m) => m.dir === "исходящее"), ins = msgs.filter((m) => m.dir === "входящее");
    const outText = outs.map((m) => m.body || "").join("\n"), inText = ins.map((m) => m.body || "").join("\n");
    const allText = msgs.map((m) => m.body || "").join("\n") + "\n" + evs.filter((e) => e.type === "Резюме BitrixGPT" || e.type === "Комментарий-заметка").map((e) => e.body || "").join("\n");

    const resp: number[] = [];
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i]!.dir !== "входящее") continue;
      const nxt = msgs.slice(i + 1).find((m) => m.dir === "исходящее" && isRealAnswer(m));
      if (nxt) resp.push(workMinutes(msgs[i]!.ts, nxt.ts));
    }
    const respMed = med(resp), firstResp = resp.length ? resp[0]! : null;
    const lastMsg = msgs[msgs.length - 1];
    const ballWait = lastMsg && lastMsg.dir === "входящее" ? workMinutes(lastMsg.ts, now) : 0;
    const silenceD = Math.floor((now - last.ts) / 864e5);
    const calls = evs.filter((e) => e.type === "Звонок").length;
    const tasksOpen = f ? (f.tasksOpen || 0) : 0;
    const nextStep = f ? tasksOpen > 0 : evs.some((e) => e.type === "Дело" && e.status === "запланировано");
    const overdueD = f && f.taskDue && tasksOpen > 0 ? Math.floor((now - Date.parse(f.taskDue)) / 864e5) : -1;
    const overdue = overdueD > OVERDUE_GRACE_D;
    const stageCode = f ? String(f.stageCode || "") : "";
    const early = !stageCode || EARLY.has(stageCode);
    const hist = (f && Array.isArray(f.hist)) ? f.hist : [];
    const stageDays = hist.length ? Math.floor((now - Date.parse(hist[hist.length - 1][1])) / 864e5) : -1;
    const a = ai[key] || null;

    const tags: Tag[] = [];
    const add = (t: string, sec: string, tone: Tag["tone"]) => tags.push({ t, sec, tone });

    // 1. Отклик
    if (firstResp !== null && firstResp <= FIRST_ANSWER_MIN) add(`Первый ответ за ${fmtMin(firstResp)}`, "speed", "good");
    else if (firstResp !== null && firstResp > SLOW_ANSWER_MIN) add(`Первый ответ через ${fmtMin(firstResp)}`, "speed", "bad");
    if (respMed !== null && respMed <= FAST_ANSWER_MIN) add(`Держит темп · ${fmtMin(respMed)}`, "speed", "good");
    if (respMed !== null && respMed > SLOW_ANSWER_MIN) add(`Медленные ответы · ${fmtMin(respMed)}`, "speed", "bad");
    if (ballWait > BALL_STUCK_MIN) add(`Мяч у нас · клиент ждёт ${fmtMin(ballWait)}`, "speed", "bad");
    const stubs = outs.filter((m) => !isRealAnswer(m)).length;
    if (outs.length >= 4 && stubs / outs.length > 0.5) add(`Ответы-заглушки · ${stubs} из ${outs.length}`, "speed", "bad");
    // 2. Квалификация (только до расчёта)
    if (early) {
      const q = [RE.spec.test(allText) && "ТЗ/размеры", RE.term.test(allText) && "срок", RE.budget.test(allText) && "бюджет"].filter(Boolean) as string[];
      if (q.length >= 2) add(`Квалификация: ${q.join(", ")}`, "qual", "good");
      else if (msgs.length >= 3) add(`Квалификация неполная${q.length ? " (только " + q.join(", ") + ")" : ""}`, "qual", "bad");
    }
    // 3. Сроки
    if (RE.vague.test(outText) && !RE.dated.test(outText)) add("Размытый срок без даты", "deadline", "bad");
    else if (RE.dated.test(outText)) add("Называет конкретные даты", "deadline", "good");
    if (overdue) add(`Дело просрочено на ${overdueD} дн`, "deadline", "bad");
    if (silenceD >= SILENCE_BAD_D) add(`Тишина ${silenceD} дн`, "deadline", "bad");
    else if (silenceD >= SILENCE_WARN_D) add(`Пауза ${silenceD} дн`, "deadline", "warn");
    // 4. Вежливость
    if (outs.length && RE.hello.test(outText)) add("Приветствие и обращение", "polite", "good");
    else if (outs.length >= 2) add("Без приветствия", "polite", "warn");
    if (RE.jargon.test(outText)) add("Жаргон вместо извинения", "polite", "bad");
    if (RE.defense.test(outText)) add("Защита вместо извинения", "polite", "bad");
    if (RE.apology.test(outText) || RE.thanks.test(outText)) add("Этикет соблюдён", "polite", "good");
    // 5. Ведение по регламенту
    if (nextStep) add("Следующий шаг зафиксирован", "process", "good");
    else add("Нет следующего шага", "process", "bad");
    if (RE.kp.test(outText)) add("КП отправлено", "process", "good");
    if (stageCode === "C49:PREPAYMENT_INVOIC" && silenceD >= SILENCE_WARN_D) add("После КП нет дожима", "process", "bad");
    if (stageDays > 21) add(`На стадии ${stageDays} дн`, "process", "bad");
    if (calls) add(`Звонков: ${calls}`, "process", "good");
    // 6. Результат
    if (RE.ready.test(inText)) add("Сигнал готовности к оплате", "result", "good");
    if (RE.price.test(inText)) { const worked = RE.dated.test(outText) && outs.length >= ins.length; add(worked ? "Возражение по цене отработано" : "Возражение по цене без ответа", "result", worked ? "warn" : "bad"); }
    if (RE.refuse.test(inText)) add("Риск отказа", "result", "bad");
    if (a && Array.isArray(a.tags)) for (const t of a.tags) add(String(t.t || t), t.sec || "process", (t.tone as Tag["tone"]) || "warn");

    // --- вероятность ---
    const base = BASE_RATES[stageCode]?.win ?? BASE_FALLBACK;
    const factors: { label: string; mult: number }[] = [];
    const push = (label: string, mult: number) => factors.push({ label, mult });
    if (RE.ready.test(inText)) push("клиент говорит об оплате", 1.3);
    if (respMed !== null && respMed <= FAST_ANSWER_MIN) push(`быстрые ответы (${fmtMin(respMed)})`, 1.1);
    if (respMed !== null && respMed > SLOW_ANSWER_MIN) push(`медленные ответы (${fmtMin(respMed)})`, 0.8);
    if (ballWait > BALL_STUCK_MIN) push(`клиент ждёт ${fmtMin(ballWait)}`, 0.7);
    if (silenceD >= SILENCE_BAD_D) push(`тишина ${silenceD} дн`, 0.6);
    else if (silenceD >= SILENCE_WARN_D) push(`пауза ${silenceD} дн`, 0.85);
    if (!nextStep) push("нет следующего шага", 0.85);
    if (overdue) push(`дело просрочено на ${overdueD} дн`, 0.85);
    if (RE.price.test(inText)) push("возражение по цене", 0.9);
    if (RE.refuse.test(inText)) push("клиент говорит об отказе", 0.5);
    if (a && typeof a.probDelta === "number") push(`оценка ИИ: ${a.verdict || "разбор"}`, Math.max(0.5, Math.min(1.4, 1 + a.probDelta / 100)));
    let prob = base; for (const x of factors) prob *= x.mult;
    prob = Math.max(0.03, Math.min(0.97, prob));

    // --- рекомендация ---
    let next = "", why = "";
    if (a && a.recommendation) { next = a.recommendation; why = "разбор ИИ"; }
    else if (RE.refuse.test(inText)) next = "Клиент назвал причину отказа. Не благодарить и закрывать тему, а спросить, что должно измениться, чтобы решение стало другим.";
    else if (ballWait > BALL_STUCK_MIN) next = `Ответить сегодня: клиент ждёт ${fmtMin(ballWait)}. Дать конкретный срок («отвечу сегодня до 18:00»), а не «в ближайшее время».`;
    else if (RE.ready.test(inText)) next = "Клиент говорит об оплате. Выставить счёт сегодня и назвать срок готовности датой.";
    else if (RE.price.test(inText)) next = "Отработать цену: показать состав стоимости и вариант дешевле, назвать конкретный срок ответа.";
    else if (silenceD >= SILENCE_BAD_D) next = `Тишина ${silenceD} дн. Написать с новым поводом (готовность, сроки, вариант), закончить вопросом и зафиксировать дату следующего контакта.`;
    else if (overdue) next = `Дело просрочено на ${overdueD} дн${f && f.taskSubj ? " («" + String(f.taskSubj).slice(0, 40) + "»)" : ""}. Закрыть сегодня или перенести с новой датой.`;
    else if (!nextStep) next = "Поставить дело с датой и временем: без следующего шага сделка выпадает из работы.";
    else if (early && tags.some((t) => t.sec === "qual" && t.tone === "bad")) next = "Достроить квалификацию: задача, размеры, срок, бюджет. Без них расчёт уйдёт мимо.";
    else if (tags.some((t) => t.t === "Размытый срок без даты")) next = "Заменить размытый срок на дату: «подготовлю расчёт завтра до обеда».";
    else next = "Держать темп: следующий шаг зафиксирован, ответы в норме.";

    deals.push({
      key, dealId, leadId, title: last.dealT || last.leadT || key, mgr: last.mgr || "(не указан)",
      stage: f ? f.stage : "", stageCode, budget: f ? f.budget : 0,
      prob: Math.round(prob * 100), base: Math.round(base * 100), factors, tags, next, why,
      ai: a ? { verdict: a.verdict, politeness: a.politeness, regulation: a.regulation, deadlines: a.deadlines, quotes: a.quotes } : null,
      msgs: msgs.length, calls, respMed, firstResp, ballWait, silenceD, overdueD, nextStep, stageDays,
      lastTs: last.ts, lastDt: last.dt,
    });
  }

  // --- Сводка по менеджерам: доля здоровых сделок в каждом разделе ---
  const byMgr: Record<string, any[]> = {};
  for (const d of deals) (byMgr[d.mgr] ||= []).push(d);
  const hiddenMgr: { mgr: string; deals: number; why: string }[] = [];
  const managers = Object.entries(byMgr).filter(([mgr, ds]) => {
    const why = isHidden(mgr, fired);
    if (why) { hiddenMgr.push({ mgr, deals: ds.length, why }); return false; }
    return true;
  }).map(([mgr, ds]) => {
    const sections = SECTIONS.map((s) => {
      const touched = ds.filter((d) => d.tags.some((t: Tag) => t.sec === s.key));
      const bad = touched.filter((d) => d.tags.some((t: Tag) => t.sec === s.key && t.tone === "bad"));
      const enoughSec = touched.length >= MIN_SEC_N;
      return { key: s.key, label: s.label, n: touched.length, pos: enoughSec ? Math.round((1 - bad.length / touched.length) * 100) : null, bad: bad.length };
    });
    const enough = ds.length >= MIN_SAMPLE;
    const scored = sections.filter((s) => s.pos !== null);
    const wsum = scored.reduce((s, x) => s + SECTIONS.find((y) => y.key === x.key)!.weight, 0);
    const rating = enough && wsum ? Number((scored.reduce((s, x) => s + (x.pos as number) * SECTIONS.find((y) => y.key === x.key)!.weight, 0) / wsum / 20).toFixed(1)) : null;
    return {
      mgr, deals: ds.length, rating, sections,
      noRating: enough ? "" : `мало данных (${ds.length} из ${MIN_SAMPLE})`,
      probAvg: Math.round(ds.reduce((s, d) => s + d.prob, 0) / ds.length),
      pipeline: ds.reduce((s, d) => s + (d.budget || 0), 0),
      alerts: ds.filter((d) => d.tags.some((t: Tag) => t.tone === "bad")).length,
    };
  }).sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.deals - a.deals);

  // Каталог тегов для кликов: нормализованное имя -> раздел, тон, счётчик
  const tagIndex: Record<string, { sec: string; tone: string; n: number }> = {};
  for (const d of deals) for (const t of d.tags) {
    const norm = t.t.split(" · ")[0]!.replace(/\d+/g, "N");
    const rec = (tagIndex[norm] ||= { sec: t.sec, tone: t.tone, n: 0 });
    rec.n++;
  }

  // --- Тренд: срез дня, чтобы было видно, двигается ли отдел (метрика успеха инструмента) ---
  const day = (dlg.to || new Date().toISOString()).slice(0, 10);
  const rated = managers.filter((m) => m.rating !== null);
  const snap = {
    day, deals: deals.length,
    ratingAvg: rated.length ? Number((rated.reduce((s, m) => s + (m.rating as number), 0) / rated.length).toFixed(2)) : null,
    ballOurs: deals.filter((d) => d.ballWait > BALL_STUCK_MIN).length,
    noNextStep: deals.filter((d) => !d.nextStep).length,
    silence: deals.filter((d) => d.silenceD >= SILENCE_BAD_D).length,
    respMed: med(deals.map((d) => d.respMed).filter((x) => x !== null) as number[]),
    probAvg: Math.round(deals.reduce((s, d) => s + d.prob, 0) / Math.max(deals.length, 1)),
  };
  const trend: any[] = existsSync(TRD) ? (JSON.parse(readFileSync(TRD, "utf8")).days || []) : [];
  const idx = trend.findIndex((x) => x.day === day);
  if (idx >= 0) trend[idx] = snap; else trend.push(snap);
  const days = trend.slice(-90);
  writeFileSync(TRD, JSON.stringify({ updatedAt: new Date().toISOString(), days }));

  dlg.scoring = {
    trend: days.slice(-14),
    calibratedAt: CALIBRATED_AT, baseFallback: Math.round(BASE_FALLBACK * 100), baseRates: BASE_RATES,
    sections: SECTIONS, minSample: MIN_SAMPLE, aiReviews: Object.keys(ai).length,
    thresholds: { FIRST_ANSWER_MIN, FAST_ANSWER_MIN, SLOW_ANSWER_MIN, BALL_STUCK_MIN, SILENCE_WARN_D, SILENCE_BAD_D, OVERDUE_GRACE_D },
    tagIndex, deals: deals.sort((a, b) => b.prob - a.prob), managers,
    hiddenMgr: hiddenMgr.sort((a, b) => b.deals - a.deals),
  };
  writeFileSync(DLG, JSON.stringify(dlg));
  console.log(`Разбор: диалогов ${deals.length}, менеджеров ${managers.length}, тегов ${Object.keys(tagIndex).length}`);
  for (const m of managers.filter((x) => x.rating !== null)) console.log(`   ${m.rating} ★  ${m.mgr} - ${m.deals} диал · ${m.sections.map((s) => s.label + " " + (s.pos ?? "-") + "%").join(" · ")}`);
}
main();
