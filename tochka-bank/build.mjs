#!/usr/bin/env node
// Печёт самодостаточный дашборд tochka-bank/public/index.html из data/latest.json
// и data/history.ndjson. Данные запекаются в HTML (как /rop/, /economics/) - никаких
// внешних запросов и токенов в клиенте. Публикуется в /tochka/ через deploy-pages.yml.
"use strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const latest = JSON.parse(readFileSync(join(ROOT, "data/latest.json"), "utf8"));
const hp = join(ROOT, "data/history.ndjson");
const history = existsSync(hp)
  ? readFileSync(hp, "utf8").split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
  : [];

const bakedAt = new Date().toISOString();
const rub = (v) => (v == null ? "-" : Number(v).toLocaleString("ru-RU", { maximumFractionDigits: 2 }));
const esc = (s) => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const fmtDate = (s) => s ? String(s).slice(0, 10).split("-").reverse().join(".") : "-";

// ---- sparkline SVG (баланс + поступления по дням) ---------------------------
function spark(series, color, w = 640, h = 90) {
  if (series.length < 2) return `<div class="muted" style="padding:20px 0">Недостаточно истории для графика (нужно ≥2 дня синка).</div>`;
  const max = Math.max(...series, 1), min = Math.min(...series, 0);
  const rng = max - min || 1;
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * (w - 8) + 4;
    const y = h - 6 - ((v - min) / rng) * (h - 16);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `4,${h - 2} ${pts.join(" ")} ${w - 4},${h - 2}`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px">
    <polygon points="${area}" fill="${color}" opacity="0.10"/>
    <polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;
}

const pending = latest.pending || !latest.fetchedAt;
const hb = history.map(h => h.balanceTotal);
const hi = history.map(h => h.incomingTotal);

const accountsRows = (latest.accounts || []).map(a => `
  <tr>
    <td><b>${esc(a.name || "Счёт")}</b><div class="muted mono" style="font-size:11.5px">${esc(a.number || a.accountId)}</div></td>
    <td class="num"><b>${rub(a.balance)}</b> <span class="muted">${esc(a.currency || "RUB")}</span></td>
    <td class="num">${a.incoming ? a.incoming.count : 0}</td>
    <td class="num" style="color:var(--ok)">+${rub(a.incoming ? a.incoming.total : 0)}</td>
  </tr>`).join("");

const incomingRows = (latest.incoming?.items || []).map(t => `
  <tr>
    <td class="muted">${esc(t.at ? String(t.at).slice(11, 16) || fmtDate(t.at) : "")}</td>
    <td><b>${esc(t.counterparty || "Контрагент не указан")}</b>${t.inn ? `<span class="muted mono" style="font-size:11px"> · ИНН ${esc(t.inn)}</span>` : ""}<div class="muted" style="font-size:12px">${esc(t.purpose || "")}</div></td>
    <td class="muted mono" style="font-size:11.5px">${esc(t.account || "")}</td>
    <td class="num" style="color:var(--ok);white-space:nowrap"><b>+${rub(t.amount)}</b></td>
  </tr>`).join("");

