// Общее для продьюсеров Маркета: каталог данных, окна дат, клиент, выбор кампаний, ndjson.
// Данные Маркета живут ОТДЕЛЬНО от OZON: data-ym/ (контракт файлов тот же, поле platform="ym").
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { YmPartner, ymBusinessIdsFromEnv, BUSINESS_NAMES, type YmCampaign } from "../../connector/ym-partner.js";

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

// --- Несколько кабинетов = несколько ключей ---------------------------------------------------
// У Маркета Api-Key выпускается в конкретном кабинете, поэтому кабинет мебели и кабинет зеркал
// живут под разными ключами. Аккаунт = ключ + кампании, которые он видит. Все продьюсеры ходят
// по списку аккаунтов, а не по одному клиенту.
//   YM_API_KEY  / YM_DASHBOARD_1           - кабинет мебели (GEN GROUP, 74986385)
//   YM_API_KEY_2 / YM_DASHBOARD_ZERKALA_2  - кабинет зеркал (GENGLASS, 1023124)
// Дополнительные ключи: YM_API_KEY_3.. / YM_DASHBOARD_3.. (расширяется без правки кода).
export interface YmAccount { label: string; env: string; api: YmPartner }

export function accounts(): YmAccount[] {
  const out: YmAccount[] = [];
  const add = (env: string, key: string | undefined, label: string) => {
    const k = (key || "").trim();
    if (!k) return;
    out.push({ label, env, api: new YmPartner({ apiKey: k }) });
  };
  add("YM_DASHBOARD_1", process.env.YM_API_KEY || process.env.YM_DASHBOARD_1, "ключ 1 (мебель)");
  add("YM_DASHBOARD_ZERKALA_2", process.env.YM_API_KEY_2 || process.env.YM_DASHBOARD_ZERKALA_2, "ключ 2 (зеркала)");
  for (let i = 3; i <= 6; i++) add(`YM_DASHBOARD_${i}`, process.env[`YM_API_KEY_${i}`] || process.env[`YM_DASHBOARD_${i}`], `ключ ${i}`);
  if (!out.length) throw new Error("Нет ключей Маркета: задай YM_API_KEY / YM_API_KEY_2 (локально) или секреты YM_DASHBOARD_1 / YM_DASHBOARD_ZERKALA_2 (GitHub Actions). YM_TOKEN - это Метрика, не подходит.");
  return out;
}

// Совместимость с одиночными вызовами (ping печатает по каждому аккаунту сам).
export function client(): YmPartner {
  const a = accounts()[0]!;
  return a.api;
}

// Кампании к обработке по ОДНОМУ аккаунту: явный YM_CAMPAIGN_IDS (фильтр), иначе все кампании ключа.
// Фильтр по кабинетам больше не нужен: ключ и так видит только свой кабинет; лишние id из
// YM_CAMPAIGN_IDS, не найденные у этого ключа, молча пропускаются (они принадлежат другому ключу).
export async function resolveCampaigns(api: YmPartner): Promise<YmCampaign[]> {
  const all = await api.campaigns();
  const explicit = (process.env.YM_CAMPAIGN_IDS || "").split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  if (explicit.length) { const set = new Set(explicit); return all.filter((c) => set.has(c.id)); }
  return all;
}

export interface YmTarget { campaign: YmCampaign; account: YmAccount }

// Все кампании всех аккаунтов. Дубли по campaignId (если два ключа видят одну кампанию) схлопываем.
export async function resolveTargets(accs = accounts()): Promise<YmTarget[]> {
  const out: YmTarget[] = [];
  const seen = new Set<string>();
  for (const account of accs) {
    let cs: YmCampaign[] = [];
    try { cs = await resolveCampaigns(account.api); }
    catch (e) { console.warn(`::warning::${account.label} (${account.env}): список кампаний не прочитан - ${(e as Error).message.slice(0, 200)}`); continue; }
    if (!cs.length) console.warn(`::warning::${account.label} (${account.env}): у ключа нет кампаний - проверь, что аккаунт ключа принят в кабинет`);
    for (const c of cs) { if (seen.has(c.id)) continue; seen.add(c.id); out.push({ campaign: c, account }); }
  }
  const explicit = (process.env.YM_CAMPAIGN_IDS || "").split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  for (const id of explicit) if (!out.some((t) => t.campaign.id === id)) console.warn(`::warning::кампания ${id} из YM_CAMPAIGN_IDS не найдена ни у одного ключа`);
  return out;
}

// Бизнес-кабинеты для отчётов уровня business: только те, где у ключа реально есть кампании.
export async function resolveBusinesses(accs = accounts()): Promise<Array<{ businessId: string; account: YmAccount }>> {
  const targets = await resolveTargets(accs);
  const out: Array<{ businessId: string; account: YmAccount }> = [];
  const seen = new Set<string>();
  for (const t of targets) {
    const b = t.campaign.businessId;
    if (!b || seen.has(b)) continue;
    seen.add(b); out.push({ businessId: b, account: t.account });
  }
  for (const b of ymBusinessIdsFromEnv()) if (!seen.has(b)) console.warn(`::warning::кабинет ${b} (${bizName(b)}): ни один ключ не видит его кампаний - отчёты по нему не запрашиваю`);
  return out;
}

// Кампания недоступна по причине на стороне Маркета, а не из-за нашей ошибки: отключённый API
// (API_DISABLED - «отключён из-за неактивности», живой случай 2026-09-04 на кампании зеркал),
// нет прав у ключа (FORBIDDEN), кампания удалена (NOT_FOUND). Такие пропускаем с warning:
// одна мёртвая кампания не должна ронять сбор по остальным шестнадцати.
export function campaignUnavailable(e: unknown): string | null {
  const msg = e instanceof Error ? e.message : String(e);
  if (/API_DISABLED/i.test(msg)) return "API кампании отключён Маркетом из-за неактивности";
  if (/HTTP 403/.test(msg) || /FORBIDDEN/i.test(msg)) return "нет доступа к кампании по этому ключу (403)";
  if (/HTTP 404/.test(msg) || /NOT_FOUND/i.test(msg)) return "кампания не найдена (404)";
  return null;
}

export function bizName(id: string, fallback = ""): string { return BUSINESS_NAMES[id] || fallback || id; }

export function campaignSummary(cs: YmCampaign[]): string {
  return cs.map((c) => `  campaignId=${c.id}  ${c.placementType.padEnd(7)} ${c.domain || "-"}  business=${c.businessId} (${bizName(c.businessId, c.businessName)})`).join("\n");
}

export function targetSummary(ts: YmTarget[]): string {
  return ts.map((t) => `  campaignId=${t.campaign.id}  ${t.campaign.placementType.padEnd(7)} ${t.campaign.domain || "-"}  business=${t.campaign.businessId} (${bizName(t.campaign.businessId, t.campaign.businessName)})  <- ${t.account.label}`).join("\n");
}
