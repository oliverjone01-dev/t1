#!/usr/bin/env node
// harvest.mjs - ночной сбор данных GEO-monster: keys.so + Яндекс.Метрика + Яндекс.Директ.
// Zero deps. Запускается в GitHub Actions (эти API закрыты из web-контейнера Claude).
// Пишет нормализованные снапшоты в gg-seo-geo-monster/data/<project>/*.json + meta.json.
// Схема данных = схема demo-снапшотов (scripts/gen-demo.mjs). Сайт читает data/, при
// отсутствии файла падает на demo/ с бейджем DEMO.
//
// Дисциплина: кэш 24 часа (не перезапрашиваем собранное сегодня), счётчик запросов
// keys.so в meta.json, стоп на 80% суточного лимита. Ни один сбой источника не валит
// остальные - статус пишется в meta.json.
//
// Секреты (env): KEYSO_TOKEN (или KEYSSO_API_KEY), YM_TOKEN (или YANDEX_METRIKA_TOKEN),
// YD_TOKEN (или YANDEX_DIRECT_TOKEN). Счётчики Метрики - в config/projects.json.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const KEYSO_LIMIT = Number(process.env.KEYSO_DAILY_LIMIT || 3000);
const KEYSO_DB = process.env.KEYSO_DB || "msk";
const PER = Number(process.env.KEYSO_PER || 100);

const KEYSO_TOKEN = process.env.KEYSO_TOKEN || process.env.KEYSSO_API_KEY || "";
const YM_TOKEN = process.env.YM_TOKEN || process.env.YANDEX_METRIKA_TOKEN || "";
const YD_TOKEN = process.env.YD_TOKEN || process.env.YANDEX_DIRECT_TOKEN || "";

const today = () => new Date().toISOString().slice(0, 10);
const readJSON = (p, d) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return d; } };
const writeJSON = (p, v) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 1) + "\n"); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const meta = readJSON(join(DATA, "meta.json"), { sources: {} });
meta.sources = meta.sources || {};
let keysoUsed = (meta.sources.keysso && meta.sources.keysso.date === today() && meta.sources.keysso.requests_used) || 0;

function setStatus(src, status, extra) {
  meta.sources[src] = Object.assign({ status, date: today() }, src === "keysso" ? { requests_used: keysoUsed, limit: KEYSO_LIMIT } : {}, extra || {});
}

async function http(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
  return text;
}
const asJSON = (t) => JSON.parse(t);

