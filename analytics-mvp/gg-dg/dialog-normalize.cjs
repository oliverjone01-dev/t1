'use strict';
// Pure Dialog parsers, pinned to fetch-dialog.ts blob 28ffc7e1c3c398c539bb44e7f050662655112432.
// Adaptations: full text, explicit CRM service events, SMS retained; no network or AI calls.
module.exports=function createNormalizer(names,now){
const TO=new Date(now).toISOString(),cap=s=>String(s||''),employees={},empFirst={},firedSet={};
for(const value of Object.values(names)){const n=String(value||'').toLowerCase().trim();if(!n)continue;employees[n]=1;const parts=n.split(/\s+/);for(const p of parts)if(p.length>2)empFirst[p]=1;}
const durfmt = (sec     ) => { const s = parseInt(sec, 10) || 0; return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const AMB_SIG = /^(телефон|phone|whatsapp|telegram|max|instagram|бот|bot|—)$/i;
const RE_ADDRESS = /^([А-ЯЁ][а-яё]{2,15})\s*[,!]?\s+(добрый|доброе|доброй|здравствуйте|привет)(?![а-яё])/;
const RE_MGR_SPEAK = /меня зовут|компани[яи] genglass|genglass\.ru|менеджер первой линии|благодарим за обращение|мы производим|наш (замерщик|конструктор|проектный)|в проектный отдел|в конструкторский|зафиксировал[аи] ваш запрос|передал[аи] (его )?(старшему|в )|уточню у (конструктора|производства|цеха|проектного)|коммерческое предложение|(пришлю|вышлю|отправлю|подготовлю|высылаю|направляю)\s+(вам\s+)?(кп|коммерческое|расч[её]т|сч[её]т|смету|эскиз|черт[её]ж|макет|прайс|договор)/i;
const TR_TURN = /^[\s>*_-]*(оператор[а-яё]*|абонент[а-яё]*|спикер\s*\d+|speaker\s*\d+|роб[оа]т[а-яё]*|бот|ivr|автоответчик|менеджер[а-яё]*|сотрудник[а-яё]*|клиент[а-яё]*|заказчик[а-яё]*|собеседник[а-яё]*)\s*[:\-–]/gim;
const TR_GREET = /оставайтесь на линии|ваш звонок (очень )?важен|нажмите\s+\d|виртуальн[а-яё]+ (ассистент|помощник)|автоответчик|соединяю вас|для (записи|соединения|связи с оператором) нажмите|вы позвонили в .{0,50}(в рабочие|график работы|нерабоч|перезвон)|первый освободивш[а-яё]+ менеджер|для оформления нового заказа/i;
const TR_IVR = /оставайтесь на линии|первый освободивш[а-яё]+ менеджер|для оформления нового заказа|нажмите\s*[«"]?\s*(один|\d)/i;
const TR_SECRETARY = /переда(м|ю)[^.!?]{0,25}абонент|сообщ(аю|у|ают)[^.!?]{0,25}абонент|если абонент захочет|абонент\s+(захочет|перезвонит|свяжется)|зафиксировал[аи]?\s+информацию|(всё|все)\s+передам\b/i;
function stripHtml(s     )         {
  return String(s || "")
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    // Вложенные картинки приходят inline как data:...;base64,<огромный блоб> - это мусор,
    // раздувает снимок и ломает читаемость (особенно в письмах и заметках). Вырезаем.
    .replace(/data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, "[изображение]")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n")
    .replace(/\[\/?[a-z][^\]]*\]/gi, " ").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&quot;/gi, '"').replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function shortDT(s     )         {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[3]}.${m[2]} ${m[4]}:${m[5]}` : "";
}
function dueOf(a     )         {
  for (const v of [a.DEADLINE, a.END_TIME, a.START_TIME]) {
    const s = String(v || "");
    if (!/^\d{4}-\d{2}-\d{2}T/.test(s)) continue;
    const y = Number(s.slice(0, 4));
    if (y < 2000 || y > 2100) continue;
    return s;
  }
  return "";
}
function activityToEvent(a     , mgrName        , callMap                     , callRefs                     )      {
  const p = String(a.PROVIDER_ID || "").toUpperCase();
  if (/SMS|NOTIFICATION|REST_APP/.test(p)) return null;
  const dir = a.DIRECTION === "1" ? "входящее" : a.DIRECTION === "2" ? "исходящее" : "-";
  const who = a.DIRECTION === "1" ? "Клиент" : mgrName;
  const subj = stripHtml(a.SUBJECT), desc = stripHtml(a.DESCRIPTION);
  const st = a.SETTINGS && !Array.isArray(a.SETTINGS) ? a.SETTINGS : {};
  if (a.TYPE_ID === "2" || /CALL|VOX/.test(p)) {
    const ci = callMap[String(a.ID)]; let body = "Звонок", link = "";
    const f = Array.isArray(a.FILES) ? a.FILES[0] : null;   // запись звонка в карточке
    if (ci) {
      link = ci.rec || (f && f.url) || "";
      const hasRec = ci.rec || ci.recId || (f && f.url);
      body = `Звонок ${ci.type === "2" ? "входящий" : ci.type === "1" ? "исходящий" : ""}${ci.dur ? ", " + durfmt(ci.dur) : ""}`;
      body += ci.tr ? " · есть расшифровка" : (hasRec ? " · запись есть (в карточке Б24), транскрипта нет" : "");
    } else { if (subj) body = subj; if (f && f.url) { link = f.url; body += " · запись есть (в карточке Б24)"; } }
    return { raw: a.CREATED, dir, who, type: "Звонок", title: subj || "Звонок", body, status: a.COMPLETED === "Y" ? "состоялся" : "не состоялся", dur: ci && ci.dur ? durfmt(ci.dur) : "", link, src: "act#" + a.ID };
  }
  // Резюме BitrixGPT: дело с меткой IS_AI_CREATED. ASSOCIATED_ENTITY_ID - ID звонка-источника.
  if (st.IS_AI_CREATED === true || st.IS_AI_CREATED === "true") {
    const src = String(a.ASSOCIATED_ENTITY_ID || "");
    const c = src ? callRefs[src] : null;
    const ref = c ? `к звонку #${src} · ${shortDT(c.CREATED)}${c.SUBJECT ? " · " + stripHtml(c.SUBJECT) : ""}` : "";
    return { raw: a.CREATED, dir: "-", who: "BitrixGPT", type: "Резюме BitrixGPT", title: subj, body: cap(desc || subj), status: "", dur: "", link: "", ref, refId: src, src: "act#" + a.ID };
  }
  if (a.TYPE_ID === "4" || /EMAIL|MAIL/.test(p))
    return { raw: a.CREATED, dir, who, type: "Письмо", title: subj, body: cap((subj ? "Тема: " + subj + "\n" : "") + (desc || "")), status: a.COMPLETED === "Y" ? "обработано" : "", dur: "", link: "", src: "act#" + a.ID };
  if (/IMOPENLINES|IMCONNECTOR|IMOL/.test(p))
    return { raw: a.CREATED, dir, who, type: "Мессенджер ОЛ", title: subj, body: cap(desc || subj || "Сессия Открытой линии"), status: "", dur: "", link: "", src: "act#" + a.ID };
  if (a.TYPE_ID === "6" || /CRM_TODO/.test(p)) {
    const due = dueOf(a);
    const status = a.COMPLETED === "Y" ? "выполнено" : (due && due < TO ? "просрочено" : "запланировано");
    return { raw: a.CREATED, dir: "-", who: mgrName, type: "Дело", title: subj, body: cap(desc || subj), status, due, dur: "", link: "", src: "act#" + a.ID };
  }
  return { raw: a.CREATED, dir, who, type: "Активность", title: subj, body: cap(desc || subj), status: a.COMPLETED === "Y" ? "выполнено" : "", due: dueOf(a), dur: "", link: "", src: "act#" + a.ID };
}
function guessOutgoing(nm        , tx        )          {
  if (!AMB_SIG.test(nm.trim())) return false;
  const m = tx.match(RE_ADDRESS);
  if (m && !empFirst[m[1] .toLowerCase()]) return true;   // обращается к клиенту по имени
  return RE_MGR_SPEAK.test(tx);
}
function splitRobotPrefix(text        )                                         {
  // «первый/1-ый/1-й освободившийся менеджер» - последняя фраза IVR. Не требуем слова «первый»:
  // транскрибатор пишет и цифрой («1-ый освободившийся менеджер»).
  let m = text.match(/освободивш[а-яё]+ менеджер[.!?]?/i);
  if (!m) m = text.match(/оставайтесь на линии[^.?!]*[.!?]/i);
  if (!m || m.index === undefined) return null;
  const cut = m.index + m[0].length;
  return { robot: text.slice(0, cut).trim(), rest: text.slice(cut).trim() };
}
function trRole(label        , text        )         {
  const l = label.toLowerCase();
  // РОБОТ БЬЁТ МЕТКУ CRM. Транскрибатор CRM ненадёжен в ролях (лид 52589: IVR и автосекретарь
  // помечены как «Клиент»), поэтому содержательные маркеры робота - постоянный IVR-скрипт и речь
  // автосекретаря про «абонента» - проверяем ПЕРВЫМИ, до доверия метке.
  if (/роб[оа]т|^бот$|ivr|автоответчик/.test(l)) return "Робот";
  if (TR_GREET.test(text) || TR_SECRETARY.test(text)) return "Робот";
  if (/оператор|менеджер|сотрудник/.test(l)) return "Менеджер";
  if (/клиент|абонент|заказчик|собеседник/.test(l)) return "Клиент";
  if (RE_MGR_SPEAK.test(text)) return "Менеджер";   // речь от лица компании (КП/расчёт/«меня зовут»)
  return "";                                          // не выдумываем: оставляем метку как есть
}
function parseTranscript(text        )                                                                                            {
  // 1) Формат с явными метками спикера («Оператор:/Клиент:/Спикер 1:»).
  const re = new RegExp(TR_TURN.source, "gim");
  const marks                                   = [];
  let m                        ;
  while ((m = re.exec(text))) marks.push({ idx: m.index, label: m[1]  });
  if (marks.length >= 3) {
    const turns                                                  = [];
    for (let i = 0; i < marks.length; i++) {
      const seg = text.slice(marks[i] .idx, i + 1 < marks.length ? marks[i + 1] .idx : text.length);
      const colon = seg.search(/[:\-–]/);
      const body = (colon >= 0 ? seg.slice(colon + 1) : seg).trim();
      turns.push({ role: trRole(marks[i] .label, body), label: marks[i] .label.trim(), text: body });
    }
    return { turns, ok: true };
  }
  // 2) Формат «Транскрибатор CRM»: сплошной текст без меток, но с IVR-приветствием.
  // Робота вырезаем железно (скрипт постоянный), остальное держим одним блоком - разделение
  // менеджер/клиент из сплошного текста надёжно не сделать (нужна диаризация или ИИ-разбор).
  if (TR_IVR.test(text) && text.length > 150) {
    const sp = splitRobotPrefix(text);
    const turns                                                  = [];
    if (sp && sp.robot) turns.push({ role: "Робот", label: "Робот", text: sp.robot });
    const body = sp ? sp.rest : text;
    if (body) turns.push({ role: "", label: "Менеджер и клиент", text: body });
    return { turns, ok: true, undiar: true };
  }
  return { turns: [], ok: false };
}
function commentToEvent(c     , employees                   , authorName        )      {
  const raw = String(c.COMMENT || "");
  if (/wazzup24\.com/i.test(raw)) {
    let chan = "WhatsApp";
    const mi = raw.match(/wazzup24\.com\/images\/bitrix\/(\w+)\.(?:png|svg|jpg)/i);
    if (mi) { const k = (mi[1] || "").toLowerCase(); chan = k === "max" ? "MAX" : k === "telegram" ? "Telegram" : (k === "whatsapp" || k === "wapp") ? "WhatsApp" : k === "instagram" ? "Instagram" : k.charAt(0).toUpperCase() + k.slice(1); }
    let body = stripHtml(raw.replace(/\[img\][^\[]*\[\/img\]/gi, " ").replace(/&nbsp;/gi, " "));
    let nm = "", tx = body; const idx = body.indexOf(":");
    if (idx > 0 && idx < 40) { nm = body.slice(0, idx).trim(); tx = body.slice(idx + 1).trim(); }
    const isEmp = nm && employees[nm.toLowerCase()];
    // Wazzup помечает исходящие медиа/сообщения префиксом «Отправлено <тип>». Это надёжный
    // признак направления для подписи «Телефон», где имя не разрешилось. «Принято/Получено» - входящее.
    const sentMark = /^Отправлено\b/.test(tx);
    const guessed = !isEmp && (sentMark || guessOutgoing(nm || "—", tx));
    const fired = isEmp && firedSet[nm.toLowerCase()] === 1;   // сотрудник уволен/деактивирован в Bitrix
    return { raw: c.CREATED, type: "Сообщение " + chan, dir: (isEmp || guessed) ? "исходящее" : "входящее",
             who: (nm || "—") + (fired ? " (уволен)" : ""), fired: fired ? 1 : 0, guess: guessed ? 1 : 0, title: "", body: cap(tx), status: "", dur: "", link: "", src: "cmt#" + c.ID };
  }
  const txt = stripHtml(raw);
  const tr = parseTranscript(txt);
  if (tr.ok) {
    // Транскрипт звонка: не обрезаем стандартным cap() (расшифровки длинные), даём разбивку по
    // ролям (гипотеза). В теле - «Роль: реплика» построчно; структура в поле speakers.
    const disp = tr.turns.map((t) => `${t.role || t.label}: ${t.text}`).join("\n");
    return { raw: c.CREATED, type: "Транскрипт звонка", dir: "-", who: authorName || "Расшифровка", title: "",
             body: disp,
             speakers: tr.turns, roleGuess: 1, undiar: tr.undiar ? 1 : 0, status: "", dur: "", link: "", src: "cmt#" + c.ID };
  }
  return { raw: c.CREATED, type: "Комментарий-заметка", dir: "-", who: authorName, title: "", body: cap(txt), status: "", dur: "", link: "", src: "cmt#" + c.ID };
}

return {activity(a,mgr){a={...a,TYPE_ID:String(a.TYPE_ID),DIRECTION:String(a.DIRECTION)};let e=activityToEvent(a,mgr,{},{});if(!e)e={raw:a.CREATED,type:/SMS/i.test(a.PROVIDER_ID||'')?'SMS':'Уведомление CRM',dir:a.DIRECTION==='1'?'входящее':a.DIRECTION==='2'?'исходящее':'-',who:mgr,title:stripHtml(a.SUBJECT),body:stripHtml(a.DESCRIPTION)||stripHtml(a.SUBJECT),status:'',src:'act#'+a.ID};if(a.PROVIDER_ID==='CRM_ENTITY_EXCLUSION')e.type='Служебное событие';if(e.type==='Дело')e.status=a.COMPLETED==='Y'?'выполнено':e.due&&Number.isFinite(Date.parse(e.due))&&Date.parse(e.due)<now?'просрочено':'запланировано';if(e.type==='Звонок')e.status=a.COMPLETED==='Y'?'завершено':'открытое дело';return e;},comment:c=>commentToEvent(c,employees,names[String(c.AUTHOR_ID)]||'CRM')};
};
