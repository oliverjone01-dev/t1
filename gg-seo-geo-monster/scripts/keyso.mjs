#!/usr/bin/env node
// keyso.mjs - сбор данных из keys.so (конкуренты, ключи, видимость) в data/keyso/.
// Zero deps: Node 22 native fetch/fs. keys.so закрыт из web-контейнера Claude
// (прокси режет), поэтому живой сбор - в GitHub Actions или там, где keys.so открыт.
//
// Auth (по keyso-mcp): токен REST API кладётся в ДВА заголовка - X-Keyso-TOKEN и auth-token.
// Токен берётся в кабинете keys.so: «Активировать REST API» -> ключ -> секрет KEYSO_TOKEN.
//
// Env:
//   KEYSO_TOKEN   REST API ключ keys.so (обязателен, кроме DRY_RUN)
//   KEYSO_BASE    базовый хост API (default https://api.keys.so)
//   KEYSO_DB      база/регион (default "msk" - Москва Яндекс; сверить в кабинете/доке)
//   KEYSO_PER     строк на отчёт (default 100; помним суточный лимит тарифа - 3000)
//   DRY_RUN       "1" - не ходить в сеть, показать план запросов
//   MAX_RPS       запросов/сек (default 1) - бережём лимит
//
// Args: node keyso.mjs [targetsPath] [outDir]
//   targetsPath default: <root>/data/keyso-targets.json
//   outDir      default: <root>/data/keyso

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const DRY = process.env.DRY_RUN === "1";
const BASE = process.env.KEYSO_BASE || "https://api.keys.so";
const DB = process.env.KEYSO_DB || "msk";
const PER = Number(process.env.KEYSO_PER || "100");
const MAX_RPS = Number(process.env.MAX_RPS || "1");

const targetsPath = process.argv[2] || join(ROOT, "data", "keyso-targets.json");
const outDir = process.argv[3] || join(ROOT, "data", "keyso");

// Каталог отчётов. Пути/параметры keys.so сверить на первом живом 200 (apidoc.keys.so
// закрыт для нашего робота). Всё, что зависит от точной схемы API, живёт здесь -
// правится в одном месте без переписывания логики. Переопределить путь можно через
// KEYSO_EP_<REPORT> (напр. KEYSO_EP_DASHBOARD=/report/simple/organic/domain).
const REPORTS = {
  dashboard: {
    path: process.env.KEYSO_EP_DASHBOARD || "/report/simple/domain_dashboard",
    // сводка домена: видимость, число запросов, трафик
    query: (domain) => ({ base: DB, domain }),
  },
  // ключи домена доступны только через групповой отчёт (POST /report/group -> rid ->
  // /report/group/organic/keywords/<rid>) - это делает harvest.mjs; здесь только simple-отчёты
  competitors: {
    path: process.env.KEYSO_EP_COMPETITORS || "/report/simple/organic/concurents",
    // конкуренты домена по органике ("concurents" - опечатка в самом API keys.so)
    query: (domain) => ({ base: DB, domain, top: 10 }),
  },
  ad_history: {
    path: process.env.KEYSO_EP_ADS || "/report/simple/domain_ad_history",
    // история рекламных размещений домена
    query: (domain) => ({ base: DB, domain }),
  },
};

function need(name) {
  const v = process.env[name];
  if (!v && !DRY) throw new Error(`Не задан env ${name}`);
  return v || `<${name}>`;
}

function buildUrl(path, query) {
  const u = new URL(BASE + path);
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, String(v));
  return u.toString();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(url, token) {
  const headers = { "X-Keyso-TOKEN": token, "auth-token": token, Accept: "application/json" };
  if (DRY) {
    console.log(`[DRY] GET ${url}\n      headers: X-Keyso-TOKEN, auth-token`);
    return { dry: true, data: null };
  }
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status} ${await safeText(res)}`);
      // 402/403 при исчерпании суточного лимита тарифа - фатально, не ретраим
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} ${await safeText(res)}`), { fatal: true });
      return { data: await res.json() };
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

async function safeText(res) { try { return (await res.text()).slice(0, 300); } catch { return ""; } }
function nowIso() { return new Date().toISOString(); }

async function main() {
  if (!existsSync(targetsPath)) throw new Error(`Нет файла целей: ${targetsPath}`);
  const cfg = JSON.parse(readFileSync(targetsPath, "utf8"));
  const targets = cfg.targets || [];
  const token = need("KEYSO_TOKEN");
  const delay = Math.max(0, Math.round(1000 / Math.max(0.1, MAX_RPS)));

  console.log(`keys.so сбор: база=${DB}, целей=${targets.length}, dry=${DRY}. Суточный лимит тарифа - 3000 строк, следим.`);
  const index = { updated: nowIso(), source: "keys.so", db: DB, targets: [] };

  for (const t of targets) {
    const reports = t.reports?.length ? t.reports : ["dashboard", "competitors"];
    const summary = { domain: t.domain, brand: t.brand || null, role: t.role || null, reports: {} };
    for (const rep of reports) {
      const spec = REPORTS[rep];
      if (!spec) { console.warn(`  неизвестный отчёт ${rep}, пропуск`); continue; }
      const url = buildUrl(spec.path, spec.query(t.domain));
      process.stdout.write(`- ${t.domain} / ${rep} ... `);
      try {
        const { data, dry } = await call(url, token);
        if (!dry) {
          const file = join(outDir, t.domain.replace(/[^\w.-]/g, "_"), `${rep}.json`);
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, JSON.stringify({ domain: t.domain, report: rep, db: DB, measured: nowIso(), url, data }, null, 2) + "\n");
        }
        console.log(dry ? "dry" : "ok");
        summary.reports[rep] = dry ? null : "ok";
      } catch (e) {
        console.log(`FAIL: ${e.message}`);
        summary.reports[rep] = `error: ${String(e.message).slice(0, 160)}`;
      }
      if (delay) await sleep(delay);
    }
    index.targets.push(summary);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.json"), JSON.stringify(index, null, 2) + "\n");
  console.log(`Готово. index.json: ${index.targets.length} целей -> ${outDir}`);
}

main().catch((e) => { console.error("ОШИБКА:", e.message); process.exit(1); });
