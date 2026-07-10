/* GEO-MONSTER · Content Forge (M4) + внешние площадки (M5) + image-промты.
   Стандарты вшиты из скиллов GENGROUP: humanizer-ru, geo-aeo, content-factory. */
(function () {
"use strict";

/* ---------- 8.1 Anti-slop / humanizer-ru (полный текст для системных промтов) ---------- */
const ANTI_SLOP = `ПРАВИЛА ТЕКСТА (нарушение любого пункта = брак, перепиши абзац):
1. Em dash (длинное тире) ЗАПРЕЩЁН везде. Только дефис или перестрой фразу.
2. Запрещены канцеляризмы: "данный", "осуществлять", "в рамках", "является", "представляет собой", "не секрет что", "на протяжении веков", "в современном мире", "в мире современного дизайна".
3. Запрещены пустые обещания без цифр: "высочайшее качество", "широкий ассортимент", "индивидуальный подход", "доступные цены", "идеальное решение", "уникальный" без объяснения механики.
4. Запрещены формульные концовки ("подводя итог", "в заключение") и rule of three ради ритма.
5. Конструкция "не X, а Y" - максимум 1 раз на весь текст.
6. В каждом абзаце - конкретика: цифры, мм, м2, рубли, сроки, названия моделей и палитр.
7. Каждый абзац самодостаточен: его можно вырезать и он сохранит смысл (extractability для AI-цитирования).
8. Тест анти-медианы: если такой же абзац сгенерирует дефолтный ChatGPT без брифа - переписать конкретнее.
9. Предложения разной длины: чередуй короткие (5-8 слов) со средними и длинными.
10. Каждая цифра либо из брифа/фактов бренда, либо помечена [УТОЧНИТЬ] - выдумывать цифры запрещено.`;

/* ---------- 8.2 GEO/AEO-чеклист страницы ---------- */
const GEO_CHECKLIST = [
  "Прямой ответ на главный запрос в первых двух предложениях",
  "FAQ-блок 4-8 вопросов + разметка FAQPage (JSON-LD)",
  "Schema.org: Organization, Product/Service, BreadcrumbList - валидный JSON-LD",
  "Таблица сравнения или спецификаций (AI-системы берут данные из таблиц чаще)",
  "Цифры и факты с единицами измерения, дата обновления, именной автор",
  "Консистентность сущности: одинаковое написание бренда на всех страницах",
  "Внутренние ссылки: на пиллар и 2-3 сателлита"
];

/* ---------- платформы (M5) ---------- */
const PLATFORMS = {
  vc: {
    name: "vc.ru", who: "Бизнес-аудитория: предприниматели, маркетологи, дизайнеры интерьера как ЛПР.",
    format: "Кейсы с цифрами, лонгриды с H2/H3, честный опыт производства. 6 000-15 000 знаков.",
    why: "Сильный домен: статьи индексируются Яндексом и Google, дают SEO-хвост и цитируются нейросетями чаще других площадок рунета [ГИПОТЕЗА: geo-intel, внешне не сверено]. В каждую статью вшивать 1-2 запроса из модуля «Семантика».",
    templates: ["Кейс проекта: задача - решение - цифры", "Разбор рынка/ниши с таблицей сравнения", "Как мы делаем X: производственный процесс изнутри"],
    utm: { source: "vc", medium: "article" }
  },
  dzen: {
    name: "dzen.ru", who: "Широкая аудитория, алгоритмическая лента. Решают дочитывания и CTR обложки.",
    format: "1500-4000 знаков, цепкий но честный заголовок, картинка каждые 2-3 абзаца, один смысл на текст.",
    why: "Дистрибуция бесплатная, лента сама находит аудиторию. Для GLASS-MEMORY - деликатный тон обязателен.",
    templates: ["История одного заказа (с фото до/после)", "5 ошибок при выборе X (каждая с ценой ошибки в рублях)", "Что будет, если... (страх клиента -> разбор)"],
    utm: { source: "dzen", medium: "article" }
  },
  dtf: {
    name: "dtf.ru", who: "Гейм- и поп-культурная аудитория.",
    format: "Лонгриды и подборки в культуре площадки, без корпоративного тона.",
    why: "Узкая релевантность для наших ниш. Использовать только точечно.",
    templates: ["Сетап мечты: рабочее место геймера со стеклом и металлом", "Интерьер как из киберпанка: неон + зеркала"],
    utm: { source: "dtf", medium: "article" }
  }
};
function platformFit(projId, key) {
  if (key === "dtf") {
    if (projId === "glass-memory") return { ok: false, note: "Не рекомендовано: ритуальная тематика конфликтует с развлекательной культурой площадки. Публикация повредит бренду - аудитория отреагирует негативно, модерация может снять материал." };
    return { ok: "narrow", note: "Узкий угол: только «интерьер геймера, сетапы, неон». Прямые продажи перегородок здесь не работают." };
  }
  if (key === "vc" && projId === "glass-memory") return { ok: true, note: "Рабочий угол - B2B: статьи для дилеров (экономика точки, ассортимент, логистика), не для конечных покупателей." };
  if (key === "dzen" && projId === "glass-memory") return { ok: true, note: "Деликатный тон обязателен: без кликбейта на горе, фокус на памяти и качестве изделия." };
  return { ok: true, note: "" };
}

/* ---------- сборка промт-пакета (8.3) ---------- */
function brandBlock(p) {
  return `ФАКТЫ БРЕНДА ${p.brand} (использовать, не выдумывать новые):
${(p.brand_facts || []).map((f) => "- " + f).join("\n")}
Вертикаль: ${p.vertical}
Домен: ${p.domain}`;
}
function jsonLd(p, type, title) {
  const org = { "@context": "https://schema.org", "@type": "Organization", name: p.brand, url: "https://" + p.domain };
  const faq = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "[ВОПРОС 1 из FAQ-блока]", acceptedAnswer: { "@type": "Answer", text: "[ОТВЕТ с брендом и цифрой]" } }] };
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Главная", item: "https://" + p.domain + "/" }, { "@type": "ListItem", position: 2, name: title || "[РАЗДЕЛ]" }] };
  const arr = [org, faq, crumbs];
  if (type === "pillar" || type === "satellite") arr.push({ "@context": "https://schema.org", "@type": "Article", headline: title || "[H1]", author: { "@type": "Organization", name: p.brand }, dateModified: "[ДАТА ПУБЛИКАЦИИ]" });
  return JSON.stringify(arr, null, 2);
}
function articlePrompt(brief) {
  const p = brief.project;
  const typeMap = { pillar: "Пиллар (основная страница кластера, 2000-2500 слов)", satellite: "Сателлит (страница под узкий интент, 1200-1800 слов)", faq: "FAQ-страница (вопросы реальных клиентов, 800-1200 слов)", compare: "Сравнение (X vs Y, с таблицей, 1200-1800 слов)" };
  return `Ты - автор-эксперт бренда ${p.brand} с опытом работы на производстве. Пишешь для ${p.domain}.

ЗАДАЧА: написать статью типа «${typeMap[brief.type] || brief.type}».

БРИФ:
- Целевые запросы: ${brief.queries || "[ЗАПРОСЫ ИЗ МОДУЛЯ СЕМАНТИКА]"}
- Интент: ${brief.intent}
- Целевая аудитория: ${brief.audience || "клиент без технической экспертизы; снимай страхи цифрами"}

${brandBlock(p)}

СТРУКТУРА (жёсткая):
1. H1 (может отличаться от title, расширенная версия).
2. Первые 2 предложения = прямой ответ на главный запрос + полное имя бренда, город, специализация (Entity Definition).
3. H2-блоки от задач читателя, в каждом минимум 3 конкретных числа.
4. Минимум 1 таблица сравнения или спецификаций.
5. FAQ-блок 4-8 вопросов, каждый ответ содержит бренд + цифру.
6. Inline CTA каждые 600-800 слов (расчёт/замер/консультация).
7. Именной эксперт минимум 1 раз (имя + квалификация, не «наши специалисты»).

${ANTI_SLOP}

GEO/AEO-ТРЕБОВАНИЯ (страница обязана пройти все 7):
${GEO_CHECKLIST.map((c, i) => `${i + 1}. ${c}`).join("\n")}

ФОРМАТ ВЫДАЧИ:
- 3 варианта заголовка (title до 60 знаков).
- Meta description до 155 знаков: ответ + ценность + CTA. Без непроверенных цен.
- Текст статьи в HTML (H2, H3, p, table, ul).
- FAQ-блок отдельно.
- План перелинковки: 3 исходящие ссылки на свои страницы + 2 страницы, которые должны сослаться сюда.
- 2 CTA-блока (текст кнопки + подводка).

JSON-LD (вставить в head, заполнить плейсхолдеры реальными данными статьи):
${jsonLd(p, brief.type, null)}`;
}
function platformPrompt(brief) {
  const p = brief.project, pl = PLATFORMS[brief.platform];
  const fit = platformFit(p.id, brief.platform);
  return `Ты - автор бренда ${p.brand}, пишешь ДЛЯ ПЛОЩАДКИ ${pl.name} в её культуре, не пресс-релиз.

ПЛОЩАДКА: ${pl.name}. Аудитория: ${pl.who}
Формат: ${pl.format}
${fit.note ? "ОГРАНИЧЕНИЕ ПЛОЩАДКИ: " + fit.note : ""}

ЗАДАЧА: статья «${brief.title || "[ТЕМА ИЗ СЕМАНТИКИ]"}» по шаблону «${brief.template}».
Целевые запросы для SEO-хвоста (вшить естественно, 1-2 раза каждый): ${brief.queries || "[ЗАПРОСЫ ИЗ М2]"}

${brandBlock(p)}

ЧЕСТНОСТЬ: если материал само-авторский (пишем о своём бренде) - в тексте это раскрывается прямо («мы в ${p.brand} делаем...»), скрытая реклама и фейк-нейтральность запрещены. Если формат «рейтинг/подборка» - бренд идёт как один из участников, не единственный, с честными критериями.

${ANTI_SLOP}

ФОРМАТ ВЫДАЧИ:
- 3 варианта заголовка под площадку.
- Лид-абзац (2-3 предложения, без воды).
- Структура H2/H3 с тезисами каждого блока.
- Полный текст.
- Подпись с раскрытием авторства.
- UTM-ссылка на сайт: https://${p.domain}/?utm_source=${pl.utm.source}&utm_medium=${pl.utm.medium}&utm_campaign=[КАМПАНИЯ]`;
}

