#!/usr/bin/env node
// Kostya-AI: детекторы дефектов работы менеджеров по снимку Bitrix24 (rop.json, категория 49).
//
// Логика взята из 11 разборов Кости (Kostya-analitycs-2026/), каталог с обоснованием
// каждого детектора - references/defect-catalog.md.
//
// Запуск:
//   node kostya-audit.mjs /путь/к/rop.json > kostya.json
// Опции:
//   --mgr "Имя"        только по одному менеджеру
//   --deal ID          только по одной сделке
//   --today YYYY-MM-DD зафиксировать дату разбора (по умолчанию generated_at снимка)
//   --pretty           читаемый JSON
//
// Сеть к Bitrix из песочницы закрыта: снимок берётся из ветки данных rop-dashboard-v1,
// живой запрос идёт только в GitHub Actions (b24-snapshots.yml).

import { readFileSync } from "node:fs";

const PORTAL = process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru";

// --- Пороги. [ГИПОТЕЗА - калибровка] ---
// Костя в ТЗ оставил тайминги пустыми ("в течение __ рабочих часов") осознанно, чтобы
// компания определила их сама. Дефолты ниже откалиброваны по снимку 2026-08-07 (650
// открытых сделок): взята медиана dwell по стадии, округлённая вверх до рабочего смысла.
// Правило пересмотра: если детектор даёт >30% флагов по стадии, порог слишком жёсткий.
const STAGE_LIMITS = {
  "Новая сделка": { dwell: 3, silence: 3, group: "active" },
  "Расчёт": { dwell: 10, silence: 7, group: "active" },
  "Формирование ТЗ": { dwell: 14, silence: 10, group: "active" },
  // D01 и D02 давали 52.8% и 40.5% флагов от открытого портфеля, нарушая собственное
  // правило «детектор с долей выше 30% это шум, а не сигнал». Лимиты ослаблены до p75
  // фактического распределения. Костин совет из ТЗ: начинать с мягких лимитов.
  "КП отправлено": { dwell: 35, silence: 14, group: "active" },
  "Принимают решение": { dwell: 14, silence: 10, group: "active" },
  "Долгострой": { dwell: 60, silence: 30, group: "stuck" },
  "Предоплата получена": { dwell: 5, silence: 7, group: "money" },
  "Заказ в производстве": { dwell: 45, silence: 21, group: "prod" },
  "Заказ произведен": { dwell: 7, silence: 14, group: "prod" },
  "Заказ отправлен": { dwell: 7, silence: 14, group: "prod" },
};
const DEFAULT_LIMIT = { dwell: 30, silence: 14, group: "active" };

// Стадии, на которых сделка обязана иметь сумму (КП уже у клиента).
const BUDGET_REQUIRED_FROM = new Set([
  "КП отправлено", "Принимают решение", "Предоплата получена",
  "Заказ в производстве", "Заказ произведен", "Заказ отправлен", "Долгострой",
]);

// Порядок стадий воронки C49 для детектора регресса.
const PIPE_ORDER = [
  "Новая сделка", "Расчёт", "Формирование ТЗ", "КП отправлено", "Принимают решение",
  "Предоплата получена", "Заказ в производстве", "Заказ произведен", "Заказ отправлен",
];

const SEV_RANK = { crit: 3, high: 2, med: 1, low: 0 };

// --- Аргументы ---
// Разбираем позиционно: опции со значением съедают следующий токен, всё остальное - путь.
// Наивный поиск «первого не-флага» ломался бы на `--since 2026-07-01 /tmp/rop.json`.
const VALUE_OPTS = new Set(["--mgr", "--deal", "--today", "--since"]);
const BOOL_OPTS = new Set(["--pretty"]);
const argv = process.argv.slice(2);
const opts = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (VALUE_OPTS.has(a)) { opts[a] = argv[++i]; continue; }
  if (BOOL_OPTS.has(a)) { opts[a] = true; continue; }
  if (a.startsWith("--")) { console.error(`Неизвестная опция: ${a}`); process.exit(1); }
  positional.push(a);
}
const opt = (name) => opts[name];
const flag = (name) => !!opts[name];
const src = positional[0];
if (!src) {
  console.error("Нужен путь к rop.json. Пример: node kostya-audit.mjs /tmp/rop.json > kostya.json");
  process.exit(1);
}

const snap = JSON.parse(readFileSync(src, "utf8"));
const onlyMgr = opt("--mgr");
const onlyDeal = opt("--deal");

