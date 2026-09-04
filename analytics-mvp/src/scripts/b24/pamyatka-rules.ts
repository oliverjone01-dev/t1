// Движок «Куратор по памятке v2.3»: правила поверх переписки окна снимка.
// ЕДИНЫЙ код для страницы (build-svod2) и ночных фактов (build-ai-facts) -
// урок ФЕНИКС-аудитов D1/D7: два расчёта одного и того же расходятся.
//
// v2 после ВЕТО ФЕНИКСА 03.09 (G1-G10): улика атрибутируется АВТОРУ сообщения,
// а не владельцу сделки; звонки/боты/письма не считаются «клиент написал»;
// первый ответ меряется в РАБОЧИХ минутах (памятка §1: «в рабочее время»);
// R3 с порогом 12 знаков и окном 10 минут, батч вложений минуты = одно событие;
// K_DATE знает «в течение дня/часа», «на этой неделе», «ниже»; R2+R5 на одном
// предложении = одна улика; шаблонные автоответы группируются в «дефект шаблона».
// Статус выхода - ЧЕРНОВИК ДЕТЕКТОРА: precision не измерен, до ручной разметки
// 60 улик РОПом/Иваном (порог 90%) именная публикация запрещена ФЕНИКСОМ.

const K_PROMISE = /(?<![а-яё])(отправлю|пришлю|подготовлю|уточню|свяжусь|вернусь|верн[ёе]мся|наберу|скину|посчитаю|сообщу|позвоню|отвечу|напишу|вышлю|пересчитаю|направлю|подскажу|уточним|отправим|пришлём|пришлем|сделаю)(?![а-яё])/i;
const K_DONE = /(направля|отправля|прилага|во вложении|высыла)[а-яё]*/i;
const K_DATE = /сегодня|завтра|послезавтра|сейчас|сразу|в течени[ие]\s+(час|дня|суток|\d)|на (этой|текущей|следующей) неделе|до конца (дня|недели)|ниже|до \d{1,2}|к \d{1,2}|\d{1,2}[:.]\d{2}|\d{1,2}\.\d{2}|понедельник|вторник|сред[уа]|четверг|пятниц|суббот|воскрес|числа|минут/i;
const K_NOTPROM = /с радостью|всегда готов|буду рад|готов[а]? (ответить|помочь)|сообщу,? что|подскажу,? что/i;
const K_STOP = /(закрутил|забыл[ао]?с|замотал|в ближайшее время|постараюсь|как только смогу|в скором времени|на днях|вы же сами|вы не указали)/i;
const K_ATTACH = /^(отправлено|принято)\s+\S+/i;
const K_EXPENSIVE = /(?<![а-яё])(дорого|дороговато|дешевле у|за такие деньги|цена высок)/i;
const K_ESCAL = /(претензи|жалоб[аеу]|сколько можно|расторг|юрист)/i;
const K_APOLOGY = /(извин|прошу прощ|сожале|виноват)/i;
const K_BUDGQ = /(бюджет|какую сумму|сумма для вас|рабочая сумма|сколько закладыва)/i;
const K_ALT = /(альтернатив|вариант дешевле|можем убрать|заменить|осветл|другой профиль|дешевле, если|уберём|уберем)/i;
const K_LPRQ = /(кто принимает решение|кто подписывает|кто ещё будет смотреть|кто еще будет смотреть|кто согласов)/i;
const K_TERMQ = /(к какому числу|к какому сроку|в какие сроки|какие сроки у вас|сколько времени у вас|когда нужно готовое|дата объекта|когда планируете)/i;
// не-речь клиента: записи звонков, сервисные и ботовые сообщения, письма-треды
const K_NONMSG = /^(звонок|тема:|\/start|не удаляйте это сообщение|чат открытой линии)/i;
const K_HELLO = /здравствуйте|добрый день|доброе утро|добрый вечер|приветству|доброго дня/i;

export const KURATOR_RULES: Record<string, string> = {
  R1: "Первый ответ дольше 15 рабочих минут", R2: "Обещание без даты", R3: "Вложение без сопроводительного текста",
  R5: "Стоп-слово из блоклиста", R7: "«Дорого» без вопроса о бюджете", R9: "Эскалация без извинения",
  R10: "Первый ответ новому клиенту без приветствия",
};

