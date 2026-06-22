// Клиент OZON Seller API (api-seller.ozon.ru). Логика из DOC_02 §2.
// Все вызовы обёрнуты в retry/backoff (S3): переживают 429 OZON.

import { withRetry, HttpError } from "../util/retry.js";
import { lineOf } from "../util/line.js";
import type { SkuDaily } from "../types.js";

const SELLER_HOST = "https://api-seller.ozon.ru";

// Порядок метрик важен: ответ - массив в этом же порядке (DOC_02 §2.1).
export const ANALYTICS_METRICS = [
  "revenue",
  "ordered_units",
  "hits_view",
  "hits_tocart",
  "delivered_units",
  "returns",
  "cancellations",
] as const;

export interface SellerCreds {
  clientId: string;
  apiKey: string;
}

export interface AnalyticsRow {
  id: string;
  name: string;
  metrics: number[]; // в порядке ANALYTICS_METRICS
}

export class OzonSeller {
  constructor(private creds: SellerCreds) {}

  private headers(): Record<string, string> {
    return {
      "Client-Id": this.creds.clientId,
      "Api-Key": this.creds.apiKey,
      "Content-Type": "application/json",
    };
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return withRetry(async () => {
      const res = await fetch(`${SELLER_HOST}${path}`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new HttpError(res.status, `OZON Seller ${path} -> HTTP ${res.status}: ${await res.text()}`);
      }
      return (await res.json()) as T;
    });
  }

  // Дневные строки по SKU за одну дату - основа исторического бэкфилла (S3).
  // Запрашиваем один день, dimension sku, маппим в SkuDaily.
  async skuDaily(date: string): Promise<SkuDaily[]> {
    const rows = await this.analytics(date, date, "sku");
    return rows
      .filter((r) => r.id)
      .map((r) => {
        const m = r.metrics;
        return {
          date,
          sku: r.id,
          offer_id: null, // обогащается из stocks/таксономии отдельно
          name: r.name,
          line: lineOf(r.name),
          revenue: m[0] ?? 0,
          units: m[1] ?? 0,
          views: m[2] ?? 0,
          to_cart: m[3] ?? 0,
          delivered: m[4] ?? 0,
          returns: m[5] ?? 0,
          cancellations: m[6] ?? 0,
        };
      });
  }

  // POST /v1/analytics/data, dimension day | sku
  async analytics(
    dateFrom: string,
    dateTo: string,
    dimension: "day" | "sku",
  ): Promise<AnalyticsRow[]> {
    const data = await this.post<{ result?: { data?: any[] } }>("/v1/analytics/data", {
      date_from: dateFrom,
      date_to: dateTo,
      metrics: ANALYTICS_METRICS,
      dimension: [dimension],
      limit: 1000,
      sort: [{ key: "revenue", order: "DESC" }],
    });
    const rows = data.result?.data ?? [];
    return rows.map((r: any) => ({
      id: String(r.dimensions?.[0]?.id ?? ""),
      name: String(r.dimensions?.[0]?.name ?? ""),
      metrics: (r.metrics ?? []).map((x: any) => Number(x) || 0),
    }));
  }

  // POST /v4/product/info/stocks - пагинация по last_id
  async stocks(): Promise<Array<{ offer_id: string; sku: string; present: number; reserved: number }>> {
    const out: Array<{ offer_id: string; sku: string; present: number; reserved: number }> = [];
    let lastId = "";
    do {
      const data = await this.post<any>("/v4/product/info/stocks", {
        filter: { visibility: "ALL" },
        limit: 1000,
        last_id: lastId,
      });
      const items = data.result?.items ?? data.items ?? [];
      for (const it of items) {
        for (const s of it.stocks ?? []) {
          out.push({
            offer_id: String(it.offer_id ?? ""),
            sku: String(s.sku ?? ""),
            present: Number(s.present) || 0,
            reserved: Number(s.reserved) || 0,
          });
        }
      }
      lastId = data.result?.last_id ?? data.last_id ?? "";
    } while (lastId);
    return out;
  }

  // POST /v5/product/info/prices - пагинация по cursor
  async prices(): Promise<Array<{ offer_id: string; price_index_value: number | null; color_index: string | null }>> {
    const out: Array<{ offer_id: string; price_index_value: number | null; color_index: string | null }> = [];
    let cursor = "";
    do {
      const data = await this.post<any>("/v5/product/info/prices", {
        filter: { visibility: "ALL" },
        limit: 1000,
        cursor,
      });
      const items = data.items ?? data.result?.items ?? [];
      for (const it of items) {
        const ext = it.price_indexes?.external_index_data ?? {};
        out.push({
          offer_id: String(it.offer_id ?? ""),
          price_index_value: ext.price_index_value != null ? Number(ext.price_index_value) : null,
          color_index: it.price_indexes?.color_index ?? null,
        });
      }
      cursor = data.cursor ?? "";
    } while (cursor);
    return out;
  }

  // POST /v3/finance/transaction/list - все операции за период. Пагинация по page/page_count.
  // Защита от «битого» page_count (OZON иногда отдаёт 1 при наличии данных): продолжаем,
  // пока последняя страница ПОЛНАЯ (1000), даже если page_count это не отражает. withRetry
  // покрывает 429/5xx постранично; невозвратные 4xx падают сразу (через HttpError).
  async transactions(dateFrom: string, dateTo: string): Promise<any[]> {
    const from = `${dateFrom}T00:00:00.000Z`, to = `${dateTo}T23:59:59.999Z`;
    const ops: any[] = [];
    let page = 1, pageCount = 1, lastSize = 0;
    do {
      const data = await this.post<any>("/v3/finance/transaction/list", {
        filter: { date: { from, to }, transaction_type: "all" }, page, page_size: 1000,
      });
      const res = data.result ?? {};
      const batch: any[] = res.operations ?? [];
      for (const o of batch) ops.push(o);
      pageCount = res.page_count ?? 1;
      lastSize = batch.length;
      page++;
    } while ((page <= pageCount || lastSize === 1000) && page <= 500);
    return ops;
  }
}