// Дата разбора: по умолчанию день снимка, а не «сегодня». Иначе прогон старого снимка
// нарисует ложную просрочку на ровном месте.
const snapDay = String(snap.generated_at || "").slice(0, 10);
const today = opt("--today") || snapDay;
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
  console.error(`Не удалось определить дату разбора (generated_at="${snap.generated_at}"). Задайте --today YYYY-MM-DD.`);
  process.exit(1);
}

const dayNum = (s) => (s ? Math.floor(Date.parse(s + "T00:00:00Z") / 86400000) : null);
const T = dayNum(today);
const daysAgo = (s) => {
  const d = dayNum(s);
  return d === null ? null : T - d;
};
const limitsOf = (stage) => STAGE_LIMITS[stage] || DEFAULT_LIMIT;
const dealUrl = (id) => `${PORTAL}/crm/deal/details/${id}/`;

// Возраст снимка в часах: протухший снимок обязан быть виден в отчёте, а не молча съеден.
const snapAgeH = snap.generated_at
  ? Math.round((Date.now() - Date.parse(snap.generated_at)) / 36e5)
  : null;

// --- Подготовка ---
const deals = snap.deals || [];
const open = deals.filter((d) => !d.won && !d.lost);
const scopeOpen = open.filter((d) =>
  (!onlyMgr || d.mgr === onlyMgr) && (!onlyDeal || String(d.id) === String(onlyDeal)));
const lost = deals.filter((d) => d.lost && (!onlyMgr || d.mgr === onlyMgr));

// Сделки, у которых есть карточка производства (для D08).
const prodDealIds = new Set((snap.prodItems || []).filter((p) => p.dealId && p.start).map((p) => String(p.dealId)));

// Дата последнего входа в текущую стадию. Без истории dwell не считается: такие сделки
// уходят в отдельную корзину, а не считаются здоровыми.
const stageEntry = (d) => {
  const h = d.hist || [];
  for (let i = h.length - 1; i >= 0; i--) {
    if (String(h[i][0]) === String(d.stageCode) && h[i][1]) return h[i][1];
  }
  return null;
};

