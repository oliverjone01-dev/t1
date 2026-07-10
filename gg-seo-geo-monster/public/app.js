/* GEO-MONSTER · GENGROUP internal · app core
   Статика без сборки: hash-роутер, данные из data/ (живые) с fallback на demo/. */
(function () {
"use strict";

/* ---------- utils ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => n == null ? "-" : Math.round(n).toLocaleString("ru-RU");
const fmt1 = (n) => n == null ? "-" : (+n).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
const rub = (n) => fmt(n) + " ₽";
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } }
};
async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function download(name, text, mime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime || "text/plain;charset=utf-8" }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function copyBtn(getText, label) {
  const b = document.createElement("button");
  b.className = "btn ghost sm"; b.textContent = label || "Копировать";
  b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(typeof getText === "function" ? getText() : getText); }
    catch { const t = document.createElement("textarea"); t.value = typeof getText === "function" ? getText() : getText; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    const old = b.textContent; b.textContent = "Скопировано"; b.classList.add("copied");
    setTimeout(() => { b.textContent = old; b.classList.remove("copied"); }, 1400);
  });
  return b;
}
const badge = (demo) => `<span class="${demo ? "badge-demo" : "badge-live"}">${demo ? "DEMO" : "LIVE"}</span>`;

/* ---------- SVG line chart (без библиотек) ---------- */
function lineChart(series, opts) {
  const o = Object.assign({ h: 150, pad: 6 }, opts);
  const all = series.flatMap((s) => s.points.map((p) => p.value));
  if (!all.length) return '<div class="empty">Нет данных для графика</div>';
  const min = Math.min(...all), max = Math.max(...all), span = (max - min) || 1;
  const W = 600, H = o.h, P = o.pad, n = Math.max(...series.map((s) => s.points.length));
  const x = (i) => P + (i / Math.max(1, n - 1)) * (W - 2 * P);
  const y = (v) => H - P - ((v - min) / span) * (H - 2 * P - 14);
  let g = "";
  for (const s of series) {
    const pts = s.points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
    g += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>`;
    s.points.forEach((p, i) => { g += `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="5" fill="transparent"><title>${esc(p.date)}: ${fmt(p.value)}</title></circle>`; });
  }
  const first = series[0].points[0], last = series[0].points[series[0].points.length - 1];
  g += `<text x="${P}" y="${H - 1}" font-size="9.5" fill="#6B6A66" font-family="ui-monospace,monospace">${esc(first ? first.date : "")}</text>`;
  g += `<text x="${W - P}" y="${H - 1}" text-anchor="end" font-size="9.5" fill="#6B6A66" font-family="ui-monospace,monospace">${esc(last ? last.date : "")}</text>`;
  const legend = series.length > 1 ? `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div>` : "";
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="график">${g}</svg>${legend}`;
}

/* ---------- state & data ---------- */
const state = { projects: [], proj: null, data: {}, demo: {}, meta: null };

function mergedProjects(base) {
  const over = ls.get("gm.projects.override", {});
  return base.map((p) => Object.assign({}, p, over[p.id] || {}));
}
async function fetchJSON(url) {
  try { const r = await fetch(url, { cache: "no-store" }); if (!r.ok) return null; return await r.json(); }
  catch { return null; }
}
/* на проде data/ и config/ копируются внутрь /seo/; при локальном запуске из public/
   они лежат уровнем выше - пробуем оба пути */
async function firstJSON(urls) {
  for (const u of urls) { const j = await fetchJSON(u); if (j) return j; }
  return null;
}
async function loadSource(id, name) {
  const live = await firstJSON([`data/${id}/${name}.json`, `../data/${id}/${name}.json`]);
  if (live) { state.demo[name] = !!live.demo; return live; }
  const demo = await fetchJSON(`demo/${id}/${name}.json`);
  state.demo[name] = true;
  return demo;
}
async function loadProjectData(id) {
  state.data = {}; state.demo = {};
  const [keysso, metrika, direct, semantics] = await Promise.all(
    ["keysso", "metrika", "direct", "semantics"].map((n) => loadSource(id, n)));
  state.data = { keysso, metrika, direct, semantics };
  state.meta = await firstJSON(["data/meta.json", "../data/meta.json", "demo/meta.json"]);
}

/* CSV-оверлей семантики (импорт выгрузок Keys.so без API) */
const csvKey = (id) => `gm.csv.${id}`;
function semanticsPhrases() {
  const base = (state.data.semantics && state.data.semantics.phrases) || [];
  const extra = ls.get(csvKey(state.proj.id), []);
  const seen = new Set(base.map((p) => p.phrase.toLowerCase()));
  return base.concat(extra.filter((p) => !seen.has(p.phrase.toLowerCase())));
}
const STOP = new Set(["для", "как", "что", "или", "под", "при", "из", "на", "в", "с", "и", "не", "по", "от", "до", "за", "the", "купить", "цена", "заказать", "москва", "стоимость"]);
function guessCluster(phrase) {
  const t = phrase.toLowerCase().split(/\s+/).find((w) => w.length > 3 && !STOP.has(w));
  return t || "прочее";
}
function guessIntent(p) {
  const s = p.toLowerCase();
  if (/(куп|цена|заказ|стоимост|прайс)/.test(s)) return "transactional";
  if (/^(как|что|почему|сколько|какой|чем)/.test(s)) return "informational";
  return "commercial";
}
function parseCSV(text) {
  const firstLine = text.slice(0, text.indexOf("\n") + 1 || 200);
  const delim = [";", "\t", ","].map((d) => [d, (firstLine.match(new RegExp("\\" + d, "g")) || []).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let cur = [""], inQ = false, row = cur;
  for (const ch of text) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (!inQ && ch === delim) { row.push(""); continue; }
    if (!inQ && (ch === "\n" || ch === "\r")) { if (row.length > 1 || row[0]) { rows.push(row); } row = [""]; continue; }
    row[row.length - 1] += ch;
  }
  if (row.length > 1 || row[0]) rows.push(row);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (names) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const iP = idx(["фраза", "запрос", "keyword", "phrase"]), iPos = idx(["позици", "pos"]),
        iF = idx(["частот", "ws", "freq", "показ"]), iU = idx(["url", "адрес", "страниц"]);
  if (iP < 0) return [];
  return rows.slice(1).map((r) => {
    const phrase = (r[iP] || "").trim();
    if (!phrase) return null;
    return {
      phrase,
      pos: iPos >= 0 ? parseInt(r[iPos]) || null : null,
      freq: iF >= 0 ? parseInt(String(r[iF]).replace(/\D/g, "")) || 0 : 0,
      url: iU >= 0 ? (r[iU] || "").trim() : "",
      cluster: guessCluster(phrase), intent: guessIntent(phrase), csv: true
    };
  }).filter(Boolean);
}

/* приоритизация: частотка × близость к топ-10 + буст Директа (платим, но нет в органик топ-10) */
function tokens(s) { return new Set(s.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))); }
function priorityList() {
  const dq = ((state.data.direct && state.data.direct.search_queries) || []).map((q) => ({ q, t: tokens(q.query) }));
  return semanticsPhrases().map((p) => {
    const pos = p.pos || 101;
    const closeness = pos <= 10 ? 0.2 : pos <= 20 ? 1 : pos <= 30 ? 0.7 : pos <= 50 ? 0.4 : 0.2;
    const pt = tokens(p.phrase);
    const paid = dq.find((d) => { let c = 0; for (const w of pt) if (d.t.has(w)) c++; return c >= 2; });
    const boost = paid && pos > 10 ? 1.5 : 1;
    return Object.assign({}, p, { score: Math.round((p.freq || 0) * closeness * boost), paid: !!paid && pos > 10 });
  }).sort((a, b) => b.score - a.score);
}

/* сигналы для дашборда */
function signals() {
  const out = [];
  const k = state.data.keysso, m = state.data.metrika;
  if (k && k.deltas) {
    for (const d of k.deltas.dropped_top10 || []) out.push({ ico: "▼", cls: "bad", text: `Выпал из топ-10: «${d.phrase}» (${d.from} → ${d.to})` });
    for (const d of k.deltas.entered_top10 || []) out.push({ ico: "▲", cls: "ok", text: `Вошёл в топ-10: «${d.phrase}» (${d.from} → ${d.to})` });
    for (const d of k.deltas.competitor_up || []) out.push({ ico: "⚠", cls: "warn", text: `Конкурент растёт: ${d.domain} (+${fmt1(d.delta)}% видимости)` });
  }
  if (m && m.visits_30d && m.visits_30d.length >= 14) {
    const v = m.visits_30d.map((x) => x.search_visits);
    const last7 = v.slice(-7).reduce((a, b) => a + b, 0), prev7 = v.slice(-14, -7).reduce((a, b) => a + b, 0);
    if (prev7 > 0) {
      const ch = (last7 - prev7) / prev7 * 100;
      if (ch <= -20) out.push({ ico: "⚠", cls: "bad", text: `Поисковый трафик упал на ${fmt1(-ch)}% неделя к неделе (${fmt(prev7)} → ${fmt(last7)})` });
    }
  }
  if (!out.length) out.push({ ico: "✓", cls: "ok", text: "Аномалий не обнаружено" });
  return out;
}

/* ---------- views ---------- */
const V = {};

V.dash = function (root) {
  const k = state.data.keysso || {}, m = state.data.metrika || {}, d = state.data.direct || {};
  const sv = (m.visits_30d || []).reduce((a, x) => a + (x.search_visits || 0), 0);
  const hist = k.history || [];
  const kpi = (label, val, demo, sub) => `
    <div class="card kpi"><h3>${label} ${badge(demo)}</h3><div class="v gold">${val}</div>${sub ? `<div class="d">${sub}</div>` : ""}</div>`;
  const visDelta = hist.length > 7 ? ((hist[hist.length - 1].visibility - hist[hist.length - 8].visibility) / hist[hist.length - 8].visibility * 100) : null;
  root.innerHTML = `
    <div class="grid g4 mb">
      ${kpi("Видимость Keys.so", fmt(k.visibility), state.demo.keysso, visDelta != null ? `за 7 дней: <span class="${visDelta >= 0 ? "up" : "down"}">${visDelta >= 0 ? "+" : ""}${fmt1(visDelta)}%</span>` : "")}
      ${kpi("Ключей в топ-10", fmt(k.top10), state.demo.keysso, `топ-3: ${fmt(k.top3)} · всего: ${fmt(k.keywords_total)}`)}
      ${kpi("Поисковый трафик 30д", fmt(sv), state.demo.metrika, `отказы ${fmt1(m.bounce_rate)}% · глубина ${fmt1(m.depth)}`)}
      ${kpi("Директ 30д", rub(d.spend_30d), state.demo.direct, `клики ${fmt(d.clicks)} · CTR ${fmt1(d.ctr)}% · CPC ${rub(d.avg_cpc)}`)}
    </div>
    <div class="grid g2 mb">
      <div class="card"><h3>Динамика видимости и топ-10 ${badge(state.demo.keysso)}</h3>
        ${lineChart([
          { name: "Видимость", color: "#C9A96A", points: hist.map((h) => ({ date: h.date, value: h.visibility })) },
          { name: "Ключей в топ-10", color: "#6B8CAE", points: hist.map((h) => ({ date: h.date, value: h.top10 })) }
        ])}</div>
      <div class="card"><h3>Трафик из поиска, по дням ${badge(state.demo.metrika)}</h3>
        ${lineChart([
          { name: "Все визиты", color: "#5A5A60", points: (m.visits_30d || []).map((v) => ({ date: v.date, value: v.visits })) },
          { name: "Из поиска", color: "#C9A96A", points: (m.visits_30d || []).map((v) => ({ date: v.date, value: v.search_visits })) }
        ])}</div>
    </div>
    <div class="grid g2">
      <div class="card"><h3>Сигналы</h3>
        ${signals().map((s) => `<div class="signal"><span class="ico tag ${s.cls}">${s.ico}</span><span>${esc(s.text)}</span></div>`).join("")}
      </div>
      <div class="card"><h3>Конкуренты по видимости ${badge(state.demo.keysso)}</h3>
        <div class="tbl-wrap"><table><thead><tr><th>Домен</th><th class="num">Видимость</th><th class="num">Общие ключи</th><th class="num">Δ 7д</th></tr></thead><tbody>
        ${(k.competitors || []).map((c) => `<tr><td>${esc(c.domain)}</td><td class="num">${fmt(c.visibility)}</td><td class="num">${fmt(c.common_keywords)}</td><td class="num ${c.delta_visibility >= 0 ? "pos-good" : "pos-far"}">${c.delta_visibility >= 0 ? "+" : ""}${fmt1(c.delta_visibility)}%</td></tr>`).join("") || '<tr><td colspan="4" class="dim">Нет данных</td></tr>'}
        </tbody></table></div>
      </div>
    </div>`;
};

V.sem = function (root) {
  const phrases = priorityList();
  const clusters = [...new Set(phrases.map((p) => p.cluster || "прочее"))].sort();
  let sortKey = "score", sortDir = -1, q = "", fc = "", fi = "";
  root.innerHTML = `
    <div class="row mb">
      <input id="semQ" placeholder="Поиск по фразам" style="flex:1;min-width:180px">
      <select id="semC"><option value="">Все кластеры</option>${clusters.map((c) => `<option>${esc(c)}</option>`).join("")}</select>
      <select id="semI"><option value="">Все интенты</option><option value="commercial">commercial</option><option value="transactional">transactional</option><option value="informational">informational</option></select>
      <span class="dim">${badge(state.demo.semantics)} фраз: ${phrases.length}</span>
    </div>
    <div class="card mb"><h3>Семантическое ядро <span class="dim">приоритет = частотка × близость к топ-10, буст ×1.5 если запрос куплен в Директе, но нет в органик топ-10</span></h3>
      <div class="tbl-wrap"><table id="semT"><thead><tr>
        <th data-k="phrase">Фраза</th><th data-k="pos" class="num">Позиция</th><th data-k="freq" class="num">Частотка</th>
        <th data-k="score" class="num">Приоритет</th><th data-k="cluster">Кластер</th><th data-k="intent">Интент</th><th>URL</th><th></th>
      </tr></thead><tbody></tbody></table></div>
    </div>
    <div class="grid g2 mb">
      <div class="card"><h3>Матрица «пиллар → сателлиты»</h3><div id="pillars"></div></div>
      <div class="card"><h3>Импорт CSV из Keys.so <span class="dim">работает и без API-тарифа</span></h3>
        <p class="dim mb">Экспорт «фразы домена» из Keys.so (CSV). Колонки распознаются по заголовкам: фраза, позиция, частотность, URL. Импортированное хранится локально в браузере.</p>
        <div class="row"><input type="file" id="csvFile" accept=".csv,.txt"><button class="btn ghost sm" id="csvClear">Очистить импорт (${ls.get(csvKey(state.proj.id), []).length})</button></div>
        <div class="dim mt" id="csvMsg"></div>
      </div>
    </div>
    <div class="card"><h3>Контент-план (kanban) <span class="dim">хранится в браузере · экспорт/импорт JSON</span></h3>
      <div class="row mb"><button class="btn ghost sm" id="kbExport">Экспорт JSON</button>
        <label class="btn ghost sm" style="cursor:pointer">Импорт JSON<input type="file" id="kbImport" accept=".json" hidden></label></div>
      <div class="kanban" id="kanban"></div>
    </div>`;

  const tbody = $("#semT tbody", root);
  function rows() {
    let list = phrases.filter((p) =>
      (!q || p.phrase.toLowerCase().includes(q)) && (!fc || p.cluster === fc) && (!fi || p.intent === fi));
    list = list.slice().sort((a, b) => {
      const av = a[sortKey] ?? (sortKey === "pos" ? 999 : ""), bv = b[sortKey] ?? (sortKey === "pos" ? 999 : "");
      return (av > bv ? 1 : av < bv ? -1 : 0) * sortDir;
    });
    tbody.innerHTML = list.slice(0, 300).map((p) => {
      const pc = p.pos == null ? "dim" : p.pos <= 10 ? "pos-good" : p.pos <= 20 ? "pos-mid" : "pos-far";
      return `<tr><td>${esc(p.phrase)} ${p.paid ? '<span class="tag warn" title="Куплен в Директе, нет в органик топ-10">Директ платит</span>' : ""}${p.csv ? ' <span class="tag">csv</span>' : ""}</td>
        <td class="num ${pc}">${p.pos ?? "-"}</td><td class="num">${fmt(p.freq)}</td><td class="num" style="color:var(--gold)">${fmt(p.score)}</td>
        <td><span class="tag">${esc(p.cluster || "-")}</span></td><td class="dim">${esc(p.intent || "-")}</td>
        <td class="dim mono" style="font-size:11px">${esc(p.url || "-")}</td>
        <td><button class="btn ghost sm" data-plan="${esc(p.phrase)}">+ в план</button></td></tr>`;
    }).join("") || '<tr><td colspan="8" class="dim">Ничего не найдено</td></tr>';
  }
  rows();
  $("#semQ", root).addEventListener("input", (e) => { q = e.target.value.toLowerCase(); rows(); });
  $("#semC", root).addEventListener("change", (e) => { fc = e.target.value; rows(); });
  $("#semI", root).addEventListener("change", (e) => { fi = e.target.value; rows(); });
  root.querySelectorAll("th[data-k]").forEach((th) => th.addEventListener("click", () => {
    const k = th.dataset.k; if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = k === "phrase" || k === "cluster" ? 1 : -1; } rows();
  }));

  /* пиллары */
  const byC = {};
  for (const p of phrases) (byC[p.cluster || "прочее"] = byC[p.cluster || "прочее"] || []).push(p);
  $("#pillars", root).innerHTML = Object.entries(byC).sort((a, b) => b[1].length - a[1].length).slice(0, 8).map(([c, list]) => {
    const sorted = list.slice().sort((a, b) => (b.freq || 0) - (a.freq || 0));
    return `<div class="mb"><b style="color:var(--gold)">${esc(sorted[0].phrase)}</b> <span class="dim">(${esc(c)}, ${fmt(sorted[0].freq)})</span>
      <div class="dim" style="margin:4px 0 0 14px">${sorted.slice(1, 5).map((s) => esc(s.phrase)).join(" · ") || "сателлитов нет"}</div></div>`;
  }).join("") || '<div class="empty">Нет кластеров</div>';

  /* CSV */
  $("#csvFile", root).addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const parsed = parseCSV(await f.text());
    if (!parsed.length) { $("#csvMsg", root).textContent = "Не удалось распознать колонки. Нужен заголовок с колонкой «фраза»."; return; }
    ls.set(csvKey(state.proj.id), ls.get(csvKey(state.proj.id), []).concat(parsed));
    $("#csvMsg", root).textContent = `Импортировано фраз: ${parsed.length}. Таблица обновлена.`;
    V.sem(root);
  });
  $("#csvClear", root).addEventListener("click", () => { ls.set(csvKey(state.proj.id), []); V.sem(root); });

  /* kanban */
  const kbKey = `gm.kanban.${state.proj.id}`;
  const COLS = ["Идея", "В работе", "Ревью", "Опубликовано"];
  function kb() { return ls.get(kbKey, []); }
  function drawKb() {
    const items = kb();
    $("#kanban", root).innerHTML = COLS.map((col, ci) => `
      <div class="kcol"><h4>${col} · ${items.filter((i) => i.col === ci).length}</h4>
        ${items.map((it, idx) => it.col === ci ? `<div class="kcard">${esc(it.title)}
          <div class="ops">
            ${ci > 0 ? `<button data-mv="${idx}:-1">←</button>` : ""}
            ${ci < 3 ? `<button data-mv="${idx}:1">→</button>` : ""}
            <button data-rm="${idx}">×</button>
          </div></div>` : "").join("")}
      </div>`).join("");
    $("#kanban", root).querySelectorAll("[data-mv]").forEach((b) => b.addEventListener("click", () => {
      const [i, d] = b.dataset.mv.split(":").map(Number); const items2 = kb(); items2[i].col += d; ls.set(kbKey, items2); drawKb();
    }));
    $("#kanban", root).querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => {
      const items2 = kb(); items2.splice(+b.dataset.rm, 1); ls.set(kbKey, items2); drawKb();
    }));
  }
  drawKb();
  tbody.addEventListener("click", (e) => {
    const b = e.target.closest("[data-plan]"); if (!b) return;
    const items = kb();
    if (!items.some((i) => i.title === b.dataset.plan)) { items.push({ title: b.dataset.plan, col: 0 }); ls.set(kbKey, items); drawKb(); }
  });
  $("#kbExport", root).addEventListener("click", () => download(`content-plan-${state.proj.id}.json`, JSON.stringify(kb(), null, 2), "application/json"));
  $("#kbImport", root).addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const arr = JSON.parse(await f.text()); if (Array.isArray(arr)) { ls.set(kbKey, arr); drawKb(); } } catch { /* ignore */ }
  });
};

