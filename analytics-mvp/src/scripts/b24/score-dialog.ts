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
// Пост-продажные стадии: продажа состоялась, дальше идёт производство и логистика.
// Здесь стадия двигается по факту цеха, а не по работе с клиентом, и тишина в неделю
// это норма, а не брошенный клиент. Проверено на данных: 25 из 56 «движений без
// общения» приходились именно на эти стадии - без поправки они били бы по людям зря.
const POST_SALE = new Set(["C49:EXECUTING", "C49:FINAL_INVOICE", "C49:1", "C49:2"]);
const WORK_FROM = 9, WORK_TO = 19, TZ_SHIFT = 3;

// Кого не показывать в таблице рейтинга: роботы портала, числовые ID вместо имени,
// уволенные (список firedManagers из снимка РОПа) и явно названные Иваном не-наши.
// KEEP_MGR - исключения из списка уволенных: числится уволенным в CRM, но работает.
const EXCLUDE_MGR = new Set(["Лысенко Ольга", "Сячинова Александра", "Мавлина Юлия", "Ерина Екатерина", "Королькова Наталья", "Павлова Анна"]);
// Лобова: в портале два пользователя с этим ФИО. ID 7999 - рабочая (активна, вход
// ежедневно, 15 сделок C49, 60 активностей), ID 8001 - ошибочный дубль (отключена,
// ноль сделок). В firedManagers попал дубль, поэтому по имени фильтр снёс бы живого
// человека. Проверено пробой 18.08.2026.
// Турченко Анна - офис-менеджер, ведёт первичную работу с лидами. В firedManagers
// попала ошибочно (в портале несколько учёток с этой фамилией), поэтому держим явно.
const KEEP_MGR = new Set(["Лобова Надежда", "Турченко Анна"]);
const swapName = (n: string) => { const p = n.trim().split(/\s+/); return p.length === 2 ? p[1] + " " + p[0] : n; };
function isHidden(mgr: string, fired: Set<string>): string {
  if (KEEP_MGR.has(mgr)) return "";
  if (/^Системный пользователь/i.test(mgr) || mgr === "(не указан)") return "робот портала";
  if (!/[A-Za-zА-Яа-яЁё]/.test(mgr)) return "ID без имени";
  if (EXCLUDE_MGR.has(mgr)) return "не в отделе продаж";
  if (fired.has(mgr) || fired.has(swapName(mgr))) return "уволен";
  return "";
}