const html = `<!DOCTYPE html>
<html lang="ru"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Точка Банк - остаток и поступления</title>
<style>
  :root{--bg:#0d1014;--bg2:#12161d;--panel:#171d26;--panel2:#1d2530;--border:#263040;--border2:#313d4f;
    --text:#e9edf3;--muted:#8a95a6;--muted2:#616b7a;--accent:#7c5cff;--ok:#4caf7d;--warn:#e0b64a;--bad:#e5735e;--shadow:0 6px 24px rgba(0,0,0,.35);}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:"SB Sans Display","Segoe UI",system-ui,-apple-system,sans-serif;line-height:1.55;font-size:15px;-webkit-font-smoothing:antialiased}
  .mono{font-family:"SF Mono",ui-monospace,Consolas,monospace}
  .wrap{max-width:1040px;margin:0 auto;padding:34px 28px 80px}
  .top{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px;margin-bottom:26px}
  .kicker{color:var(--accent);font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px}
  h1{font-size:26px;letter-spacing:-.02em;margin-bottom:4px}
  .sub{color:var(--muted);font-size:14px}
  .badge{display:inline-flex;align-items:center;gap:7px;font-size:12px;padding:7px 12px;border-radius:9px;border:1px solid var(--border2)}
  .badge.ok{color:var(--ok);border-color:rgba(76,175,125,.4);background:rgba(76,175,125,.07)}
  .badge.wait{color:var(--warn);border-color:rgba(224,182,74,.4);background:rgba(224,182,74,.07)}
  .badge .p{width:8px;height:8px;border-radius:50%;background:currentColor}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin-bottom:8px}
  .stat{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:20px}
  .stat .k{color:var(--muted);font-size:12.5px;margin-bottom:10px}
  .stat .v{font-size:28px;font-weight:700;letter-spacing:-.02em}
  .stat .v small{font-size:14px;font-weight:400;color:var(--muted)}
  .stat.hl .v{color:var(--ok)}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:20px 22px;margin-top:16px}
  h2{font-size:16px;margin-bottom:12px;display:flex;align-items:center;gap:9px}
  h2 .bar{width:3px;height:16px;background:var(--accent);border-radius:2px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:11px 12px;border-bottom:1px solid var(--border);vertical-align:top}
  thead th{color:var(--muted);font-weight:600;font-size:12px;letter-spacing:.03em;text-transform:uppercase}
  td.num,th.num{text-align:right;white-space:nowrap}
  tbody tr:hover{background:var(--panel2)}
  .muted{color:var(--muted)}
  .empty{border:1px dashed var(--border2);border-radius:14px;padding:40px 28px;text-align:center;color:var(--muted);margin-top:16px}
  .empty .big{font-size:30px;margin-bottom:10px;opacity:.7}
  .foot{color:var(--muted2);font-size:11.5px;margin-top:28px;border-top:1px solid var(--border);padding-top:14px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  @media(max-width:720px){.grid2{grid-template-columns:1fr}}
</style></head>
<body><div class="wrap">
  <div class="top">
    <div>
      <div class="kicker">GENGROUP · Казначейство</div>
      <h1>Точка Банк - остаток и поступления</h1>
      <div class="sub">Ежедневный синк расчётных счетов${latest.day ? ` · операционный день ${fmtDate(latest.day)}` : ""}</div>
    </div>
    ${pending
      ? `<div class="badge wait"><span class="p"></span> Ожидание первого синка</div>`
      : `<div class="badge ok"><span class="p"></span> Синк активен</div>`}
  </div>

  ${pending ? `
  <div class="empty">
    <div class="big">🏦</div>
    <b style="color:var(--text)">Пайплайн готов, данные ещё не загружены</b><br>
    <span>Добавь секреты доступа Точки в репозиторий и запусти воркфлоу «Tochka snapshots» - панель заполнится остатком и поступлениями за день.</span>
    <div class="mono muted" style="margin-top:16px;font-size:12px;text-align:left;max-width:520px;margin-inline:auto;background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:12px 14px">
      Secrets: TOCHKA_TOKEN &nbsp;<span style="color:var(--muted2)">(или)</span>&nbsp; TOCHKA_REFRESH_TOKEN + TOCHKA_CLIENT_ID + TOCHKA_CLIENT_SECRET<br>
      Scope: чтение счетов + выписок (read-only)
    </div>
  </div>` : `
  <div class="cards">
    <div class="stat"><div class="k">Остаток по всем счетам</div><div class="v">${rub(latest.balanceTotal)} <small>₽</small></div></div>
    <div class="stat hl"><div class="k">Поступления за день</div><div class="v">+${rub(latest.incoming?.total)} <small>₽</small></div></div>
    <div class="stat"><div class="k">Платежей-поступлений</div><div class="v">${latest.incoming?.count ?? 0}</div></div>
    <div class="stat"><div class="k">Счетов</div><div class="v">${latest.accounts?.length ?? 0}</div></div>
  </div>

  <div class="grid2">
    <div class="card"><h2><span class="bar"></span>Остаток, динамика</h2>${spark(hb, "#7c5cff")}<div class="muted" style="font-size:12px;margin-top:6px">${history.length} дн. истории</div></div>
    <div class="card"><h2><span class="bar"></span>Поступления, динамика</h2>${spark(hi, "#4caf7d")}<div class="muted" style="font-size:12px;margin-top:6px">по операционным дням</div></div>
  </div>

  <div class="card">
    <h2><span class="bar"></span>Расчётные счета</h2>
    <table><thead><tr><th>Счёт</th><th class="num">Остаток</th><th class="num">Поступлений</th><th class="num">Сумма прихода</th></tr></thead>
    <tbody>${accountsRows || `<tr><td colspan="4" class="muted">Нет счетов</td></tr>`}</tbody></table>
  </div>

  <div class="card">
    <h2><span class="bar"></span>Поступления за ${fmtDate(latest.day)}</h2>
    ${incomingRows
      ? `<table><thead><tr><th>Время</th><th>Контрагент / назначение</th><th>Счёт</th><th class="num">Сумма</th></tr></thead><tbody>${incomingRows}</tbody></table>`
      : `<div class="muted" style="padding:8px 0">За этот день поступлений не зафиксировано.</div>`}
  </div>`}

  <div class="foot">
    Собрано ${bakedAt} · источник: Точка Банк Open API (${esc(latest.currency || "RUB")}) · read-only, без хранения токенов в клиенте.<br>
    Данные обновляет воркфлоу «Tochka snapshots» (ежедневный cron). Публикация: deploy-pages.yml → /tochka/.
  </div>
</div>
<script>window.__BAKED_AT="${bakedAt}";</script>
</body></html>`;

writeFileSync(join(ROOT, "public/index.html"), html);
writeFileSync(join(ROOT, "public/v.txt"), bakedAt);
console.log(`Дашборд Точки собран: public/index.html (${(html.length / 1024).toFixed(1)} КБ), history ${history.length} дн.`);
