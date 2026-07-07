#!/usr/bin/env node
// wordstat.mjs - сбор семантического ядра из Yandex Wordstat API.
// Zero deps: Node 22 native fetch/fs. Запускается в GitHub Actions (Yandex закрыт
// из web-контейнера Claude) или локально там, где сеть к Яндексу открыта.
//
// Режимы (WORDSTAT_MODE):
//   direct   - standalone Wordstat API v1 (host api.wordstat.yandex.net, Bearer OAuth).
//              Контракт подтверждён публичной докой (POST /v1/topRequests,
//              тело {phrase, regions[], devices[]}, ответ {topRequests:[{phrase,count}]}).
//   aistudio - Yandex Cloud AI Studio Search API (Api-Key + folderId). Точные имена
//              полей сверить при первом живом 200 (страница доки отдаёт 403 боту).
//
// Env:
//   WORDSTAT_MODE          direct | aistudio            (default: direct)
//   YANDEX_OAUTH_TOKEN     для direct  (Authorization: Bearer)
//   YANDEX_SEARCH_API_KEY  для aistudio (Authorization: Api-Key)
//   YANDEX_FOLDER_ID       для aistudio (folderId в теле)
//   WORDSTAT_REGIONS       "213,225"   (Москва, Россия) - дефолт регионов
//   WORDSTAT_ENDPOINT      override URL эндпоинта (на случай смены пути без правки кода)
//   DRY_RUN                "1" - не ходить в сеть, показать план запросов
//   MAX_RPS                запросов в секунду (default 1) - бережём квоту
//
// Args: node wordstat.mjs [seedsPath] [outDir]
//   seedsPath default: <projectRoot>/data/seed-phrases.json
//   outDir    default: <projectRoot>/data/semcore

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const MODE = (process.env.WORDSTAT_MODE || "direct").toLowerCase();
const DRY = process.env.DRY_RUN === "1";
const MAX_RPS = Number(process.env.MAX_RPS || "1");
const DEFAULT_REGIONS = (process.env.WORDSTAT_REGIONS || "213,225")
  .split(",").map((s) => Number(s.trim())).filter(Boolean);

const seedsPath = process.argv[2] || join(ROOT, "data", "seed-phrases.json");
const outDir = process.argv[3] || join(ROOT, "data", "semcore");

// Провайдеры: URL + сборка заголовков и тела + нормализация ответа.
// Всё, что зависит от конкретного API, живёт здесь - остальной код общий.
const PROVIDERS = {
  direct: {
    url: () => process.env.WORDSTAT_ENDPOINT || "https://api.wordstat.yandex.net/v1/topRequests",
    headers: () => {
      const t = need("YANDEX_OAUTH_TOKEN");
      return { "Content-Type": "application/json;charset=utf-8", Authorization: `Bearer ${t}` };
    },
    body: (phrase, regions) => ({ phrase, regions, devices: ["phone", "desktop"] }),
    normalize: (json) => pickPhraseCountArray(json),
  },
  aistudio: {
    // Точный путь/поля сверить при первом 200 (aistudio.yandex.ru/.../wordstat.html).
    url: () => process.env.WORDSTAT_ENDPOINT || "https://searchapi.api.cloud.yandex.net/api/v1/tools/wordstat/top",
    headers: () => {
      const k = need("YANDEX_SEARCH_API_KEY");
      return { "Content-Type": "application/json", Authorization: `Api-Key ${k}` };
    },
    body: (phrase, regions) => ({ folderId: need("YANDEX_FOLDER_ID"), phrase, regions }),
    normalize: (json) => pickPhraseCountArray(json),
  },
};

function need(name) {
  const v = process.env[name];
  if (!v && !DRY) throw new Error(`Не задан env ${name} (нужен для WORDSTAT_MODE=${MODE})`);
  return v || `<${name}>`;
}