V.geo = function (root) {
  const jKey = `gm.geo.${state.proj.id}`, cKey = `gm.geocheck.${state.proj.id}`;
  const SYSTEMS = ["ChatGPT", "Perplexity", "Алиса / YandexGPT", "Gemini"];
  const CHECK = window.Forge.GEO_CHECKLIST;
  const journal = () => ls.get(jKey, []);
  const isGM = state.proj.id === "glass-memory";
  const aiCnt = state.data.keysso && state.data.keysso.ai_answers;
  root.innerHTML = `
    ${isGM ? '<div class="card mb" style="border-color:var(--gold)"><h3 style="color:var(--gold)">Приоритетная ниша GEO</h3><p class="dim">Ниша GLASS-MEMORY в AI-поиске не занята [ГИПОТЕЗА: geo-intel-intake, проверяется этим baseline-замером]. Обкатываем GEO-механику здесь, затем переносим на GENGLASS.</p></div>' : ""}
    ${aiCnt != null ? `<div class="card mb"><h3>Упоминания в ИИ-ответах Алисы ${badge(state.demo.keysso)} <span class="dim">по данным keys.so (aiAnswersCnt)</span></h3><div class="kpi"><div class="v gold">${fmt(aiCnt)}</div></div></div>` : ""}
    <div class="grid g2 mb">
      <div class="card"><h3>Журнал проверок AI-видимости <span class="dim">ручной замер, канон KPI: knowledge/geo-intel-intake.md</span></h3>
        <form class="stack" id="geoForm">
          <div class="row">
            <label class="f" style="flex:1">Дата<input type="date" id="gDate" required></label>
            <label class="f" style="flex:1">AI-система<select id="gSys">${SYSTEMS.map((s) => `<option>${s}</option>`).join("")}</select></label>
          </div>
          <label class="f">Запрос (промпт)<input id="gQuery" required placeholder="лучшие производители стеклянных перегородок"></label>
          <div class="row">
            <label class="f" style="flex:1">Бренд упомянут?<select id="gHit"><option value="1">Да</option><option value="0">Нет</option></select></label>
            <label class="f" style="flex:2">Кто упомянут вместо нас<input id="gInstead" placeholder="домены/бренды через запятую"></label>
          </div>
          <button class="btn" type="submit">Записать проверку</button>
        </form>
      </div>
      <div class="card"><h3>PWR по системам <span class="dim">Prompt Win Rate = доля промптов с упоминанием, кап 1/промпт</span></h3><div id="pwr"></div></div>
    </div>
    <div class="card mb"><h3>Динамика по неделям</h3><div id="geoTrend"></div></div>
    <div class="card mb"><h3>Последние проверки</h3><div class="tbl-wrap"><table><thead><tr><th>Дата</th><th>Система</th><th>Запрос</th><th>Мы</th><th>Вместо нас</th><th></th></tr></thead><tbody id="geoRows"></tbody></table></div></div>
    <div class="card"><h3>GEO-готовность страниц <span class="dim">чек-лист из 7 пунктов на URL</span></h3>
      <div class="row mb"><input id="urlNew" placeholder="/peregorodki/ или полный URL" style="flex:1"><button class="btn sm" id="urlAdd">Добавить URL</button></div>
      <div id="checks"></div>
    </div>`;

  function drawPWR() {
    const j = journal();
    $("#pwr", root).innerHTML = SYSTEMS.map((s) => {
      const rows = j.filter((e) => e.system === s);
      const pwr = rows.length ? Math.round(rows.filter((e) => e.hit).length / rows.length * 100) : null;
      const cls = pwr == null ? "dim" : pwr < 10 ? "pos-far" : pwr <= 30 ? "pos-mid" : "pos-good";
      return `<div class="signal"><span style="flex:1">${esc(s)}</span>
        <span class="mono ${cls}">${pwr == null ? "нет замеров" : pwr + "% · " + rows.length + " промпт."}</span></div>`;
    }).join("") + `<p class="dim mt">Шкала: &lt;10% невидим · 10-30% базовая видимость · &gt;30% сильная.</p>`;
  }
  function weekOf(d) { const dt = new Date(d + "T00:00:00Z"); const day = (dt.getUTCDay() + 6) % 7; dt.setUTCDate(dt.getUTCDate() - day); return dt.toISOString().slice(0, 10); }
  function drawTrend() {
    const j = journal();
    if (!j.length) { $("#geoTrend", root).innerHTML = '<div class="empty">Пока нет проверок. Добавь первую через форму выше - появится динамика PWR по неделям.</div>'; return; }
    const byW = {};
    for (const e of j) { const w = weekOf(e.date); (byW[w] = byW[w] || { n: 0, hit: 0 }).n++; if (e.hit) byW[w].hit++; }
    const pts = Object.entries(byW).sort((a, b) => a[0] < b[0] ? -1 : 1).map(([w, v]) => ({ date: w, value: Math.round(v.hit / v.n * 100) }));
    $("#geoTrend", root).innerHTML = lineChart([{ name: "PWR %", color: "#C9A96A", points: pts }]);
  }
  function drawRows() {
    const j = journal().slice().reverse().slice(0, 30);
    $("#geoRows", root).innerHTML = j.map((e, i) => `<tr><td class="mono dim">${esc(e.date)}</td><td>${esc(e.system)}</td><td>${esc(e.query)}</td>
      <td>${e.hit ? '<span class="tag ok">да</span>' : '<span class="tag bad">нет</span>'}</td><td class="dim">${esc(e.instead || "-")}</td>
      <td><button class="btn ghost sm" data-del="${journal().length - 1 - i}">×</button></td></tr>`).join("") || '<tr><td colspan="6" class="dim">Журнал пуст</td></tr>';
    $("#geoRows", root).querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      const j2 = journal(); j2.splice(+b.dataset.del, 1); ls.set(jKey, j2); drawPWR(); drawTrend(); drawRows();
    }));
  }
  $("#geoForm", root).addEventListener("submit", (e) => {
    e.preventDefault();
    const entry = { date: $("#gDate", root).value, system: $("#gSys", root).value, query: $("#gQuery", root).value.trim(), hit: $("#gHit", root).value === "1", instead: $("#gInstead", root).value.trim() };
    if (!entry.date || !entry.query) return;
    ls.set(jKey, journal().concat(entry));
    $("#gQuery", root).value = ""; $("#gInstead", root).value = "";
    drawPWR(); drawTrend(); drawRows();
  });

  function drawChecks() {
    const data = ls.get(cKey, {});
    const urls = Object.keys(data);
    $("#checks", root).innerHTML = urls.map((u) => {
      const st = data[u]; const done = st.filter(Boolean).length; const pct = Math.round(done / CHECK.length * 100);
      return `<div class="mb"><div class="row"><b class="mono" style="font-size:12.5px;flex:1">${esc(u)}</b>
        <span class="dim">${done}/${CHECK.length}</span><button class="btn ghost sm" data-urm="${esc(u)}">×</button></div>
        <div class="progress mt" style="margin-top:6px"><i style="width:${pct}%"></i></div>
        <div class="mt">${CHECK.map((c, i) => `<label class="check-item"><input type="checkbox" data-u="${esc(u)}" data-i="${i}" ${st[i] ? "checked" : ""}><span>${esc(c)}</span></label>`).join("")}</div></div>`;
    }).join("") || '<div class="empty">Добавь URL страницы - получишь чек-лист GEO-готовности с прогрессом.</div>';
    $("#checks", root).querySelectorAll("input[type=checkbox]").forEach((cb) => cb.addEventListener("change", () => {
      const d = ls.get(cKey, {}); d[cb.dataset.u][+cb.dataset.i] = cb.checked; ls.set(cKey, d); drawChecks();
    }));
    $("#checks", root).querySelectorAll("[data-urm]").forEach((b) => b.addEventListener("click", () => {
      const d = ls.get(cKey, {}); delete d[b.dataset.urm]; ls.set(cKey, d); drawChecks();
    }));
  }
  $("#urlAdd", root).addEventListener("click", () => {
    const u = $("#urlNew", root).value.trim(); if (!u) return;
    const d = ls.get(cKey, {}); if (!d[u]) d[u] = CHECK.map(() => false); ls.set(cKey, d);
    $("#urlNew", root).value = ""; drawChecks();
  });
  drawPWR(); drawTrend(); drawRows(); drawChecks();
};

