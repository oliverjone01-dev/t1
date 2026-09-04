// Клиент Яндекс Маркет Partner API (api.partner.market.yandex.ru). ТОЛЬКО ЧТЕНИЕ:
// campaigns / stats/orders / offer-mappings / offers / stocks / reports (generate -> poll -> download).
// Мутирующих методов в классе нет по построению (Protocol 6: кабинет не трогаем).
//
// Авторизация: заголовок Api-Key (секрет YM_DASHBOARD_1 в GitHub Actions; YM_TOKEN - это
// Метрика, к Маркету отношения не имеет). Один ключ покрывает оба бизнес-кабинета GENGLASS.
// Ретраи: 420 (лимит Маркета), 429, 5xx, сеть - через util/retry withRetry. Прочие 4xx - сразу ошибка.
//
// [ГИПОТЕЗА] до первого живого прогона (Этап 0, ym:ping): формы ответов взяты из документации
// Partner API (OpenAPI yandex-market-partner-api). Парсеры терпимы к отсутствующим полям и
// к двум форматам дат (DD-MM-YYYY и YYYY-MM-DD).

import { withRetry, HttpError, defaultRetryable } from "../util/retry.js";
import { isZip, unzip } from "../util/zip.js";

export const YM_HOST = "https://api.partner.market.yandex.ru";

// Бизнес-кабинеты GENGLASS на Маркете (Иван, 2026-09-04): зеркала и мебель. Переопределяется
// YM_BUSINESS_IDS (через запятую). Кампании (магазины) внутри кабинетов узнаём через GET /campaigns.
export const DEFAULT_BUSINESS_IDS: ReadonlyArray<string> = ["1023124", "74986385"];
export const BUSINESS_NAMES: Record<string, string> = { "1023124": "GENGLASS (зеркала)", "74986385": "GEN GROUP (мебель)" };

export interface YmCreds { apiKey: string }

export interface YmCampaign {
  id: string;
  domain: string;
  clientId: string;
  businessId: string;
  businessName: string;
  placementType: string; // FBS | FBY | DBS | EXPRESS | ...
}

export interface YmOrderItem {
  offerName: string;
  marketSku: string;
  shopSku: string;
  count: number;
  initialCount: number;
  prices: Array<{ type: string; costPerItem: number; total: number }>;
  details: Array<{ itemStatus: string; itemCount: number; updateDate: string }>;
  warehouse?: string;
}

export interface YmOrder {
  id: string;
  creationDate: string;    // как отдал Маркет
  statusUpdateDate: string;
  status: string;
  partnerOrderId?: string;
  paymentType?: string;
  fake?: boolean;
  deliveryRegion?: string;
  items: YmOrderItem[];
  commissions: Array<{ type: string; actual: number | null; predicted: number | null }>;
  payments: Array<{ id?: string; date: string; type: string; source?: string; total: number; paymentOrderId?: string; paymentOrderDate?: string }>;
}

export interface YmOffer {
  offerId: string;       // shopSku = артикул GG
  name: string;
  marketSku: string;
  category: string;
  marketCategoryId: string;
  basicPrice: number | null;
  cardStatus?: string;
  archived?: boolean;
}

export interface YmStock { offerId: string; warehouseId: string; available: number; fit: number; updatedAt: string }

export type ReportStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED" | "NO_DATA" | string;
export interface ReportResult { reportId: string; status: ReportStatus; fileName: string; text: string | null; bytes: number; subStatus?: string }

// Дата Маркета -> YYYY-MM-DD. Маркет в stats/orders отдаёт "DD-MM-YYYY", в других местах ISO.
export function ymDate(s: string | undefined | null): string {
  if (!s) return "";
  const t = String(s).trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{2})[-.](\d{2})[-.](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return "";
}

// 420 = "лимит запросов Маркета" (свой код Партнёрского API), ретраим как 429.
function ymRetryable(e: unknown): boolean {
  if (e instanceof HttpError) return e.status === 420 || defaultRetryable(e);
  return defaultRetryable(e);
}

const num = (x: any): number => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
const str = (x: any): string => (x == null ? "" : String(x));