export type KViol = { r: string; q: string; d: string };
export type KDeal = { id: any; lead: number; m: string; t: string; b: number; viol: KViol[] };
export type Kurator = {
  mgrs: Record<string, { fr: number; frOk: number; pr: number; prOk: number; out: number; qe: number; viol: number; byRule: Record<string, number>; deals: KDeal[] }>;
  firstLine: { fr: number; frOk: number; viol: number; authors: string[] };
  qual: { bud: number; term: number; lpr: number; out: number; note: string };
  note: string;
};

// рабочие минуты между двумя ts (памятка §1: норматив «в рабочее время» 9:00-18:00 МСК)
export function workMinutes(t1: number, t2: number): number {
  if (t2 <= t1) return 0;
  const H0 = 9, H1 = 18;
  let min = 0;
  const d = new Date(t1);
  d.setSeconds(0, 0);
  const step = 6e4;
  // грубый, но честный счёт по минутам; окна недели - максимум ~10 тыс минут на пару
  for (let t = t1; t < t2 && min < 60 * 24 * 14; t += step) {
    const loc = new Date(t + 3 * 36e5); // снимок в +03:00
    const dow = loc.getUTCDay();
    if (dow === 0 || dow === 6) continue; // N1 ФЕНИКСА: сб/вс - не рабочее время (§1)
    const hh = loc.getUTCHours();
    if (hh >= H0 && hh < H1) min++;
  }
  return min;
}