V.reports = function (root) {
  const k = state.data.keysso || {}, m = state.data.metrika || {}, d = state.data.direct || {};
  const kb = ls.get(`gm.kanban.${state.proj.id}`, []);
  const j = ls.get(`gm.geo.${state.proj.id}`, []);
  const sv = (m.visits_30d || []).reduce((a, x) => a + (x.search_visits || 0), 0);
  const sig = signals().map((s) => `- ${s.text}`).join("\n");
  const md = `# Еженедельный дайджест · ${state.proj.brand} (${state.proj.domain})

Дата сборки: ${(state.meta && state.meta.updated) || "-"} · Источники: keys.so ${state.demo.keysso ? "DEMO" : "live"}, Метрика ${state.demo.metrika ? "DEMO" : "live"}, Директ ${state.demo.direct ? "DEMO" : "live"}

## KPI
- Видимость Keys.so: ${fmt(k.visibility)}
- Ключей в топ-10: ${fmt(k.top10)} (топ-3: ${fmt(k.top3)}, всего: ${fmt(k.keywords_total)})
- Поисковый трафик 30д: ${fmt(sv)} визитов
- Директ 30д: ${fmt(d.spend_30d)} руб, ${fmt(d.clicks)} кликов, CTR ${fmt1(d.ctr)}%, CPC ${fmt(d.avg_cpc)} руб

## Движения ключей
${(k.deltas && [(k.deltas.entered_top10 || []).map((x) => `- Вошёл в топ-10: «${x.phrase}» (${x.from} -> ${x.to})`).join("\n"), (k.deltas.dropped_top10 || []).map((x) => `- Выпал из топ-10: «${x.phrase}» (${x.from} -> ${x.to})`).join("\n")].filter(Boolean).join("\n")) || "- без изменений"}

## Сигналы
${sig}

## AI-видимость (журнал GEO-трекера)
- Проверок всего: ${j.length}${j.length ? `, упоминаний: ${j.filter((x) => x.hit).length} (PWR ${Math.round(j.filter((x) => x.hit).length / j.length * 100)}%)` : " - замеров ещё нет"}

## Контент
- Опубликовано: ${kb.filter((x) => x.col === 3).map((x) => `«${x.title}»`).join(", ") || "ничего за период"}
- В работе: ${kb.filter((x) => x.col === 1 || x.col === 2).map((x) => `«${x.title}»`).join(", ") || "-"}

## План на неделю
${kb.filter((x) => x.col === 0).slice(0, 5).map((x) => `- ${x.title}`).join("\n") || "- пополнить контент-план из модуля «Семантика»"}
`;
  root.innerHTML = `
    <div class="row mb"><p class="muted" style="flex:1">Дайджест собирается из текущих данных проекта: KPI, движения ключей, сигналы, журнал GEO, контент-план.</p>
    <span id="repBtns" class="row"></span></div>
    <div class="out-block"><div class="head">weekly-digest-${esc(state.proj.id)}.md</div><pre>${esc(md)}</pre></div>`;
  const btns = $("#repBtns", root);
  btns.appendChild(copyBtn(md, "Копировать MD"));
  const dl = document.createElement("button"); dl.className = "btn sm"; dl.textContent = "Скачать .md";
  dl.addEventListener("click", () => download(`weekly-digest-${state.proj.id}.md`, md, "text/markdown"));
  btns.appendChild(dl);
};

