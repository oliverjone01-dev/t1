// Общие типы. Provenance и Reliability - из DOC_05 раздел 1.5.

export type Provenance = "DATA" | "HYPOTHESIS";

export type Reliability = "RELIABLE" | "INDICATIVE" | "HYPOTHESIS" | "FORBIDDEN";

export interface Metric<T = number> {
  value: T;
  provenance: Provenance;
  reliability: Reliability;
  assumption?: string; // обязателен для HYPOTHESIS
  source?: string; // 'ozon_analytics' | 'ozon_performance' | 'signed_act'
}

// Окно периода (полуинтервалы дат в формате YYYY-MM-DD, включительно).
export interface Window {
  from: string;
  to: string;
}

// Текущее окно и окно сравнения, всегда равной длины.
export interface PeriodPair {
  cur: Window;
  cmp: Window;
  label: string; // человекочитаемое описание ("неделя к неделе", "апрель к марту")
}

// Дневная строка по SKU (оперативный слой).
export interface SkuDaily {
  date: string;
  sku: string;
  offer_id: string | null;
  name: string;
  line: string;
  revenue: number;
  units: number;
  views: number;
  to_cart: number;
  delivered: number;
  returns: number;
  cancellations: number;
}

// Снимок цены/индекса по SKU на дату.
export interface PriceSnap {
  date: string;
  sku: string;
  price_index_value: number | null;
  color_index: string | null;
}

// Снимок склада по SKU на дату.
export interface StockSnap {
  date: string;
  sku: string;
  present: number;
  reserved: number;
}
