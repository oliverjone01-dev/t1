// Отчёт о покрытии и пробелы по SKU (CLAUDE.md §15 п.3) - общий для build-katya и build-site.
// Источник: <DATA_DIR>/reconcile.json (кладёт продьюсер платформы, у Маркета - ym:reconcile).
// Нет файла - ничего не добавляем: OZON-сборка без reconcile.json остаётся байт-в-байт (гейт Этапа 2).
import { readFileSync } from "node:fs";
import { dp } from "./paths.js";

export const RECON: any = (() => { try { return JSON.parse(readFileSync(dp("reconcile.json"), "utf-8")); } catch { return null; } })();

const fmtR = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("ru-RU") + " ₽");

export function coverageStrip(): string {
  if (!RECON || !RECON.coverage) return "";
  const c = RECON.coverage, gapsN = Object.keys(c.gaps || {}).length;
  const isGo = RECON.verdict === "go";
  const pill = (ok: boolean, t: string) => `<span style="display:inline-block;border:1px solid ${ok ? "#34D399" : "#E5B567"};color:${ok ? "#34D399" : "#E5B567"};border-radius:7px;padding:1px 8px;margin:2px 4px 2px 0;white-space:nowrap">${t}</span>`;
  const per = (RECON.periods || []).map((p: any) => {
    const u = p.units, m = p.money, r = p.revenue || {};
    return `<div style="margin-top:4px"><b>${p.label}</b> (${p.dateFrom}..${p.dateTo})
    <div>штуки: доставлено нетто ${u.orders_delivered_net} (возвраты ${u.orders_returned}) vs реализация нетто ${u.realization_net ?? "—"} → ${u.status}</div>
    <div>деньги: к выплате по заказам ${fmtR(m.payout_derived)} vs выплаты ЛК по тем же заказам ${fmtR(m.netting_by_order)} (покрыто ${m.orders_matched ?? 0}/${m.orders_total ?? 0} заказов) → ${m.status}</div>
    ${m.payments ? `<div>фактические платежи Маркета (из заказов): ${fmtR(m.payments.payments_actual)} vs расчёт ${fmtR(m.payments.payout_with_payments)} → ${m.payments.status}</div>` : ""}
    ${r.status ? `<div>выручка: начислено ${fmtR(r.accruals)} vs реализация ${fmtR(r.realization_amount)} → ${r.status}</div>` : ""}
    <div>СС: ${p.cogs.sku_with_cogs}/${p.cogs.sku_total} SKU, ${p.cogs.pct_rev}% оборота → ${p.cogs.status}</div></div>`;
  }).join("");
  const cum = RECON.cumulative ? `<div style="margin-top:4px"><b>с начала данных</b>: к выплате ${fmtR(RECON.cumulative.payout_derived)} vs выплаты ЛК по заказам ${fmtR(RECON.cumulative.netting_by_order)} → ${RECON.cumulative.status}; сборы уровня кабинета (строки без заказа): ${fmtR(RECON.cumulative.netting_account)}${RECON.cumulative.payments ? `<br>фактические платежи Маркета: ${fmtR(RECON.cumulative.payments.payments_actual)} vs расчёт ${fmtR(RECON.cumulative.payments.payout_with_payments)} по ${RECON.cumulative.payments.orders_with_payments}/${RECON.cumulative.payments.orders_total} заказам → ${RECON.cumulative.payments.status}` : ""}</div>` : "";
  const warn = isGo ? "" : `<div style="margin:4px 0 6px;padding:6px 10px;border:1px solid #E5B567;border-radius:8px;color:#ffd27a;font-weight:700">ПРЕДВАРИТЕЛЬНО: цифры этой страницы не сверены по §15 (вердикт RETURN). Причины: ${(RECON.blockers || []).join("; ") || "см. периоды ниже"}.</div>`;
  return `<div id="gg-cov" style="background:#141c26;border-bottom:1px solid #2a3a4a;color:#cfe8ef;font:12px/1.6 system-ui;padding:6px 18px">${warn}
  <div><b style="color:${isGo ? "#34D399" : "#E5B567"}">Сверка §15: ${isGo ? "GO" : "RETURN"}</b> · покрытие за ${c.window?.dateFrom}..${c.window?.dateTo}, SKU ${c.sku_total}:
  ${pill(c.cogs.pct_rev >= 90, `СС ${c.cogs.pct_sku}% SKU / ${c.cogs.pct_rev}% оборота`)}${pill(c.taxonomy.pct_rev >= 90, `таксономия ${c.taxonomy.pct_sku}% / ${c.taxonomy.pct_rev}%`)}${pill(!!(c.realization && c.realization.months && c.realization.months.length), `реализация: ${c.realization && c.realization.months && c.realization.months.length ? c.realization.months.join(", ") : "нет отчёта"}`)}${pill(!!c.netting, `выплаты ЛК: ${c.netting ? c.netting.months.join(", ") : "нет отчёта"}`)}${pill(!!(c.account_fees && c.account_fees.rows), `сборы уровня кабинета: ${c.account_fees && c.account_fees.rows ? "из отчёта взаиморасчётов" : "не подключены (нули)"}`)}${pill(c.views && c.views.days > 0, `показы: ${c.views ? c.views.days : 0} дн`)}${pill(false, `реклама: ${c.ads}`)}${pill(!(c.bad_cells > 0), `битых ячеек отчётов: ${c.bad_cells || 0}`)}${RECON.cumulative && RECON.cumulative.payments && RECON.cumulative.payments.orders_with_payments ? pill(Math.abs(RECON.cumulative.payments.diff) <= Math.max(50, Math.abs(RECON.cumulative.payments.payments_actual) * 0.005), `деньги vs платежи Маркета: ${RECON.cumulative.payments.diff === 0 ? "сошлось" : (RECON.cumulative.payments.diff > 0 ? "+" : "") + Math.round((RECON.cumulative.payments.diff / (RECON.cumulative.payments.payout_with_payments || 1)) * 1000) / 10 + "%"}`) : ""}${pill(gapsN === 0, `пробелов по SKU: ${gapsN}`)}
  <details style="display:inline-block;margin-left:6px"><summary style="cursor:pointer;color:#22D3EE">три периода и кумулятив</summary>${per}${cum}</details></div></div>`;
}