export function parseOrder(o: any): YmOrder {
  const items: YmOrderItem[] = (o?.items ?? []).map((it: any) => ({
    offerName: str(it.offerName),
    marketSku: str(it.marketSku),
    shopSku: str(it.shopSku),
    count: num(it.count),
    initialCount: it.initialCount != null ? num(it.initialCount) : num(it.count),
    prices: (it.prices ?? []).map((p: any) => ({ type: str(p.type), costPerItem: num(p.costPerItem), total: p.total != null ? num(p.total) : num(p.costPerItem) * num(it.count) })),
    details: (it.details ?? []).map((d: any) => ({ itemStatus: str(d.itemStatus), itemCount: num(d.itemCount), updateDate: ymDate(d.updateDate) })),
    warehouse: it.warehouse?.name ? str(it.warehouse.name) : undefined,
  }));
  return {
    id: str(o?.id),
    creationDate: str(o?.creationDate),
    statusUpdateDate: str(o?.statusUpdateDate),
    status: str(o?.status || "UNKNOWN"),
    partnerOrderId: o?.partnerOrderId != null ? str(o.partnerOrderId) : undefined,
    paymentType: o?.paymentType ? str(o.paymentType) : undefined,
    fake: !!o?.fake,
    deliveryRegion: o?.deliveryRegion?.name ? str(o.deliveryRegion.name) : undefined,
    items,
    commissions: (o?.commissions ?? []).map((c: any) => ({ type: str(c.type), actual: c.actual != null ? num(c.actual) : null, predicted: c.predicted != null ? num(c.predicted) : null })),
    payments: (o?.payments ?? []).map((p: any) => ({
      id: p.id != null ? str(p.id) : undefined, date: ymDate(p.date), type: str(p.type), source: p.source ? str(p.source) : undefined,
      total: num(p.total), paymentOrderId: p.paymentOrder?.id != null ? str(p.paymentOrder.id) : undefined, paymentOrderDate: ymDate(p.paymentOrder?.date),
    })),
  };
}

export class YmPartner {
  constructor(private creds: YmCreds, private host: string = YM_HOST) {}

  private headers(): Record<string, string> {
    return { "Api-Key": this.creds.apiKey, "Content-Type": "application/json", Accept: "application/json" };
  }

