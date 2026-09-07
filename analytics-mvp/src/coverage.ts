// Отчёт о покрытии и пробелы по SKU (CLAUDE.md §15 п.3) - общий для build-katya и build-site.
// Источник: <DATA_DIR>/reconcile.json (кладёт продьюсер платформы, у Маркета - ym:reconcile).
// Нет файла - ничего не добавляем: OZON-сборка без reconcile.json остаётся байт-в-байт (гейт Этапа 2).
import { readFileSync } from "node:fs";
import { dp } from "./paths.js";

export const RECON: any = (() => { try { return JSON.parse(readFileSync(dp("reconcile.json"), "utf-8")); } catch { return null; } })();

const fmtR = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("ru-RU") + " ₽");
// Человекочитаемые имена бизнес-кабинетов Маркета (для полосы покрытия).
const BIZ: Record<string, string> = { "1023124": "зеркала", "74986385": "мебель" };

export function coverageStrip(): string {
  if (!RECON || !RECON.coverage) return "";
  const c = RECON.coverage, gapsN = Object.keys(c.gaps || {}).length;
  const isGo = RECON.verdict === "go";
  const pill = (ok: boolean, t: string) => `<span style="display:inline-block;border:1px solid ${ok ? "#34D399" : "#E5B567"};color:${ok ? "#34D399" : "#E5B567"};border-radius:7px;padding:1px 8px;margin:2px 4px 2px 0;white-space:nowrap">${t}</span>`;
  // Что именно проверяет сверка денег. Сборы берутся из реестра, поэтому в разности payout − реестр
  // они сокращаются тождественно, и «сошлось» относится к начислениям, а не к сборам. Показываем обе
  // ноги: нулевая нога сборов - это и есть признак тождества, её нельзя выдавать за проверку.
  const legs = (m: any) => {
    const l = m && m.legs; if (!l) return "";
    const a = l.allocation || {};
    return `<div style="margin-left:12px;opacity:.85">ноги разности: начисления ${fmtR(l.accruals_orders)} − ${fmtR(l.accruals_ledger)} = <b>${fmtR(l.accruals_diff)}</b> · сборы ${fmtR(l.fees_derived)} − ${fmtR(l.fees_ledger)} = <b>${fmtR(l.fees_diff)}</b>${l.fees_diff === 0 ? ` <span style="color:#E5B567">(ноль тождественно: сборы взяты из этого же реестра)</span>` : ""}
    <br>${l.covers}<br>независимо проверяется разнесение: ${a.status || "—"}${a.orders_off ? ` (${fmtR(a.off_amount)})` : ""}</div>`;
  };

  const per = (RECON.periods || []).map((p: any) => {
    const u = p.units, m = p.money, r = p.revenue || {};
    return `<div style="margin-top:4px"><b>${p.label}</b> (${p.dateFrom}..${p.dateTo})
    <div>штуки: доставлено нетто ${u.orders_delivered_net} (возвраты ${u.orders_returned}) vs реализация нетто ${u.realization_net ?? "—"} → ${u.status}</div>
    <div>деньги: к выплате по заказам ${fmtR(m.payout_derived)} vs выплаты ЛК по тем же заказам ${fmtR(m.netting_by_order)} (покрыто ${m.orders_matched ?? 0}/${m.orders_total ?? 0} заказов) → ${m.status}</div>
    ${legs(m)}
    ${m.payments ? `<div>платежи Маркета (покупательская нога): факт ${fmtR(m.payments.payments_actual)} vs начислено − софинансирование ${fmtR(m.payments.buyer_leg_derived)}; сошлось ${m.payments.orders_matched}/${m.payments.orders_with_payments} заказов → ${m.payments.status}</div>` : ""}
    ${r.status ? `<div>выручка: начислено ${fmtR(r.accruals)} vs реализация ${fmtR(r.realization_amount)} → ${r.status}</div>` : ""}
    <div>СС: ${p.cogs.sku_with_cogs}/${p.cogs.sku_total} SKU, ${p.cogs.pct_rev}% оборота → ${p.cogs.status}</div></div>`;
  }).join("");
  const cum = RECON.cumulative ? `<div style="margin-top:4px"><b>с начала данных</b>: к выплате ${fmtR(RECON.cumulative.payout_derived)} vs выплаты ЛК по заказам ${fmtR(RECON.cumulative.netting_by_order)} → ${RECON.cumulative.status}${legs(RECON.cumulative)}; сборы уровня кабинета (строки без заказа): ${fmtR(RECON.cumulative.netting_account)}${RECON.cumulative.netting_account_note ? ` <span style="opacity:.8">- ${RECON.cumulative.netting_account_note}</span>` : ""}${RECON.cumulative.payments ? `<br>платежи Маркета (покупательская нога): факт ${fmtR(RECON.cumulative.payments.payments_actual)} vs начислено ${fmtR(RECON.cumulative.payments.accruals)} − софинансирование ${fmtR(RECON.cumulative.payments.subsidy_leg)} = ${fmtR(RECON.cumulative.payments.buyer_leg_derived)} по ${RECON.cumulative.payments.orders_with_payments}/${RECON.cumulative.payments.orders_total} заказам → ${RECON.cumulative.payments.status}<br><span style="opacity:.75">полное «к выплате» ${fmtR(RECON.cumulative.payments.payout_full)}: ${RECON.cumulative.payments.covers}</span>` : ""}</div>` : "";
  const warn = isGo ? "" : `<div style="margin:4px 0 6px;padding:6px 10px;border:1px solid #E5B567;border-radius:8px;color:#ffd27a;font-weight:700">ПРЕДВАРИТЕЛЬНО: цифры этой страницы не сверены по §15 (вердикт RETURN). Причины: ${(RECON.blockers || []).join("; ") || "см. периоды ниже"}.</div>`;
  // Бейджи выше считаются по живому окну 30 дней, а страницы показывают весь период. Показываем оба:
  // окно отвечает «как сейчас», весь период - «на чём построены цифры, которые ты видишь».
  const ap = (c as any).all_period;
  const apBlock = ap ? `<div style="margin-top:6px"><b>покрытие за весь период</b> (${ap.dateFrom}..${ap.dateTo}, ${ap.sku_total} SKU, ${fmtR(ap.rev_total)})
  <div>СС: ${ap.cogs.sku} SKU (${ap.cogs.pct_sku}%), ${ap.cogs.pct_rev}% оборота${ap.cogs.rev_without > 0 ? ` · без СС ${fmtR(ap.cogs.rev_without)} - маржа по ним не считается` : ""}</div>
  <div>таксономия: ${ap.taxonomy.sku} SKU (${ap.taxonomy.pct_sku}%), ${ap.taxonomy.pct_rev}% оборота${ap.taxonomy.rev_without > 0 ? ` · без категории ${fmtR(ap.taxonomy.rev_without)} - в разрезах по категориям этот оборот не виден` : ""}</div></div>` : "";

  // Разрез «откуда сборы» по месяцам: без него читатель видит одну ставку сборов и считает её фактом.
  const fs = (c as any).fee_source;
  const fees = fs ? `<div style="margin-top:6px"><b>откуда сборы по месяцам</b> (где ledger'а нет, ставка занижена и маржа завышена)
  ${Object.entries(fs.by_month as Record<string, any>).sort(([a], [b]) => a.localeCompare(b)).map(([m, b]) => {
    const bad = b.accruals_order > 0 && b.accruals_order >= b.accruals_netting;
    return `<div style="color:${bad ? "#ffd27a" : "inherit"}">${m}: взаиморасчёты ${fmtR(b.accruals_netting)}${b.rate_netting != null ? ` (${b.rate_netting}%)` : ""} · комиссии заказа ${fmtR(b.accruals_order)}${b.rate_order != null ? ` (${b.rate_order}%)` : ""}${bad ? " ← ledger не покрывает большую часть месяца" : ""}</div>`;
  }).join("")}</div>` : "";
  return `<div id="gg-cov" style="background:#141c26;border-bottom:1px solid #2a3a4a;color:#cfe8ef;font:12px/1.6 system-ui;padding:6px 18px">${warn}
  <div><b style="color:${isGo ? "#34D399" : "#E5B567"}">Сверка §15: ${isGo ? "GO" : "RETURN"}</b> · покрытие за ${c.window?.dateFrom}..${c.window?.dateTo}, SKU ${c.sku_total}:
  ${pill(c.cogs.pct_rev >= 90, `СС ${c.cogs.pct_sku}% SKU / ${c.cogs.pct_rev}% оборота`)}${pill(c.taxonomy.pct_rev >= 90, `таксономия ${c.taxonomy.pct_sku}% / ${c.taxonomy.pct_rev}%`)}${ap ? pill(ap.cogs.pct_rev >= 90 && ap.taxonomy.pct_rev >= 90, `за ВЕСЬ период (${ap.sku_total} SKU): СС ${ap.cogs.pct_rev}% оборота · таксономия ${ap.taxonomy.pct_rev}%`) : ""}${pill(!!(c.realization && c.realization.prev_month_coverage && c.realization.prev_month_coverage.complete), `реализация: ${c.realization && c.realization.months && c.realization.months.length ? c.realization.months.join(", ") : "нет отчёта"}${c.realization && c.realization.prev_month_coverage ? (c.realization.prev_month_coverage.complete ? "" : c.realization.prev_month_coverage.known ? ` · закрытый месяц добран ${c.realization.prev_month_coverage.shops_with_rows}/${c.realization.prev_month_coverage.shops_sold} магазинов` : " · покрытие закрытого месяца неизвестно") : ""}`)}${pill(!!c.netting, `выплаты ЛК: ${c.netting ? c.netting.months.join(", ") : "нет отчёта"}`)}${c.netting_key && c.netting_key.checked ? pill(c.netting_key.trusted === true, `ключ заказа: ${c.netting_key.trusted ? "подтверждён" : "НЕ подтверждён"} (${c.netting_key.pct}%)`) : ""}${pill(!!(c.account_fees && c.account_fees.rows), `сборы уровня кабинета: ${c.account_fees && c.account_fees.rows ? "из отчёта взаиморасчётов" : "не подключены (нули)"}`)}${c.fee_source ? pill(c.fee_source.pct_accruals_from_commissions <= 20, `сборы из взаиморасчётов: ${100 - c.fee_source.pct_accruals_from_commissions}% оборота${c.fee_source.pct_accruals_from_commissions > 0 ? ` · у остальных ${c.fee_source.pct_accruals_from_commissions}% ставка ${c.fee_source.rate_order}% против ${c.fee_source.rate_netting}% (маржа завышена)` : ""}`) : ""}${pill(c.views && c.views.days > 0, `показы: ${c.views ? c.views.days : 0} дн`)}${pill(false, `реклама: ${c.ads}`)}${pill(!(c.bad_cells > 0), `битых ячеек отчётов: ${c.bad_cells || 0}`)}${RECON.cumulative && RECON.cumulative.payments && RECON.cumulative.payments.orders_with_payments ? pill(RECON.cumulative.payments.orders_off_pct <= 2, `деньги vs платежи Маркета: сошлось ${RECON.cumulative.payments.orders_matched}/${RECON.cumulative.payments.orders_with_payments} заказов${RECON.cumulative.payments.orders_off ? ` (не сошлись ${RECON.cumulative.payments.orders_off} на ${fmtR(RECON.cumulative.payments.off_amount)})` : ""}`) : ""}${pill(gapsN === 0, `пробелов по SKU: ${gapsN}`)}${Object.entries((c.by_business || {}) as Record<string, any>).map(([b, v]) => pill(v.rows > 0, `кабинет ${BIZ[b] || b}: ${v.skus} SKU / ${v.orders} заказов`)).join("")}${(c.campaigns_skipped || []).length ? pill(false, `кампаний без данных: ${c.campaigns_skipped.length}`) : ""}
  <details style="display:inline-block;margin-left:6px"><summary style="cursor:pointer;color:#22D3EE">три периода и кумулятив</summary>${per}${cum}${apBlock}${fees}</details></div></div>`;
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