/* ---------- image-промты ---------- */
const IMG_MODELS = {
  gpt: { name: "GPT (gpt-image / DALL-E)", hint: "развёрнутое описание сцены: стиль, свет, композиция, материалы" },
  banana: { name: "Nano Banana (Gemini image)", hint: "серии в одном стиле, консистентность, рендер текста на изображении" },
  grok: { name: "Grok (Aurora)", hint: "фотореализм, смелые ракурсы" }
};
const IMG_FORMATS = { "vc-cover": "обложка vc.ru 1600x900", "dzen-cover": "обложка dzen 1280x720", square: "квадрат 1:1", vertical: "вертикаль 3:4" };
const BRAND_STYLE = "glass and metal surfaces, loft interior, warm directional light, matte black steel profiles, natural reflections, premium minimalism, no close-up people, no text overlays unless asked";
function imagePrompt(model, format, subject, p) {
  const ar = { "vc-cover": "16:9 (1600x900)", "dzen-cover": "16:9 (1280x720)", square: "1:1", vertical: "3:4" }[format];
  const subj = subject || "glass partition dividing a loft living room";
  if (model === "gpt") {
    return { en: `Editorial interior photograph for a premium glass-and-metal furniture brand. Scene: ${subj}. Style: ${BRAND_STYLE}. Composition: wide shot, rule of thirds, generous negative space for headline. Lighting: warm late-afternoon window light with soft shadows. Aspect ratio ${ar}. High detail, realistic materials, no watermark.`, ru: `Редакционное интерьерное фото: ${subj}. Лофт, стекло и металл, тёплый свет, место под заголовок. Формат ${ar}.` };
  }
  if (model === "banana") {
    return { en: `Create image 1 of a consistent series (same style, palette and camera angle across the whole series). Subject: ${subj}. Series style: ${BRAND_STYLE}. Keep identical color grading and lens across all images in this series. If text is required, render clean Cyrillic label exactly as provided. Aspect ratio ${ar}.`, ru: `Первая картинка серии в едином стиле (одинаковая палитра и ракурс для всей серии): ${subj}. Кириллический текст рендерить точно как задан. Формат ${ar}.` };
  }
  return { en: `Photorealistic bold interior shot, cinematic contrast. Subject: ${subj}. Style: ${BRAND_STYLE}, dramatic depth of field, slightly low camera angle for presence. Aspect ratio ${ar}. No people in focus, no text.`, ru: `Фотореалистичный смелый кадр: ${subj}. Кинематографичный контраст, низкий ракурс. Формат ${ar}.` };
}

