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
import { isHidden, OFFICE_MGR } from "./mgr-roster.js";

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

// Старт градусника. Решение Ивана 2026-09-22: новая сделка = 10 градусов всем, дальше рост -
// заслуга менеджера. Раньше точкой отсчёта была база стадии входа, и сделка, зашедшая на
// «Расчёт», стартовала с 75 градусов и могла только падать, а менеджер выглядел виноватым
// за чужой хороший вход. 10 согласуется с методикой sales-director: вес прогноза у «Новой
// сделки» 0.05, у «Квалификации» 0.10.
const ENTRY_TEMP = 10;

// Порядок стадий воронки C49 - с канбана Bitrix24 (снимок Ивана 2026-09-22), а не из догадки.
// Нужен только для фактора stage_up: переход в стадию с большим номером = движение вперёд.
// «Долгострой» намеренно ВНЕ лестницы: по канбану он стоит после «Принимают решение», но
// движением вперёд не является - из дошедших до него закрытых сделок выиграно 4% (n=51).
// «Квалификация» на канбане не показана, но в данных живёт (n=963), держим её вторым шагом.
const STAGE_ORDER: Record<string, number> = {
  "C49:NEW": 1, "C49:UC_LRFLH9": 2, "C49:PREPARATION": 3, "C49:UC_OGZUU0": 4,
  "C49:PREPAYMENT_INVOIC": 5, "C49:3": 6, "C49:EXECUTING": 7,
  "C49:FINAL_INVOICE": 8, "C49:1": 9, "C49:2": 10,
};
// [ДАННЫЕ: rop.json 2026-09-22, 1555 закрытых C49 с created >= 2026-04-01]
// P(выиграл | дошёл до стадии): Новая 21% (n=1498), Квалификация 20% (n=963), Формирование ТЗ
// 22% (n=505), Расчёт 70% (n=375), КП отправлено 21% (n=767), Принимают решение 34% (n=183),
// Долгострой 4% (n=51), Предоплата 95% (n=323). Шанс по воронке НЕ растёт монотонно: отправка
// КП не двигает вероятность (21% против 21% у новой сделки), а реально делит воронку «Расчёт».
// Поэтому градусник к этой лестнице не привязан, старт у всех 10°, а stage_up меряет
// продвижение по ПОРЯДКУ стадий. Вопрос «почему КП не работает» вынесен Ивану и РОПу.
const STAGE_UP_DAYS = 21;

// ПЕРЕЕЗД С AMOCRM. В марте 2026 в Bitrix перенесли 21 465 сделок, и все легли на те же стадии,
// что были в амо [ДАННЫЕ: rop.json 2026-09-22, created по месяцам - март 21465, апрель 418,
// май 320, июнь 302, июль 351, август 391, сентябрь 313]. У этих сделок нет честной истории:
// стадия проставлена импортом, а не работой менеджера. Их нельзя пускать ни в калибровку весов,
// ни в «силу нагрева». Решение Ивана: анализируем только то, что родилось после переезда.
// Эффект загрязнения [ДАННЫЕ]: в калибровке весов 583 переехавших из 2123 закрытых (27%),
// и у них win-rate 30% против 22% у живых, то есть они тянут отношения вверх.
const MIGRATION_CUTOFF = "2026-04-01";
const CALIBRATED_AT = "2026-08-17";

