// Подмена Partner API Маркета через globalThis.fetch для сквозных тестов продьюсеров (без сети).
// Взято из стенда ФЕНИКСА для PR #465. Сценарий - env SCEN (JSON), журнал запросов - env STUB_LOG.
// No network. Scenario from env SCEN (JSON). Request log -> env STUB_LOG (ndjson).
import { appendFileSync } from "node:fs";

const SCEN = JSON.parse(process.env.SCEN || "{}");
const LOG = process.env.STUB_LOG || "";
const log = (o) => { if (LOG) appendFileSync(LOG, JSON.stringify(o) + "\n"); };

// fast sleeps: retries, polling, rate-limit waits
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...a) => realSetTimeout(fn, 0, ...a);

const bodies = [];          // distinct generate bodies in order of first appearance
const reports = new Map();  // reportId -> {type, body, pending}
let seq = 0;

function mkErr(kind) {
  if (kind === "fetch_failed") return Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) });
  if (kind === "tls_expired") return Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("certificate has expired"), { code: "CERT_HAS_EXPIRED" }) });
  if (kind === "enotfound") return Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("getaddrinfo ENOTFOUND api.partner.market.yandex.ru"), { code: "ENOTFOUND" }) });
  return null;
}
function resp(status, obj, text) {
  const body = text !== undefined ? text : JSON.stringify(obj);
  return new Response(body, { status, headers: { "content-type": text !== undefined ? "text/csv" : "application/json" } });
}
function csvNetting(b, from, to) {
  const h = "BUSINESS_ID;TRANSACTION_DATE;TRANSACTION_ID;ORDER_ID;SHOP_SKU;OFFER_OR_SERVICE_NAME;COUNT;TRANSACTION_SUM;TRANSACTION_TYPE;TRANSACTION_SOURCE;PAYMENT_STATUS";
  const rows = [from, to].map((d, i) => `${b};${d};tx-${b}-${from}-${i};ord-${from}-${i};SKU-${i};Товар;1;${1000 + i};Начисление;Оплата покупателем;Переведён`);
  return [h, ...rows].join("\n") + "\n";
}
function csvRealization(c, y, m) {
  const h = "ORDER_ID;YOUR_SKU;DELIVERED_COUNT;DELIVERY_DATE;DELIVERED_PRICE_SUM_WITH_VAT_AND_DISCOUNTS";
  const d = `${y}-${String(m).padStart(2, "0")}-10`;
  return [h, `ord-${c}-${y}-${m};SKU-1;1;${d};1000`].join("\n") + "\n";
}

globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  const method = (init.method || "GET").toUpperCase();
  const body = init.body ? JSON.parse(init.body) : undefined;
  const p = u.pathname;
  if (p === "/campaigns") {
    log({ method, p });
    return resp(200, { campaigns: [
      { id: 1001, domain: "a", clientId: 1, business: { id: 111, name: "A" }, placementType: "FBS" },
      { id: 2002, domain: "b", clientId: 2, business: { id: 222, name: "B" }, placementType: "FBS" },
    ], pager: { pagesCount: 1 } });
  }
  let m = p.match(/^\/reports\/([^/]+)\/generate$/);
  if (m && method === "POST") {
    const type = m[1];
    const key = type + " " + JSON.stringify(body);
    let idx = bodies.indexOf(key);
    if (idx < 0) { bodies.push(key); idx = bodies.length - 1; }
    const nth = idx + 1; // 1-based logical generate call
    log({ method, p, type, body, nth });
    if (SCEN.permanent === "http503") return resp(503, { status: "ERROR", errors: [{ code: "SERVICE_UNAVAILABLE" }] });
    if (SCEN.failType && SCEN.failType === type) return resp(503, { status: "ERROR", errors: [{ code: "SERVICE_UNAVAILABLE" }] });
    if (SCEN.failNth && nth === SCEN.failNth) {
      if (SCEN.failKind === "http503") return resp(503, { status: "ERROR", errors: [{ code: "SERVICE_UNAVAILABLE" }] });
      if (SCEN.failKind === "http400_body_5xx") return resp(400, { status: "ERROR", errors: [{ code: "BAD_REQUEST", message: "upstream said HTTP 502 for dateTo" }] });
      if (SCEN.failKind !== "timeout_pending") throw mkErr(SCEN.failKind);
    }
    const id = `r${++seq}`;
    reports.set(id, { type, body, pending: SCEN.failNth === nth && SCEN.failKind === "timeout_pending" });
    return resp(200, { status: "OK", result: { reportId: id, estimatedGenerationTime: 0 } });
  }
  m = p.match(/^\/reports\/info\/(.+)$/);
  if (m) {
    const r = reports.get(m[1]);
    if (!r) return resp(404, { status: "ERROR" });
    if (r.pending) return resp(200, { status: "OK", result: { status: "PROCESSING", estimatedGenerationTime: 0 } });
    return resp(200, { status: "OK", result: { status: "DONE", file: `https://api.partner.market.yandex.ru/stubfile/${m[1]}` } });
  }
  m = p.match(/^\/stubfile\/(.+)$/);
  if (m) {
    const r = reports.get(m[1]);
    if (r.type === "united-netting") return resp(200, null, csvNetting(r.body.businessId, r.body.dateFrom, r.body.dateTo));
    if (r.type === "goods-realization") return resp(200, null, csvRealization(r.body.campaignId, r.body.year, r.body.month));
    return resp(200, null, "A;B\n1;2\n");
  }
  log({ method, p, unknown: true });
  return resp(404, { status: "ERROR", errors: [{ code: "NOT_FOUND" }] });
};