  private async req<T>(method: "GET" | "POST", path: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<T> {
    const qs = query ? Object.entries(query).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&") : "";
    const url = `${this.host}${path}${qs ? (path.includes("?") ? "&" : "?") + qs : ""}`;
    return withRetry(async () => {
      const res = await fetch(url, { method, headers: this.headers(), body: body === undefined ? undefined : JSON.stringify(body) });
      if (!res.ok) throw new HttpError(res.status, `Market ${method} ${path} -> HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
      return (await res.json()) as T;
    }, { isRetryable: ymRetryable, retries: 5, baseMs: 1500 });
  }

  // GET /campaigns - магазины (кампании) пользователя ключа, с бизнес-кабинетом каждого.
  async campaigns(): Promise<YmCampaign[]> {
    const out: YmCampaign[] = [];
    let page = 1;
    for (;;) {
      const j = await this.req<any>("GET", "/campaigns", undefined, { page, pageSize: 100 });
      const list: any[] = j?.campaigns ?? [];
      for (const c of list) out.push({
        id: str(c.id), domain: str(c.domain), clientId: str(c.clientId),
        businessId: str(c.business?.id), businessName: str(c.business?.name), placementType: str(c.placementType),
      });
      const pages = num(j?.pager?.pagesCount) || 1;
      if (!list.length || page >= pages) break;
      page++;
    }
    return out;
  }

  // POST /campaigns/{id}/stats/orders - заказы с составом, ценами по типам, комиссиями и платежами.
  // Фильтр по дате создания (dateFrom/dateTo) либо по дате обновления (updateFrom/updateTo).
  async ordersStats(campaignId: string, f: { dateFrom?: string; dateTo?: string; updateFrom?: string; updateTo?: string; statuses?: string[] }): Promise<YmOrder[]> {
    const out: YmOrder[] = [];
    let pageToken: string | undefined;
    let guard = 0;
    do {
      const body: any = {};
      if (f.dateFrom) body.dateFrom = f.dateFrom;
      if (f.dateTo) body.dateTo = f.dateTo;
      if (f.updateFrom) body.updateFrom = f.updateFrom;
      if (f.updateTo) body.updateTo = f.updateTo;
      if (f.statuses?.length) body.statuses = f.statuses;
      const j = await this.req<any>("POST", `/campaigns/${campaignId}/stats/orders`, body, { limit: 200, page_token: pageToken });
      const r = j?.result ?? j ?? {};
      for (const o of r.orders ?? []) out.push(parseOrder(o));
      pageToken = r.paging?.nextPageToken || undefined;
    } while (pageToken && ++guard < 2000);
    return out;
  }

  // POST /businesses/{id}/offer-mappings - каталог кабинета: артикул -> имя, marketSku, категория, базовая цена.
  async offerMappings(businessId: string): Promise<YmOffer[]> {
    const out: YmOffer[] = [];
    let pageToken: string | undefined;
    let guard = 0;
    do {
      const j = await this.req<any>("POST", `/businesses/${businessId}/offer-mappings`, {}, { limit: 200, page_token: pageToken });
      const r = j?.result ?? {};
      for (const m of r.offerMappings ?? []) {
        const of = m.offer ?? {}, mp = m.mapping ?? {};
        out.push({
          offerId: str(of.offerId), name: str(of.name), marketSku: str(mp.marketSku), category: str(of.category || mp.marketCategoryName),
          marketCategoryId: str(mp.marketCategoryId), basicPrice: of.basicPrice?.value != null ? num(of.basicPrice.value) : null,
          cardStatus: of.cardStatus ? str(of.cardStatus) : undefined, archived: !!of.archived,
        });
      }
      pageToken = r.paging?.nextPageToken || undefined;
    } while (pageToken && ++guard < 5000);
    return out;
  }

  // POST /campaigns/{id}/offers/stocks - остатки по складам (FBS/FBY). AVAILABLE = доступно к заказу.
  async stocks(campaignId: string): Promise<YmStock[]> {
    const out: YmStock[] = [];
    let pageToken: string | undefined;
    let guard = 0;
    do {
      const j = await this.req<any>("POST", `/campaigns/${campaignId}/offers/stocks`, { withTurnover: false }, { limit: 200, page_token: pageToken });
      const r = j?.result ?? {};
      for (const w of r.warehouses ?? []) for (const o of w.offers ?? []) {
        let available = 0, fit = 0;
        for (const s of o.stocks ?? []) { if (s.type === "AVAILABLE") available += num(s.count); if (s.type === "FIT") fit += num(s.count); }
        out.push({ offerId: str(o.offerId), warehouseId: str(w.warehouseId), available, fit, updatedAt: str(o.updatedAt) });
      }
      pageToken = r.paging?.nextPageToken || undefined;
    } while (pageToken && ++guard < 5000);
    return out;
  }

  // POST /campaigns/{id}/offers - цены магазина (базовая и с акциями) по артикулам.
  async campaignOffers(campaignId: string): Promise<Array<{ offerId: string; basicPrice: number | null; campaignPrice: number | null; status: string }>> {
    const out: Array<{ offerId: string; basicPrice: number | null; campaignPrice: number | null; status: string }> = [];
    let pageToken: string | undefined;
    let guard = 0;
    do {
      const j = await this.req<any>("POST", `/campaigns/${campaignId}/offers`, {}, { limit: 200, page_token: pageToken });
      const r = j?.result ?? {};
      for (const o of r.offers ?? []) out.push({
        offerId: str(o.offerId), basicPrice: o.basicPrice?.value != null ? num(o.basicPrice.value) : null,
        campaignPrice: o.campaignPrice?.value != null ? num(o.campaignPrice.value) : null, status: str(o.status),
      });
      pageToken = r.paging?.nextPageToken || undefined;
    } while (pageToken && ++guard < 5000);
    return out;
  }

  // --- Отчёты: POST /reports/{type}/generate -> GET /reports/info/{id} -> скачать файл ---
  async reportGenerate(type: string, body: unknown, format: "CSV" | "FILE" | "JSON" = "CSV"): Promise<{ reportId: string; estimatedSec: number }> {
    const j = await this.req<any>("POST", `/reports/${type}/generate`, body, { format });
    const r = j?.result ?? {};
    if (!r.reportId) throw new Error(`Market reports/${type}/generate: нет reportId в ответе ${JSON.stringify(j).slice(0, 300)}`);
    return { reportId: str(r.reportId), estimatedSec: num(r.estimatedGenerationTime) / 1000 };
  }

  async reportInfo(reportId: string): Promise<{ status: ReportStatus; file?: string; subStatus?: string; estimatedSec: number }> {
    const j = await this.req<any>("GET", `/reports/info/${reportId}`);
    const r = j?.result ?? {};
    return { status: str(r.status), file: r.file ? str(r.file) : undefined, subStatus: r.subStatus ? str(r.subStatus) : undefined, estimatedSec: num(r.estimatedGenerationTime) / 1000 };
  }

  // Скачивание файла отчёта. Ссылка подписанная (S3); Api-Key шлём только на свой хост.
  async download(url: string): Promise<Buffer> {
    return withRetry(async () => {
      const own = url.startsWith(this.host);
      const res = await fetch(url, { headers: own ? { "Api-Key": this.creds.apiKey } : {} });
      if (!res.ok) throw new HttpError(res.status, `Market report download -> HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    }, { isRetryable: ymRetryable });
  }

  // Полный цикл: generate -> poll (до timeoutMs) -> download -> текст (zip распакован, кодировка угадана).
  async report(type: string, body: unknown, opts: { timeoutMs?: number; pollMs?: number; format?: "CSV" | "FILE" | "JSON"; sleep?: (ms: number) => Promise<void> } = {}): Promise<ReportResult> {
    const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000;
    const { reportId, estimatedSec } = await this.reportGenerate(type, body, opts.format ?? "CSV");
    const t0 = Date.now();
    let wait = Math.max(3000, Math.min(30000, estimatedSec * 1000 || 5000));
    for (;;) {
      await sleep(wait);
      const info = await this.reportInfo(reportId);
      if (info.status === "DONE") {
        if (!info.file) return { reportId, status: "DONE", fileName: "", text: null, bytes: 0, subStatus: info.subStatus };
        const buf = await this.download(info.file);
        const { name, text } = decodeReport(buf);
        return { reportId, status: "DONE", fileName: name, text, bytes: buf.length, subStatus: info.subStatus };
      }
      if (info.status === "FAILED" || info.status === "NO_DATA") return { reportId, status: info.status, fileName: "", text: null, bytes: 0, subStatus: info.subStatus };
      if (Date.now() - t0 > timeoutMs) throw new Error(`Market report ${type} ${reportId}: не готов за ${Math.round(timeoutMs / 1000)} с (status ${info.status})`);
      wait = opts.pollMs ?? Math.min(30000, Math.max(5000, info.estimatedSec * 1000 || 10000));
    }
  }
}

// Файл отчёта -> текст. zip -> первая текстовая запись; xlsx -> ошибка с понятным текстом
// (просим CSV); текст - utf-8 (BOM) либо windows-1251, если utf-8 даёт мусор.
export function decodeReport(buf: Buffer): { name: string; text: string } {
  let name = "report";
  let data = buf;
  if (isZip(buf)) {
    const entries = unzip(buf);
    const txt = entries.find((e) => /\.(csv|txt|json)$/i.test(e.name)) || entries[0];
    if (!txt) throw new Error("Market report: пустой zip");
    if (/\.xlsx$/i.test(txt.name)) throw new Error(`Market report: внутри zip xlsx (${txt.name}) - запрашивай format=CSV`);
    name = txt.name; data = txt.data;
  } else if (buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b) {
    throw new Error("Market report: похоже на xlsx (zip без central directory?) - запрашивай format=CSV");
  }
  let text = data.toString("utf-8");
  const bad = (text.match(/�/g) || []).length;
  if (bad > 3) { try { text = new TextDecoder("windows-1251").decode(data); } catch { /* оставляем utf-8 */ } }
  return { name, text };
}

// Ключ из окружения: YM_API_KEY (локально) либо YM_DASHBOARD_1 (GitHub Secret). YM_TOKEN не читаем - это Метрика.
export function ymApiKeyFromEnv(): string {
  return process.env.YM_API_KEY || process.env.YM_DASHBOARD_1 || "";
}

export function ymBusinessIdsFromEnv(): string[] {
  const raw = process.env.YM_BUSINESS_IDS || "";
  const ids = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  return ids.length ? ids : [...DEFAULT_BUSINESS_IDS];
}
