// Движок «Куратор по памятке v2.3»: правила поверх переписки окна снимка.
// ЕДИНЫЙ код для страницы (build-svod2) и ночных фактов (build-ai-facts) -
// урок ФЕНИКС-аудитов D1/D7: два расчёта одного и того же расходятся.
// Точность калибрована на прототипе 03.09: маркеры вложений - не речь менеджера,
// обещания - только первое лицо, вежливые формулы и письма-треды исключены.
// Согласовано Иваном 03.09: отдел видит всех.

const K_PROMISE = /(?<![а-яё])(отправлю|пришлю|подготовлю|уточню|свяжусь|вернусь|верн[ёе]мся|наберу|скину|посчитаю|сообщу|позвоню|отвечу|напишу|вышлю|пересчитаю|направлю|подскажу|уточним|отправим|пришлём|пришлем|сделаю)(?![а-яё])/i;
const K_DONE = /(направля|отправля|прилага|во вложении|высыла)[а-яё]*/i;
const K_DATE = /сегодня|завтра|послезавтра|сейчас|сразу|в течение час|до \d{1,2}|к \d{1,2}|\d{1,2}[:.]\d{2}|\d{1,2}\.\d{2}|понедельник|вторник|сред[уа]|четверг|пятниц|суббот|воскрес|числа|минут/i;
const K_NOTPROM = /с радостью|всегда готов|готов[а]? ответить|сообщу,? что|подскажу,? что/i;
const K_STOP = /(закрутил|забыл[ао]?с|замотал|в ближайшее время|постараюсь|как только смогу|в скором времени|на днях|вы же сами|вы не указали)/i;
const K_ATTACH = /^(отправлено|принято)\s+\S+/i;
const K_EXPENSIVE = /(?<![а-яё])(дорого|дороговато|дешевле у|за такие деньги|цена высок)/i;
const K_ESCAL = /(претензи|жалоб|руководител|директор[ау]?(?![а-яё])|юрист|расторг|сколько можно)/i;
const K_APOLOGY = /(извин|прошу прощ|сожале|виноват)/i;
const K_BUDGQ = /(бюджет|какую сумму|сумма для вас|рабочая сумма|сколько закладыва)/i;
const K_ALT = /(альтернатив|вариант дешевле|можем убрать|заменить|осветл|другой профиль|дешевле, если|уберём|уберем)/i;
const K_LPRQ = /(кто принимает решение|кто подписывает|кто ещё будет смотреть|кто еще будет смотреть|кто согласов)/i;
const K_TERMQ = /(к какому числу|к какому сроку|когда нужно готовое|дата объекта|когда планируете)/i;

export const KURATOR_RULES: Record<string, string> = {
  R1: "Первый ответ дольше 15 минут", R2: "Обещание без даты", R3: "Вложение без сопроводительного текста",
  R5: "Стоп-слово из блоклиста", R7: "«Дорого» без вопроса о бюджете", R9: "Эскалация без извинения",
};

export type KViol = { r: string; q: string; d: string };
export type KDeal = { id: any; lead: number; m: string; t: string; b: number; viol: KViol[] };
export type Kurator = {
  mgrs: Record<string, { fr: number; frOk: number; pr: number; prOk: number; viol: number; deals: KDeal[] }>;
  qual: { bud: number; term: number; lpr: number; out: number };
  note: string;
};

