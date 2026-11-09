import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseDeliveryCsv, type DelivIssue } from "./delivery-lib.js";

type Source = { text: string; path: string; issues: DelivIssue[]; warning: string; loaded_at: string | null; through: string | null };
const json = (path: string): any => JSON.parse(readFileSync(path, "utf8"));
// Delivery alone may degrade. Invalid snapshots are never used or silently rolled back.
export function deliverySource(dataDir = "data-ym", fixture = "fixtures/delivery_ym.csv"): Source {
  const path = `${dataDir}/delivery.csv`, manifest = `${dataDir}/delivery_source.json`;
  const empty: Source = { text: "", path, issues: [], warning: "Данные нашей доставки недоступны.", loaded_at: null, through: null };
  let refresh: any = {};
  try { if (existsSync(`${dataDir}/delivery_refresh.json`)) refresh = json(`${dataDir}/delivery_refresh.json`); }
  catch { refresh = { status: "error" }; }
  if (!existsSync(path) && !existsSync(manifest)) {
    if (!existsSync(fixture)) return empty;
    const text = readFileSync(fixture, "utf8");
    try { parseDeliveryCsv(text); } catch { return empty; }
    return { ...empty, text, path: fixture, warning: "Доставка не обновлена. Использована только историческая ведомость; дата её актуальности не подтверждена." };
  }
  try {
    const text = readFileSync(path, "utf8"), state = json(manifest);
    if (state.schema !== 1 || state.platform !== "ym" || !Number.isFinite(Date.parse(state.loaded_at)) ||
        state.csv_sha256 !== createHash("sha256").update(text).digest("hex")) throw new Error("invalid snapshot");
    if (typeof state.loaded_at !== "string" ||
        (state.through != null && (typeof state.through !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(state.through))) ||
        (state.source_issues != null && (!Array.isArray(state.source_issues) || state.source_issues.some((x: any) =>
          !x || !["order", "shipped", "status", "reason"].every(k => typeof x[k] === "string") ||
          !(x.ship === null || typeof x.ship === "number" && Number.isFinite(x.ship)))))) throw new Error("invalid metadata");
    parseDeliveryCsv(text);
    const warnings: string[] = [];
    if (refresh.status === "error") warnings.push("Таблица доставки не обновлена. " + (typeof refresh.reason === "string" ? refresh.reason : "Ошибка загрузки или проверки таблицы."));
    if (Date.now() - Date.parse(state.loaded_at) > 36 * 3600_000) warnings.push("Данные доставки старше 36 часов.");
    if (state.source_issues?.length) warnings.push("В таблице доставки есть незаполненные данные; подробности в списке проблем доставки.");
    if (Object.values(state.source_counts || {}).some((x: any) => x.missing_cost_rows > 0)) warnings.push("В таблице есть отправки без суммы доставки.");
    return { text, path, issues: state.source_issues || [], warning: warnings.join(" "), loaded_at: state.loaded_at, through: state.through || null };
  } catch {
    return { ...empty, warning: "Сохранённая ведомость доставки не прошла проверку и не включена в расчёт." };
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function deliveryHealthHtml(dataDir = "data-ym", fixture?: string): string {
  const source = deliverySource(dataDir, fixture);
  if (!source.warning) return "";
  const date = source.loaded_at ? new Date(source.loaded_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }) + " МСК" : "нет подтверждённой загрузки";
  return `<aside id="ym-delivery-health" role="status" style="margin:12px 24px;padding:14px 18px;border:1px solid #dbab40;border-radius:10px;background:#fff7df;color:#513b13;font:14px/1.5 sans-serif"><strong>Наша доставка: расходы могут быть неполными</strong><br>${esc(source.warning)}<br>Последняя успешная загрузка: ${esc(date)}. Проверенный период: ${esc(source.through || "не подтверждён")}.<br>${source.text ? "Сохранены последние проверенные расходы доставки." : "Расходы нашей доставки не включены в расчёт."} <strong>Прибыль предварительная и может быть завышена.</strong> Обновление остальных данных Маркета продолжается.</aside>`;
}