/* ---------- keys.so ---------- */
async function keyso(path, params) {
  if (keysoUsed >= KEYSO_LIMIT * 0.8) throw Object.assign(new Error(`стоп: израсходовано ${keysoUsed} из ${KEYSO_LIMIT} (порог 80%)`), { limit: true });
  const u = new URL("https://api.keys.so" + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  keysoUsed++;
  return asJSON(await http(u, { headers: { "X-Keyso-TOKEN": KEYSO_TOKEN, "auth-token": KEYSO_TOKEN, Accept: "application/json" } }));
}
// защитные экстракторы: точная схема ответа сверяется на первом живом 200 (apidoc закрыт из контейнера)
function pick(obj, names, isNum) {
  if (!obj || typeof obj !== "object") return null;
  for (const [k, v] of Object.entries(obj)) {
    const lk = k.toLowerCase();
    if (names.some((n) => lk.includes(n)) && (isNum ? typeof v === "number" : true)) return v;
  }
  for (const v of Object.values(obj)) { const r = typeof v === "object" ? pick(v, names, isNum) : null; if (r != null) return r; }
  return null;
}
function pickRows(json) {
  if (Array.isArray(json)) return json;
  for (const key of ["data", "rows", "items", "result", "keywords", "phrases", "list"]) if (Array.isArray(json?.[key])) return json[key];
  for (const v of Object.values(json || {})) if (Array.isArray(v) && v.length && typeof v[0] === "object") return v;
  return [];
}
const STOP = new Set(["для", "как", "что", "или", "под", "при", "из", "на", "в", "с", "и", "не", "по", "от", "до", "за", "купить", "цена", "заказать", "москва", "стоимость"]);
const guessCluster = (s) => s.toLowerCase().split(/\s+/).find((w) => w.length > 3 && !STOP.has(w)) || "прочее";
const guessIntent = (s) => /(куп|цена|заказ|стоимост|прайс)/i.test(s) ? "transactional" : /^(как|что|почему|сколько|какой|чем)/i.test(s) ? "informational" : "commercial";

async function harvestKeyso(p) {
  const file = join(DATA, p.id, "keysso.json");
  const prev = readJSON(file, null);
  if (prev && prev.measured === today()) { setStatus("keysso", "cached-24h"); return; }

  // Схема живого ответа keys.so не сверена с apidoc (D6): числа до ручной сверки
  // помечаются в статусе. Убрать пометку - после первого подтверждённого прогона.
  const dash = await keyso(process.env.KEYSO_EP_DASHBOARD || "/report/simple/domain_dashboard", { base: KEYSO_DB, domain: p.domain });
  const kwJson = await keyso(process.env.KEYSO_EP_ORGANIC || "/report/simple/organic/keywords", { base: KEYSO_DB, domain: p.domain, page: 1, per_page: PER });
  const compJson = await keyso(process.env.KEYSO_EP_COMPETITORS || "/report/simple/organic/competitors", { base: KEYSO_DB, domain: p.domain, page: 1, per_page: 50 });

  const keywords = pickRows(kwJson).map((r) => ({
    phrase: pick(r, ["phrase", "keyword", "query", "name"]) || "",
    pos: pick(r, ["pos", "position"], true),
    freq: pick(r, ["ws", "freq", "wordstat", "shows"], true) || 0,
    url: pick(r, ["url", "page"]) || ""
  })).filter((k) => k.phrase);
  const top10 = keywords.filter((k) => k.pos && k.pos <= 10).length;
  const visibility = pick(dash, ["visib", "traff"], true);

  const wanted = new Set((p.competitors || []).map((c) => c.toLowerCase()));
  const competitors = pickRows(compJson).map((r) => ({
    domain: (pick(r, ["domain", "site", "host"]) || "").toLowerCase(),
    visibility: pick(r, ["visib", "traff"], true) || 0,
    common_keywords: pick(r, ["common", "cross", "intersect"], true) || 0,
    delta_visibility: 0
  })).filter((c) => c.domain).filter((c, i) => wanted.has(c.domain) || i < 15);

  // дельты против прошлого снапшота
  const prevPos = new Map(((prev && prev.keywords) || []).map((k) => [k.phrase, k.pos]));
  const dropped = [], entered = [];
  for (const k of keywords) {
    const was = prevPos.get(k.phrase);
    if (was != null && was <= 10 && (k.pos == null || k.pos > 10)) dropped.push({ phrase: k.phrase, from: was, to: k.pos ?? 100 });
    if (was != null && was > 10 && k.pos != null && k.pos <= 10) entered.push({ phrase: k.phrase, from: was, to: k.pos });
  }
  const prevComp = new Map(((prev && prev.competitors) || []).map((c) => [c.domain, c.visibility]));
  const compUp = [];
  for (const c of competitors) {
    const was = prevComp.get(c.domain);
    if (was) { c.delta_visibility = +(((c.visibility - was) / was) * 100).toFixed(1); if (c.delta_visibility >= 5) compUp.push({ domain: c.domain, delta: c.delta_visibility }); }
  }
  const history = ((prev && prev.history) || []).slice(-59).concat([{ date: today(), visibility: visibility || 0, top10 }]);

  writeJSON(file, {
    domain: p.domain, measured: today(), visibility, keywords_total: pick(dash, ["keywords_total", "keys", "count"], true) || keywords.length,
    top1: keywords.filter((k) => k.pos === 1).length, top3: keywords.filter((k) => k.pos && k.pos <= 3).length,
    top10, top50: keywords.filter((k) => k.pos && k.pos <= 50).length,
    history, keywords, competitors,
    deltas: { dropped_top10: dropped.slice(0, 20), entered_top10: entered.slice(0, 20), competitor_up: compUp }
  });
  writeJSON(join(DATA, p.id, "semantics.json"), {
    measured: today(),
    phrases: keywords.map((k) => ({ phrase: k.phrase, pos: k.pos, freq: k.freq, url: k.url, cluster: guessCluster(k.phrase), intent: guessIntent(k.phrase) }))
  });
  setStatus("keysso", process.env.KEYSO_SCHEMA_VERIFIED === "1" ? "ok" : "ok (схема не сверена, см. BACKLOG-1)");
}

/* ---------- Метрика ---------- */
async function ym(params) {
  const u = new URL("https://api-metrika.yandex.net/stat/v1/data" + (params.bytime ? "/bytime" : ""));
  delete params.bytime;
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return asJSON(await http(u, { headers: { Authorization: "OAuth " + YM_TOKEN } }));
}
async function harvestMetrika(p) {
  const file = join(DATA, p.id, "metrika.json");
  const prev = readJSON(file, null);
  if (prev && prev.measured === today()) { setStatus("metrika", "cached-24h"); return; }
  const counter = p.metrika_counter;
  if (!counter || /PLACEHOLDER/i.test(counter)) { setStatus("metrika", "no-counter (заполни metrika_counter в config/projects.json)"); return; }

  const base = { ids: counter, date1: "30daysAgo", date2: "yesterday", accuracy: "full" };
  const byDay = await ym(Object.assign({ bytime: 1, metrics: "ym:s:visits", group: "day" }, base));
  const byDaySearch = await ym(Object.assign({ bytime: 1, metrics: "ym:s:visits", group: "day", filters: "ym:s:lastTrafficSource=='organic'" }, base));
  const dates = (byDay.time_intervals || []).map((t) => t[0]);
  const tot = ((byDay.data && byDay.data[0] && byDay.data[0].metrics && byDay.data[0].metrics[0]) || []);
  const org = ((byDaySearch.data && byDaySearch.data[0] && byDaySearch.data[0].metrics && byDaySearch.data[0].metrics[0]) || []);
  let phrases;
  try { phrases = await ym(Object.assign({ metrics: "ym:s:visits", dimensions: "ym:s:lastSearchPhrase", filters: "ym:s:lastSearchPhrase!n", limit: 50, sort: "-ym:s:visits" }, base)); }
  catch { phrases = await ym(Object.assign({ metrics: "ym:s:visits", dimensions: "ym:s:lastSearchPhrase", limit: 50, sort: "-ym:s:visits" }, base)); }
  const pages = await ym(Object.assign({ metrics: "ym:s:visits", dimensions: "ym:s:startURLPath", filters: "ym:s:lastTrafficSource=='organic'", limit: 30, sort: "-ym:s:visits" }, base));
  const quality = await ym(Object.assign({ metrics: "ym:s:bounceRate,ym:s:pageDepth" }, base));

  writeJSON(file, {
    counter, measured: today(),
    visits_30d: dates.map((d, i) => ({ date: d, visits: Math.round(tot[i] || 0), search_visits: Math.round(org[i] || 0) })),
    top_phrases: (phrases.data || []).map((r) => ({ phrase: r.dimensions[0].name, visits: Math.round(r.metrics[0]) })).filter((x) => x.phrase),
    top_pages: (pages.data || []).map((r) => ({ url: r.dimensions[0].name, visits: Math.round(r.metrics[0]) })),
    goals: [], // цели: подключаются отдельно после выбора goal id (BACKLOG)
    bounce_rate: +(quality.totals?.[0]?.toFixed?.(1) ?? 0), depth: +(quality.totals?.[1]?.toFixed?.(1) ?? 0)
  });
  setStatus("metrika", "ok");
}

/* ---------- Директ (Reports API, TSV) ---------- */
async function ydReport(body) {
  const headers = {
    Authorization: "Bearer " + YD_TOKEN, "Accept-Language": "ru", "Content-Type": "application/json; charset=utf-8",
    processingMode: "auto", returnMoneyInMicros: "false", skipReportHeader: "true", skipColumnHeader: "true", skipReportSummary: "true"
  };
  if (process.env.YD_LOGIN || process.env.YANDEX_DIRECT_LOGIN) headers["Client-Login"] = process.env.YD_LOGIN || process.env.YANDEX_DIRECT_LOGIN;
  for (let i = 0; i < 5; i++) {
    const res = await fetch("https://api.direct.yandex.com/json/v5/reports", { method: "POST", headers, body: JSON.stringify(body) });
    if (res.status === 200) return await res.text();
    if (res.status === 201 || res.status === 202) { await sleep((i + 1) * 4000); continue; }
    throw new Error(`Директ HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  throw new Error("Директ: отчёт не готов после 5 попыток (офлайн-очередь)");
}
const tsv = (text) => text.trim().split("\n").map((l) => l.split("\t"));
async function harvestDirect(p) {
  const file = join(DATA, p.id, "direct.json");
  const prev = readJSON(file, null);
  if (prev && prev.measured === today()) { setStatus("direct", "cached-24h"); return; }

  const mk = (fields, name, extra) => ({ params: Object.assign({
    SelectionCriteria: {}, FieldNames: fields, ReportName: `${name}-${p.id}-${today()}`,
    ReportType: extra.type, DateRangeType: "LAST_30_DAYS", Format: "TSV", IncludeVAT: "YES"
  }, extra.more || {}) });
  const campText = await ydReport(mk(["CampaignName", "Impressions", "Clicks", "Cost"], "camp", { type: "CAMPAIGN_PERFORMANCE_REPORT" }));
  const rows = tsv(campText).filter((r) => r.length >= 4);
  const campaigns = rows.map((r) => ({ name: r[0], impressions: +r[1] || 0, clicks: +r[2] || 0, spend: +r[3] || 0 }))
    .map((c) => ({ name: c.name, spend: Math.round(c.spend), clicks: c.clicks, ctr: c.impressions ? +(c.clicks / c.impressions * 100).toFixed(2) : 0, cpc: c.clicks ? +(c.spend / c.clicks).toFixed(1) : 0, impressions: c.impressions }));
  const spend = campaigns.reduce((a, c) => a + c.spend, 0), clicks = campaigns.reduce((a, c) => a + c.clicks, 0), imp = campaigns.reduce((a, c) => a + c.impressions, 0);

  let queries = [];
  try {
    const qText = await ydReport(mk(["Query", "Clicks", "Cost"], "query", { type: "SEARCH_QUERY_PERFORMANCE_REPORT" }));
    queries = tsv(qText).filter((r) => r.length >= 3).map((r) => ({ query: r[0], clicks: +r[1] || 0, cost: Math.round(+r[2] || 0) }))
      .sort((a, b) => b.clicks - a.clicks).slice(0, 30);
  } catch (e) { console.warn(`  Директ (${p.id}): поисковые запросы недоступны: ${e.message}`); }

  writeJSON(file, {
    measured: today(), spend_30d: spend, impressions: imp, clicks,
    ctr: imp ? +(clicks / imp * 100).toFixed(2) : 0, avg_cpc: clicks ? +(spend / clicks).toFixed(1) : 0,
    campaigns: campaigns.map(({ impressions, ...c }) => c), search_queries: queries
  });
  setStatus("direct", "ok");
}

/* ---------- main ---------- */
async function main() {
  const cfg = readJSON(join(ROOT, "public", "config", "projects.json"), null);
  if (!cfg) throw new Error("public/config/projects.json не найден");
  console.log(`GEO-monster harvest: проектов ${cfg.projects.length}, keys.so лимит ${KEYSO_LIMIT}/сутки (израсходовано ${keysoUsed})`);

  for (const p of cfg.projects) {
    console.log(`\n== ${p.brand} (${p.domain}) ==`);
    if (KEYSO_TOKEN) { try { await harvestKeyso(p); console.log("  keys.so: ok"); } catch (e) { setStatus("keysso", "error: " + e.message.slice(0, 160)); console.warn("  keys.so:", e.message); if (e.limit) break; } }
    else setStatus("keysso", "no-token (KEYSO_TOKEN)");
    if (YM_TOKEN) { try { await harvestMetrika(p); console.log("  metrika: ok"); } catch (e) { setStatus("metrika", "error: " + e.message.slice(0, 160)); console.warn("  metrika:", e.message); } }
    else setStatus("metrika", "no-token (YM_TOKEN)");
    if (YD_TOKEN) { try { await harvestDirect(p); console.log("  direct: ok"); } catch (e) { setStatus("direct", "error: " + e.message.slice(0, 160)); console.warn("  direct:", e.message); } }
    else setStatus("direct", "no-token (YD_TOKEN)");
  }

  // Честная свежесть: meta.updated двигаем только если хотя бы один источник
  // реально собрался (ok/cached); при полном сбое дата остаётся прошлой.
  const anyOk = Object.values(meta.sources).some((s) => s && s.date === today() && /^(ok|cached)/.test(String(s.status)));
  if (anyOk) meta.updated = today();
  if (meta.sources.keysso) { meta.sources.keysso.requests_used = keysoUsed; meta.sources.keysso.limit = KEYSO_LIMIT; }
  delete meta.demo;
  writeJSON(join(DATA, "meta.json"), meta);
  console.log(`\nГотово. keys.so запросов за сегодня: ${keysoUsed}/${KEYSO_LIMIT}. Статусы: ${JSON.stringify(meta.sources)}`);
}
main().catch((e) => { console.error("HARVEST FATAL:", e.message); process.exit(1); });