// Ответы двух API отличаются - ищем первый массив объектов с полем-фразой и
// полем-числом, приводим к {phrase, count}. Защитно, без завязки на точное имя.
function pickPhraseCountArray(json) {
  const phraseKeys = ["phrase", "text", "searchValue", "query"];
  const countKeys = ["count", "value", "shows", "number", "freq"];
  const out = [];
  const visit = (node) => {
    if (Array.isArray(node)) {
      for (const it of node) {
        if (it && typeof it === "object") {
          const pk = phraseKeys.find((k) => typeof it[k] === "string");
          const ck = countKeys.find((k) => typeof it[k] === "number");
          if (pk && ck) out.push({ phrase: it[pk], count: it[ck] });
          else visit(it);
        }
      }
    } else if (node && typeof node === "object") {
      for (const v of Object.values(node)) visit(v);
    }
  };
  visit(json);
  // дедуп по фразе, сохраняем макс count
  const map = new Map();
  for (const r of out) {
    const prev = map.get(r.phrase);
    if (!prev || r.count > prev.count) map.set(r.phrase, r);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callWordstat(provider, phrase, regions) {
  const url = provider.url();
  const headers = provider.headers();
  const body = JSON.stringify(provider.body(phrase, regions));
  if (DRY) {
    console.log(`[DRY] POST ${url}\n      headers: ${Object.keys(headers).join(", ")}\n      body: ${body}`);
    return { phrases: [], dry: true };
  }
  // retry с backoff на сетевые/5xx/429
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers, body });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status} ${await safeText(res)}`);
      }
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} ${await safeText(res)}`), { fatal: true });
      const json = await res.json();
      return { phrases: provider.normalize(json), raw: json };
    } catch (e) {
      lastErr = e;
      if (e.fatal) throw e;
      const wait = 2 ** attempt * 1000;
      console.warn(`  retry ${attempt}/4 через ${wait}ms: ${e.message}`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

async function safeText(res) {
  try { return (await res.text()).slice(0, 300); } catch { return ""; }
}

function nowIso() {
  // Date разрешён в скрипте (не в workflow-движке) - это обычный Node-процесс.
  return new Date().toISOString();
}

async function main() {
  if (!existsSync(seedsPath)) throw new Error(`Нет файла сидов: ${seedsPath}`);
  const seedsCfg = JSON.parse(readFileSync(seedsPath, "utf8"));
  const seeds = seedsCfg.seeds || [];
  const baseRegions = seedsCfg.default_regions?.length ? seedsCfg.default_regions : DEFAULT_REGIONS;
  const provider = PROVIDERS[MODE];
  if (!provider) throw new Error(`Неизвестный WORDSTAT_MODE=${MODE} (direct | aistudio)`);

  console.log(`Wordstat semcore: mode=${MODE}, seeds=${seeds.length}, regions=${baseRegions}, dry=${DRY}`);

  const index = { updated: nowIso(), mode: MODE, source: "wordstat", regions: baseRegions, seeds: [] };
  const perReqDelay = Math.max(0, Math.round(1000 / Math.max(0.1, MAX_RPS)));

  for (const seed of seeds) {
    const regions = seed.regions?.length ? seed.regions : baseRegions;
    process.stdout.write(`- ${seed.brand}/${seed.slug} "${seed.phrase}" ... `);
    let result;
    try {
      result = await callWordstat(provider, seed.phrase, regions);
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
      index.seeds.push({ ...seed, regions, measured: null, error: String(e.message).slice(0, 200) });
      continue;
    }
    const record = {
      brand: seed.brand, slug: seed.slug, phrase: seed.phrase, intent: seed.intent || null,
      regions, source: "wordstat", mode: MODE,
      measured: DRY ? null : nowIso(),
      phrases: result.phrases,
    };
    const file = join(outDir, seed.brand, `${seed.slug}.json`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(record, null, 2) + "\n");
    console.log(DRY ? "dry" : `${result.phrases.length} фраз`);
    index.seeds.push({
      brand: seed.brand, slug: seed.slug, phrase: seed.phrase, regions,
      measured: record.measured, count_phrases: result.phrases.length,
      top: result.phrases.slice(0, 5),
    });
    if (perReqDelay) await sleep(perReqDelay);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.json"), JSON.stringify(index, null, 2) + "\n");
  console.log(`Готово. index.json: ${index.seeds.length} сидов -> ${outDir}`);
}

main().catch((e) => { console.error("ОШИБКА:", e.message); process.exit(1); });