// Нормализация названия сделки для прокси-группировки «свалки».
// Названия вида "4127Сделка #4127 Наталья" -> "наталья".
const clientKey = (title) => String(title || "")
  .replace(/^\d+/, "")
  .replace(/сделка\s*#?\s*\d+/gi, "")
  .replace(/[^\p{L}\s]/gu, " ")
  .trim().toLowerCase().split(/\s+/).slice(0, 3).join(" ");

const flags = [];
const add = (d, code, severity, fact, should, evidence) => {
  flags.push({
    deal: String(d.id), title: d.title || "", url: dealUrl(d.id), mgr: d.mgr,
    stage: d.stage, budget: d.budget || 0, code, severity, fact, should, evidence,
  });
};

// --- D14 СНИМОК_ПРОТУХ ---
const snapStale = snapAgeH !== null && snapAgeH > 36;

// --- Детекторы по открытым сделкам ---
const noHist = [];
for (const d of scopeOpen) {
  const lim = limitsOf(d.stage);
  const entry = stageEntry(d);
  const dwell = entry ? daysAgo(entry) : null;
  const silence = daysAgo(d.activity);

  if (dwell === null) noHist.push(String(d.id));

  // D01 ЗАВИС_НА_СТАДИИ
  if (dwell !== null && dwell > lim.dwell) {
    const ratio = dwell / lim.dwell;
    add(d, "D01", ratio > 3 ? "crit" : "high",
      `${dwell} дн. на стадии «${d.stage}» при лимите ${lim.dwell} дн.`,
      "Перевести на стадию, отражающую реальность, или увести в «Связаться позже» с датой следующего контакта.",
      { dwell, limit: lim.dwell, stageEntry: entry });
  }

  // D02 ТИШИНА
  if (silence !== null && silence > lim.silence) {
    add(d, "D02", silence > 21 ? "crit" : "high",
      `${silence} дн. без активности (последняя ${d.activity}) при лимите ${lim.silence} дн.`,
      "Алгоритм трёх касаний: смена формулировки, затем смена канала, затем предложение отложить контакт с датой.",
      { silence, limit: lim.silence, lastActivity: d.activity });
  }

  // D03 ПРОСРОЧЕНО_ДЕЛО
  const overdue = d.taskDue ? daysAgo(d.taskDue) : null;
  if (overdue !== null && overdue > 0) {
    add(d, "D03", overdue > 7 ? "crit" : overdue > 3 ? "high" : "med",
      `Дело «${d.taskSubj || "без темы"}» просрочено на ${overdue} дн. (срок ${d.taskDue}).`,
      "Дело закрывается или переносится с новой датой в день срока. Просроченное дело - точка контроля РОПа.",
      { overdueDays: overdue, taskDue: d.taskDue, taskSubj: d.taskSubj });
  }

  // D04 БЕЗ_СЛЕДУЮЩЕГО_ШАГА
  if ((d.tasksOpen || 0) === 0 && lim.group === "active") {
    add(d, "D04", silence !== null && silence > 7 ? "high" : "med",
      "Нет ни одного открытого дела: следующий шаг по сделке не запланирован.",
      "После каждого значимого контакта ставить своё дело на дату следующего касания, не полагаясь на робота.",
      { tasksOpen: 0, silence });
  }

  // D05 РЕШЕНИЕ_БЕЗ_ДАТЫ (прокси)
  if (d.stage === "Принимают решение" && dwell !== null && dwell > 7) {
    add(d, "D05", "high",
      `${dwell} дн. на «Принимают решение»: согласованной даты решения нет (правило «нет даты - нет стадии»).`,
      "Получить у клиента конкретную дату и зафиксировать её, либо увести в «Связаться позже».",
      { dwell, proxy: "поле «Дата решения клиента» в Bitrix24 не создано, признак вычислен по dwell>7" });
  }

  // D07 БЮДЖЕТ_НОЛЬ
  if (BUDGET_REQUIRED_FROM.has(d.stage) && !d.budget) {
    add(d, "D07", "med",
      `Сумма сделки не заполнена на стадии «${d.stage}».`,
      "Сумма проставляется при отправке КП. Без неё прогноз по пайплайну считать нельзя.",
      { budget: 0 });
  }

  // D08 СТАДИЯ_НЕ_АКТУАЛЬНА
  if (d.stage === "Предоплата получена" && prodDealIds.has(String(d.id))) {
    add(d, "D08", "high",
      "Карточка производства уже заведена, а сделка всё ещё на «Предоплата получена».",
      "Стадия меняется в день события: заказ ушёл в производство - сделка на «Заказ в производстве» тем же днём.",
      { hasProdCard: true });
  }

  // D09 РЕГРЕСС_СТАДИИ
  const seq = (d.hist || []).map((h) => PIPE_ORDER.indexOf(snap.refs?.dealStages?.[h[0]] || ""))
    .filter((i) => i >= 0);
  let backs = 0;
  for (let i = 1; i < seq.length; i++) if (seq[i] < seq[i - 1]) backs++;
  if (backs >= 2) {
    add(d, "D09", "low",
      `${backs} возврата назад по воронке: КП, вероятно, уходило сырым.`,
      "Возврат на «Формирование ТЗ» после КП легитимен при принципиальном изменении конструкции. Многократный возврат - повод разобрать качество проработки.",
      { backwardMoves: backs });
  }

  // D10 ПУСТЫЕ_КЛАССИФИКАТОРЫ
  const miss = [];
  if (!d.dir || d.dir === "не указано") miss.push("направление");
  if (!d.assort || d.assort === "нет данных") miss.push("ассортимент");
  if (miss.length) {
    add(d, "D10", "low",
      `Не заполнено: ${miss.join(", ")}.`,
      "Классификаторы заполняются при квалификации. Без них конверсия по продуктам и брендам не считается.",
      { missing: miss });
  }

  // D11 ДОЛГОСТРОЙ_БЕЗ_ДВИЖЕНИЯ
  if (d.stage === "Долгострой" && silence !== null && silence > 30) {
    add(d, "D11", "high",
      `«Долгострой» без активности ${silence} дн.`,
      "«Долгострой» это флаг производственной задержки, а не склад. Нужно либо движение, либо решение о закрытии.",
      { silence });
  }
}

// --- D12 СВАЛКА (прокси по названию клиента) ---
const byMgrClient = new Map();
for (const d of scopeOpen) {
  const k = clientKey(d.title);
  if (k.length < 4) continue;
  const key = `${d.mgr}||${k}`;
  if (!byMgrClient.has(key)) byMgrClient.set(key, []);
  byMgrClient.get(key).push(d);
}
for (const [key, group] of byMgrClient) {
  if (group.length < 3) continue;
  const ids = group.map((g) => String(g.id));
  for (const d of group) {
    add(d, "D12", "med",
      `${group.length} открытых сделок с одним клиентом «${key.split("||")[1]}»: ${ids.join(", ")}.`,
      "Правило «один запрос - одна сделка» соблюдено, но группа требует проверки на дубли и на «свалку» внутри карточек.",
      { siblings: ids, proxy: "группировка по названию сделки: CONTACT_ID/COMPANY_ID в снимке отсутствуют" });
  }
}
// Вторая ветка D12: одна сделка с чрезмерно длинной историей и долгим зависанием.
for (const d of scopeOpen) {
  const entry = stageEntry(d);
  const dwell = entry ? daysAgo(entry) : null;
  if ((d.hist || []).length > 12 && dwell !== null && dwell > 60) {
    add(d, "D12", "med",
      `${d.hist.length} переходов по стадиям и ${dwell} дн. на текущей: похоже на сделку-свалку с несколькими запросами внутри.`,
      "Разделить на отдельные сделки по каждому самостоятельному запросу, в комментарии оставить ссылку на основную.",
      { historyLen: d.hist.length, dwell, proxy: "эвристика по длине истории" });
  }
}

// --- D06 ОТКАЗ_БЕЗ_ПРИЧИНЫ (по проваленным за окно) ---
// Окно по умолчанию - 30 дней от даты разбора. Отказ без причины актуален, пока менеджер
// ещё помнит клиента; гнать в ежедневный дайджест 5509 исторических отказов бессмысленно.
// Полную историю смотреть точечно через --since 2020-01-01.
const LOST_WINDOW_DAYS = 30;
const since = opt("--since") || new Date((T - LOST_WINDOW_DAYS) * 86400000).toISOString().slice(0, 10);
const lostWindow = lost.filter((d) => d.closed && d.closed >= since);
const BLANK_REASON = new Set(["", "не указана", "Другое", "другое"]);
for (const d of lostWindow) {
  if (BLANK_REASON.has(String(d.reason || "").trim())) {
    add(d, "D06", "med",
      `Отказ закрыт без причины (в поле «${d.reason || "пусто"}»).`,
      "Причина отказа заполняется текстом, а не выбором «Другое». Перед закрытием отработать скрипт «Открытая дверь».",
      { reason: d.reason, closed: d.closed });
  }
}

// --- D13 БЕЗ_ДАТЫ_СЛЕДУЮЩЕГО_КОНТАКТА (ждёт стадию) ---
const stageNames = new Set(Object.values(snap.refs?.dealStages || {}));
const laterStageExists = [...stageNames].some((s) => /связаться позже|отложен/i.test(String(s)));

// --- Агрегация по менеджерам ---
const mgrs = new Map();
const touchMgr = (m) => {
  if (!mgrs.has(m)) {
    mgrs.set(m, {
      mgr: m, openDeals: 0, openBudget: 0,
      // openFlags - оперативные косяки по живым сделкам (то, что менеджер правит сегодня).
      // lostFlags - разбор закрытых отказов за окно, отдельная история, в индекс не входит.
      openFlags: 0, lostFlags: 0,
      bySeverity: { crit: 0, high: 0, med: 0, low: 0 }, byCode: {},
      overdueTasks: 0, silentDeals: 0, stuckDeals: 0, noNextStep: 0,
      emptyClassifiers: 0, zeroBudget: 0,
    });
  }
  return mgrs.get(m);
};
for (const d of scopeOpen) {
  const m = touchMgr(d.mgr);
  m.openDeals++;
  m.openBudget += Number(d.budget) || 0;
}
for (const f of flags) {
  const m = touchMgr(f.mgr);
  if (f.code === "D06") m.lostFlags++; else m.openFlags++;
  m.bySeverity[f.severity]++;
  m.byCode[f.code] = (m.byCode[f.code] || 0) + 1;
  if (f.code === "D03") m.overdueTasks++;
  if (f.code === "D02") m.silentDeals++;
  if (f.code === "D01") m.stuckDeals++;
  if (f.code === "D04") m.noNextStep++;
  if (f.code === "D10") m.emptyClassifiers++;
  if (f.code === "D07") m.zeroBudget++;
}

// --- Индекс дисциплины. Модель и веса - references/scoring.md. [ГИПОТЕЗА - калибровка] ---
// Каждая компонента - доля здоровых сделок в портфеле менеджера, 0..1. Итог 0..10.
const WEIGHTS = { stages: 0.30, silence: 0.25, tasks: 0.25, fields: 0.20 };
// Ниже этого порога выборка нерепрезентативна. Костя делал ручной глубокий разбор на 5-8
// сделках и всё равно оговаривал ограниченность выборки. Для автоматического ежедневного
// индекса берём 10: один зависший заказ у менеджера с шестью сделками роняет индекс на 1.7
// балла, и светофор начинает врать.
const MIN_SAMPLE = 10;
for (const m of mgrs.values()) {
  if (!m.openDeals) { m.index = null; m.sample = "нет открытых сделок"; continue; }
  const share = (n) => 1 - Math.min(1, n / m.openDeals);
  const comp = {
    stages: share(m.stuckDeals),
    silence: share(m.silentDeals),
    tasks: share(m.overdueTasks + m.noNextStep),
    fields: share(m.emptyClassifiers + m.zeroBudget),
  };
  m.components = comp;
  m.index = Math.round(
    (comp.stages * WEIGHTS.stages + comp.silence * WEIGHTS.silence
      + comp.tasks * WEIGHTS.tasks + comp.fields * WEIGHTS.fields) * 100,
  ) / 10;
  m.sample = m.openDeals < MIN_SAMPLE ? "мало данных" : "ок";
  // Ниже минимальной выборки индекс НЕ выдаётся числом. Иначе в JSON лежит «8.0» против
  // сотрудника с одной сделкой, и первый же потребитель контракта опубликует это как оценку.
  if (m.sample !== "ок") m.index = null;
  m.band = m.sample !== "ок" ? "мало данных"
    : m.index >= 7.5 ? "молодец" : m.index >= 5 ? "норма" : "холодец";
}

// Сортировка сначала по наличию выборки, потом по индексу: менеджер с одной сделкой
// не должен оказываться первым элементом массива.
const BAND_RANK = { "молодец": 3, "норма": 2, "холодец": 1, "мало данных": 0 };
const managers = [...mgrs.values()].sort((a, b) =>
  (BAND_RANK[b.band] ?? 0) - (BAND_RANK[a.band] ?? 0) || (b.index ?? -1) - (a.index ?? -1));

flags.sort((a, b) => (SEV_RANK[b.severity] - SEV_RANK[a.severity])
  || (b.budget - a.budget) || String(a.deal).localeCompare(String(b.deal)));

const byCode = {};
for (const f of flags) byCode[f.code] = (byCode[f.code] || 0) + 1;

const out = {
  meta: {
    tool: "kostya-ai",
    generated_at: new Date().toISOString(),
    snapshot_at: snap.generated_at || null,
    snapshot_age_hours: snapAgeH,
    snapshot_stale: snapStale,
    audit_date: today,
    source: src,
    portal: PORTAL,
    scope: { mgr: onlyMgr || null, deal: onlyDeal || null, lostSince: since || null },
    thresholds: { stageLimits: STAGE_LIMITS, defaultLimit: DEFAULT_LIMIT, weights: WEIGHTS, minSample: MIN_SAMPLE },
    caveats: [
      "Пороги стадий и веса индекса - [ГИПОТЕЗА - калибровка], откалиброваны по снимку 2026-08-07. Пересмотр после 2 недель прогонов.",
      "lastTouch/touch90 из снимка не используются: атрибуция касаний недостоверна (228 из 650 открытых сделок имели активность за 7 дней при нулевых касаниях). Тишина считается по LAST_ACTIVITY_TIME.",
      "D05 и D12 - прокси. Поля «Дата решения клиента», CONTACT_ID и COMPANY_ID в снимке отсутствуют.",
      "Коммуникационный слой (тела писем, приветствия, формулировки, орфография) не проверялся: в rop.json нет текстов сообщений.",
    ],
    notImplemented: {
      D13: laterStageExists
        ? "стадия «Связаться позже» найдена в справочнике, детектор можно включать"
        : "стадия «Связаться позже» в Bitrix24 не создана, ТЗ Кости не внедрено",
      layerB: "T01-T09 (тексты сообщений) требуют сборщика тел активностей, см. references/data-contract.md",
    },
    dealsWithoutHistory: noHist.length,
  },
  totals: {
    dealsInSnapshot: deals.length,
    openDeals: scopeOpen.length,
    openBudget: scopeOpen.reduce((s, d) => s + (Number(d.budget) || 0), 0),
    lostInWindow: lostWindow.length,
    flags: flags.length,
    byCode,
    bySeverity: flags.reduce((a, f) => (a[f.severity] = (a[f.severity] || 0) + 1, a), {}),
  },
  managers,
  flags,
};

process.stdout.write(JSON.stringify(out, null, flag("--pretty") ? 2 : 0));