/* ---------- M4 view ---------- */
function viewForge(root, ctx) {
  const p = ctx.state.proj;
  const top = ctx.priorityList().slice(0, 12);
  root.innerHTML = `
    <div class="grid g2 mb">
      <div class="card"><h3>Бриф статьи</h3>
        <form class="stack" id="fgForm">
          <label class="f">Тип
            <select id="fgType"><option value="pillar">Пиллар</option><option value="satellite">Сателлит</option><option value="faq">FAQ-страница</option><option value="compare">Сравнение</option></select></label>
          <label class="f">Целевые запросы (из семантики, через запятую)
            <input id="fgQ" placeholder="${ctx.esc(top.slice(0, 2).map((x) => x.phrase).join(", "))}"></label>
          <label class="f">Интент
            <select id="fgI"><option>commercial</option><option>transactional</option><option>informational</option></select></label>
          <label class="f">Целевая аудитория
            <input id="fgA" placeholder="делает ремонт, техэкспертиза около нуля, боится цены и монтажа"></label>
          <button class="btn" type="submit">Собрать промт-пакет</button>
        </form>
        <p class="dim mt">Топ приоритетов из М2: ${top.slice(0, 5).map((x) => `<span class="tag">${ctx.esc(x.phrase)}</span>`).join(" ")}</p>
      </div>
      <div class="card"><h3>Генератор image-промтов</h3>
        <form class="stack" id="imForm">
          <label class="f">Модель
            <select id="imM">${Object.entries(IMG_MODELS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("")}</select></label>
          <label class="f">Формат
            <select id="imF">${Object.entries(IMG_FORMATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
          <label class="f">Сюжет (EN или RU)
            <input id="imS" placeholder="glass partition in a loft kitchen, black steel frame"></label>
          <button class="btn" type="submit">Собрать промт</button>
        </form>
        <p class="dim mt" id="imHint">${IMG_MODELS.gpt.hint}</p>
      </div>
    </div>
    <div id="fgOut"></div>`;

  const out = root.querySelector("#fgOut");
  function block(title, text) {
    const wrap = document.createElement("div"); wrap.className = "out-block";
    const head = document.createElement("div"); head.className = "head";
    head.innerHTML = `<span style="flex:1">${ctx.esc(title)}</span>`;
    head.appendChild(ctx.copyBtn(text));
    const pre = document.createElement("pre"); pre.textContent = text;
    wrap.append(head, pre); return wrap;
  }
  root.querySelector("#fgForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const brief = { project: p, type: root.querySelector("#fgType").value, queries: root.querySelector("#fgQ").value.trim(), intent: root.querySelector("#fgI").value, audience: root.querySelector("#fgA").value.trim() };
    const prompt = articlePrompt(brief);
    out.innerHTML = "";
    out.appendChild(block(`Промт-пакет · ${p.brand} · ${brief.type}`, prompt));
    const dl = document.createElement("div"); dl.className = "row mt";
    const b1 = document.createElement("button"); b1.className = "btn sm"; b1.textContent = "Скачать .md";
    b1.addEventListener("click", () => ctx.download(`forge-${p.id}-${brief.type}.md`, prompt, "text/markdown"));
    dl.appendChild(b1); out.appendChild(dl);
    out.scrollIntoView({ behavior: "smooth" });
  });
  root.querySelector("#imM").addEventListener("change", (e) => { root.querySelector("#imHint").textContent = IMG_MODELS[e.target.value].hint; });
  root.querySelector("#imForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const m = root.querySelector("#imM").value, f = root.querySelector("#imF").value, s = root.querySelector("#imS").value.trim();
    const pr = imagePrompt(m, f, s, p);
    out.innerHTML = "";
    out.appendChild(block(`Image-промт · ${IMG_MODELS[m].name} · ${IMG_FORMATS[f]}`, pr.en));
    out.appendChild(block("Русская подпись (для alt/подписи под фото)", pr.ru));
    out.scrollIntoView({ behavior: "smooth" });
  });
}