type Ev = { ts: number; dt: string; stage: string; leadId: string; dealId: string; leadT: string; dealT: string; mgr: string; type: string; dir: string; who: string; body: string; title: string; status: string; src: string };
const isMsg = (e: Ev) => e.type.startsWith("Сообщение") || e.type === "Письмо" || e.type === "Мессенджер ОЛ";
// Антигейминг: «Хорошо, спасибо!» за 2 минуты не ответ клиенту. Ответом по существу считаем
// сообщение от 25 символов либо с цифрой, датой или вопросом (16% исходящих - короткие отписки).
const MIN_ANSWER_LEN = 25;
// Окно, в котором ответ менеджера ещё считается ответом на возражение (сутки).
const OBJ_WINDOW_MS = 24 * 3600_000;
// Вложение - это содержание, а не отписка. Wazzup кладёт в тело строку вида
// «Отправлено Изображение» / «Принято Файл» (иногда с подписью следующей строкой):
// менеджер прислал эскиз, замер или прайс, текста в теле нет по формату канала.
// 372 таких сообщения из 3339. Метить их «заглушкой» - ложный флаг.
const RE_ATTACH = /^(отправлено|принято)\s+(изображени|фото|файл|видео|аудио|документ|голосов|стикер|локаци|контакт)/i;
const isAttach = (e: Ev) => RE_ATTACH.test(String(e.body || "").trim());
const attachKind = (e: Ev) => { const m = String(e.body || "").trim().match(/^(?:отправлено|принято)\s+([A-Za-zА-Яа-яЁё]+)/i); return m ? m[1]!.toLowerCase() : "вложение"; };
const isRealAnswer = (e: Ev) => { if (isAttach(e)) return true; const b = String(e.body || "").trim(); return b.length >= MIN_ANSWER_LEN || /\d|\?/.test(b); };
// Короткая реплика вдогонку собственному развёрнутому сообщению - продолжение мысли,
// а не отдельный ответ клиенту. Заглушкой считаем только то, что стоит одиноко после
// сообщения клиента.
const CONT_MIN = 20;
function isStub(msgs: Ev[], i: number): boolean {
  const m = msgs[i]!;
  if (m.dir !== "исходящее" || isRealAnswer(m)) return false;
  for (let j = i - 1; j >= 0; j--) {
    const p = msgs[j]!;
    if (m.ts - p.ts > CONT_MIN * 60000) break;
    if (p.dir === "входящее") break;
    if (p.dir === "исходящее" && isRealAnswer(p)) return false;
  }
  return true;
}

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
  ready: /выставьте счёт|выставите счет|выставляйте|выставите|оплач|оформля|(?<![а-яё])беру(?![а-яё])|готов оплатить|реквизит|когда можно оплатить|счёт на оплату/i,
  price: /дорого|скидк|дешевле|снизить цену|цена высок|не укладыва|бюджет не|подешевле/i,
  // «Дорого» бывает трёх видов: возражение, вопрос про скидку и реплика перед покупкой
  // («ого дорого, выставляйте счёт»). Возражением считаем только первое: objQuestion и
  // сигнал готовности к оплате в том же сообщении снимают срабатывание.
  objection: /(?<![а-яё])дорого(?![а-яё])|дешевле|снизить цену|цена высок|не укладыва|бюджет не|подешевле|дорогова|почему так долго|слишком долго|в другой компании|у конкурент|у других (дешевле|быстрее)|нашли дешевле|подума(ю|ем)|посоветуюсь|нет денег|не готов[аы]? платить|(дайте|дадите|сделайте|нужна|нужен|хотелось бы) скидк|без скидки/i,
  // Вопрос про скидку - это интерес, а не возражение: «есть ли у вас дизайнерские скидки?»,
  // «какой процент скидки при таком объёме?». Между вопросительным словом и «скидкой»
  // помещаются определения, поэтому допускаем до трёх слов.
  objQuestion: /(есть|будет|будут|бывают|какая|какие|какой|каков|предусмотрен[аы]?|возможн[оаы]|предоставля[а-яё]*)\s+(ли\s+)?(у вас\s+)?(?:[а-яё]+\s+){0,3}(скидк|бонус|дисконт|программ)|скидки (для|дизайнер)|(дешевле|дороже)[^.?!]{0,40}\?/i,
  // Контраргумент: причина цены, состав, ценность, альтернатива или уточняющий вопрос по сути
  // возражения. Голое «хорошо, сделаю скидку» контраргументом не считается.
  counter: /потому что|так как|за счёт|в стоимость (входит|включ)|в цену (входит|включ)|включен[оаы]? в|входит в цену|гарант|срок службы|толщин|закал|сертификат|собственное производство|монтаж включ|замер бесплат|доставка включ|сравн|разниц|аналог|могу предложить|есть вариант|альтернатив|можем упрост|упрост|рассрочк|по этапам|частями|индивидуальн|под заказ|по вашим размерам|ручная работа|не серийн|можно (тогда )?без|попробуем без|вариант попроще|индивидуальные условия|с чем сравнива|какой у вас бюджет|на какую сумму ориентир|что для вас важн|если убрать|если заменить|дешевле будет если/i,
  // Уступка без объяснения: цену снизили, ценность не объяснили.
  concede: /(сделаю|сделаем|дам|дадим|готова дать|готов дать|могу дать) скидк|дам скидку|скидка \d+|уступ|снизим цену|минус \d+ ?%/i,
  refuse: /не актуально|отказыва|передумал|выбрали друг|уже заказал|не интересует|не будем/i,
  vague: /в ближайшее время|как только|постараюсь|на днях|в течение недели|буду держать в курсе|ориентировочно/i,
  dated: /\b\d{1,2}[.\/]\d{1,2}\b|завтра|сегодня до|понедельник|вторник|среду|четверг|пятницу|до \d{1,2}[:.]\d{2}|в течение дня/i,
  hello: /здравствуйте|добрый день|доброе утро|добрый вечер|приветствую/i,
  budget: /бюджет|стоимость|цена|прайс|сколько будет стоить|в какую сумму/i,
  term: /срок|когда нужно|к какой дате|когда планир|готовность/i,
  spec: /размер|\d+\s*(мм|см|м2)|\d+\s*[хx]\s*\d+|чертеж|эскиз|замер|(?<![а-яё])тз(?![а-яё])|техзадан/i,
  jargon: /закрутил|замотал|забыл|запар|не успел|вылетело из головы|извиняюсь/i,
  apology: /прошу прощения|извините|приношу извинения|сожалею/i,
  defense: /я же (писал|говорил)|вы не (сказали|уточнили)|это не (моя|наша) вина|у нас так принято/i,
  thanks: /спасибо|благодар/i,
  // Дела, которые по смыслу требуют контакта с клиентом. Робот Bitrix ставит их шаблонно,
  // поэтому ловим и его формулировки: «Связаться с клиентом», «Сформируй КП и отправь клиенту».
  contactTask: /связ(аться|ись)|позвони|перезвони|набери|отправ\w* (?:кп|клиент|предложени|расч)|напиш\w* клиент|дожм|уточни у клиент|согласуй с клиент|пригласи|контроль/i,
  // Обещание клиенту: «пришлю сегодня», «отправлю завтра», «в понедельник». Ловим глагол
  // отправки рядом со сроком - иначе «завтра приедет замерщик» считалось бы обещанием менеджера.
  // Только будущее время от первого лица: «отправлю», «пришлю», «перезвоню». Настоящее
  // («направляю вам КП») - это уже выполненное действие, а не обещание, и в детектор не идёт.
  // ВНИМАНИЕ: \b в JS считает границей только латиницу и цифры, для кириллицы он не работает.
  // Поэтому границы задаём явными lookaround по русским буквам.
  promiseVerb: /(?<![а-яёa-z])(отправлю|пришлю|направлю|подготовлю|скину|сделаю|посчитаю|уточню|перезвоню|позвоню|свяжусь|вышлю|отвечу|сообщу|напишу|запрошу|согласую|проверю|скажу|пришлём|отправим|подготовим|перезвоним|свяжемся)(?![а-яё])/i,
  today: /сегодня|в течение дня|до конца дня|до \d{1,2}[:.]\d{2}|в течени[еи] \d+ ?(мин|час)|через \d+ ?(мин|час)/i,
  tomorrow: /завтра|к утру|до обеда завтра/i,
  weekday: /(в |во )?(понедельник|вторник|сред[уы]|четверг|пятниц[уы]|субботу|воскресенье)/i,
  innerTask: /производств|конструктор|замерщик|логист|бухгалтер|счёт в 1с|передать информацию о заказе|внутрен/i,
  kp: /(?<![а-яё])кп(?![а-яё])|коммерческое предложение|направил.{0,12}предложени|отправил.{0,12}расч|расчёт во вложении/i,
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
  // Историю смены ответственного Bitrix через REST не отдаёт: в снимке есть только текущий
  // владелец. Поэтому ведём собственный журнал - сравниваем владельца с прошлым снимком и
  // копим переходы. С каждым днём история становится полнее, задним числом её не восстановить.
  const OWN = "dialog/data/owners.json";
  const ownDb: { owners: Record<string, string>; changes: { id: string; from: string; to: string; at: string }[] } =
    existsSync(OWN) ? JSON.parse(readFileSync(OWN, "utf8")) : { owners: {}, changes: [] };
  const ownStamp = new Date().toISOString().slice(0, 10);
  let ownNew = 0;
  for (const [id, f] of Object.entries(facts)) {
    const cur = String((f as any).mgr || "");
    if (!cur) continue;
    const prev = ownDb.owners[id];
    if (prev && prev !== cur) { ownDb.changes.push({ id, from: prev, to: cur, at: ownStamp }); ownNew++; }
    ownDb.owners[id] = cur;
  }
  ownDb.changes = ownDb.changes.slice(-20000);
  const ownByDeal: Record<string, { from: string; to: string; at: string }[]> = {};
  for (const c of ownDb.changes) (ownByDeal[c.id] ||= []).push(c);
  console.log(`Журнал ответственных: сделок ${Object.keys(ownDb.owners).length}, новых передач ${ownNew}, всего в журнале ${ownDb.changes.length}`);

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

    // Менеджер назвал срок следующего шага («завтра утром пришлю КП») - до этого срока
    // пауза не дефект, а время на подготовку: клиент знает, когда ждать. Считаем окно
    // по тому же правилу, что и обещания в T08.
    const promiseDue = (m: Ev): number => {
      const b = String(m.body || "");
      if (!RE.promiseVerb.test(b)) return 0;
      const sent = b.split(/(?<=[.!?\n])\s+/).find((x) => RE.promiseVerb.test(x)) || b;
      if (RE.today.test(sent)) return m.ts + 12 * 3600_000;
      if (RE.tomorrow.test(sent)) return m.ts + 36 * 3600_000;
      if (RE.weekday.test(sent)) return m.ts + 7 * 864e5;
      return 0;
    };
    const promiseCovers = (ts: number) => outs.some((o) => o.ts <= ts && promiseDue(o) >= ts);

    const resp: number[] = [];
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i]!.dir !== "входящее") continue;
      const nxt = msgs.slice(i + 1).find((m) => m.dir === "исходящее" && isRealAnswer(m));
      if (nxt && !promiseCovers(nxt.ts)) resp.push(workMinutes(msgs[i]!.ts, nxt.ts));
    }
    const respMed = med(resp), firstResp = resp.length ? resp[0]! : null;
    const lastMsg = msgs[msgs.length - 1];
    const ballWaitRaw = lastMsg && lastMsg.dir === "входящее" ? workMinutes(lastMsg.ts, now) : 0;
    const waitAgreed = ballWaitRaw > 0 && promiseCovers(now);   // срок назван и ещё не истёк
    const ballWait = waitAgreed ? 0 : ballWaitRaw;
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
    // Движение без работы: стадия менялась в окне снимка, а клиенту не написали и не позвонили.
    // Это лучший индикатор имитации: в CRM прогресс есть, в общении с клиентом его нет.
    const fromDay = String(dlg.from || "").slice(0, 10);
    const movedDays = hist.filter((h: any) => h && String(h[1] || "").slice(0, 10) >= fromDay).map((h: any) => String(h[1]).slice(0, 10));
    const touched = msgs.length > 0 || evs.some((e) => e.type === "Звонок");
    const ghostMove = movedDays.length > 0 && !touched && !POST_SALE.has(stageCode);
    // Внутренняя работа без клиента: дела, заметки, резюме звонков есть, а самого разговора
    // с клиентом за окно нет. Формально сделка «в работе», фактически клиент ничего не получил.
    const internalOnly = !touched && evs.length > 0 && !POST_SALE.has(stageCode);
    const internalKinds = [...new Set(evs.map((e) => e.type))].join(", ");
    const a = ai[key] || null;

    // --- Разметка ПО СООБЩЕНИЯМ: какой именно фразой сработал тег ------------------
    // Тег на уровне сделки не объясняет, что не так. Здесь каждый сигнал привязан к
    // конкретному сообщению (src) и к цитате внутри него, чтобы в переписке было видно
    // место ошибки, а не общий вывод.
    let objTotal = 0, objWorked = 0;
    const evTags: Record<string, { t: string; tone: string; sec: string; quote: string }[]> = {};
    const mark = (src: string, t: string, tone: string, sec: string, quote = "") => {
      (evTags[src] ||= []).push({ t, tone, sec, quote });
    };
    const hit = (re: RegExp, txt: string) => { const m = txt.match(re); return m ? m[0].slice(0, 40) : ""; };
    let greeted = false;
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i]!, body = String(m.body || ""), src = m.src || "";
      if (!src) continue;
      if (m.dir === "исходящее") {
        if (!greeted && RE.hello.test(body)) { mark(src, "Приветствие и обращение", "good", "polite", hit(RE.hello, body)); greeted = true; }
        if (RE.vague.test(body) && !RE.dated.test(body)) mark(src, "Размытый срок без даты", "bad", "deadline", hit(RE.vague, body));
        else if (RE.dated.test(body)) mark(src, "Конкретная дата", "good", "deadline", hit(RE.dated, body));
        // «Не успела» рядом с «прошу прощения» - это причина, а не замена извинения. Дефект
        // ставим только когда корректного извинения в сообщении нет вовсе.
        if (RE.jargon.test(body) && !RE.apology.test(body)) mark(src, "Жаргон вместо извинения", "bad", "polite", hit(RE.jargon, body));
        if (RE.defense.test(body)) mark(src, "Защита вместо извинения", "bad", "polite", hit(RE.defense, body));
        if (RE.kp.test(body)) mark(src, "КП отправлено", "good", "process", hit(RE.kp, body));
        if (isAttach(m)) mark(src, `Вложение: ${attachKind(m)}`, "info", "process");
        else if (isStub(msgs, i) && outs.length >= 4) mark(src, "Ответ-заглушка", "bad", "speed");
        // квалификационные вопросы менеджера
        const q = [RE.spec.test(body) && "размеры/ТЗ", RE.term.test(body) && "срок", RE.budget.test(body) && "бюджет"].filter(Boolean) as string[];
        if (q.length && early) mark(src, `Спросил: ${q.join(", ")}`, "good", "qual");
        // скорость: ищем предыдущее входящее
        // Скорость меряем только по ПЕРВОМУ ответу после сообщения клиента: следующие
        // сообщения того же менеджера - продолжение работы, а не новый ответ. И если
        // срок был назван заранее, доставка внутри него - выполненное слово, не задержка.
        const prevIn = msgs.slice(0, i).reverse().find((x) => x.dir === "входящее");
        if (prevIn && isRealAnswer(m)) {
          const answered = msgs.slice(0, i).some((x) => x.dir === "исходящее" && x.ts > prevIn.ts && isRealAnswer(x));
          if (!answered) {
            const wm = workMinutes(prevIn.ts, m.ts);
            if (promiseCovers(m.ts) && wm > FAST_ANSWER_MIN) mark(src, `В названный срок (${fmtMin(wm)})`, "good", "deadline");
            else if (wm > SLOW_ANSWER_MIN) mark(src, `Ответ через ${fmtMin(wm)}`, "bad", "speed");
            else if (wm <= FIRST_ANSWER_MIN) mark(src, `Ответ за ${fmtMin(wm)}`, "good", "speed");
          }
        }
      } else if (m.dir === "входящее") {
        if (RE.ready.test(body)) mark(src, "Сигнал готовности к оплате", "good", "result", hit(RE.ready, body));
        if (RE.price.test(body)) mark(src, "Возражение по цене", "warn", "result", hit(RE.price, body));
        // Возражение без контраргумента: клиент назвал причину сомнения, менеджер ответил,
        // но ответ не содержит ни объяснения цены, ни альтернативы, ни уточняющего вопроса.
        // Разбираем и ценовые возражения (тег выше), и остальные: клиент назвал причину
        // сомнения - на неё должен прозвучать аргумент.
        if ((RE.price.test(body) || RE.objection.test(body)) && !RE.objQuestion.test(body) && !RE.ready.test(body)) {
          objTotal++;
          if (!RE.price.test(body)) mark(src, "Возражение клиента", "warn", "result", hit(RE.objection, body));
          const reply = msgs.slice(i + 1).filter((x) => x.dir === "исходящее" && x.ts - m.ts <= OBJ_WINDOW_MS).slice(0, 4);
          // Уточняющий вопрос по сути возражения («какую цену согласовали?») - тоже работа
          // с возражением, а не уход от него.
          const isCounter = (t: string) => RE.counter.test(t) || (/\?/.test(t) && /цен|бюджет|сумм|стоимост|сравн|сколько|важн|материал|алюмин|стекл|толщин|комплект|размер/i.test(t));
          const arg = reply.find((x) => isCounter(String(x.body || "")));
          const gave = reply.find((x) => RE.concede.test(String(x.body || "")));
          if (arg) { objWorked++; if (arg.src) mark(arg.src, "Контраргумент на возражение", "good", "result", hit(RE.counter, String(arg.body || ""))); }
          else if (gave) { if (gave.src) mark(gave.src, "Скидка без аргумента", "bad", "result", hit(RE.concede, String(gave.body || ""))); }
          else if (reply.length) { if (reply[0]!.src) mark(reply[0]!.src, "Ответ без контраргумента", "bad", "result"); }
          else mark(src, "Возражение без ответа", "bad", "result", hit(RE.objection, body));
        }
        if (RE.refuse.test(body)) mark(src, "Риск отказа", "bad", "result", hit(RE.refuse, body));
        // Тег вешаем только на ПОСЛЕДНЕЕ сообщение клиента: если он написал три подряд,
        // без ответа висит вся пачка, но повторять метку на каждой строке - шум.
        const isLastIn = !msgs.slice(i + 1).some((x) => x.dir === "входящее");
        const nxt = msgs.slice(i + 1).find((x) => x.dir === "исходящее" && isRealAnswer(x));
        if (!nxt && isLastIn && ballWait > BALL_STUCK_MIN) mark(src, `Без ответа ${fmtMin(ballWait)}`, "bad", "speed");
        else if (!nxt && isLastIn && waitAgreed) mark(src, `Ждёт по договорённости`, "good", "deadline");
      }
    }
    // T08: обещал и не сделал. Берём исходящее с обещанием и сроком, считаем дедлайн и смотрим,
    // ушло ли клиенту хоть что-то до него. Отдельно от «тишины»: тут нарушено конкретное слово.
    const promises: { at: string; text: string; due: string; kept: boolean }[] = [];
    let vagueProm = 0;
    for (const m of outs) {
      const b = String(m.body || "");
      if (!RE.promiseVerb.test(b)) continue;
      // Срок ищем в том же предложении, что и обещание: иначе «отправлю расчёт» и «замерщик
      // приедет завтра» из разных фраз склеились бы в одно ложное обещание.
      const sent = b.split(/(?<=[.!?\n])\s+/).find((x) => RE.promiseVerb.test(x)) || b;
      let horizonMs = 0, label = "";
      if (RE.today.test(sent)) { horizonMs = 12 * 3600_000; label = "сегодня"; }
      else if (RE.tomorrow.test(sent)) { horizonMs = 36 * 3600_000; label = "завтра"; }
      else if (RE.weekday.test(sent)) { horizonMs = 7 * 864e5; label = (sent.match(RE.weekday) || [""])[0]; }
      else {
        // Обещание без срока: «пришлю попозже», «свяжусь с вами». Клиент не знает, когда ждать,
        // и проверить исполнение нечем. По методике это самостоятельный дефект.
        vagueProm++;
        if (m.src) mark(m.src, "Обещание без срока", "bad", "deadline", (sent.match(RE.promiseVerb) || [""])[0]);
        continue;
      }
      const dueTs = m.ts + horizonMs;
      if (dueTs > now) continue;                       // срок ещё не наступил
      const kept = msgs.some((x) => x.dir === "исходящее" && x.ts > m.ts && x.ts <= dueTs && isRealAnswer(x))
        || evs.some((x) => x.type === "Звонок" && x.ts > m.ts && x.ts <= dueTs);
      promises.push({ at: m.dt, text: sent.slice(0, 110), due: label, kept });
      if (m.src) mark(m.src, kept ? `Обещал ${label} и сделал` : `Обещал ${label} и не сделал`, kept ? "good" : "bad", "deadline");
    }
    const promiseBroken = promises.filter((p) => !p.kept).length;
    const promiseKept = promises.filter((p) => p.kept).length;

    // Дело закрыто, а клиенту не написали и не позвонили. Формальная галочка вместо работы:
    // ищем контакт в 48 часов после дела, подразумевающего разговор с клиентом.
    const CONTACT_WINDOW_MS = 48 * 3600_000;
    let taskNoContact = 0;
    for (const e of evs) {
      if (e.type !== "Дело" && e.type !== "Резюме BitrixGPT") continue;
      const txt = `${e.title || ""} ${e.body || ""}`;
      if (!RE.contactTask.test(txt) || RE.innerTask.test(txt)) continue;
      // Запланированное дело ещё не наступило: спрашивать за него нельзя. Дефект - только
      // выполненное (галочка есть, разговора нет) и просроченное (срок прошёл, контакта нет).
      if (e.status !== "выполнено" && e.status !== "просрочено") continue;
      const after = evs.some((x) => x.ts > e.ts && x.ts <= e.ts + CONTACT_WINDOW_MS
        && (x.dir === "исходящее" || x.type === "Звонок"));
      if (!after) {
        taskNoContact++;
        if (e.src) mark(e.src, e.status === "выполнено" ? "Закрыто без контакта с клиентом" : "Просрочено, контакта нет", "bad", "process");
      } else if (e.src) mark(e.src, "Контакт после дела был", "good", "process");
    }

    // Кто вёл переписку: участники по этапам (лид -> сделка), с числом сообщений.
    const partMap: Record<string, { who: string; stage: string; n: number; first: number }> = {};
    for (const e of evs) {
      if (e.dir !== "исходящее") continue;
      const who = e.who && e.who !== "Клиент" ? e.who : e.mgr;
      if (!who) continue;
      // «Маслова Ольга» из CRM и «Ольга Маслова» из подписи Wazzup - один человек.
      const norm = who.trim().toLowerCase().split(/\s+/).sort().join(" ");
      const k = norm + "|" + e.stage;
      const r = (partMap[k] ||= { who, stage: e.stage, n: 0, first: e.ts });
      r.n++; if (e.ts < r.first) r.first = e.ts;
    }
    // Движение по стадиям: rop.json хранит вход на каждую стадию с точностью до даты.
    // Времени суток там нет, поэтому ставим полдень - для «сколько дней стояла» этого хватает,
    // а точнее данных в CRM просто нет.
    const stageRows = (hist as [string, string][]).map(([code, date]: [string, string], i: number) => {
      const from = Date.parse(date + "T12:00:00+03:00");
      const to = i + 1 < hist.length ? Date.parse(hist[i + 1]![1] + "T12:00:00+03:00") : now;
      return { code, name: BASE_RATES[code]?.name || code, date, ts: from, days: Math.max(0, Math.round((to - from) / 864e5)) };
    });
    // Самая долгая стадия и та, на которой сделка стоит сейчас
    const slowStage = stageRows.length ? stageRows.reduce((a, b) => (b.days > a.days ? b : a)) : null;
    // Передачи ответственного из собственного журнала
    const owners = dealId ? (ownByDeal[dealId] || []) : [];
    // Взял в работу: от создания сделки до первого исходящего слова клиенту
    const createdTs = f && f.created ? Date.parse(String(f.created)) : 0;
    const firstOut = outs.length ? outs[0]!.ts : 0;
    const takeH = createdTs && firstOut && firstOut > createdTs ? Math.round(workMinutes(createdTs, firstOut) / 6) / 10 : null;

    const participants = Object.values(partMap).sort((a, b) => a.first - b.first);

    const tags: Tag[] = [];
    const add = (t: string, sec: string, tone: Tag["tone"]) => tags.push({ t, sec, tone });

    // 1. Отклик
    if (firstResp !== null && firstResp <= FIRST_ANSWER_MIN) add(`Первый ответ за ${fmtMin(firstResp)}`, "speed", "good");
    else if (firstResp !== null && firstResp > SLOW_ANSWER_MIN) add(`Первый ответ через ${fmtMin(firstResp)}`, "speed", "bad");
    if (respMed !== null && respMed <= FAST_ANSWER_MIN) add(`Держит темп · ${fmtMin(respMed)}`, "speed", "good");
    if (respMed !== null && respMed > SLOW_ANSWER_MIN) add(`Медленные ответы · ${fmtMin(respMed)}`, "speed", "bad");
    if (ballWait > BALL_STUCK_MIN) add(`Мяч у нас · клиент ждёт ${fmtMin(ballWait)}`, "speed", "bad");
    else if (waitAgreed) add(`Пауза по договорённости · срок назван клиенту`, "deadline", "good");
    const stubs = msgs.filter((_, i) => isStub(msgs, i)).length;
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
    const postSale = POST_SALE.has(stageCode);
    if (silenceD >= SILENCE_BAD_D) add(`Тишина ${silenceD} дн`, "deadline", postSale ? "warn" : "bad");
    else if (silenceD >= SILENCE_WARN_D) add(`Пауза ${silenceD} дн`, "deadline", "warn");
    // 4. Вежливость
    if (outs.length && RE.hello.test(outText)) add("Приветствие и обращение", "polite", "good");
    else if (outs.length >= 2) add("Без приветствия", "polite", "warn");
    if (RE.jargon.test(outText) && !RE.apology.test(outText)) add("Жаргон вместо извинения", "polite", "bad");
    if (RE.defense.test(outText)) add("Защита вместо извинения", "polite", "bad");
    if (RE.apology.test(outText) || RE.thanks.test(outText)) add("Этикет соблюдён", "polite", "good");
    // 5. Ведение по регламенту
    if (nextStep) add("Следующий шаг зафиксирован", "process", "good");
    else add("Нет следующего шага", "process", "bad");
    if (RE.kp.test(outText)) add("КП отправлено", "process", "good");
    if (stageCode === "C49:PREPAYMENT_INVOIC" && silenceD >= SILENCE_WARN_D) add("После КП нет дожима", "process", "bad");
    if (stageDays > 21) add(`На стадии ${stageDays} дн`, "process", "bad");
    if (ghostMove) add(`Стадия двигалась ${movedDays.length} раз, касаний в CRM нет`, "process", "bad");
    if (internalOnly) add(`Нет следов общения в CRM: только ${internalKinds}`, "process", "bad");
    if (taskNoContact) add(`Дел закрыто без контакта: ${taskNoContact}`, "process", "bad");
    if (promiseBroken) add(`Обещал и не сделал: ${promiseBroken}`, "deadline", "bad");
    else if (promiseKept) add(`Обещания выполнены: ${promiseKept}`, "deadline", "good");
    if (vagueProm) add(`Обещаний без срока: ${vagueProm}`, "deadline", "bad");
    if (calls) add(`Звонков: ${calls}`, "process", "good");
    // 6. Результат
    if (RE.ready.test(inText)) add("Сигнал готовности к оплате", "result", "good");
    if (objTotal) add(objWorked >= objTotal ? `Возражения отработаны аргументом: ${objWorked}` : `Возражение без контраргумента: ${objTotal - objWorked} из ${objTotal}`, "result", objWorked >= objTotal ? "good" : "bad");
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
    if (silenceD >= SILENCE_BAD_D) push(`тишина ${silenceD} дн`, postSale ? 0.9 : 0.6);
    else if (silenceD >= SILENCE_WARN_D) push(`пауза ${silenceD} дн`, postSale ? 0.95 : 0.85);
    if (!nextStep) push("нет следующего шага", 0.85);
    if (overdue) push(`дело просрочено на ${overdueD} дн`, 0.85);
    if (objTotal && objWorked < objTotal) push(`возражение без контраргумента (${objTotal - objWorked})`, 0.8);
    else if (objTotal) push("возражение отработано аргументом", 1.05);
    if (RE.refuse.test(inText)) push("клиент говорит об отказе", 0.5);
    if (ghostMove) push("стадия двигалась, касаний в CRM нет", 0.7);
    else if (internalOnly) push("нет следов общения в CRM", 0.75);
    if (promiseBroken) push(`обещал и не сделал: ${promiseBroken}`, promiseBroken > 1 ? 0.7 : 0.8);
    else if (vagueProm > 1) push(`обещания без срока: ${vagueProm}`, 0.9);
    if (taskNoContact) push(`дел закрыто без контакта: ${taskNoContact}`, taskNoContact > 1 ? 0.75 : 0.85);
    if (a && typeof a.probDelta === "number") push(`оценка ИИ: ${a.verdict || "разбор"}`, Math.max(0.5, Math.min(1.4, 1 + a.probDelta / 100)));
    let prob = base; for (const x of factors) prob *= x.mult;
    prob = Math.max(0.03, Math.min(0.97, prob));
    // Почему шанс такой: вклад каждой причины в процентных пунктах и в рублях.
    // Вклад считаем как разницу «без этой причины» и «с ней», при остальных неизменных.
    const moneyBase = (f && f.budget) ? f.budget : 0;
    const whyProb: { label: string; pp: number; rub: number; bad: boolean; who: string }[] = [];
    for (const x of factors) {
      const without = Math.max(0.03, Math.min(0.97, prob / x.mult));
      const pp = Math.round((prob - without) * 100);
      if (!pp) continue;
      whyProb.push({ label: x.label, pp, rub: Math.round(moneyBase * (prob - without)), bad: x.mult < 1, who: last.mgr || "" });
    }
    whyProb.sort((a, b) => a.pp - b.pp);

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

    // --- Срочность: что именно горит и насколько [ГИПОТЕЗА - калибровка] ---
    // Порядок важен: берём первую сработавшую причину, она же показывается в очереди.
    const urg: [string, number, string][] = [
      [RE.ready.test(inText) ? "Готов к оплате" : "", 1.0, "ready"],
      [ballWait > BALL_STUCK_MIN ? `Клиент ждёт ${fmtMin(ballWait)}` : "", 0.9, "waiting"],
      [RE.refuse.test(inText) ? "Риск отказа" : "", 0.85, "refuse"],
      [objTotal > objWorked ? `Возражение без контраргумента (${objTotal - objWorked})` : "", 0.7, "objection"],
      [silenceD >= SILENCE_BAD_D + 2 ? `Тишина ${silenceD} дн` : "", 0.65, "silent"],
      [stageCode === "C49:PREPAYMENT_INVOIC" && silenceD >= SILENCE_WARN_D ? "После КП нет дожима" : "", 0.6, "nopush"],
      [silenceD >= SILENCE_BAD_D ? `Тишина ${silenceD} дн` : "", 0.5, "silent"],
      [overdue ? `Дело просрочено ${overdueD} дн` : "", 0.45, "overdue"],
      [promiseBroken ? `Обещал и не сделал (${promiseBroken})` : "", 0.7, "promise"],
      [taskNoContact ? `Дело закрыто, клиенту не написали (${taskNoContact})` : "", 0.6, "fakedone"],
      [internalOnly ? "Нет следов общения в CRM" : "", 0.55, "internal"],
      [!nextStep ? "Нет следующего шага" : "", 0.4, "nostep"],
    ].filter((x) => x[0]) as [string, number, string][];
    const urgency = urg.length ? urg[0]![0] : "";
    const uw = urg.length ? urg[0]![1] : 0.1;
    const uKey = urg.length ? urg[0]![2] : "ok";
    // Приоритет = деньги под риском: сумма x шанс закрыть x вес срочности.
    // Сделки без суммы не проваливаются в конец: берём медиану бюджета как ориентир.
    const money = (f && f.budget) ? f.budget : 0;
    const prio = Math.round((money || 60000) * (prob) * uw);

    deals.push({
      key, dealId, leadId, isLead: !dealId, urgency, uKey, uw, prio, evTags, participants,
      title: last.dealT || last.leadT || key, mgr: last.mgr || "(не указан)",
      stage: f ? f.stage : "", stageCode, budget: f ? f.budget : 0,
      prob: Math.round(prob * 100), base: Math.round(base * 100), factors, tags, next, why, whyProb, stageRows, slowStage, owners, takeH, ghostMove, movedDays, internalOnly, internalKinds, taskNoContact, promiseBroken, promiseKept, vagueProm, promises, objTotal, objWorked,
      ai: a ? { verdict: a.verdict, politeness: a.politeness, regulation: a.regulation, deadlines: a.deadlines, quotes: a.quotes } : null,
      msgs: msgs.length, calls, respMed, firstResp, ballWait, silenceD, overdueD, nextStep, stageDays,
      lastTs: last.ts, lastDt: last.dt,
    });
  }

  // ===== ДОСЬЕ РОПа: кто сильный и почему, кто слабый и что чинить =====
  // Каждая метрика сравнивается с медианой отдела: сильная сторона это не «хорошо вообще»,
  // а «заметно лучше коллег на сопоставимой выборке». Ниже порога выборки не судим.
  const METRICS = [
    { key: "resp", label: "скорость ответа", unit: "мин", better: "less",
      calc: (ds: any[]) => med(ds.map((d) => d.respMed).filter((x) => x !== null) as number[]),
      good: (v: number) => `отвечает клиенту за ${v} мин`, bad: (v: number) => `отвечает за ${fmtMin(v)}` },
    { key: "ball", label: "клиент ждёт ответа", unit: "%", better: "less",
      calc: (ds: any[]) => Math.round(ds.filter((d) => d.ballWait > BALL_STUCK_MIN).length / ds.length * 100),
      good: (v: number) => `почти не оставляет клиентов без ответа (${v}%)`, bad: (v: number) => `${v}% сделок ждут ответа` },
    { key: "silent", label: "тишина 4+ дней", unit: "%", better: "less",
      calc: (ds: any[]) => Math.round(ds.filter((d) => d.silenceD >= SILENCE_BAD_D).length / ds.length * 100),
      good: (v: number) => `держит регулярный контакт, тишина только в ${v}% сделок`, bad: (v: number) => `${v}% сделок молчат 4 дня и дольше` },
    { key: "step", label: "следующий шаг", unit: "%", better: "more",
      calc: (ds: any[]) => Math.round(ds.filter((d) => d.nextStep).length / ds.length * 100),
      good: (v: number) => `следующий шаг стоит в ${v}% сделок`, bad: (v: number) => `следующий шаг есть только в ${v}% сделок` },
    { key: "qual", label: "квалификация", unit: "%", better: "more",
      calc: (ds: any[]) => { const e = ds.filter((d) => EARLY.has(d.stageCode) || !d.stageCode); return e.length >= 3 ? Math.round(e.filter((d) => d.tags.some((t: Tag) => t.sec === "qual" && t.tone === "good")).length / e.length * 100) : null; },
      good: (v: number) => `собирает ТЗ, срок и бюджет в ${v}% ранних сделок`, bad: (v: number) => `квалификация собрана лишь в ${v}% ранних сделок` },
    { key: "fake", label: "дела вхолостую", unit: "шт", better: "less",
      calc: (ds: any[]) => ds.reduce((a: number, d: any) => a + (d.taskNoContact || 0), 0),
      good: () => `закрывает дела только после разговора с клиентом`, bad: (v: number) => `${v} дел закрыто без контакта с клиентом` },
    { key: "ghost", label: "движение без общения", unit: "шт", better: "less",
      calc: (ds: any[]) => ds.filter((d) => d.ghostMove || d.internalOnly).length,
      good: () => `не двигает сделки в тишине`, bad: (v: number) => `${v} сделок двигались без единого слова клиенту` },
    { key: "promise", label: "держит слово", unit: "%", better: "more",
      calc: (ds: any[]) => { const p = ds.filter((d) => (d.promiseBroken || 0) + (d.promiseKept || 0) + (d.vagueProm || 0) > 0);
        if (p.length < 3) return null;
        const k = p.reduce((a, d) => a + (d.promiseKept || 0), 0);
        const b = p.reduce((a, d) => a + (d.promiseBroken || 0) + (d.vagueProm || 0), 0);
        return k + b ? Math.round(k / (k + b) * 100) : null; },
      good: (v: number) => `держит слово: ${v}% обещаний с датой и выполнены`, bad: (v: number) => `только ${v}% обещаний с датой и выполнены` },
    // Возражений за неделю мало (десятки на отдел), поэтому считаем не долю, а штуки:
    // процент на выборке из двух возражений - это не оценка человека.
    // Дата создания в снимке хранится без времени, поэтому отсчёт идёт от начала рабочего
    // дня создания. Для сравнения менеджеров между собой этого достаточно, для SLA в часах - нет.
    { key: "take", label: "взял в работу", unit: "ч", better: "less",
      calc: (ds: any[]) => { const v = ds.map((d) => d.takeH).filter((x) => x !== null && x !== undefined) as number[];
        return v.length >= 3 ? med(v) : null; },
      good: (v: number) => `берёт сделку в работу за ${v} ч`, bad: (v: number) => `первое слово клиенту через ${v} ч после создания сделки` },
    { key: "obj", label: "возражение без аргумента", unit: "шт", better: "less",
      calc: (ds: any[]) => ds.reduce((a: number, d: any) => a + Math.max(0, (d.objTotal || 0) - (d.objWorked || 0)), 0),
      good: () => `на возражение клиента отвечает аргументом, а не уступкой`, bad: (v: number) => `${v} возражений закрыты без аргумента: молчание, «хорошо» или скидка` },
    { key: "date", label: "конкретные сроки", unit: "%", better: "more",
      calc: (ds: any[]) => Math.round(ds.filter((d) => d.tags.some((t: Tag) => t.t === "Называет конкретные даты")).length / ds.length * 100),
      good: (v: number) => `называет клиенту конкретные даты в ${v}% сделок`, bad: (v: number) => `конкретные даты только в ${v}% сделок` },
  ];
  const dealsByMgr: Record<string, any[]> = {};
  for (const d of deals) (dealsByMgr[d.mgr] ||= []).push(d);
  const scored = Object.entries(dealsByMgr).filter(([m, ds]) => !isHidden(m, fired) && ds.length >= MIN_SAMPLE);
  const dept: Record<string, number | null> = {};
  for (const mt of METRICS) {
    const vals = scored.map(([, ds]) => mt.calc(ds)).filter((v) => v !== null && !isNaN(v as number)) as number[];
    dept[mt.key] = vals.length ? med(vals) : null;
  }
  const profile: Record<string, any> = {};
  for (const [mgr, ds] of scored) {
    const strengths: any[] = [], weaknesses: any[] = [];
    for (const mt of METRICS) {
      const v = mt.calc(ds); const dv = dept[mt.key];
      if (v === null || v === undefined || dv === null || dv === undefined || isNaN(v)) continue;
      const better = mt.better === "less" ? v < dv : v > dv;
      const gap = dv === 0 ? (v === 0 ? 0 : 100) : Math.round(Math.abs(v - dv) / Math.max(Math.abs(dv), 1) * 100);
      const item = { key: mt.key, label: mt.label, v, dept: dv, gap, text: better ? mt.good(v) : mt.bad(v) };
      if (better && gap >= 20) strengths.push(item);
      else if (!better && gap >= 20) weaknesses.push(item);
    }
    strengths.sort((a, b) => b.gap - a.gap); weaknesses.sort((a, b) => b.gap - a.gap);
    // Что чинить: конкретные списки сделок под каждую слабость, с деньгами.
    const pick = (f: (d: any) => boolean, title: string, how: string) => {
      const list = ds.filter(f).sort((a, b) => (b.budget || 0) - (a.budget || 0));
      if (!list.length) return null;
      return { title, how, n: list.length, money: list.reduce((a, d) => a + (d.budget || 0), 0),
               ids: list.slice(0, 5).map((d) => ({ id: d.dealId || d.leadId, t: d.title.slice(0, 40), b: d.budget || 0 })) };
    };
    const actions = [
      pick((d) => d.ballWait > BALL_STUCK_MIN, "Ответить сегодня", "Клиент написал последним и ждёт дольше 4 часов"),
      pick((d) => (d.promiseBroken || 0) + (d.vagueProm || 0) > 0, "Вернуть долги по обещаниям", "Менеджер обещал прислать или перезвонить: срок прошёл либо не был назван вовсе. Написать, дать конкретную дату и выполнить"),
      pick((d) => d.taskNoContact > 0, "Закрыть дела по-настоящему", "Дело отмечено выполненным, а разговора с клиентом после него нет"),
      pick((d) => d.silenceD >= SILENCE_BAD_D && !POST_SALE.has(d.stageCode), "Разбудить молчащие", "Нет касаний 4 дня и больше: написать с новым поводом и назначить дату следующего контакта"),
      pick((d) => d.stageCode === "C49:PREPAYMENT_INVOIC" && d.silenceD >= SILENCE_WARN_D, "Дожать после КП", "КП отправлено, ответа нет: позвонить и спросить решение"),
      pick((d) => (d.objTotal || 0) > (d.objWorked || 0), "Вернуться к возражению", "Клиент назвал причину сомнения - цену, срок, сравнение с другими. В ответе аргумента не было. Вернуться с расчётом разницы или альтернативой, а не со скидкой"),
      pick((d) => !d.nextStep, "Поставить следующий шаг", "В CRM нет открытого дела: сделка выпадает из работы"),
    ].filter(Boolean);
    // Сырые значения метрик - для табличного вида: сортировать и сравнивать в столбцах.
    const metrics: Record<string, number | null> = {};
    for (const mt of METRICS) { const v = mt.calc(ds); metrics[mt.key] = (v === null || v === undefined || isNaN(v)) ? null : v; }
    const hotMoney = ds.filter((d) => d.urgency).reduce((a, d) => a + (d.budget || 0), 0);
    const verdict = weaknesses.length === 0 ? "сильный" : (strengths.length > weaknesses.length ? "норма" : (weaknesses.length >= 3 ? "в разборе" : "норма"));
    profile[mgr] = { strengths, weaknesses, actions, hotMoney, verdict, metrics };
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
    // Цена ошибок: сколько рублей потенциала съели дефекты в сделках этого менеджера.
    const lossBy: Record<string, number> = {};
    let lossRub = 0;
    for (const d of ds) for (const w of (d.whyProb || [])) {
      if (!w.bad) continue;
      lossRub += -w.rub;
      const k = w.label.replace(/\s*\([^)]*\)/, "").replace(/\d+/g, "N");
      lossBy[k] = (lossBy[k] || 0) + -w.rub;
    }
    const topLoss = Object.entries(lossBy).sort((a, b) => b[1] - a[1])[0];
    return {
      mgr, deals: ds.length, rating, sections,
      lossRub: Math.round(lossRub),
      lossPerDeal: Math.round(lossRub / Math.max(ds.length, 1)),
      topLoss: topLoss ? { label: topLoss[0], rub: Math.round(topLoss[1]) } : null,
      ghost: ds.filter((d) => d.ghostMove).length,
      profile: profile[mgr] || null,
      internal: ds.filter((d) => d.internalOnly).length,
      fakedone: ds.reduce((s2, d) => s2 + (d.taskNoContact || 0), 0),
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

  const QUEUES = [
    { key: "waiting", label: "Ждут ответа", hint: "Последним написал клиент, ответа нет дольше 4 рабочих часов" },
    { key: "ready", label: "Готовы к оплате", hint: "Клиент сам заговорил про счёт, оплату или реквизиты" },
    { key: "silent", label: "Тишина", hint: "Ни одного касания 4 дня и дольше" },
    { key: "nostep", label: "Без следующего шага", hint: "В CRM не назначено ни одного открытого дела" },
    { key: "refuse", label: "Риск отказа", hint: "В переписке прозвучал отказ или «не актуально»" },
    { key: "nopush", label: "КП без дожима", hint: "КП отправлено, но после него тишина" },
    { key: "promise", label: "Обещал и не сделал", hint: "Менеджер назвал клиенту срок («отправлю сегодня», «пришлю завтра»), срок прошёл, ничего не ушло" },
    { key: "fakedone", label: "Дела закрыты вхолостую", hint: "Дело вида «связаться с клиентом» или «отправь КП» отмечено выполненным, но контакта с клиентом в CRM после него нет" },
    { key: "internal", label: "Нет следов общения", hint: "За окно есть только дела, заметки и задачи. Внимание: звонок с личного телефона мимо телефонии система не видит, поэтому это повод спросить, а не обвинение" },
  ].map((q) => ({ ...q, n: deals.filter((d) => d.uKey === q.key).length,
                  money: deals.filter((d) => d.uKey === q.key).reduce((s2, d) => s2 + (d.budget || 0), 0) }));

  dlg.scoring = {
    queues: QUEUES,
    trend: days.slice(-14),
    calibratedAt: CALIBRATED_AT, baseFallback: Math.round(BASE_FALLBACK * 100), baseRates: BASE_RATES,
    sections: SECTIONS, minSample: MIN_SAMPLE, aiReviews: Object.keys(ai).length,
    thresholds: { FIRST_ANSWER_MIN, FAST_ANSWER_MIN, SLOW_ANSWER_MIN, BALL_STUCK_MIN, SILENCE_WARN_D, SILENCE_BAD_D, OVERDUE_GRACE_D },
    deptMedians: dept, metricDefs: METRICS.map((m) => ({ key: m.key, label: m.label, unit: m.unit, better: m.better })), tagIndex, deals: deals.sort((a, b) => b.prob - a.prob), managers,
    hiddenMgr: hiddenMgr.sort((a, b) => b.deals - a.deals),
  };
  writeFileSync(OWN, JSON.stringify(ownDb));
  writeFileSync(DLG, JSON.stringify(dlg));
  console.log(`Разбор: диалогов ${deals.length}, менеджеров ${managers.length}, тегов ${Object.keys(tagIndex).length}`);
  for (const m of managers.filter((x) => x.rating !== null)) console.log(`   ${m.rating} ★  ${m.mgr} - ${m.deals} диал · ${m.sections.map((s) => s.label + " " + (s.pos ?? "-") + "%").join(" · ")}`);
}
main();
