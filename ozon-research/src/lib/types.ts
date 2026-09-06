/** Типы и словари исследования. Без импорта JSON - можно тянуть в клиентские компоненты. */

export type Verdict =
  | "PASS" | "PASS_CERT" | "PASS_PREMIUM" | "PASS_SERIAL_ONLY" | "PASS_SERIAL_ONLY_CERT"
  | "BORDER" | "BORDER_SERIAL" | "PASS_ONLY_MARGINAL" | "FAIL" | "NO_ECON" | "NO_PRICE";

export type Workshop = "metal" | "combo" | "glass" | "print" | "mdf" | "led" | "";

export interface Niche {
  id: string; name: string; query: string; workshop: Workshop; workshopRaw: string | null; verdict: Verdict;
  verdictNote: string | null; belowDemandFloor: boolean; noCabinetData: boolean;
  demand: number; units: number; pop: number | null; dyn: number | null;
  competitors: number | null; avgPrice: number | null;
  q1: number | null; med: number | null; q3: number | null;
  ssLow: number | null; ssBase: number | null; ssHigh: number | null; ssTotal: number | null;
  market: number | null; commission: number | null;
  p10: number | null; p15: number | null; ssMax55: number | null; ssMax45: number | null;
  gapBase: number | null; gapLow: number | null; rent45: number | null;
  laserH: number | null; weldH: number | null; kgt: boolean | null;
  flags: string; score: number | null; spec: string | null;
  confidence: string | null; risks: string | null; bottleneck: string | null;
  certification: string | null; purchased: string | null; anchor: string | null;
  position: string | null; logistics: number | null; logisticsReal: number | null;
  netMonth: number | null; targetUnits: number | null;
  /** Рентабельность к чистой выручке по цене market. null - убыток съедает всю выручку. */
  rentToday: number | null;
  rent46: number | null;
}

export interface Competitor {
  sku?: string; name?: string; price?: number; reviews?: number; rating?: number;
  seller?: string; seller_orders?: string; delivery?: string; dims?: string;
  why_wins?: string; url?: string;
}

export interface AuditItem {
  verdict: "GO" | "GO_WITH_FIXES" | "NO_GO" | "NEED_DATA";
  audience: string | null; assumptions: string | null; gaps: string | null;
  downside: string | null; checkpoint: string | null; bogdan: string | null; redLines: string | null;
}

/** В кейсах поле competitors - карточки конкурентов с витрины, а не счётчик кабинета. */
export interface Case extends Omit<Niche, "competitors"> {
  photo: string | null;
  competitors: Competitor[];
  seasonality: string | null;
  gaps: string | null;
  angle: string | null;
  cardNotes: string | null;
  audit: AuditItem | null;
}

export interface Idea {
  name: string; what: string; evidence: string | null; whyNobody: string | null; whyUs: string | null;
  workshop: Workshop; ops: string | null; ss: number | null; price: number | null; logistics: string | null;
  season: string | null; ttm: number | null; risk: string | null;
  refuted: boolean; reason: string | null; fix: string | null;
}

export interface Meta {
  date: string;
  counts: {
    niches: number; withEcon: number; withCabinet: number; cases: number;
    noEcon: number; knowhow: number; knowhowKept: number; knowhowWithFix: number;
    priced: number; profitableToday: number; passing: number; passingBelowFloor: number;
    marginal: number; fails: number; lossExceedsRevenue: number;
  };
  verdicts: Record<string, number>;
  assumptions: Record<string, number | Record<string, number>>;
  model: { ads: number; returns: number; acq: number; lastMile: number; kgtFee: number; commFact: number; netFloor: number };
  medianDelta46: number | null;
  medianDelta46Passing: number | null;
  medianLoss52: number | null;
  medianLoss46: number | null;
  profitableAt46: number;
  commissionRange: number[];
  hero: Record<string, string>;
  audit: { overall: string; noGo: number; needData: number; goWithFixes: number; go: number; total: number };
  bestToday: Niche | null;
}

export const PASS_VERDICTS: Verdict[] = [
  "PASS", "PASS_CERT", "PASS_PREMIUM", "PASS_SERIAL_ONLY", "PASS_SERIAL_ONLY_CERT", "BORDER", "BORDER_SERIAL",
];

export const VERDICT_LABEL: Record<Verdict, string> = {
  PASS: "проходит",
  PASS_CERT: "проходит, нужна сертификация",
  PASS_PREMIUM: "проходит в премиум-цене",
  PASS_SERIAL_ONLY: "проходит в серийном режиме",
  PASS_SERIAL_ONLY_CERT: "серийный режим и сертификация",
  BORDER: "на грани",
  BORDER_SERIAL: "на грани в серийном",
  PASS_ONLY_MARGINAL: "только при АДМ 1,2 и баллах как в июле",
  FAIL: "не проходит",
  NO_ECON: "экономика не считалась",
  NO_PRICE: "нет рыночной цены",
};

export const VERDICT_SHORT: Record<Verdict, string> = {
  PASS: "проходит",
  PASS_CERT: "проходит, нужен сертификат",
  PASS_PREMIUM: "проходит в премиум-цене",
  PASS_SERIAL_ONLY: "серийный режим",
  PASS_SERIAL_ONLY_CERT: "серийный и сертификат",
  BORDER: "на грани",
  BORDER_SERIAL: "на грани в серийном",
  PASS_ONLY_MARGINAL: "только при АДМ 1,2",
  FAIL: "не проходит",
  NO_ECON: "без экономики",
  NO_PRICE: "нет цены",
};

export const VERDICT_TONE: Record<Verdict, "ok" | "warn" | "dim" | "bad" | "muted"> = {
  PASS: "ok", PASS_CERT: "ok", PASS_PREMIUM: "ok",
  PASS_SERIAL_ONLY: "warn", PASS_SERIAL_ONLY_CERT: "warn", BORDER: "warn", BORDER_SERIAL: "warn",
  PASS_ONLY_MARGINAL: "dim", FAIL: "bad", NO_ECON: "muted", NO_PRICE: "muted",
};

export const WORKSHOP_LABEL: Record<string, string> = {
  metal: "металл", combo: "комбо", glass: "стекло", print: "керамопечать", mdf: "МДФ", led: "LED", "": "не определён",
};