// Бейджи у затронутых строк: ячейка, чей текст равен артикулу/SKU с пробелом (или содержит артикул GG), получает пометку.
export const GAPS_JS: string = RECON && RECON.coverage && Object.keys(RECON.coverage.gaps || {}).length ? `<script>(function(){var G=${JSON.stringify(RECON.coverage.gaps)};
function mark(){document.querySelectorAll('td,.pv-name,.model-name,.name').forEach(function(td){if(td.dataset.ggGap)return;var t=(td.textContent||'').trim();var g=G[t];if(!g){var m=t.match(/[A-ZА-Я]{2,4}-[A-Z0-9-]{3,}/);if(m)g=G[m[0]];}if(!g)return;td.dataset.ggGap='1';var b=document.createElement('span');b.textContent='⚠ '+g.join(', ');b.title='Пробел данных по SKU (сверка §15): '+g.join(', ');b.style.cssText='margin-left:6px;font-size:10px;color:#E5B567;border:1px solid #E5B567;border-radius:5px;padding:0 5px;white-space:nowrap';td.appendChild(b);});}
mark();setInterval(mark,1500);})();</script>` : "";

// Для страниц build-site (obzor/tovary/...): полоса сразу после <body>, бейджи перед </body>.
export function injectCoverage(html: string): string {
  if (!RECON) return html;
  let out = html.replace(/<body[^>]*>/, (m) => m + "\n" + coverageStrip());
  if (GAPS_JS) out = out.replace("</body>", GAPS_JS + "\n</body>");
  return out;
}