V.admin = function (root) {
  const meta = state.meta || {};
  const src = meta.sources || {};
  const over = ls.get("gm.projects.override", {});
  root.innerHTML = `
    <div class="card mb"><h3>Источники данных</h3>
      <div class="tbl-wrap"><table><thead><tr><th>Источник</th><th>Статус</th><th>Расход лимита</th></tr></thead><tbody>
        ${["keysso", "metrika", "direct"].map((s) => {
          const st = src[s] || {}; const live = /(^|: )(ok|cached)/.test(String(st.status || ""));
          return `<tr><td>${s}</td><td>${live ? '<span class="badge-live">LIVE</span>' : '<span class="badge-demo">DEMO</span>'} <span class="dim">${esc(st.status || "нет данных")}</span></td>
          <td class="num">${st.requests_used != null ? `${fmt(st.requests_used)} / ${fmt(st.limit)}` : "-"}</td></tr>`;
        }).join("")}
      </tbody></table></div>
      <p class="dim mt">Обновлено: ${esc(meta.updated || "-")}. Живые данные появляются после ночного harvest (GitHub Actions) с секретами - см. SETUP.md в репозитории. Запуск вручную: Actions → «GEO-monster harvest».</p>
    </div>
    <div class="card mb"><h3>Проекты <span class="dim">правки хранятся в браузере поверх config/projects.json</span></h3>
      <div id="projForms"></div>
      <div class="row mt">
        <button class="btn sm" id="projExport">Экспортировать projects.json</button>
        <button class="btn ghost sm" id="projReset">Сбросить локальные правки ${Object.keys(over).length ? `(${Object.keys(over).length})` : ""}</button>
      </div>
      <p class="dim mt">Экспортированный файл коммитится в репозиторий вручную или через PR - у статического сайта нет права писать в repo без токена.</p>
    </div>`;
  $("#projForms", root).innerHTML = state.projects.map((p) => `
    <form class="stack mb" data-pid="${p.id}" style="border:1px solid var(--border);border-radius:12px;padding:14px">
      <b style="color:var(--gold)">${esc(p.brand)} <span class="dim mono" style="font-weight:400">${esc(p.id)}</span></b>
      <div class="row">
        <label class="f" style="flex:1">Домен<input name="domain" value="${esc(p.domain)}"></label>
        <label class="f" style="flex:1">Счётчик Метрики<input name="metrika_counter" value="${esc(p.metrika_counter)}"></label>
      </div>
      <label class="f">Вертикаль<textarea name="vertical" rows="2">${esc(p.vertical)}</textarea></label>
      <label class="f">Конкуренты (через запятую)<input name="competitors" value="${esc((p.competitors || []).join(", "))}"></label>
      <label class="f">Приоритетные темы (через запятую)<input name="priority_topics" value="${esc((p.priority_topics || []).join(", "))}"></label>
      <button class="btn sm" type="submit" style="align-self:flex-start">Сохранить локально</button>
    </form>`).join("");
  root.querySelectorAll("form[data-pid]").forEach((f) => f.addEventListener("submit", (e) => {
    e.preventDefault();
    const o = ls.get("gm.projects.override", {});
    const fd = new FormData(f);
    o[f.dataset.pid] = {
      domain: fd.get("domain").trim(), metrika_counter: fd.get("metrika_counter").trim(),
      vertical: fd.get("vertical").trim(),
      competitors: fd.get("competitors").split(",").map((s) => s.trim()).filter(Boolean),
      priority_topics: fd.get("priority_topics").split(",").map((s) => s.trim()).filter(Boolean)
    };
    ls.set("gm.projects.override", o);
    boot(true);
  }));
  $("#projExport", root).addEventListener("click", () => download("projects.json", JSON.stringify({ updated: new Date().toISOString().slice(0, 10), projects: state.projects }, null, 2), "application/json"));
  $("#projReset", root).addEventListener("click", () => { ls.set("gm.projects.override", {}); boot(true); });
};