// --- Градусник температуры клиента ---
// Температура = вероятность покупки в моменте (0-100°), откалибрована на реальных исходах
// (база стадии - [ДАННЫЕ], поведение двигает её - [ГИПОТЕЗА]). Структурная температура стадии
// = её эмпирическая доля выигранных. Ведём её отдельно, чтобы строить кривую нагрева по стадиям.
const stageTemp = (code: string) => Math.round((BASE_RATES[code]?.win ?? BASE_FALLBACK) * 100);
const tempBucket = (t: number) => t >= 80 ? "boiling" : t >= 50 ? "hot" : t >= 25 ? "warm" : "cold";
const TEMP_LABEL: Record<string, string> = { cold: "Холодный", warm: "Тёплый", hot: "Горячий", boiling: "Кипит" };

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
// Ростер отдела продаж (кого показываем и оцениваем) вынесен в mgr-roster.ts:
// тот же список читает выгрузка очереди на разбор, чтобы люди не расходились.

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

  const aiFile: any = existsSync(AIF) ? JSON.parse(readFileSync(AIF, "utf8")) : {};
  const ai: Record<string, any> = aiFile.reviews || {};
  const aiMgr: Record<string, any> = aiFile.managers || {};   // разбор ИИ на уровне менеджера
  if (Object.keys(ai).length) console.log(`Слой ИИ: разборов ${Object.keys(ai).length}, менеджеров ${Object.keys(aiMgr).length}`);

  // Офис-менеджер: работа с лидами под системным пользователем - это Турченко Анна
  // (решение Ивана). Событиям ЧИСТЫХ лидов (без сделки) с владельцем-системой ставим Аню,
  // чтобы её лид-интейк был виден отдельной строкой, а не терялся в «роботе портала».
  const isSysUser = (m: string) => /^Системный пользователь/i.test(m || "") || /^\d+$/.test(m || "");
  let annaLeadEv = 0;
  for (const e of events) if (!e.dealId && isSysUser(e.mgr || "")) { e.mgr = OFFICE_MGR; annaLeadEv++; }
  if (annaLeadEv) console.log(`Лид-события системного пользователя отнесены на ${OFFICE_MGR}: ${annaLeadEv}`);

  // Джойн лид->сделка. События, оставшиеся физически на лиде (dealId пуст, есть только leadId),
  // вливаем в ленту конвертированной сделки. Обратный индекс строим из событий самой сделки:
  // они несут leadId (из dealSrcLead при выгрузке), поэтому маппинг leadId->dealId самодостаточен.
  // Без этого полнота коммуникаций сделки-из-лида ложно = 0 (переписка висит на лиде-первоисточнике).
  const leadToDeal: Record<string, string> = {};
  for (const e of events) if (e.dealId && e.leadId) leadToDeal[e.leadId] = e.dealId;
  const groupKey = (e: Ev): string =>
    e.dealId ? "D" + e.dealId
      : e.leadId && leadToDeal[e.leadId] ? "D" + leadToDeal[e.leadId]
      : "L" + e.leadId;
  const byKey: Record<string, Ev[]> = {};
  for (const e of events) (byKey[groupKey(e)] ||= []).push(e);

  const deals: any[] = [];
  for (const [key, evs] of Object.entries(byKey)) {
    evs.sort((a, b) => a.ts - b.ts);
    const last = evs[evs.length - 1]!;
    // dealId/leadId берём из ключа группы, а не из last: last может оказаться лид-событием
    // (dealId пуст), влитым в группу сделки - тогда сделка ложно прочиталась бы как лид.
    const isDeal = key[0] === "D";
    const dealId = isDeal ? key.slice(1) : "";
    const leadId = isDeal ? (evs.find((e) => e.leadId)?.leadId || "") : key.slice(1);
    const f = dealId ? facts[dealId] : null;
    // Закрытые сделки (успех/отказ) раньше пропускались. Теперь оставляем - ИИ учится на
    // исходах, а в дашборде видны стадии «Сделка успешна/провалена». Из рейтинга и медиан
    // отдела они исключаются ниже (dealsByMgr), чтобы не искажать оценку текущей дисциплины.
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
    // Тишина считается по РАЗГОВОРУ с клиентом, а не по любой активности в карточке.
    // Раньше отсчёт шёл от последнего события вообще, и автоматическое дело, заметка или
    // смена стадии обнуляли счётчик: сделка без единого слова 150 дней показывала «тишины
    // нет». Правило Ивана: идут дела автоматические или от сотрудника, а коммуникаций нет -
    // это сигнал к остыванию. Разговор - сообщение, письмо, открытая линия, звонок.
    const talks = evs.filter((e) => isMsg(e) || e.type === "Звонок");
    const lastTalk = talks.length ? talks[talks.length - 1]! : null;
    // Разговора не было ни разу - считаем от первого события: столько сделка живёт молча.
    const silenceD = Math.floor((now - (lastTalk ? lastTalk.ts : evs[0]!.ts)) / 864e5);
    const noTalk = !lastTalk;
    // Последняя активность любого рода. Нужна в карточке, чтобы менеджер видел разницу
    // между «в сделке ничего не происходит» и «дела идут, а клиенту не написали».
    const silenceAnyD = Math.floor((now - last.ts) / 864e5);
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
    const evTags: Record<string, { t: string; tone: string; sec: string; quote: string; ai?: boolean; deg?: number }[]> = {};
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

    // Состав ленты: чем сделка наполнена. Нужен для быстрого взгляда - где разговор,
    // а где только внутренние дела. Мессенджеры считаем и штуками сообщений, и числом
    // каналов: три сообщения в одном чате и три разных канала - разные истории.
    const chans = new Set(msgs.filter((m) => m.type.startsWith("Сообщение")).map((m) => m.type.replace("Сообщение ", "")));
    const mix = {
      msg: msgs.filter((m) => m.type.startsWith("Сообщение") || m.type === "Мессенджер ОЛ").length,
      chan: chans.size,
      call: evs.filter((e) => e.type === "Звонок").length,
      mail: evs.filter((e) => e.type === "Письмо").length,
      task: evs.filter((e) => e.type === "Дело" || e.type === "Задача").length,
      note: evs.filter((e) => e.type === "Комментарий-заметка").length,
      ai: evs.filter((e) => e.type === "Резюме BitrixGPT").length,
      // Резюме BitrixGPT - разбор звонка, а не отдельная коммуникация: сам звонок уже
      // посчитан, поэтому в общий счёт ленты резюме не идёт.
      total: evs.filter((e) => e.type !== "Резюме BitrixGPT").length,
    };
    const firstTs = evs.length ? evs[0]!.ts : 0;
    const createdAt = f && f.created ? String(f.created).slice(0, 10) : "";

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
    const silLbl = noTalk ? `Разговора нет ${silenceD} дн` : silenceAnyD < silenceD - 1
      ? `Тишина ${silenceD} дн (дела идут, клиенту не пишут)` : `Тишина ${silenceD} дн`;
    if (silenceD >= SILENCE_BAD_D) add(silLbl, "deadline", postSale ? "warn" : "bad");
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
    // Теги ИИ по КОНКРЕТНЫМ сообщениям: вешаем на нужную реплику (evTags[src]) с цитатой -
    // в ленте видно, какая именно фраза греет или холодит сделку.
    if (a && Array.isArray(a.msgTags)) for (const t of a.msgTags) { if (t && t.src) (evTags[t.src] ||= []).push({ t: String(t.t || ""), tone: t.tone || "warn", sec: "process", quote: t.quote || "", ai: true, deg: typeof t.deg === "number" ? t.deg : undefined }); }

    // --- НОВЫЕ ПОВЕДЕНЧЕСКИЕ СИГНАЛЫ (item 2) ------------------------------------
    // Инициатива: клиент ТЯНЕТ САМ. Два входящих подряд (ответа менеджера между ними нет) -
    // это НАПОМИНАНИЕ только если между ними прошло ощутимое ожидание. Иначе это пачка бабблов
    // Telegram/MAX (одно логическое сообщение в 3-4 строки), а не re-ping (ФЕНИКС L1: 88%
    // срабатываний были <15 мин - штрафовать за них нельзя). Порог = окно «мяча» (4 раб.часа).
    const CHASE_MIN = BALL_STUCK_MIN;
    let clientChase = 0;
    for (let i = 1; i < msgs.length; i++) {
      if (msgs[i]!.dir === "входящее" && msgs[i - 1]!.dir === "входящее"
          && workMinutes(msgs[i - 1]!.ts, msgs[i]!.ts) >= CHASE_MIN) {
        clientChase++;
        // Метим только последнее в пачке. Тон warn (не bad) + «повод спросить»: клиент мог
        // напоминать по своей причине - это сигнал разобраться, а не обвинение менеджеру.
        if (msgs[i]!.src && !(msgs[i + 1] && msgs[i + 1]!.dir === "входящее"))
          mark(msgs[i]!.src!, "Клиент напоминает сам (повод спросить)", "warn", "speed");
      }
    }
    // Латентность на ГОРЯЧЕЙ реплике: запрос про оплату/наличие/сроки/склад/готовность/реквизиты
    // требует мгновенного ответа. 2 дня молчания на «зеркало в наличии?» убивают сделку вернее
    // медленной медианы (сделка 100633). RE.ready ловит только платёж, поэтому отдельный RE_HOT
    // покрывает и наличие/сроки/готовность/отгрузку (ФЕНИКС L2: было 345 таких сигналов мимо).
    // ФЕНИКС gap 3. «есть ли» убрано: разбор 14 случайных из 111 потерянных реплик показал горячими
    // только 2-3 («есть ли у вас столы 120 на 60»), остальное - фото, шоу-рум, ЭДО, чертёж, «есть ли
    // новости» (последнее и так ловит client_chase). Это осознанный размен точности на полноту,
    // а не снятие сплошь ложных срабатываний: ~20% настоящих вопросов о наличии теряется.
    //
    // Счёт: гард закрывает ТОЛЬКО идиомы «за счёт» и «насчёт / на счёт» (30 реплик из 1044).
    // Прошлая версия гарда была `(?<![а-яё])` и глушила 438 реплик, в том числе 408 законных:
    // «А где расчет?», «ждать ли нам просчет», «расчет так и не прислали с апреля». Просьба о
    // расчёте - это и есть горячая реплика, ради которой RE_HOT существует (ФЕНИКС iter3, A6).
    // Гард закрыт по КЛАССУ, а не по двум примерам (проба A4 раунда 2 была FAIL): [\s\u200b-]*
    // держит «за  счет», «за\nсчет», «засчет» слитно, «за-счет», ZWSP; `нас` ловит опечатку
    // «нассчет». «на счет» раздельно НЕ глушим: там живут «пришлю заявку на счёт» и
    // «нужна счет-фактура». Батарея 25 строк проходит 25 из 25, в корпусе гард снимает
    // 31 реплику и все 31 - идиомы (за счёт 15, насчёт 16), побочных нет.
    // «ускор» добавлено намеренно: это компенсация регрессии, а не расширение скоупа. Просьбу
    // «есть ли вариант как-то ускорить?» раньше ловило «есть ли», и ФЕНИКС назвал её потерю
    // настоящим промахом. Альтернатива точная: 11 из 12 живых реплик - просьба ускорить
    // производство, монтаж, изготовление. Сигнал получают 26 сделок, замер приложен в методичке.
    // «есть ли информаци» - вторая компенсация того же удаления «есть ли». ФЕНИКС разобрал сделку
    // 98107 (единственная в потолке 97%): её снятый сигнал - «не привезли все части зеркального
    // панно ... Есть ли информация по этому вопросу?», то есть настоящая эскалация по недопоставке.
    // Альтернатива узкая и чистая: 6 реплик в корпусе, все 6 - запрос статуса («есть ли информация
    // по готовности стола», «по дате»). Класс жалоб «не привезли» НЕ добавляем: 18 новых реплик
    // при смешанной точности, это отдельная механика и отдельное решение.
    const RE_HOT = /(в наличии|на складе|когда готов|какие сроки|срок[аи]\b|когда будет|сколько ждать|когда отправ|отгруз|реквизит|выставите сч|(?<!за[\s\u200b-]*)(?<!нас)(?<!на)сч[её]т|оплат|договор|когда монтаж|дата монтаж|ускор|есть ли информаци)/i;
    // Машинная почта поставщиков падает в воронку лидами и получала обвинение «горячая реплика
    // без ответа» за 1600 часов: биллинг Манго Телеком про лицевой счёт проходил по слову «счет».
    // Отвечать там некому и нечего. Маркеры ищем ТОЛЬКО в теме и первых строках: в хвосте письма
    // лежат подпись и цитата, и по ним фильтр снимал живые заявки («прошу выставить счет на
    // ИНТЕРУМ ООО»). Это список, а не blanket по лидам: 12 из 16 лидов под обвинением - настоящие
    // входящие заявки («не могу оплатить заказ на сайте», «прошу подготовить КП»), глушить их
    // нельзя. Фильтр снимает 64 сущности, у всех бюджет 0, ни одного живого клиента.
    const RE_BLAST = /(mango[\s-]?office|манго телеком|коммерческое предложение от|предлагаем добавить ваш сайт|вы получили это письмо|если вы не хотите получать|отписаться от рассылки)/i;
    let hotSlow = false, hotFast = false, hotMax = 0, hotOpen = false;
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i]!; if (m.dir !== "входящее" || !RE_HOT.test(String(m.body || ""))) continue;
      if (RE_BLAST.test(String(m.body || "").slice(0, 160))) continue;
      const nxt = msgs.slice(i + 1).find((x) => x.dir === "исходящее" && isRealAnswer(x));
      const lat = nxt ? workMinutes(m.ts, nxt.ts) : workMinutes(m.ts, now);
      if (lat > hotMax) hotMax = lat;
      if (!nxt || lat > SLOW_ANSWER_MIN) {
        hotSlow = true;
        // На горячую реплику не ответили вовсе: тогда она же и есть текущий «мяч» (см. гейт ball ниже).
        if (!nxt) hotOpen = true;
        // ФЕНИКС gap 3, framing: тон по силе улики, как у client_chase. Не ответили совсем - дефект
        // (bad). Ответили, но позже 4 раб.ч - задержка, ответ клиент всё же получил (warn).
        if (m.src) mark(m.src, nxt ? `Поздний ответ на горячую реплику (${fmtMin(lat)})` : `Горячая реплика без ответа (${fmtMin(lat)})`,
          nxt ? "warn" : "bad", "speed", hit(RE_HOT, String(m.body || "")));
      }
      else if (lat <= FAST_ANSWER_MIN) hotFast = true;
    }

    // --- вероятность ---
    const base = BASE_RATES[stageCode]?.win ?? BASE_FALLBACK;
    // key нужен для калибровки весов на исходах (см. пост-цикловый блок calibrate()).
    const factors: { key: string; label: string; mult: number }[] = [];
    const push = (key: string, label: string, mult: number) => factors.push({ key, label, mult });
    if (RE.ready.test(inText)) push("ready", "клиент говорит об оплате", 1.3);
    // СИММЕТРИЯ. До этой правки поднять градус умели 4 фактора, опустить - 19, и на 611 сделках
    // со стадией срабатываний вниз было в 5.4 раза больше, чем вверх (медианный множитель 0.50).
    // Нормально ведомая сделка всё равно делилась пополам. Три сигнала ниже - про работу
    // менеджера, а не про возраст сделки, и они умеют греть.
    if (promiseKept > 0 && !promiseBroken) push("promise_kept", `обещания выполнены: ${promiseKept}`, 1.15);
    if (firstResp !== null && firstResp <= FIRST_ANSWER_MIN) push("first_fast", `первый ответ за ${fmtMin(firstResp)}`, 1.1);
    // Движение вперёд по воронке за последние 3 недели: сделка перешла в стадию с более высоким
    // эмпирическим шансом. Именно это «в руках менеджера», в отличие от того, где сделка зашла.
    if (stageRows.length >= 2) {
      const last2 = stageRows[stageRows.length - 1]!, prev2 = stageRows[stageRows.length - 2]!;
      const rNew = STAGE_ORDER[last2.code], rOld = STAGE_ORDER[prev2.code];
      // Бонус только если шаг вперёд И ПО КАНБАНУ, И по эмпирическому шансу. Одного канбана мало:
      // 86 из 280 срабатываний (31%) приходились на переходы, где шанс падает - 51 раз «ТЗ в КП»,
      // 27 раз «Расчёт в КП». Награждать за движение, снижающее вероятность, нельзя (ФЕНИКС G2).
      const wNew = BASE_RATES[last2.code]?.win ?? BASE_FALLBACK, wOld = BASE_RATES[prev2.code]?.win ?? BASE_FALLBACK;
      if (rNew != null && rOld != null && rNew > rOld && wNew >= wOld && (now - last2.ts) / 864e5 <= STAGE_UP_DAYS)
        push("stage_up", `продвинул стадию: ${prev2.name} -> ${last2.name}`, 1.15);
    }
    if (respMed !== null && respMed <= FAST_ANSWER_MIN) push("fast_resp", `быстрые ответы (${fmtMin(respMed)})`, 1.1);
    // Гасим общий «медленные ответы», если уже штрафуем за медленную ГОРЯЧУЮ реплику -
    // иначе одна задержка наказывается дважды (ФЕНИКС L4).
    if (respMed !== null && respMed > SLOW_ANSWER_MIN && !hotSlow) push("slow_resp", `медленные ответы (${fmtMin(respMed)})`, 0.8);
    // ФЕНИКС gap 1: «мяч» гасим, если горячая реплика висит вообще без ответа - физически это одна
    // и та же задержка, hot_slow её уже штрафует, иначе 0.6x0.7 за один дефект. Гейт именно на
    // hotOpen, а не на hotSlow: из 320 пересечений 271 - одна задержка, но в 49 сделках горячую
    // реплику ответили поздно, а потом клиент написал снова и ждёт сейчас. Это два разных дефекта,
    // оба остаются (при hotSlow без hotOpen ball продолжает начисляться).
    if (ballWait > BALL_STUCK_MIN && !hotOpen) push("ball", `клиент ждёт ${fmtMin(ballWait)}`, 0.7);
    // СЕМЬЯ «ДРЕЙФ»: тишина, отсутствие следующего шага, просрочка дела и обещания без срока -
    // это четыре описания одного и того же: сделкой не занимаются. Раньше они перемножались, и
    // просто старая сделка получала 0.6 x 0.85 x 0.85 x 0.9 = 0.39, то есть менеджер выглядел
    // виноватым за возраст. Берём ОДИН сильнейший сигнал, остальные показываем в подсказке.
    // Тот же принцип уже применён к паре slow_resp / hot_slow (ФЕНИКС L4).
    const drift: { key: string; label: string; mult: number }[] = [];
    if (silenceD >= SILENCE_BAD_D) drift.push({ key: postSale ? "silence_post" : "silence", label: `тишина ${silenceD} дн`, mult: postSale ? 0.9 : 0.6 });
    else if (silenceD >= SILENCE_WARN_D) drift.push({ key: postSale ? "pause_post" : "pause", label: `пауза ${silenceD} дн`, mult: postSale ? 0.95 : 0.85 });
    if (!nextStep) drift.push({ key: "nostep", label: "нет следующего шага", mult: 0.85 });
    if (overdue) drift.push({ key: "overdue", label: `дело просрочено на ${overdueD} дн`, mult: 0.85 });
    if (!promiseBroken && vagueProm > 1) drift.push({ key: "promise_vague", label: `обещания без срока: ${vagueProm}`, mult: 0.9 });
    let driftAlso: string[] = [];
    if (drift.length) {
      drift.sort((x, y) => x.mult - y.mult);
      const top = drift[0]!;
      driftAlso = drift.slice(1).map((x) => x.label);
      push(top.key, driftAlso.length ? `${top.label} (плюс: ${driftAlso.join(", ")})` : top.label, top.mult);
    }
    if (objTotal && objWorked < objTotal) push("obj_open", `возражение без контраргумента (${objTotal - objWorked})`, 0.8);
    else if (objTotal) push("obj_worked", "возражение отработано аргументом", 1.05);
    if (RE.refuse.test(inText)) push("refuse", "клиент говорит об отказе", 0.5);
    if (ghostMove) push("ghost", "стадия двигалась, касаний в CRM нет", 0.7);
    else if (internalOnly) push("internal", "нет следов общения в CRM", 0.75);
    else {
      // Слепая зона: касания есть, но видимой коммуникации с клиентом почти нет - лента
      // держится на системных делах/заметках. Не видно, с чем пришёл клиент, его боли,
      // возражения, как ведёт менеджер. По логике РОПа это риск: сделкой не управляют, она стынет.
      const commEv = mix.msg + mix.call + mix.mail, sysEv = mix.task + mix.note;
      const visShare = (commEv + sysEv) ? commEv / (commEv + sysEv) : 1;
      if (!postSale && (commEv + sysEv) >= 4 && visShare < 0.34)
        push("blind", "слепая зона: видимой коммуникации почти нет", commEv === 0 ? 0.7 : 0.82);
    }
    // promise_broken остаётся отдельным: «обещал и не сделал» это проверяемый факт, а не дрейф.
    // promise_vague ушёл в семью «дрейф» выше.
    if (promiseBroken) push("promise_broken", `обещал и не сделал: ${promiseBroken}`, promiseBroken > 1 ? 0.7 : 0.8);
    if (taskNoContact) push("fakedone", `дел закрыто без контакта: ${taskNoContact}`, taskNoContact > 1 ? 0.75 : 0.85);
    // item 2: новые факторы (дефолтные веса, чистая калибровка накопится логированием B;
    // приёмка: владелец Иван, дата проверки false-positive rate по calib-log +2 недели).
    if (hotSlow) push("hot_slow", `медленно на горячей реплике (${fmtMin(hotMax)})`, 0.6);
    else if (hotFast) push("hot_fast", "быстро на горячей реплике", 1.2);
    // clientChase - уже настоящие re-ping (порог ожидания). Мягкий вес: сигнал разобраться.
    if (clientChase >= 1) push("client_chase", `клиент напоминает сам (${clientChase})`, 0.85);
    // Оценка ИИ временно НЕ влияет на вероятность и температуру. Причина: ИИ-разбором покрыт
    // 361 диалог из 2406 (15%), причём неравномерно - Лысанова целиком, Лакомова наполовину,
    // остальные 29 менеджеров вообще нет. Множитель бил только по двум сотрудницам, и рейтинг
    // отдела по температуре получался следствием очереди прогона, а не работы людей.
    // Включать обратно, когда покрытие станет полным и пройдёт гейт ФЕНИКСА (вето 4.3, 23.09).
    const AI_PROB_ENABLED = false;
    if (AI_PROB_ENABLED && a && typeof a.probDelta === "number") push("ai", `оценка ИИ: ${a.verdict || "разбор"}`, Math.max(0.5, Math.min(1.4, 1 + a.probDelta / 100)));
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
      // Крупная сделка с низким шансом без острых проблем: не «в норме», а кандидат на дожим.
      // Порог по деньгам, чтобы не флудить мелочью; идёт последним - острые причины важнее.
      [prob < 0.25 && (f && f.budget ? f.budget : 0) >= 300000 ? `Шанс низкий (${Math.round(prob * 100)}%)` : "", 0.35, "lowprob"],
    ].filter((x) => x[0]) as [string, number, string][];
    // Закрытые сделки (успех/отказ) не «горят»: это исход, а не задача в очереди.
    const isWon = !!(f && f.won), isLost = !!(f && f.lost), isClosed = isWon || isLost;
    const urgency = isClosed ? "" : (urg.length ? urg[0]![0] : "");
    const uw = isClosed ? 0.05 : (urg.length ? urg[0]![1] : 0.1);
    const uKey = isWon ? "won" : isLost ? "lost" : (urg.length ? urg[0]![2] : "ok");
    // Приоритет = деньги под риском: сумма x шанс закрыть x вес срочности.
    // Сделки без суммы не проваливаются в конец: берём медиану бюджета как ориентир.
    const money = (f && f.budget) ? f.budget : 0;
    const prio = Math.round((money || 60000) * (prob) * uw);

    // --- ГРАДУСНИК: температура клиента = вероятность покупки в моменте (0-100°). Цель отдела -
    // довести до ПРЕДОПЛАТЫ; после неё (POST_SALE) сделка «в цеху», грев окончен -> goalReached.
    const temp = Math.round(prob * 100);
    const entryTemp = ENTRY_TEMP;   // старт один для всех, см. комментарий у ENTRY_TEMP
    const goalReached = POST_SALE.has(stageCode) || isWon;
    const tempDelta = temp - entryTemp;                 // путь сделки от старта, для карточки
    // ВКЛАД МЕНЕДЖЕРА = температура минус структурная температура ТЕКУЩЕЙ стадии.
    // Только он и годится для оценки человека. tempDelta при постоянном старте вырождается:
    // tempDelta = temp - 10 тождественно на всех 5050 строках, то есть «сила нагрева» по нему
    // была ранговой копией состава портфеля (Spearman с долей сделок на дорогих стадиях = 1.000).
    // Менеджер, которому достались сделки на «Расчёте», выигрывал столбец не работой, а входом.
    // heatLift этого не умеет: стадия из него вычтена, остаётся то, что добавило поведение.
    const heatLift = temp - stageTemp(stageCode);
    const tBucket = goalReached ? "goal" : tempBucket(temp);
    // Кривая нагрева: структурная температура по стадиям [ДАННЫЕ] + текущая точка с учётом поведения.
    const tempCurve: { d: string; t: number; n: string }[] = (stageRows as any[]).map((s) => ({ d: s.date, t: stageTemp(s.code), n: s.name }));
    tempCurve.push({ d: String(last.dt).slice(0, 10), t: temp, n: "сейчас" });
    // Чего не хватает до предоплаты: отрицательные факторы = что тянет температуру вниз, с ценой
    // в градусах (сколько вернём, если закрыть) и в рублях.
    const needToClose = (whyProb || []).filter((w) => w.bad)
      .map((w) => ({ label: w.label.replace(/\s*\([^)]*\)/, ""), deg: -w.pp, rub: -w.rub }))
      .sort((a, b) => b.deg - a.deg).slice(0, 5);

    deals.push({
      temp, entryTemp, tempDelta, heatLift, tempBucket: tBucket, goalReached, tempCurve, needToClose,
      key, dealId, leadId, isLead: !dealId, urgency, uKey, uw, prio, evTags, participants,
      title: last.dealT || last.leadT || key, mgr: last.mgr || "(не указан)",
      stage: f ? f.stage : "", stageCode, budget: f ? f.budget : 0,
      // Доп. сигналы сделки из снимка воронки: чек уже в budget, здесь тип клиента,
      // ассортимент, источник лида, бренд, цикл. Идут в ИИ-разбор и компактно в дашборд.
      client: f ? (f.client || "") : "", assort: f ? (f.assort || "") : "", source: f ? (f.source || "") : "",
      dir: f ? (f.dir || "") : "", cycle: f && f.cycle != null ? f.cycle : null, lossReason: f ? (f.reason || "") : "",
      won: isWon, lost: isLost, outcome: isWon ? "won" : isLost ? "lost" : "open",
      prob: Math.round(prob * 100), base: Math.round(base * 100), factors, tags, next, why, whyProb, mix, firstTs, createdAt, stageRows, slowStage, owners, takeH, ghostMove, movedDays, internalOnly, internalKinds, taskNoContact, promiseBroken, promiseKept, vagueProm, promises, objTotal, objWorked,
      ai: a ? { verdict: a.verdict || "", problem: a.problem || "", recommendation: a.recommendation || "", tone: a.tone || (a.problem ? "warn" : "good"), scores: a.scores || null, quotes: a.quotes || [], audit: a.audit || null } : null,
      msgs: msgs.length, calls, respMed, firstResp, ballWait, silenceD, silenceAnyD, noTalk, overdueD, nextStep, stageDays,
      preMig: !!createdAt && createdAt < MIGRATION_CUTOFF,
      clientChase, hotSlow, hotOpen, driftAlso, readySig: RE.ready.test(inText), refuseSig: RE.refuse.test(inText),
      lastTs: last.ts, lastDt: last.dt,
    });
  }

  // ===== КАЛИБРОВКА ВЕСОВ НА ИСХОДАХ (item 1, вариант A - осторожный) =====
  // Наивный obs/exp на терминальном срезе конфаундится прогрессом сделки: закрытые схлопнуты
  // в «успех/провал» (base=fallback), а «плохие» сигналы копятся на длинных активных сделках,
  // которые и так ближе к закрытию (проверено: «обещал и не сделал» наивно даёт вес 2.5).
  // Поэтому двигаем ТОЛЬКО направленно-устойчивые сигналы, с контролем по макс. достигнутой
  // стадии и предохранителями: направление залочено (плохой тег не >1, хороший не <1),
  // сдвиг к ручному дефолту 70/30, min-n>=50, кламп [0.3,1.6]. Остальное - логом B (ниже).
  const CAL_KEYS: Record<string, { def: number; bad: boolean }> = {
    slow_resp: { def: 0.8, bad: true }, refuse: { def: 0.5, bad: true }, ready: { def: 1.3, bad: false },
  };
  const stageWin = (code: string) => BASE_RATES[code]?.win ?? 0;
  const maxReached = (d: any) => { let b = 0; for (const r of (d.stageRows || [])) { const v = stageWin(r.code); if (v > b) b = v; } return b || BASE_FALLBACK; };
  const bucketOf = (x: number) => x < 0.3 ? 0 : x < 0.7 ? 1 : 2;
  // Только сделки, родившиеся после переезда: у переехавших стадия проставлена импортом.
  const closedC = deals.filter((d) => (d.outcome === "won" || d.outcome === "lost") && !d.preMig);
  const calibration: Record<string, any> = {};
  for (const key of Object.keys(CAL_KEYS)) {
    const def = CAL_KEYS[key]!.def, bad = CAL_KEYS[key]!.bad;
    const withK = closedC.filter((d) => (d.factors || []).some((f: any) => f.key === key));
    const woK = closedC.filter((d) => !(d.factors || []).some((f: any) => f.key === key));
    const nWith = withK.length;
    let ratioNum = 0, ratioDen = 0;
    for (let b = 0; b < 3; b++) {
      const w = withK.filter((d) => bucketOf(maxReached(d)) === b);
      const o = woK.filter((d) => bucketOf(maxReached(d)) === b);
      if (!w.length || !o.length) continue;
      const winW = w.filter((d) => d.outcome === "won").length / w.length;
      const winO = o.filter((d) => d.outcome === "won").length / o.length;
      if (winO <= 0) continue;
      ratioNum += (winW / winO) * w.length; ratioDen += w.length;   // пул по n «с сигналом»
    }
    const raw = ratioDen ? ratioNum / ratioDen : null;
    const obsWin = nWith ? withK.filter((d) => d.outcome === "won").length / nWith : 0;
    let mult = def, applied = false, conf = "none";
    if (raw !== null && nWith >= 50) {
      let g = bad ? Math.min(1, raw) : Math.max(1, raw);         // направление залочено
      g = Math.max(0.3, Math.min(1.6, g));
      mult = Math.max(0.3, Math.min(1.6, Math.round((def * 0.7 + g * 0.3) * 100) / 100));   // сдвиг к дефолту 70/30
      applied = true; conf = nWith >= 200 ? "high" : "mid";
    }
    calibration[key] = { n: nWith, obsWin: Math.round(obsWin * 100), raw: raw === null ? null : Math.round(raw * 100) / 100, def, mult, applied, conf, bad };
  }
  // Пересчёт prob/whyProb/temp/prio по калиброванным весам (только 3 ключа применены,
  // остальные факторы используют свой ручной mult). Делаем ДО profile/queues/temperature.
  const CM = (f: any) => (calibration[f.key] && calibration[f.key].applied) ? calibration[f.key].mult : f.mult;
  for (const d of deals) {
    const base = (d.base || 0) / 100;
    let p = base; for (const f of (d.factors || [])) p *= CM(f);
    p = Math.max(0.03, Math.min(0.97, p));
    const moneyBase = d.budget || 0;
    const why: any[] = [];
    for (const f of (d.factors || [])) {
      const m = CM(f);
      const without = Math.max(0.03, Math.min(0.97, p / m));
      const pp = Math.round((p - without) * 100); if (!pp) continue;
      why.push({ label: f.label, pp, rub: Math.round(moneyBase * (p - without)), bad: m < 1, who: d.mgr || "" });
    }
    why.sort((a, b) => a.pp - b.pp);
    d.prob = Math.round(p * 100); d.whyProb = why;
    d.needToClose = why.filter((w) => w.bad).map((w) => ({ label: w.label.replace(/\s*\([^)]*\)/, ""), deg: -w.pp, rub: -w.rub })).sort((a, b) => b.deg - a.deg).slice(0, 5);
    d.temp = Math.round(p * 100); d.tempDelta = d.temp - d.entryTemp; d.heatLift = d.temp - stageTemp(d.stageCode); d.tempBucket = d.goalReached ? "goal" : tempBucket(d.temp);
    if (d.uKey === "ok" || d.uKey === "lowprob") {   // lowprob-хвост срочности зависит от prob
      if (!d.won && !d.lost && d.prob < 25 && (d.budget || 0) >= 300000) { d.uKey = "lowprob"; d.urgency = `Шанс низкий (${d.prob}%)`; d.uw = 0.35; }
      else if (d.uKey === "lowprob") { d.uKey = "ok"; d.urgency = ""; d.uw = 0.1; }
    }
    d.prio = Math.round((d.budget || 60000) * p * d.uw);
  }
  // ===== ЛОГ СОСТОЯНИЙ для чистой калибровки (item 1, вариант B) =====
  // Пишем состояние каждой ОТКРЫТОЙ сделки на дату снимка (стадия, сработавшие факторы, prob).
  // Через недели join этих состояний с будущим исходом сделки даст веса без конфаундинга
  // (состояние в момент времени -> forward outcome), в отличие от терминального среза.
  try {
    const LOG = "dialog/data/calib-log.ndjson";
    const today = (dlg.to || new Date().toISOString()).slice(0, 10);
    const prev = existsSync(LOG) ? readFileSync(LOG, "utf8").split("\n").filter((l) => l && !l.includes(`"d":"${today}"`)) : [];
    const rows = deals.filter((d) => d.outcome === "open" && d.dealId)
      // hl (вклад ведения поверх стадии) и pre (наследство амо) пишем в лог с 2026-09-22:
      // через 2-4 недели по нему проверяется не только вероятность, но и метрика оценки
      // менеджера. Без этого поля валидировать «силу нагрева» будет нечем: на терминальном
      // срезе она непроверяема (закрытые сделки все лежат на WON/LOSE с одной базой).
      .map((d) => JSON.stringify({ d: today, id: d.dealId, st: d.stageCode, mgr: d.mgr, keys: (d.factors || []).map((f: any) => f.key), prob: d.prob, hl: d.heatLift, pre: d.preMig ? 1 : 0, bud: d.budget || 0 }));
    const all = [...prev, ...rows].slice(-150000);
    writeFileSync(LOG, all.join("\n") + "\n");
    console.log(`Калибро-лог: +${rows.length} строк за ${today} (всего ${all.length})`);
  } catch (e: any) { console.warn("калибро-лог пропущен:", e && e.message); }

  // ===== ДОСЬЕ РОПа: кто сильный и почему, кто слабый и что чинить =====
  // Каждая метрика сравнивается с медианой отдела: сильная сторона это не «хорошо вообще»,
  // а «заметно лучше коллег на сопоставимой выборке». Ниже порога выборки не судим.
  const METRICS = [
    { key: "resp", label: "скорость ответа", unit: "мин", better: "less",
      how: "Медиана времени от сообщения клиента до первого содержательного ответа менеджера. Считается в рабочих минутах (09:00-19:00 МСК), паузы внутри названного срока не учитываются. Ответом не считается реплика короче 25 символов без цифр и вопроса.",
      calc: (ds: any[]) => med(ds.map((d) => d.respMed).filter((x) => x !== null) as number[]),
      good: (v: number) => `отвечает клиенту за ${v} мин`, bad: (v: number) => `отвечает за ${fmtMin(v)}` },
    { key: "ball", label: "клиент ждёт ответа", unit: "%", better: "less",
      how: "Доля сделок, где последним написал клиент и ждёт дольше 4 рабочих часов. Если менеджер назвал срок и он не наступил, сделка сюда не попадает.",
      calc: (ds: any[]) => Math.round(ds.filter((d) => d.ballWait > BALL_STUCK_MIN).length / ds.length * 100),
      good: (v: number) => `почти не оставляет клиентов без ответа (${v}%)`, bad: (v: number) => `${v}% сделок ждут ответа` },
    { key: "silent", label: "тишина 4+ дней", unit: "%", better: "less",
      how: "Доля сделок без единого касания 4 календарных дня и дольше. Пост-продажные стадии (производство, отгрузка) не считаются: там тишина нормальна.",
      calc: (ds: any[]) => Math.round(ds.filter((d) => d.silenceD >= SILENCE_BAD_D).length / ds.length * 100),
      good: (v: number) => `держит регулярный контакт, тишина только в ${v}% сделок`, bad: (v: number) => `${v}% сделок молчат 4 дня и дольше` },
    { key: "step", label: "следующий шаг", unit: "%", better: "more",
      how: "Доля сделок с открытым делом в CRM. Берётся из снимка РОПа: есть незакрытая задача - шаг поставлен.",
      calc: (ds: any[]) => Math.round(ds.filter((d) => d.nextStep).length / ds.length * 100),
      good: (v: number) => `следующий шаг стоит в ${v}% сделок`, bad: (v: number) => `следующий шаг есть только в ${v}% сделок` },
    { key: "qual", label: "квалификация", unit: "%", better: "more",
      how: "Доля ранних сделок, где менеджер спросил хотя бы два из трёх: размеры или ТЗ, срок, бюджет. Ранние стадии - до расчёта: Новая, Квалификация, КП отправлено, Формирование ТЗ, Принимают решение.",
      calc: (ds: any[]) => { const e = ds.filter((d) => EARLY.has(d.stageCode) || !d.stageCode); return e.length >= 3 ? Math.round(e.filter((d) => d.tags.some((t: Tag) => t.sec === "qual" && t.tone === "good")).length / e.length * 100) : null; },
      good: (v: number) => `собирает ТЗ, срок и бюджет в ${v}% ранних сделок`, bad: (v: number) => `квалификация собрана лишь в ${v}% ранних сделок` },
    { key: "fake", label: "дела вхолостую", unit: "шт", better: "less",
      how: "Число дел вида «связаться с клиентом» и «отправь КП», отмеченных выполненными или просроченными, после которых в CRM нет ни сообщения, ни звонка клиенту в течение суток.",
      calc: (ds: any[]) => ds.reduce((a: number, d: any) => a + (d.taskNoContact || 0), 0),
      good: () => `закрывает дела только после разговора с клиентом`, bad: (v: number) => `${v} дел закрыто без контакта с клиентом` },
    { key: "ghost", label: "движение без общения", unit: "шт", better: "less",
      how: "Число сделок, где стадия менялась, а следов общения с клиентом в CRM нет, плюс сделки, где вообще только внутренняя работа. Учитывает, что звонок с личного телефона в CRM не виден.",
      calc: (ds: any[]) => ds.filter((d) => d.ghostMove || d.internalOnly).length,
      good: () => `не двигает сделки в тишине`, bad: (v: number) => `${v} сделок двигались без единого слова клиенту` },
    { key: "promise", label: "держит слово", unit: "%", better: "more",
      how: "Доля выполненных обещаний со сроком. Обещание - фраза «пришлю, отправлю, перезвоню» с указанием когда. В знаменатель идут и обещания без срока: клиент не знает, когда ждать.",
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
      how: "Медиана часов от создания сделки до первого слова клиенту. Дата создания в снимке без времени, отсчёт от начала рабочего дня: сравнивать менеджеров между собой можно, считать SLA в часах нельзя.",
      calc: (ds: any[]) => { const v = ds.map((d) => d.takeH).filter((x) => x !== null && x !== undefined) as number[];
        return v.length >= 3 ? med(v) : null; },
      good: (v: number) => `берёт сделку в работу за ${v} ч`, bad: (v: number) => `первое слово клиенту через ${v} ч после создания сделки` },
    { key: "obj", label: "возражение без аргумента", unit: "шт", better: "less",
      how: "Число возражений клиента (цена, срок, сравнение с другими, «я подумаю»), на которые в ответе менеджера не прозвучало ни объяснения, ни альтернативы, ни уточняющего вопроса. Вопрос про скидку и «дорого, но выставляйте счёт» возражением не считаются.",
      calc: (ds: any[]) => ds.reduce((a: number, d: any) => a + Math.max(0, (d.objTotal || 0) - (d.objWorked || 0)), 0),
      good: () => `на возражение клиента отвечает аргументом, а не уступкой`, bad: (v: number) => `${v} возражений закрыты без аргумента: молчание, «хорошо» или скидка` },
    { key: "date", label: "конкретные сроки", unit: "%", better: "more",
      how: "Доля сделок, где менеджер называл клиенту конкретную дату вместо «в ближайшее время».",
      calc: (ds: any[]) => Math.round(ds.filter((d) => d.tags.some((t: Tag) => t.t === "Называет конкретные даты")).length / ds.length * 100),
      good: (v: number) => `называет клиенту конкретные даты в ${v}% сделок`, bad: (v: number) => `конкретные даты только в ${v}% сделок` },
  ];
  // Рейтинг и медианы отдела - только по открытым сделкам: дисциплина ведения меряется
  // на живом пайплайне, а не на уже закрытых успехах/отказах.
  const dealsByMgr: Record<string, any[]> = {};
  for (const d of deals) if (d.outcome === "open") (dealsByMgr[d.mgr] ||= []).push(d);
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
    // --- ИИ-оценка менеджера (уровень 1) -----------------------------------------
    // Балл = средний ИИ-балл по разобранным сделкам (scores 0-5 -> 0-10). Вердикт и
    // сильные/слабые стороны берём из manager-разбора ИИ (aiMgr), если он есть.
    const aiDeals = ds.filter((d) => d.ai && d.ai.scores);
    let aiGrade: number | null = null, aiCounts = { good: 0, warn: 0, bad: 0 };
    if (aiDeals.length) {
      const sc = aiDeals.map((d) => { const s = d.ai.scores; const v = ["polite", "qual", "deadline", "process", "result"].map((k) => Number(s[k] ?? NaN)).filter((x) => !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; }).filter((x) => !isNaN(x));
      if (sc.length) aiGrade = Number((sc.reduce((a, b) => a + b, 0) / sc.length / 5 * 10).toFixed(1));
      for (const d of aiDeals) { const t = d.ai.tone; if (t === "bad") aiCounts.bad++; else if (t === "warn") aiCounts.warn++; else aiCounts.good++; }
    }
    const aiM = aiMgr[mgr] || null;
    const ai = aiDeals.length ? {
      grade: aiGrade, reviewed: aiDeals.length, counts: aiCounts,
      verdict: aiM ? aiM.verdict : "", strengths: (aiM && aiM.strengths) || [], weaknesses: (aiM && aiM.weaknesses) || [], action: aiM ? aiM.action : "",
    } : null;
    // Офис-менеджер (лиды) не оценивается регламентом продавца-закрывашки: у него другая
    // работа - принять и квалифицировать лид, а не довести до оплаты. Рейтинг не выставляем.
    const role = mgr === OFFICE_MGR ? "office" : "sales";
    // Градусник по менеджеру: распределение открытых сделок по температуре + СИЛА НАГРЕВА
    // (медиана Δ температуры с входа до сейчас на пути к предоплате). Кто реально греет клиента,
    // а кто сидит на входящем потоке. [ГИПОТЕЗА]: корреляция, часть клиентов стынет сами.
    const openDs = ds.filter((d) => d.outcome === "open");
    const tempDist = { cold: 0, warm: 0, hot: 0, boiling: 0, goal: 0 };
    for (const d of openDs) (tempDist as any)[d.tempBucket] = ((tempDist as any)[d.tempBucket] || 0) + 1;
    const heatVals = openDs.filter((d) => !d.goalReached && !d.preMig && (d.stageRows || []).length).map((d) => d.heatLift);
    const heatPower = heatVals.length >= 3 ? med(heatVals) : null;
    const hotMoneyTemp = openDs.filter((d) => d.tempBucket === "hot" || d.tempBucket === "boiling").reduce((s2, d) => s2 + (d.budget || 0), 0);
    return {
      mgr, role, deals: ds.length, sections, ai,
      tempDist, heatPower, hotMoneyTemp,
      lossRub: Math.round(lossRub),
      lossPerDeal: Math.round(lossRub / Math.max(ds.length, 1)),
      topLoss: topLoss ? { label: topLoss[0], rub: Math.round(topLoss[1]) } : null,
      ghost: ds.filter((d) => d.ghostMove).length,
      profile: profile[mgr] || null,
      internal: ds.filter((d) => d.internalOnly).length,
      fakedone: ds.reduce((s2, d) => s2 + (d.taskNoContact || 0), 0),
      probAvg: Math.round(ds.reduce((s, d) => s + d.prob, 0) / ds.length),
      pipeline: ds.reduce((s, d) => s + (d.budget || 0), 0),
      alerts: ds.filter((d) => d.tags.some((t: Tag) => t.tone === "bad")).length,
    };
  }).sort((a, b) => b.deals - a.deals);

  // Каталог тегов для кликов: нормализованное имя -> раздел, тон, счётчик
  const tagIndex: Record<string, { sec: string; tone: string; n: number }> = {};
  for (const d of deals) for (const t of d.tags) {
    const norm = t.t.split(" · ")[0]!.replace(/\d+/g, "N");
    const rec = (tagIndex[norm] ||= { sec: t.sec, tone: t.tone, n: 0 });
    rec.n++;
  }

  // --- Тренд: срез дня, чтобы было видно, двигается ли отдел (метрика успеха инструмента) ---
  const day = (dlg.to || new Date().toISOString()).slice(0, 10);
  const snap = {
    day, deals: deals.length,
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
    { key: "lowprob", label: "Низкий шанс", hint: "Крупная сделка (от 300к) с низкой вероятностью (<25%) без острых проблем - кандидат на дожим или на честную фиксацию причины" },
  ].map((q) => ({ ...q, n: deals.filter((d) => d.uKey === q.key).length,
                  money: deals.filter((d) => d.uKey === q.key).reduce((s2, d) => s2 + (d.budget || 0), 0) }));

  // Градусник отдела: распределение открытых сделок по температуре (штуки + деньги) и медиана.
  const openAll = deals.filter((d) => d.outcome === "open");
  const TBUCKETS = [
    { key: "boiling", label: "Кипят (готовы платить)", min: 80 },
    { key: "hot", label: "Горячие", min: 50 },
    { key: "warm", label: "Тёплые", min: 25 },
    { key: "cold", label: "Холодные", min: 0 },
  ].map((b) => { const ds = openAll.filter((d) => !d.goalReached && d.tempBucket === b.key);
    return { ...b, n: ds.length, money: ds.reduce((s2, d) => s2 + (d.budget || 0), 0) }; });
  const goalN = openAll.filter((d) => d.goalReached).length;
  const temperature = {
    buckets: TBUCKETS, goalN,
    goalMoney: openAll.filter((d) => d.goalReached).reduce((s2, d) => s2 + (d.budget || 0), 0),
    medianTemp: med(openAll.filter((d) => !d.goalReached).map((d) => d.temp)),
    // Остывающие горячие: были прогреты (temp>=50), но давно молчат - деньги утекают.
    coolingHot: openAll.filter((d) => !d.goalReached && d.temp >= 50 && d.silenceD >= SILENCE_WARN_D)
      .sort((a, b) => (b.budget || 0) - (a.budget || 0))
      .slice(0, 20).map((d) => ({ id: d.dealId || d.leadId, t: d.title.slice(0, 40), temp: d.temp, silent: d.silenceD, budget: d.budget || 0, mgr: d.mgr })),
    goal: "Предоплата получена",
  };

  dlg.scoring = {
    queues: QUEUES, temperature,
    trend: days.slice(-14),
    calibration,
    calibratedAt: CALIBRATED_AT, baseFallback: Math.round(BASE_FALLBACK * 100), baseRates: BASE_RATES,
    sections: SECTIONS, minSample: MIN_SAMPLE, aiReviews: Object.keys(ai).length, aiDemo: !!aiFile.demo, aiModel: aiFile.model || "",
    aiAgg: aiFile.aggregates || null,
    thresholds: { FIRST_ANSWER_MIN, FAST_ANSWER_MIN, SLOW_ANSWER_MIN, BALL_STUCK_MIN, SILENCE_WARN_D, SILENCE_BAD_D, OVERDUE_GRACE_D },
    deptMedians: dept, metricDefs: METRICS.map((m) => ({ key: m.key, label: m.label, unit: m.unit, better: m.better, how: (m as any).how || "" })), tagIndex, deals: deals.sort((a, b) => b.prob - a.prob), managers,
    hiddenMgr: hiddenMgr.sort((a, b) => b.deals - a.deals),
  };
  writeFileSync(OWN, JSON.stringify(ownDb));
  writeFileSync(DLG, JSON.stringify(dlg));
  console.log(`Разбор: диалогов ${deals.length}, менеджеров ${managers.length}, тегов ${Object.keys(tagIndex).length}`);
  for (const m of managers) console.log(`   ${m.mgr} - ${m.deals} диал · ${m.sections.map((s) => s.label + " " + (s.pos ?? "-") + "%").join(" · ")}`);
}
main();
