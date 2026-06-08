// Клиент OZON Performance API (api-performance.ozon.ru). Логика из DOC_02 §3.
// Подводные камни: только хост с префиксом api-; токен живёт 1800 с;
// десятичная запятая в суммах; батч кампаний не более 25.

import { parseOzonNumber } from "../util/num.js";
import { withRetry, HttpError } from "../util/retry.js";

const PERF_HOST = "https://api-performance.ozon.ru";
export const CAMPAIGN_BATCH = 25;

export interface PerfCreds {
  clientId: string;
  clientSecret: string;
}

export interface DailyStatRow {
  id: string;
  title: string; // = offer_id для SKU-кампаний
  date: string;
  views: number;
  clicks: number;
  spent: number;
  orders: number;
  ordersMoney: number;
}

// Чистый помощник: разбить кампании на батчи по 25 (тестируется без сети).
export function batchCampaigns(ids: string[], size = CAMPAIGN_BATCH): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export class OzonPerformance {
  private token: string | null = null;
  private tokenExp = 0;

  constructor(private creds: PerfCreds) {}

  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.token && now < this.tokenExp) return this.token;
    const j = await withRetry(async () => {
      const res = await fetch(`${PERF_HOST}/api/client/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: this.creds.clientId,
          client_secret: this.creds.clientSecret,
          grant_type: "client_credentials",
        }),
      });
      if (!res.ok) throw new HttpError(res.status, `OZON Perf token -> HTTP ${res.status}: ${await res.text()}`);
      return (await res.json()) as { access_token: string; expires_in: number };
    });
    this.token = j.access_token;
    // обновляем за 60 с до истечения
    this.tokenExp = now + (j.expires_in - 60) * 1000;
    return this.token;
  }

  private async get<T>(path: string): Promise<T> {
    return withRetry(async () => {
      const token = await this.getToken();
      const res = await fetch(`${PERF_HOST}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new HttpError(res.status, `OZON Perf ${path} -> HTTP ${res.status}: ${await res.text()}`);
      return (await res.json()) as T;
    });
  }

  async campaigns(): Promise<Array<{ id: string; title: string; state: string }>> {
    const data = await this.get<{ list?: any[] }>("/api/client/campaign");
    return (data.list ?? []).map((c) => ({
      id: String(c.id),
      title: String(c.title ?? ""),
      state: String(c.state ?? ""),
    }));
  }

  // GET /api/client/statistics/daily/json - объединённый диапазон, батчи по 25.
  async dailyStats(campaignIds: string[], dateFrom: string, dateTo: string): Promise<DailyStatRow[]> {
    const out: DailyStatRow[] = [];
    for (const batch of batchCampaigns(campaignIds)) {
      const qs = `campaignIds=${batch.join(",")}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const data = await this.get<{ rows?: any[] }>(`/api/client/statistics/daily/json?${qs}`);
      for (const r of data.rows ?? []) {
        out.push({
          id: String(r.id ?? ""),
          title: String(r.title ?? ""),
          date: String(r.date ?? ""),
          views: parseOzonNumber(r.views),
          clicks: parseOzonNumber(r.clicks),
          spent: parseOzonNumber(r.moneySpent),
          orders: parseOzonNumber(r.orders),
          ordersMoney: parseOzonNumber(r.ordersMoney),
        });
      }
    }
    return out;
  }
}