/* внешние модули (M4/M5) из forge.js */
V.forge = (root) => window.Forge.viewForge(root, ctx());
V.ext = (root) => window.Forge.viewExt(root, ctx());
function ctx() {
  return { state, esc, fmt, copyBtn, download, ls, badge, semanticsPhrases, priorityList };
}

/* ---------- shell ---------- */
const NAV = [["dash", "Дашборд"], ["sem", "Семантика"], ["geo", "GEO-трекер"], ["forge", "Content Forge"], ["ext", "Внешние площадки"], ["reports", "Отчёты"], ["admin", "Админка"]];
const TITLES = Object.fromEntries(NAV);

function route() { return (location.hash.replace(/^#\/?/, "") || "dash").split("?")[0]; }

async function render() {
  const r = V[route()] ? route() : "dash";
  $("#nav").innerHTML = NAV.map(([id, t]) => `<button class="nav-btn ${id === r ? "active" : ""}" data-r="${id}">${t}</button>`).join("");
  $("#nav").querySelectorAll("[data-r]").forEach((b) => b.addEventListener("click", () => { location.hash = "#/" + b.dataset.r; }));
  const main = $("#main");
  main.innerHTML = `
    <div class="topbar">
      <h1>${TITLES[r]}</h1>
      <span class="updated">данные: ${esc((state.meta && state.meta.updated) || "-")}</span>
      <span class="spacer"></span>
      <div class="proj-switch">${state.projects.map((p) => `<button class="${p.id === state.proj.id ? "active" : ""}" data-p="${p.id}">${esc(p.brand)}</button>`).join("")}</div>
    </div>
    <div id="view"></div>`;
  main.querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", async () => {
    state.proj = state.projects.find((p) => p.id === b.dataset.p);
    ls.set("gm.proj", state.proj.id);
    await loadProjectData(state.proj.id);
    render();
  }));
  V[r]($("#view"));
}