/* ---------- M5 view ---------- */
function viewExt(root, ctx) {
  const p = ctx.state.proj;
  const calKey = `gm.cal.${p.id}`;
  root.innerHTML = `
    <div class="grid g3 mb" id="platCards"></div>
    <div class="grid g2 mb">
      <div class="card"><h3>Генератор статьи под площадку</h3>
        <form class="stack" id="exForm">
          <label class="f">Площадка<select id="exP">${Object.keys(PLATFORMS).map((k) => `<option value="${k}">${PLATFORMS[k].name}</option>`).join("")}</select></label>
          <label class="f">Шаблон<select id="exT"></select></label>
          <label class="f">Тема / рабочий заголовок<input id="exTitle" placeholder="Как мы делаем стеклянные перегородки: 7 этапов производства"></label>
          <label class="f">Запросы из семантики (SEO-хвост)<input id="exQ" placeholder="${ctx.esc(ctx.priorityList().slice(0, 2).map((x) => x.phrase).join(", "))}"></label>
          <button class="btn" type="submit">Собрать промт-пакет</button>
          <p class="dim" id="exWarn"></p>
        </form>
      </div>
      <div class="card"><h3>UTM-конструктор</h3>
        <form class="stack" id="utmForm">
          <label class="f">Страница<input id="utmUrl" value="https://${ctx.esc(p.domain)}/"></label>
          <div class="row">
            <label class="f" style="flex:1">Source<select id="utmS"><option>vc</option><option>dzen</option><option>dtf</option><option>telegram</option></select></label>
            <label class="f" style="flex:1">Medium<select id="utmM"><option>article</option><option>post</option><option>profile</option></select></label>
            <label class="f" style="flex:1">Campaign<input id="utmC" placeholder="peregorodki-q3"></label>
          </div>
          <div class="row"><button class="btn sm" type="submit">Собрать</button><span id="utmOutWrap" class="row"></span></div>
          <input id="utmOut" readonly class="mono" style="font-size:12px">
        </form>
        <h3 class="mt">Календарь публикаций <span class="dim">в браузере</span></h3>
        <form class="row" id="calForm">
          <input type="date" id="calD" required><select id="calP2"><option>vc</option><option>dzen</option><option>dtf</option></select>
          <input id="calT" placeholder="Название материала" style="flex:1" required>
          <button class="btn sm" type="submit">+</button>
        </form>
        <div id="calList" class="mt"></div>
      </div>
    </div>
    <div id="exOut"></div>`;

  /* карточки платформ */
  root.querySelector("#platCards").innerHTML = Object.entries(PLATFORMS).map(([k, pl]) => {
    const fit = platformFit(p.id, k);
    const cls = fit.ok === false ? "no" : fit.ok === "narrow" ? "narrow" : "";
    const tag = fit.ok === false ? '<span class="tag bad">не рекомендовано</span>' : fit.ok === "narrow" ? '<span class="tag warn">узкий угол</span>' : '<span class="tag ok">рекомендовано</span>';
    return `<div class="card plat ${cls}"><h3>${pl.name} ${tag}</h3>
      <p class="dim">${ctx.esc(pl.who)}</p>
      <ul><li><b>Формат:</b> ${ctx.esc(pl.format)}</li><li><b>Зачем:</b> ${ctx.esc(pl.why)}</li>${fit.note ? `<li><b>Для ${ctx.esc(p.brand)}:</b> ${ctx.esc(fit.note)}</li>` : ""}</ul>
      <p class="dim mt">Шаблоны: ${pl.templates.map((t) => `<span class="tag">${ctx.esc(t)}</span>`).join(" ")}</p></div>`;
  }).join("");

  const selP = root.querySelector("#exP"), selT = root.querySelector("#exT"), warn = root.querySelector("#exWarn");
  function syncTemplates() {
    const pl = PLATFORMS[selP.value];
    selT.innerHTML = pl.templates.map((t) => `<option>${ctx.esc(t)}</option>`).join("");
    const fit = platformFit(p.id, selP.value);
    warn.textContent = fit.ok === false ? "Площадка помечена «не рекомендовано» для этого проекта: " + fit.note : (fit.note || "");
    warn.style.color = fit.ok === false ? "var(--bad)" : "var(--muted)";
  }
  syncTemplates();
  selP.addEventListener("change", syncTemplates);

  const out = root.querySelector("#exOut");
  root.querySelector("#exForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fit = platformFit(p.id, selP.value);
    out.innerHTML = "";
    if (fit.ok === false) {
      out.innerHTML = `<div class="card" style="border-color:var(--bad)"><h3 style="color:var(--bad)">Стоп: площадка не подходит</h3><p class="muted">${ctx.esc(fit.note)}</p><p class="dim mt">Возьми vc.ru (B2B для дилеров) или dzen.ru (деликатный тон) - карточки выше.</p></div>`;
      return;
    }
    const prompt = platformPrompt({ project: p, platform: selP.value, template: selT.value, title: root.querySelector("#exTitle").value.trim(), queries: root.querySelector("#exQ").value.trim() });
    const wrap = document.createElement("div"); wrap.className = "out-block";
    const head = document.createElement("div"); head.className = "head";
    head.innerHTML = `<span style="flex:1">Промт-пакет · ${PLATFORMS[selP.value].name} · ${ctx.esc(p.brand)}</span>`;
    head.appendChild(ctx.copyBtn(prompt));
    const pre = document.createElement("pre"); pre.textContent = prompt;
    wrap.append(head, pre); out.appendChild(wrap);
    out.scrollIntoView({ behavior: "smooth" });
  });

  /* UTM */
  root.querySelector("#utmForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const base = root.querySelector("#utmUrl").value.trim().replace(/[?#].*$/, "");
    const u = `${base}?utm_source=${root.querySelector("#utmS").value}&utm_medium=${root.querySelector("#utmM").value}&utm_campaign=${encodeURIComponent(root.querySelector("#utmC").value.trim() || "seo-hub")}`;
    const outI = root.querySelector("#utmOut"); outI.value = u;
    const w = root.querySelector("#utmOutWrap"); w.innerHTML = ""; w.appendChild(ctx.copyBtn(u, "Копировать URL"));
  });

  /* календарь */
  function drawCal() {
    const items = ctx.ls.get(calKey, []).slice().sort((a, b) => a.date < b.date ? -1 : 1);
    root.querySelector("#calList").innerHTML = items.map((it, i) => `<div class="signal"><span class="mono dim">${ctx.esc(it.date)}</span><span class="tag">${ctx.esc(it.platform)}</span><span style="flex:1">${ctx.esc(it.title)}</span><button class="btn ghost sm" data-ci="${i}">×</button></div>`).join("") || '<div class="empty">Публикаций не запланировано</div>';
    root.querySelectorAll("[data-ci]").forEach((b) => b.addEventListener("click", () => {
      const items2 = ctx.ls.get(calKey, []).slice().sort((a, b2) => a.date < b2.date ? -1 : 1);
      items2.splice(+b.dataset.ci, 1); ctx.ls.set(calKey, items2); drawCal();
    }));
  }
  root.querySelector("#calForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const items = ctx.ls.get(calKey, []);
    items.push({ date: root.querySelector("#calD").value, platform: root.querySelector("#calP2").value, title: root.querySelector("#calT").value.trim() });
    ctx.ls.set(calKey, items); root.querySelector("#calT").value = ""; drawCal();
  });
  drawCal();
}

window.Forge = { viewForge, viewExt, GEO_CHECKLIST, ANTI_SLOP, PLATFORMS, imagePrompt };
})();