// dlg - снимок диалогов (events + from/to); dealLookup(key 'd123'|'l123') - сделка снимка;
// clip - санитайзер; canonSeller(name) - КАНОНИЧЕСКОЕ имя продавца из ростера или null.
// B1 ФЕНИКСА: e.who приходит в двух форматах («Татьяна Лакомова» из мессенджеров и
// «Лакомова Татьяна» из Звонок/Письмо) - ключом копилки может быть только канон ростера.
export function kuratorAudit(dlg: any, dealLookup: (k: string) => any, clip: (s: string) => string, canonSeller: (name: string) => string | null): Kurator {
  const WIN_FROM = new Date(dlg.from).getTime(), WIN_TO = new Date(dlg.to).getTime();
  const evByObj: Record<string, any[]> = {};
  for (const e of dlg.events || []) {
    if (!e.ts || (e.dir !== "входящее" && e.dir !== "исходящее") || !(e.dealId || e.leadId)) continue;
    const k = (e.dealId ? "d" : "l") + (e.dealId || e.leadId);
    (evByObj[k] ||= []).push(e);
  }
  for (const list of Object.values(evByObj)) list.sort((a, b) => +a.ts - +b.ts);
  const kDT = (e: any) => { const s = String(e.dt || ""); return s.slice(8, 10) + "." + s.slice(5, 7) + " " + s.slice(11, 16); };
  const isRealMsg = (e: any) => !K_NONMSG.test(String(e.body || "").trim());
  const mgrs: Kurator["mgrs"] = {};
  const firstLine = { fr: 0, frOk: 0, viol: 0, authors: [] as string[] };
  const flAuthors = new Set<string>();
  const dealEv: Record<string, KDeal> = {};
  const qual = { bud: 0, term: 0, lpr: 0, out: 0, note: "по списку зашитых формулировок; полнота детектора не измерена - «не найдено» значит «не найдено этим списком», а не «не спрашивали»" };
  // per-author копилки: улика принадлежит АВТОРУ сообщения (G2 ФЕНИКСА)
  const st = (a: string) => (mgrs[a] ||= { fr: 0, frOk: 0, pr: 0, prOk: 0, out: 0, qe: 0, viol: 0, byRule: {}, deals: [] });
  const violByDeal: Record<string, { author: string; v: KViol }[]> = {};
  for (const [k, list] of Object.entries(evByObj)) {
    const win = list.filter((e) => +e.ts >= WIN_FROM && +e.ts <= WIN_TO);
    if (!win.length) continue;
    const d = dealLookup(k);
    const V: { author: string; v: KViol }[] = [];
    // R1: первое НАСТОЯЩЕЕ сообщение клиента (не звонок/бот/письмо) -> первый текстовый
    // ответ; время в РАБОЧИХ минутах; улика и знаменатель - у автора ответа
    const fin = win.find((e) => e.dir === "входящее" && isRealMsg(e));
    const fout = fin ? win.find((e) => e.dir === "исходящее" && +e.ts > +fin.ts && isRealMsg(e)) : null;
    const newDialog = +list[0].ts >= WIN_FROM; // у сделки нет истории до окна - диалог новый
    if (fin && fout) {
      const author = canonSeller(String(fout.who || d?.mgr || "").trim());
      const wm = workMinutes(+fin.ts, +fout.ts);
      if (author) {
        const s = st(author);
        s.fr++; if (wm <= 15) s.frOk++;
        else V.push({ author, v: { r: "R1", q: "Клиент написал " + kDT(fin) + ", ответ ушёл через " + (wm >= 60 ? Math.floor(wm / 60) + " ч " + (wm % 60) + " мин" : wm + " мин") + " рабочего времени", d: kDT(fout) } });
        // R10 (памятка §3, детектор T02 академии): в НОВОМ диалоге никто не поздоровался
        // ни в одном исходящем от начала окна до первого ответа ВКЛЮЧИТЕЛЬНО. Доминирующий
        // поток - менеджер здоровается ПЕРВЫМ, до реплики клиента (дельта-аудит ФЕНИКСА:
        // проверка одного fout давала точность 16%). Маркеры и служебные строки - не речь.
        const greeted = win.some((x: any) => x.dir === "исходящее" && +x.ts <= +fout.ts && isRealMsg(x) && !K_ATTACH.test(String(x.body || "").trim()) && K_HELLO.test(String(x.body || "")));
        const foutBody = String(fout.body || "").trim();
        if (newDialog && !greeted && !K_ATTACH.test(foutBody)) { if (process.env.R10DBG) console.log("R10DBG :: " + author + " :: " + String(d?.title || k).slice(0,45) + " :: " + clip(foutBody).slice(0, 130));
          V.push({ author, v: { r: "R10", q: "Первый ответ новому клиенту без приветствия: «" + clip(foutBody).slice(0, 110) + "»", d: kDT(fout) } }); }
      } else { firstLine.fr++; if (wm <= 15) firstLine.frOk++; flAuthors.add(String(fout.who || "?").trim()); }
    }
    const seenAttachMin = new Set<string>();
    for (const e of win) {
      if (e.dir !== "исходящее") continue;
      const body = String(e.body || "").trim(); if (!body || !isRealMsg(e) && !K_ATTACH.test(body)) continue;
      const rawWho = String(e.who || d?.mgr || "").trim();
      const author = canonSeller(rawWho);
      const seller = !!author;
      const marker = K_ATTACH.test(body) && body.length < 60;
      if (seller && !marker) { const s = st(author!); s.out++; qual.out++;
        if (/\?\s*$/.test(body)) s.qe++; // «ход у нас»: сообщение заканчивается вопросом (счётчик, не улика)
        if (K_BUDGQ.test(body)) qual.bud++; if (K_TERMQ.test(body)) qual.term++; if (K_LPRQ.test(body)) qual.lpr++; }
      const flaggedSents: string[] = [];
      // N4 ФЕНИКСА: счёт симметричен - КАЖДОЕ предложение-обещание учитывается и в pr,
      // и в уликах (раньше улика делала break, а prOk считался по всем предложениям)
      if (!marker) for (const sent of body.split(/[.!?\n]+/)) {
        if (K_PROMISE.test(sent) && !K_DONE.test(sent) && !K_DATE.test(sent) && !K_NOTPROM.test(sent) && sent.length > 12 && sent.length < 220) {
          if (seller) { st(author!).pr++; flaggedSents.push(sent); V.push({ author: author!, v: { r: "R2", q: "«" + clip(sent.trim()).slice(0, 140) + "»", d: kDT(e) } }); } else firstLine.viol++;
        } else if (K_PROMISE.test(sent) && K_DATE.test(sent) && seller) { st(author!).pr++; st(author!).prOk++; }
      }
      if (marker) {
        // батч вложений одной минуты = одно событие (G3); текст-сосед: >12 знаков, окно 10 мин
        const minuteKey = author + "|" + String(e.dt || "").slice(0, 16);
        if (!seenAttachMin.has(minuteKey)) {
          seenAttachMin.add(minuteKey);
          const near = win.some((x: any) => x !== e && x.dir === "исходящее" && Math.abs(+x.ts - +e.ts) < 600e3 && String(x.body || "").trim().length > 12 && !K_ATTACH.test(String(x.body || "").trim()));
          if (!near) { if (seller) V.push({ author: author!, v: { r: "R3", q: "«" + clip(body).slice(0, 60) + "» - и ни строки текста в пределах 10 минут", d: kDT(e) } }); else firstLine.viol++; }
        }
      }
      const sm = body.match(K_STOP);
      // R2+R5 на одном предложении - одна улика (G5): если предложение уже помечено R2, R5 молчит
      if (sm && !flaggedSents.some((s2) => s2.includes(sm[0]))) {
        if (seller) V.push({ author: author!, v: { r: "R5", q: "«…" + clip(body.slice(Math.max(0, (sm.index || 0) - 40), (sm.index || 0) + sm[0].length + 40).trim()) + "…»", d: kDT(e) } }); else firstLine.viol++;
      }
    }
    // R7/R9: чаты; письма-треды и звонки не в счёт (подписи дают ложных «директоров»),
    // «жалоба» без слова «руководител/директор» в K_ESCAL - те живут в подписях (G1 прототипа)
    for (let i = 0; i < win.length; i++) {
      const e = win[i]; if (e.dir !== "входящее" || !isRealMsg(e)) continue;
      const inB = String(e.body || "");
      const rep = win.slice(i + 1).find((x: any) => x.dir === "исходящее" && isRealMsg(x));
      if (!rep) continue;
      const outB = String(rep.body || "");
      const author = canonSeller(String(rep.who || d?.mgr || "").trim());
      if (!author) continue;
      if (K_EXPENSIVE.test(inB) && !K_BUDGQ.test(outB) && !K_ALT.test(outB) && !outB.includes("?"))
        V.push({ author, v: { r: "R7", q: "Клиент: «…" + clip(inB).slice(0, 70) + "…» -> ответ без вопроса о бюджете и без альтернативы: «" + clip(outB).slice(0, 90) + "»", d: kDT(rep) } });
      if (K_ESCAL.test(inB) && outB && !K_APOLOGY.test(outB))
        V.push({ author, v: { r: "R9", q: "Клиент: «…" + clip(inB).slice(0, 70) + "…» -> первый ответ без извинения: «" + clip(outB).slice(0, 90) + "»", d: kDT(rep) } });
    }
    if (V.length) violByDeal[k] = V;
  }
  firstLine.authors = [...flAuthors];
  // шаблонные автоответы (G10): одинаковый R2-текст у одного автора в 3+ сделках -
  // одна улика «дефект шаблона», не N персональных
  const tplCount: Record<string, number> = {};
  for (const V of Object.values(violByDeal)) for (const { author, v } of V) if (v.r === "R2") tplCount[author + "|" + v.q] = (tplCount[author + "|" + v.q] || 0) + 1;
  const tplSeen = new Set<string>();
  for (const [k, V] of Object.entries(violByDeal)) {
    const keep: { author: string; v: KViol }[] = [];
    for (const it of V) {
      const key = it.author + "|" + it.v.q;
      if (it.v.r === "R2" && (tplCount[key] || 0) >= 3) {
        if (tplSeen.has(key)) continue;
        tplSeen.add(key);
        it.v = { ...it.v, q: it.v.q + " - шаблонный автоответ, встречается в " + tplCount[key] + " сделках: дефект шаблона, не человека" };
      }
      keep.push(it);
    }
    // дедуп в пределах сделки
    const seen = new Set<string>();
    const uniq = keep.filter((it) => { const key2 = it.author + "|" + it.v.r + "|" + it.v.q + "|" + it.v.d; if (seen.has(key2)) return false; seen.add(key2); return true; });
    if (!uniq.length) continue;
    const d = dealLookup(k);
    const win0 = evByObj[k].find((e) => +e.ts >= WIN_FROM) || evByObj[k][0];
    for (const it of uniq) { const s2 = st(it.author); s2.viol++; s2.byRule[it.v.r] = (s2.byRule[it.v.r] || 0) + 1; }
    const byAuthor: Record<string, KViol[]> = {};
    for (const it of uniq) (byAuthor[it.author] ||= []).push(it.v);
    for (const [author, vs] of Object.entries(byAuthor)) {
      (dealEv[k + "|" + author] = { id: d?.dealId || d?.leadId || k.slice(1), lead: d?.isLead ? 1 : 0, m: author, t: clip(String(d?.title || win0.dealT || win0.leadT || "#" + k.slice(1))).slice(0, 46), b: Math.round(d?.budget || 0), viol: vs.slice(0, 4) });
    }
  }
  for (const m of Object.keys(mgrs))
    mgrs[m].deals = Object.values(dealEv).filter((x) => x.m === m).sort((a, b) => b.b - a.b).slice(0, 5);
  return {
    mgrs, firstLine, qual,
    note: "ЧЕРНОВИК ДЕТЕКТОРА - точность не измерена: до ручной разметки 60 улик РОПом (порог 90%) выводы по людям не делаются; первый ответ - в рабочих минутах 9:00-18:00; звонки, боты и письма-треды исключены; спорная улика оспаривается по ссылке в CRM",
  };
}
