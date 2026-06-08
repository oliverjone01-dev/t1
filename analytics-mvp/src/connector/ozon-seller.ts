// Клиент OZON Seller API (api-seller.ozon.ru). Логика из DOC_02 §2.
// Боевые вызовы подключаются на шаге S2. Чистые помощники покрыты тестами.

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
    const res = await fetch(`${SELLER_HOST}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`OZON Seller ${path} -> HTTP ${res.status}: ${await res.text()}`);
    }
    return (await res.json()) as T;
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
}