// dlg - снимок диалогов (events + from/to); dealLookup(key 'd123'|'l123') - сделка снимка
// (mgr/title/budget/dealId/isLead) либо null; clip - санитайзер строк страницы (noDash).
export function kuratorAudit(dlg: any, dealLookup: (k: string) => any, clip: (s: string) => string): Kurator {
  const WIN_FROM = new Date(dlg.from).getTime(), WIN_TO = new Date(dlg.to).getTime();
  const evByObj: Record<string, any[]> = {};
  for (const e of dlg.events || []) {
    if (!e.ts || (e.dir !== "входящее" && e.dir !== "исходящее") || !(e.dealId || e.leadId)) continue;
    const k = (e.dealId ? "d" : "l") + (e.dealId || e.leadId);
    (evByObj[k] ||= []).push(e);
  }
  for (const list of Object.values(evByObj)) list.sort((a, b) => +a.ts - +b.ts);
  const kDT = (e: any) => { const s = String(e.dt || ""); return s.slice(8, 10) + "." + s.slice(5, 7) + " " + s.slice(11, 16); };
  const mgrs: Kurator["mgrs"] = {};
  const dealEv: Record<string, KDeal> = {};
  const qual = { bud: 0, term: 0, lpr: 0, out: 0 };
  for (const [k, list] of Object.entries(evByObj)) {
    const win = list.filter((e) => +e.ts >= WIN_FROM && +e.ts <= WIN_TO);
    if (!win.length) continue;
    const d = dealLookup(k);
    const mgr = d?.mgr || (win.find((e) => e.mgr) || {}).mgr; if (!mgr) continue;
    const st = (mgrs[mgr] ||= { fr: 0, frOk: 0, pr: 0, prOk: 0, viol: 0, deals: [] });
    const V: KViol[] = [];
    // R1: первая пара окна; ночные разрывы >8 ч в улики не идут (в знаменателе остаются)
    const fin = win.find((e) => e.dir === "входящее");
    const fout = fin ? win.find((e) => e.dir === "исходящее" && +e.ts > +fin.ts) : null;
    if (fin && fout) {
      const min = Math.round((+fout.ts - +fin.ts) / 6e4);
      st.fr++; if (min <= 15) st.frOk++;
      else if (min < 8 * 60) V.push({ r: "R1", q: "Клиент написал " + kDT(fin) + ", ответ ушёл через " + (min >= 60 ? Math.floor(min / 60) + " ч " + (min % 60) + " мин" : min + " мин"), d: kDT(fout) });
    }
    for (const e of win) {
      if (e.dir !== "исходящее") continue;
      const body = String(e.body || "").trim(); if (!body) continue;
      const marker = K_ATTACH.test(body) && body.length < 60;
      qual.out++;
      if (K_BUDGQ.test(body)) qual.bud++; if (K_TERMQ.test(body)) qual.term++; if (K_LPRQ.test(body)) qual.lpr++;
      if (!marker) for (const sent of body.split(/[.!?\n]+/)) {
        if (K_PROMISE.test(sent) && !K_DONE.test(sent) && !K_DATE.test(sent) && !K_NOTPROM.test(sent) && sent.length > 12 && sent.length < 220) {
          st.pr++; V.push({ r: "R2", q: "«" + clip(sent.trim()).slice(0, 140) + "»", d: kDT(e) }); break;
        } else if (K_PROMISE.test(sent) && K_DATE.test(sent)) { st.pr++; st.prOk++; }
      }
      if (marker) {
        const near = win.some((x: any) => x !== e && x.dir === "исходящее" && Math.abs(+x.ts - +e.ts) < 18e4 && String(x.body || "").length > 30 && !K_ATTACH.test(String(x.body || "")));
        if (!near) V.push({ r: "R3", q: "«" + clip(body).slice(0, 60) + "» - и ни строки текста рядом", d: kDT(e) });
      }
      const sm = body.match(K_STOP);
      if (sm) V.push({ r: "R5", q: "«…" + clip(body.slice(Math.max(0, (sm.index || 0) - 40), (sm.index || 0) + sm[0].length + 40).trim()) + "…»", d: kDT(e) });
    }
    // R7/R9: письма-треды исключены (подписи и цитаты дают ложных «директоров»),
    // записи звонков не считаются текстовым ответом
    for (let i = 0; i < win.length; i++) {
      const e = win[i]; if (e.dir !== "входящее") continue;
      const inB = String(e.body || "");
      if (/^тема:/i.test(inB.trim())) continue;
      const rep = win.slice(i + 1).find((x: any) => x.dir === "исходящее" && !/^(звонок|тема:)/i.test(String(x.body || "").trim()));
      if (!rep) continue;
      const outB = String(rep.body || "");
      if (K_EXPENSIVE.test(inB) && !K_BUDGQ.test(outB) && !K_ALT.test(outB) && !outB.includes("?"))
        V.push({ r: "R7", q: "Клиент: «…" + clip(inB).slice(0, 70) + "…» -> ответ без вопроса о бюджете и без альтернативы: «" + clip(outB).slice(0, 90) + "»", d: kDT(rep) });
      if (K_ESCAL.test(inB) && outB && !K_APOLOGY.test(outB))
        V.push({ r: "R9", q: "Клиент: «…" + clip(inB).slice(0, 70) + "…» -> первый ответ без извинения: «" + clip(outB).slice(0, 90) + "»", d: kDT(rep) });
    }
    // дедуп: два вложения одной минуты дают одинаковые улики - показываем одну
    const seen = new Set<string>();
    const VU = V.filter((v) => { const key = v.r + "|" + v.q + "|" + v.d; if (seen.has(key)) return false; seen.add(key); return true; });
    V.length = 0; V.push(...VU);
    if (V.length) {
      st.viol += V.length;
      dealEv[k] = { id: d?.dealId || d?.leadId || k.slice(1), lead: d?.isLead ? 1 : 0, m: mgr, t: clip(String(d?.title || win[0].dealT || win[0].leadT || "#" + k.slice(1))).slice(0, 46), b: Math.round(d?.budget || 0), viol: V.slice(0, 4) };
    }
  }
  for (const m of Object.keys(mgrs))
    mgrs[m].deals = Object.values(dealEv).filter((x) => x.m === m).sort((a, b) => b.b - a.b).slice(0, 5);
  return { mgrs, qual, note: "улики по переписке окна; ночные разрывы дольше 8 часов в R1-улики не идут (но считаются в знаменателе); спорная улика оспаривается по ссылке в CRM - детекторы калибруются РОПом" };
}