async function boot(rerender) {
  const cfg = await firstJSON(["config/projects.json", "../config/projects.json"]);
  state.projects = mergedProjects((cfg && cfg.projects) || []);
  const savedId = ls.get("gm.proj", null);
  state.proj = state.projects.find((p) => p.id === savedId) || state.projects[0];
  if (!state.proj) { $("#main").innerHTML = '<div class="empty">config/projects.json не найден или пуст</div>'; return; }
  await loadProjectData(state.proj.id);
  if (!rerender) window.addEventListener("hashchange", render);
  render();
}

/* ---------- gate ---------- */
async function initGate() {
  // обход гейта для локальных смоук-тестов; на github.io не срабатывает
  const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const authed = sessionStorage.getItem("gm.auth") === "1" ||
    (isLocal && new URLSearchParams(location.search).get("gate") === "skip");
  if (authed) { $("#gate").remove(); $("#app").hidden = false; boot(); return; }
  $("#gateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const h = await sha256($("#gatePass").value);
    if (h === window.HUB_PASS_HASH) {
      sessionStorage.setItem("gm.auth", "1");
      $("#gate").remove(); $("#app").hidden = false; boot();
    } else { $("#gateErr").style.display = "block"; }
  });
}
document.addEventListener("DOMContentLoaded", () => {
  $("#logout").addEventListener("click", (e) => { e.preventDefault(); sessionStorage.removeItem("gm.auth"); location.reload(); });
  initGate();
});
})();
