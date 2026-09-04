// Общее для продьюсеров Маркета: каталог данных, окна дат, клиент, выбор кампаний, ndjson.
// Данные Маркета живут ОТДЕЛЬНО от OZON: data-ym/ (контракт файлов тот же, поле platform="ym").
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { YmPartner, ymApiKeyFromEnv, ymBusinessIdsFromEnv, BUSINESS_NAMES, type YmCampaign } from "../../connector/ym-partner.js";

export const PLATFORM = "ym";
export const YM_DIR: string = process.env.YM_DATA_DIR || "data-ym";
export const FLOOR: string = process.env.YM_FLOOR || "2026-02-01"; // пол данных (как у OZON); уточнится по первым заказам
export const yp = (f: string): string => `${YM_DIR}/${f}`;

export const pad = (n: number): string => String(n).padStart(2, "0");
export const fmt = (d: Date): string => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export function today(): string { return fmt(new Date()); }
export function yesterday(): string { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return fmt(d); }
export function addDays(date: string, n: number): string { const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return fmt(d); }
export function windowDays(days: number, to = yesterday()): { dateFrom: string; dateTo: string } {
  let from = addDays(to, -(days - 1)); if (from < FLOOR) from = FLOOR;
  return { dateFrom: from, dateTo: to };
}
export function monthBounds(ym: string): { dateFrom: string; dateTo: string } {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { dateFrom: `${ym}-01`, dateTo: `${ym}-${pad(last)}` };
}

export function ensureDir(): void { mkdirSync(YM_DIR, { recursive: true }); mkdirSync(`${YM_DIR}/_probe`, { recursive: true }); }

export function readNdjson<T = any>(file: string): T[] {
  if (!existsSync(file)) return [];
  const out: T[] = [];
  for (const l of readFileSync(file, "utf-8").split("\n")) { const t = l.trim(); if (!t) continue; try { out.push(JSON.parse(t)); } catch { /* битая строка */ } }
  return out;
}
export function writeNdjson(file: string, rows: any[]): void { writeFileSync(file, rows.length ? rows.map((r) => JSON.stringify(r)).join("\n") + "\n" : ""); }
export function appendNdjson(file: string, rows: any[]): void { if (rows.length) appendFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n"); }
export function writeJson(file: string, obj: any, pretty = 2): void { writeFileSync(file, JSON.stringify(obj, null, pretty)); }
export function readJson<T = any>(file: string, fallback: T): T { try { return JSON.parse(readFileSync(file, "utf-8")); } catch { return fallback; } }

export function client(): YmPartner {
  const key = ymApiKeyFromEnv();
  if (!key) throw new Error("Нет ключа Маркета: задай YM_API_KEY (локально) или секрет YM_DASHBOARD_1 (GitHub Actions). YM_TOKEN - это Метрика, не подходит.");
  return new YmPartner({ apiKey: key });
}

// Кампании к обработке: явный YM_CAMPAIGN_IDS, иначе все кампании ключа в известных бизнес-кабинетах
// (YM_BUSINESS_IDS / DEFAULT_BUSINESS_IDS). Если Маркет вернул кампании только вне списка - берём все
// и предупреждаем (кабинет мог сменить id): лучше лишние данные с warning, чем тихо пусто.
export async function resolveCampaigns(api: YmPartner): Promise<YmCampaign[]> {
  const all = await api.campaigns();
  const explicit = (process.env.YM_CAMPAIGN_IDS || "").split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  if (explicit.length) {
    const set = new Set(explicit);
    const picked = all.filter((c) => set.has(c.id));
    for (const id of explicit) if (!picked.some((c) => c.id === id)) console.warn(`::warning::кампания ${id} из YM_CAMPAIGN_IDS не найдена среди кампаний ключа`);
    return picked;
  }
  const biz = new Set(ymBusinessIdsFromEnv());
  const inBiz = all.filter((c) => biz.has(c.businessId));
  if (!inBiz.length && all.length) {
    console.warn(`::warning::ни одна кампания не принадлежит кабинетам ${[...biz].join(",")} - беру все ${all.length} кампаний ключа`);
    return all;
  }
  return inBiz;
}

export function bizName(id: string, fallback = ""): string { return BUSINESS_NAMES[id] || fallback || id; }

export function campaignSummary(cs: YmCampaign[]): string {
  return cs.map((c) => `  campaignId=${c.id}  ${c.placementType.padEnd(7)} ${c.domain || "-"}  business=${c.businessId} (${bizName(c.businessId, c.businessName)})`).join("\n");
}
