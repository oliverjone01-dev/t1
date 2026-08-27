import { readFileSync, writeFileSync, existsSync } from "node:fs";
const J = JSON.parse(readFileSync("economics/data/econ-recon.json", "utf8"));
const PORTAL = J.b24Portal || "https://glassmemory.bitrix24.ru";

const ORDER = ["Калькулятор GG", "Расчёт", "Закупка", "Производство  GG", "Сборка", "Логистика", "Монтаж"];
const SHORT = { "Калькулятор GG": "Кальк.", "Расчёт": "Расчёт", "Закупка": "Закупка", "Производство  GG": "Произв.", "Сборка": "Сборка", "Логистика": "Логист.", "Монтаж": "Монтаж" };
const etidByKey = {};
for (const s of J.spMeta) etidByKey[s.title] = s.etid;

const STAGE_ORDER = ["Новая сделка", "Формирование ТЗ", "Расчёт", "КП отправлено", "Принимают решение", "Долгострой", "Предоплата получена", "Заказ в производстве", "Заказ произведен", "Заказ отправлен", "Сделка успешна", "Сделка провалена"];
const RANK = {}; STAGE_ORDER.forEach((s, i) => RANK[s] = i);
const PROD_RANK = { "Предоплата получена": 3, "Заказ в производстве": 4, "Заказ произведен": 5, "Заказ отправлен": 5, "Сделка успешна": 5 };
const MOVE_DATE = "2026-03-01";
const SP_TL = [
  { k: "Расчёт", created: "2026-03-03", real: "2026-03-03", cards: 1006 },
  { k: "Калькулятор GG", created: "2026-03-02", real: "2026-03-06", cards: 1030 },
  { k: "Закупка", created: "2026-03-11", real: "2026-03-11", cards: 705 },
  { k: "Сборка", created: "2026-03-19", real: "2026-03-19", cards: 650 },
  { k: "Логистика", created: "2026-03-31", real: "2026-03-31", cards: 646 },
  { k: "Производство  GG", created: "2026-04-01", real: "2026-04-01", cards: 420 },
  { k: "Замер", created: "2026-04-01", real: "2026-04-01", cards: 13 },
  { k: "Монтаж", created: "2026-03-31", real: "2026-03-31", cards: 2 },
];

const BAKED_AT = new Date().toISOString(); // штамп сборки (версия) - для v.txt и авто-перезагрузки

// --- Динамика здоровья цепочки: история метрик между снимками разведки ---
// Считаем те же цифры, что рисует чип (запуск % и с/с %), но серверно, и храним по снимкам.
// Один снимок разведки (generated_at) = одна запись. Дельта считается к предыдущему снимку.
const EXCL_N = /сумма|налог|наценк|прибыл|бюджет|коэфф|адрес|номер|исполнител|отч[её]т|тип доставки|данные из сп|^id |удалить|расход материал|макет|шаблон|обрешет|домгласс|полная себестоимость по заказу/i;
const realMoneyN = (arr) => (arr || []).filter((m) => !EXCL_N.test(m.label));
function chainMetrics() {
  const N = J.deals.length || 1;
  return ORDER.map((k) => {
    let L = 0, F = 0;
    for (const d of J.deals) { const s = (d.sps || []).find((x) => x.key === k); if (s) { L++; if (realMoneyN(s.money).length > 0) F++; } }
    return { key: k, pL: Math.round((100 * L) / N), pF: L ? Math.round((100 * F) / L) : 0, L, F };
  });
}
const HIST_PATH = "economics/data/econ-control-history.json";
let hist = [];
try { if (existsSync(HIST_PATH)) hist = JSON.parse(readFileSync(HIST_PATH, "utf8")) || []; } catch { hist = []; }
if (!Array.isArray(hist)) hist = [];
const curEntry = { gen: J.generated_at, at: BAKED_AT, chain: chainMetrics() };
hist = hist.filter((h) => h.gen !== J.generated_at); // тот же снимок разведки не плодит записи
const prevEntry = hist.length ? hist[hist.length - 1] : null;
hist.push(curEntry);
hist = hist.slice(-120); // ~15 суток при cron каждые 3 часа
writeFileSync(HIST_PATH, JSON.stringify(hist));
const chainPrev = {};
if (prevEntry) for (const c of prevEntry.chain) chainPrev[c.key] = { pL: c.pL, pF: c.pF };

const payload = { generated_at: J.generated_at, bakedAt: BAKED_AT, since: J.since || null, portal: PORTAL, order: ORDER, short: SHORT, etid: etidByKey, stageOrder: STAGE_ORDER, rank: RANK, prodRank: PROD_RANK, moveDate: MOVE_DATE, spTimeline: SP_TL, chainPrev, chainPrevAt: prevEntry ? prevEntry.gen : null, deals: J.deals };

// Справка по полям смартов: что учитывается в Σ с/с (генерируется из метаданных полей)
const ITOG_S = /производственная с\/с|с\/?с итог|расчет с\/с итого|себестоимость производ/i;
const EXCL_S = /сумма|налог|наценк|прибыл|бюджет|коэфф|адрес|номер|исполнител|отч[её]т|тип доставки|данные из сп|^id |удалить|расход материал|макет|шаблон|обрешет|домгласс|полная себестоимость по заказу/i;
const escS = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const invMap = {}; for (const r of (J.inventory || [])) invMap[r.sp + "|" + r.label] = r.fillPct;
function fieldStatus(label) {
  if (ITOG_S.test(label)) return ["ok", "итог с/с"];
  if (EXCL_S.test(label)) { const why = /сумма|бюджет/i.test(label) ? "цена/бюджет" : /налог/i.test(label) ? "налог" : /наценк|прибыл|маржа/i.test(label) ? "наценка/прибыль" : "служебное"; return ["no", "не в с/с · " + why]; }
  return ["mid", "в с/с (компонент)"];
}
let FIELDS_REF = "";
for (const sp of (J.spMeta || [])) {
  const rows = (sp.fields || []).map(f => { const st = fieldStatus(f.label); const fp = invMap[sp.title + "|" + f.label];
    return `<tr class="fr-${st[0]}"><td>${escS(f.label)}</td><td class="frp">${fp != null ? fp + "%" : "-"}</td><td class="frs">${st[1]}</td></tr>`; }).join("");
  FIELDS_REF += `<div class="frsp">${escS(sp.title)}</div><table class="dtab frtab"><tr><th>Денежное поле</th><th>Запол.</th><th>В с/с?</th></tr>${rows}</table>`;
}

const HTML = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Контроль экономики сделок</title>
<style>
:root{--bg:#0B0F15;--card:#131820;--elev:#1A2029;--border:#1F2731;--ink:#F1F4F8;--ink-2:#A0AAB8;--ink-3:#6A7484;--ink-4:#3F4855;--up:#10B981;--warn:#F59E0B;--dn:#F43F5E;--info:#A78BFA;--accent:#22D3EE}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:13px/1.45 -apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:1760px;margin:0 auto;padding:18px 18px 80px}
h1{font-size:21px;margin:0 0 4px}
.sub{color:var(--ink-2);font-size:12.5px;margin:0 0 14px;max-width:1200px}
.ver{color:var(--ink-3);font-size:12px;margin:0 0 12px}
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:8px;margin:6px 0 10px}
.sums{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:6px 0 10px}
.sm{background:var(--elev);border:1px solid var(--border);border-radius:10px;padding:8px 12px}
.smv{font-size:17px;font-weight:800;color:var(--ink-1);font-variant-numeric:tabular-nums}
.sml{font-size:11px;color:var(--ink-3);margin-top:2px}
.smsub{color:var(--ink-2);font-weight:700}
.sm-ok{border-color:rgba(60,170,110,.4)}.sm-ok .smsub{color:#82dcaa}
.sm-lo{border-color:rgba(214,92,110,.45)}.sm-lo .smsub{color:#ec93a4}
.ctype{color:var(--ink-2);font-size:10.5px}
.kt{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:9px 12px;cursor:pointer;transition:border-color .1s}
.kt:hover{border-color:var(--accent)} .kt.act{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.kt .v{font-size:20px;font-weight:800;line-height:1.1} .kt .l{font-size:11px;color:var(--ink-2);margin-top:3px}
.kt.good .v{color:var(--up)} .kt.weak .v{color:var(--warn)} .kt.loss .v{color:var(--dn)} .kt.noprice .v{color:var(--warn)} .kt.noss .v{color:var(--ink-3)} .kt.draft .v{color:var(--info)}
.midrow{display:flex;gap:14px;align-items:flex-start;margin:8px 0 12px}
.filtcol{flex:1 1 340px;min-width:300px;display:flex;flex-direction:column;gap:8px}
.filtcol .bar{margin:0}.midrow .byst{margin:0}
@media(max-width:1180px){.midrow{flex-direction:column}.filtcol,.midrow .byst{width:100%}}
.byst{margin:0 0 12px;overflow:auto}
.byst table{border-collapse:collapse;font-size:12px;min-width:0;width:auto}
.byst th,.byst td{padding:5px 10px;border-bottom:1px solid var(--border);white-space:nowrap;text-align:right}
.byst th:first-child,.byst td:first-child{text-align:left}
.byst th{color:var(--ink-3);text-transform:uppercase;font-size:10.5px;letter-spacing:.03em}
.byst td.bc{cursor:pointer} .byst td.bc:hover{background:rgba(255,255,255,.06)} .byst td.selc{background:rgba(34,211,238,.14);box-shadow:inset 0 0 0 1px var(--accent)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}
.tile{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px}
.tile .v{font-size:21px;font-weight:800}.tile .l{color:var(--ink-2);font-size:11.5px;margin-top:2px}.tile .n{color:var(--ink-3);font-size:10.5px;margin-top:4px}
h3{font-size:12px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.04em;margin:16px 0 8px}
.chain{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}
.chip{background:var(--card);border:1px solid var(--border);border-radius:999px;padding:6px 12px;font-size:12px;display:flex;gap:8px;align-items:center}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block}
.trend{font-size:10.5px;font-weight:800;margin-left:1px;font-variant-numeric:tabular-nums}
.trend.up{color:var(--up)}.trend.dn{color:var(--dn)}.trend.flat{color:var(--ink-4)}
.g{background:var(--up)}.y{background:var(--warn)}.r{background:var(--dn)}.o{background:var(--ink-3)}
.tl{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.tlc{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:9px 11px;font-size:11.5px}
.tlc b{font-size:12.5px}.tlc .d{color:var(--ink-3);margin-top:3px;font-size:11px}
.tlc-h{display:flex;gap:6px;align-items:center;margin-bottom:3px}
.tlc-m{font-size:11.5px;color:var(--ink);margin-top:6px;padding-top:5px;border-top:1px solid var(--border)}
.months{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.mo{background:var(--elev);border:1px solid var(--border);border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;color:var(--ink-2)}
.mo:hover{border-color:var(--accent)}
.mo.move{background:rgba(245,158,11,.14);border-color:var(--warn);color:var(--warn);font-weight:700;cursor:default}
.mo.act{background:var(--accent);color:#04222a;border-color:var(--accent);font-weight:700}
.bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin:10px 0 10px}
.bar input,.bar select{background:var(--elev);border:1px solid var(--border);color:var(--ink);border-radius:8px;padding:7px 10px;font-size:12.5px}
.bar input[type=text]{min-width:200px}
.bar label{display:flex;gap:6px;align-items:center;color:var(--ink-2);font-size:12px;cursor:pointer;user-select:none}
.presets{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.pbtn{background:var(--elev);border:1px solid var(--border);color:var(--ink-2);border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer}
.pbtn:hover{border-color:var(--accent)}.pbtn.act{background:var(--accent);color:#04222a;border-color:var(--accent);font-weight:700}
.seg{display:inline-flex;background:var(--elev);border:1px solid var(--border);border-radius:8px;overflow:hidden}
.seg button{background:transparent;border:0;border-right:1px solid var(--border);color:var(--ink-3);font:inherit;font-size:12px;padding:6px 11px;cursor:pointer;transition:.15s;white-space:nowrap}
.seg button:last-child{border-right:0}
.seg button:hover:not(.on){color:var(--ink)}
.seg button.on{background:var(--accent);color:#04222a;font-weight:700}
.dbtn{background:var(--accent);border:1px solid var(--accent);color:#04222a;border-radius:8px;padding:7px 12px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.dsep{color:var(--ink-4)}
.cnt{color:var(--ink-3);font-size:12px;margin-left:auto}
.scrollx{overflow:auto;max-height:74vh;border:1px solid var(--border);border-radius:12px}
table{border-collapse:collapse;width:100%;font-size:11px;min-width:0;table-layout:fixed}
th,td{padding:5px 6px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mp{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
.mp-grn{background:rgba(60,170,110,.20);color:#82dcaa}
.mp-yel{background:rgba(217,164,65,.20);color:#e6c069}
.mp-wht{background:rgba(200,205,215,.09);color:var(--ink-1)}
.mp-red{background:rgba(214,92,110,.22);color:#ec93a4}
th{position:sticky;top:0;background:var(--elev);z-index:2;font-size:11px;color:var(--ink-2);text-transform:uppercase;letter-spacing:.03em;cursor:pointer;user-select:none}
th:hover{color:var(--ink)} th .ar{color:var(--accent);font-size:10px}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
tr.drow:hover td{background:rgba(255,255,255,.02)}
tr.drow{cursor:pointer}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.st{font-size:11px;padding:2px 8px;border-radius:999px;background:var(--elev);border:1px solid var(--border);color:var(--ink-2)}
.cell-g{color:var(--up);font-weight:700}.cell-y{color:var(--warn)}.cell-o{color:var(--ink-4)}.cell-dn{color:var(--dn);font-weight:800}
.nocs{color:var(--ink-3);font-size:11px;border-bottom:1px dashed var(--ink-4)}.nocs:hover{color:var(--ink-2)}
.exp{color:var(--ink-3);display:inline-block;width:12px}
.dots{display:inline-flex;gap:3px;align-items:center;flex-wrap:wrap;max-width:96px;justify-content:flex-end}
.sd{width:7px;height:7px;border-radius:50%;border:1px solid var(--ink-4);display:inline-block}
.sd.on{background:var(--up);border-color:var(--up)}
.sd.mono{background:var(--ink-4)}
.dmore{color:var(--ink-3);font-size:10px;margin-left:2px}
.flag{font-size:11px;padding:2px 7px;border-radius:6px;font-weight:700}
.flag.ok{background:rgba(16,185,129,.14);color:var(--up)}
.flag.warn{background:rgba(245,158,11,.14);color:var(--warn)}
.flag.bad{background:rgba(244,63,94,.16);color:var(--dn)}
.flag.lost{background:rgba(106,116,132,.14);color:var(--ink-3)}
.izd td{background:#0E141C}
.izd .izcol{color:var(--accent);text-align:center;width:22px}
.izd .iname{color:var(--ink-2);padding-left:6px;max-width:340px;overflow:hidden;text-overflow:ellipsis}
.art-code{color:var(--ink-4);font-size:10px;font-variant-numeric:tabular-nums}
.atype{font-size:10px;padding:1px 6px;border-radius:6px;background:rgba(90,140,200,.14);border:1px solid rgba(90,140,200,.3);color:var(--ink-2);white-space:nowrap;margin-left:4px}
.mpct{font-size:10px;color:var(--ink-3);font-variant-numeric:tabular-nums}
.mpct.dn{color:var(--dn,#e0687a)}
.bsrc{font-size:9.5px;padding:0 4px;border-radius:4px;background:rgba(120,150,120,.16);border:1px solid rgba(120,150,120,.32);color:var(--ink-2);font-weight:700}
.note{color:var(--ink-3);font-size:11.5px;line-height:1.55;max-width:1300px;margin:2px 0 12px;padding:8px 10px;background:var(--elev);border:1px solid var(--border);border-radius:8px}
.note b{color:var(--ink-2)}.note i{color:var(--ink-2);font-style:normal}
.burger{position:fixed;top:12px;right:14px;z-index:60;cursor:pointer;font-size:12px;font-weight:700;color:var(--ink-2);background:var(--elev);border:1px solid var(--border);border-radius:8px;padding:6px 10px}
.burger:hover{color:var(--ink-1);border-color:var(--accent)}
.scrim{position:fixed;inset:0;background:rgba(0,0,0,.5);opacity:0;visibility:hidden;transition:opacity .2s;z-index:70}
.scrim.open{opacity:1;visibility:visible}
.drawer{position:fixed;top:0;right:0;height:100%;width:min(600px,62vw);background:var(--bg-1,#0b0f16);border-left:1px solid var(--border);box-shadow:-12px 0 30px rgba(0,0,0,.4);transform:translateX(100%);transition:transform .24s ease;z-index:80;display:flex;flex-direction:column}
.drawer.open{transform:translateX(0)}
.dhead{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);font-size:14px;color:var(--ink-1)}
.dx{cursor:pointer;background:none;border:none;color:var(--ink-3);font-size:16px}.dx:hover{color:var(--ink-1)}
.dbody{overflow:auto;padding:12px 16px 24px;color:var(--ink-2);font-size:12px;line-height:1.55}
.dbody p{margin:4px 0 10px}
.dsub{margin:14px 0 4px !important;color:var(--ink-1)}
.dtab{width:100%;border-collapse:collapse;margin-bottom:6px}
.dtab th{text-align:left;color:var(--ink-3);font-weight:600;padding:4px 6px;border-bottom:1px solid var(--border);font-size:11px}
.dtab td{padding:5px 6px;border-bottom:1px solid var(--border);vertical-align:top}
.dtab td:first-child{color:var(--ink-1);font-weight:600;padding-right:10px}
.drawer table{table-layout:fixed;width:100%;min-width:0}
.drawer th,.drawer td{white-space:normal !important;overflow:visible;text-overflow:clip;word-break:break-word;max-width:none}
.dtab td:first-child,.dtab th:first-child{width:40%}
.frtab td:first-child,.frtab th:first-child{width:56%}
.frtab .frp{width:15%}.frtab .frs{width:29%}
.dbody{overflow-x:hidden}
.dtab i{font-style:normal;color:var(--ink-1)}.dtab b{color:var(--ink-1)}
.frsp{margin:12px 0 3px;color:var(--ink-1);font-weight:700;font-size:12px}
.frtab td{font-size:11px;padding:3px 6px}
.frtab td:first-child{white-space:normal;font-weight:400;color:var(--ink-2)}
.frtab .frp{color:var(--ink-3);text-align:right}
.frtab .frs{color:var(--ink-3)}
.fr-ok .frs{color:#82dcaa}.fr-ok td:first-child{color:var(--ink-1)}
.fr-no{opacity:.6}.fr-no .frs{color:#ec93a4}
.frlg{display:inline-block;padding:0 6px;border-radius:4px;font-size:10px;margin-left:2px}
.frlg.fr-ok{background:rgba(60,170,110,.2);color:#82dcaa;opacity:1}
.frlg.fr-mid{background:rgba(200,205,215,.12);color:var(--ink-1)}
.frlg.fr-no{background:rgba(214,92,110,.2);color:#ec93a4;opacity:1}
.dnote{color:var(--ink-3);font-size:11px;font-style:italic;margin-top:8px}
.warnbox{border-left:3px solid #e0687a;background:rgba(214,92,110,.10);padding:2px 12px;margin:12px 0;border-radius:0 6px 6px 0}
.warnbox .dsub{color:#ec93a4;margin-top:8px !important}
.detail td{background:#0E141C;padding:12px 16px;white-space:normal}
.dgrid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.dh{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-3);margin:0 0 6px}
.dtab{width:100%;border-collapse:collapse;font-size:12px;min-width:0}
.dtab td,.dtab th{padding:4px 8px;border-bottom:1px solid var(--border);white-space:nowrap;text-align:left}
.spblock{margin-bottom:8px}.spname{font-weight:700;font-size:12px}
.card-line{color:var(--ink-2);font-size:11.5px;margin:2px 0 2px 10px}
.foot{color:var(--ink-3);font-size:11.5px;margin-top:16px;max-width:1300px}
#tbl tfoot td{position:sticky;bottom:0;background:#111a24;border-top:2px solid var(--accent,#4a90d9);font-weight:700;color:var(--ink-1);z-index:5}
.smcell{white-space:nowrap;line-height:1.4;overflow:visible}
.smseg{display:inline-block;min-width:15px;text-align:center;font-size:9px;font-weight:700;padding:1px 2px;margin:0 1px 0 0;border-radius:3px;border:1px solid transparent}
.smoff{color:var(--ink-4);opacity:.4}
.smon{color:var(--ink-2);border-color:var(--border)}
.smss{color:#0b0f16;background:#4fb387}
.smsrc{outline:2px solid #e6c069;outline-offset:1px}
.rdbar{display:inline-flex;gap:1px;vertical-align:middle;margin-left:4px}
.rdbar i{width:5px;height:11px;background:rgba(200,205,215,.14);border-radius:1px;display:inline-block}
.rdbar.rd1 i:nth-child(1){background:#d98b45}
.rdbar.rd2 i:nth-child(1),.rdbar.rd2 i:nth-child(2){background:#e6c069}
.rdbar.rd3 i{background:#4fb387}
.detail td{background:#0d141d;padding:10px 14px;overflow:visible;white-space:normal}
.pwrap{overflow-x:auto;max-width:100%}
.detail table.ptab{table-layout:auto;width:auto;border-collapse:collapse;font-size:11px;margin:0}
.ptab th{color:var(--ink-3);font-weight:600;text-align:left;padding:3px 8px;border-bottom:1px solid var(--border);white-space:nowrap}
.ptab td{padding:3px 8px;border-bottom:1px solid var(--border);white-space:nowrap}
.ptab .pnm{max-width:340px;overflow:hidden;text-overflow:ellipsis;color:var(--ink-2)}
.pusl{color:var(--ink-2);font-size:11.5px;margin-top:8px}.pusl b{color:var(--ink-1)}
.barhint{color:var(--ink-3);font-size:11px}
.sect{cursor:pointer;user-select:none}
.sect:hover{color:var(--ink-1)}
.sect .cv{display:inline-block;width:12px;color:var(--ink-3);font-size:11px}
#ftr td{padding:2px 3px;background:var(--elev);border-bottom:1px solid var(--border);overflow:visible;position:relative;vertical-align:middle}
.fcx{width:100%;min-width:0;box-sizing:border-box;font-size:10px;padding:2px 4px;background:var(--bg-1,#0b0f16);border:1px solid var(--border);border-radius:4px;color:var(--ink-1)}
.fcx.fcn{text-align:right}
.fcbtn{width:100%;min-width:0;box-sizing:border-box;font-size:10px;padding:2px 4px;background:var(--bg-1,#0b0f16);border:1px solid var(--border);border-radius:4px;color:var(--ink-2);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fcbtn:hover{color:var(--ink-1);border-color:var(--accent)}
.fcpop{display:none;position:fixed;z-index:90;background:var(--elev);border:1px solid var(--border);border-radius:8px;padding:6px;max-height:300px;overflow:auto;box-shadow:0 8px 24px rgba(0,0,0,.45);min-width:200px}
.fcpop.open{display:block}
.fcpop label{display:block;font-size:11.5px;color:var(--ink-2);padding:3px 6px;white-space:nowrap;cursor:pointer;border-radius:4px}
.fcpop label:hover{color:var(--ink-1);background:var(--bg-1,#0b0f16)}
.fcpa{border-top:1px solid var(--border);margin-top:4px;padding-top:5px;text-align:right}
.fcpa button{font-size:10px;background:none;border:1px solid var(--border);border-radius:4px;color:var(--ink-3);cursor:pointer;padding:2px 8px}
.fcpa button:hover{color:var(--ink-1)}
</style></head>
<body><div class="wrap">
<button class="burger" id="burger" title="Инструкция: как читать таблицу" aria-label="Инструкция">☰ инструкция</button>
<h1>Контроль экономики сделок</h1>
<p class="ver">Воронка «GG Заказы РФ» (49) · с/с и Маржа - за партию (с/с за шт × кол-во) · обновлено <span id="gen"></span></p>

<div class="bar">
  <input type="text" id="q" placeholder="Поиск: номер или название">
  <span class="barhint">фильтры по столбцам - в строке под шапкой таблицы ↓</span>
  <label>с <input type="date" id="dfrom"></label>
  <span class="dsep">–</span>
  <label>по <input type="date" id="dto"></label>
  <button class="dbtn" id="applyRange">ОК</button>
  <label><input type="checkbox" id="fnoprod"> без товаров</label>
  <label><input type="checkbox" id="fgap"> произв. без с/с</label>
  <label><input type="checkbox" id="fpart"> неполная с/с</label>
  <span class="cnt" id="cnt"></span>
</div>
<div class="presets" id="presets"></div>

<h3 class="sect" data-sect="sp"><span class="cv">▾</span> Смарт-процессы: запуск / внесённая с/с (стрелка - к прошлому снимку) · создан и первая боевая сделка</h3>
<div class="sbody" id="sp_body"><div class="tl" id="tl"></div></div>

<h3 class="sect" data-sect="m"><span class="cv">▾</span> Ключевые метрики (клик - фильтр таблицы) · сводка учитывает фильтры и диапазон дат</h3>
<div class="sbody" id="m_body">
<div class="sums" id="sums"></div>
<div class="kpi" id="kpi"></div>
<div class="byst" id="byst"></div>
</div>
<div class="scrim" id="scrim"></div>
<aside class="drawer" id="drawer" aria-label="Инструкция">
  <div class="dhead"><b>Как читать таблицу</b><button class="dx" id="drawerX" aria-label="Закрыть">✕</button></div>
  <div class="dbody">
    <table class="dtab">
      <tr><th>Колонка</th><th>Что значит</th></tr>
      <tr><td>Позиций</td><td>наименований (товарных строк) в сделке</td></tr>
      <tr><td>Штук</td><td>суммарное количество изделий по всем позициям</td></tr>
      <tr><td>Услуги ₽</td><td>сумма строк-услуг по <b>цене клиента</b> (не себестоимость). Слова: <i>доставка, монтаж, логистика, сборка, подъём, пронос, разгрузка, замер, установка, услуга, пэк</i>. В скобках - сколько строк</td></tr>
      <tr><td>Кальк. Расчёт Закупка Произв. Сборка Логист. Монтаж</td><td>точки = карточки смарт-процесса; зелёная точка = с/с внесена. В развороте число с/с - ссылка на карточку смарта</td></tr>
      <tr><td>Σ с/с</td><td>себестоимость за партию (с/с за штуку × количество товара)</td></tr>
      <tr><td>Маржа</td><td>бюджет − Σ с/с, в рублях. Убыток красным. «нет цены» - бюджет ≈ 0, минус ложный</td></tr>
      <tr><td>Маржин.%</td><td>маржинальность (маржа / бюджет) с подсветкой: <b>красный</b> ниже 20%, <b>жёлтый</b> 20-50%, <b>зелёный</b> выше 50%</td></tr>
      <tr><td>Бюджет (тег К/Р)</td><td>каким смартом сформирован бюджет: <b>Р</b> Расчёт, <b>К</b> Калькулятор, З Закупка, Пр Производство, Сб Сборка, Л Логистика. Нет тега = бюджет вбит вручную</td></tr>
      <tr><td>Тип</td><td>тип ассортимента из поля сделки Bitrix (чип в «Название»)</td></tr>
      <tr><td>Полнота с/с</td><td>доля смартов с внесённой с/с по сделке</td></tr>
      <tr><td>Статус</td><td>гейт: ок / КП без расчёта / в произв., с/с нет / провалена и т.п.</td></tr>
    </table>
    <p class="dsub"><b>Разворот сделки (▸)</b></p>
    <p>Строки изделий - по НС-коду (единый номер изделия). У каждой своё количество и ссылки на карточки Расчёта / Производства / Сборки. Отдельная строка «Услуги» - расшифровка доставки / монтажа / замера.</p>
    <div class="warnbox">
    <p class="dsub"><b>Что НЕ входит в Σ с/с</b></p>
    <p>Показана цеховая металло-себестоимость. Вне её: административные накладные (поле Bitrix «без адм»), сборка, монтаж, доставка. Для изделий со стеклом и монтажом реальная маржа ниже показанной.</p>
    </div>
    <p class="dsub"><b>Окно данных</b></p>
    <p>Воронка «GG Заказы РФ» (49), сделки с 2026-04-01 (после переезда). Обновление - каждые 3 часа.</p>

    <p class="dsub"><b>Поля смартов: что идёт в с/с</b></p>
    <p>Как считается с/с карточки: если есть поле-<b>итог</b> (Производственная С/С) - берётся оно; иначе суммируются поля-компоненты «в с/с». Поля цены/бюджета/налога/наценки в с/с НЕ идут (это выручка и служебное). «Запол.» - доля карточек смарта, где поле заполнено. Цвет: <span class="frlg fr-ok">итог</span> <span class="frlg fr-mid">в с/с</span> <span class="frlg fr-no">не в с/с</span>.</p>
    ${FIELDS_REF}
    <p class="dnote">Поля не про деньги (даты, адреса, исполнители, статусы) в этот список не входят - на с/с они не влияют.</p>
  </div>
</aside>

<div class="scrollx"><table id="tbl"><thead></thead><tbody></tbody><tfoot></tfoot></table></div>
</div>
<script>
const DATA=${JSON.stringify(payload)};
document.getElementById('gen').textContent=new Date(DATA.generated_at).toLocaleString('ru')+' · версия '+new Date(DATA.bakedAt).toLocaleString('ru');
// авто-обновление как у РОП: опрашиваем v.txt, при новой сборке перезагружаем
function autoReload(){ if(!DATA.bakedAt||location.search.indexOf('cb=')>=0)return; setInterval(function(){ fetch('v.txt?ts='+Date.now()).then(function(r){return r.ok?r.text():'';}).then(function(t){ t=(t||'').trim(); if(t&&t!==DATA.bakedAt) location.replace(location.pathname+'?cb='+Date.now()); }).catch(function(){}); }, 180000); }
autoReload();
const ORDER=DATA.order, SHORT=DATA.short, PORTAL=DATA.portal, RANK=DATA.rank, PROD=DATA.prodRank, MOVE=DATA.moveDate;
const EXCL=/сумма|налог|наценк|прибыл|бюджет|коэфф|адрес|номер|исполнител|отч[её]т|тип доставки|данные из сп|^id |удалить|расход материал|макет|шаблон|обрешет|домгласс|полная себестоимость по заказу/i;
const ITOG=/производственная с\\/с|с\\/?с итог|расчет с\\/с итого|себестоимость производ/i;
function realMoney(arr){ return (arr||[]).filter(m=>!EXCL.test(m.label)); }
function spCost(sp){ if(!sp) return null; const f=realMoney(sp.money); if(!f.length) return {v:0,empty:true}; const it=f.find(m=>ITOG.test(m.label)); return {v: it?it.value:f.reduce((a,m)=>a+m.value,0), empty:false, fields:f}; }
function byKey(d,key){ return d.sps.find(s=>s.key===key); }
function ssCardsOf(sp){ return sp?(sp.cards||[]).filter(c=>!c.bad&&realMoney(c.money).length>0).length:0; }
const fmt=v=>v>=1e6?(v/1e6).toFixed(1).replace('.',',')+' млн':v>=1000?Math.round(v/1000)+'к':Math.round(v)+'';
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// заголовок карточки «<сделка>/<артикул>. <название>» -> чистое название товара
const cleanNm=s=>String(s||'').replace(/^\\s*\\d+\\s*(?:[\\/\\\\][^.]*)?\\.\\s*/,'').trim();
const dealUrl=id=>PORTAL+'/crm/deal/details/'+id+'/';
const spUrl=(etid,card)=>PORTAL+'/crm/type/'+etid+'/details/'+card+'/';
const ruD=s=>{ if(!s)return''; const p=s.split('-'); return p[2]+'.'+p[1]+'.'+p[0]; };
const posOf=d=>(d.products||[]).length;
const qtyOf=d=>(d.products||[]).reduce((a,p)=>a+(+p.qty||0),0);
// с/с за партию = Σ по карточкам (с/с за 1 шт × Кол-во товара). Поля с/с в Bitrix - за 1 шт,
// бюджет и «Сумма» - за партию, поэтому маржу считаем на одной базе (за партию).
function spBatch(sp){ if(!sp) return {v:0,empty:true}; let v=0,any=false; for(const c of (sp.cards||[])){ if(c.bad)continue; const b=cardBatch(c); if(b>0){any=true; v+=b;} } return {v,empty:!any}; }
function prodSS(d){ const pr=spBatch(byKey(d,'Производство  GG')),ra=spBatch(byKey(d,'Расчёт')),za=spBatch(byKey(d,'Закупка'));
  const base=(pr&&!pr.empty)?pr.v:((ra&&!ra.empty)?ra.v:0); const glass=(za&&!za.empty)?za.v:0; return base+glass; }
// ячейка Маржа с чтением минуса: бюджет≈0 при наличии с/с = «нет цены» (ложный минус); цена реальная < с/с = «убыток»
// источник бюджета: какой смарт несёт бюджет-поле (Сумма/БЮДЖЕТ/Бюджет заказ). Приоритет Р>К>...
const BUDF=/^сумма$|бюджет/i;
const BUDPRIO=[['Расчёт','Р'],['Калькулятор GG','К'],['Закупка','З'],['Производство  GG','Пр'],['Сборка','Сб'],['Логистика','Л'],['Монтаж','М']];
const BUDNAME={'Р':'Расчёт','К':'Калькулятор','З':'Закупка','Пр':'Производство','Сб':'Сборка','Л':'Логистика','М':'Монтаж'};
function budgetSrc(d){ for(const [k,tag] of BUDPRIO){ const sp=byKey(d,k); if(!sp)continue; let v=0; for(const c of (sp.cards||[]))for(const m of (c.money||[]))if(BUDF.test(m.label))v=Math.max(v,m.value||0); if(v>0)return {tag,v}; } return null; }
// готовность с/с: 3 = готова (Производство), 2 = формируется (Расчёт), 1 = черновая (Калькулятор/Закупка), 0 = нет расчёта
const hasSP=k=>{const c=spCost(k);return c&&!c.empty;};
function readiness(d){
  if(hasSP(byKey(d,'Производство  GG'))) return {lvl:3,txt:'готова - можно верить (Производство)',cls:'rd3'};
  if(hasSP(byKey(d,'Расчёт'))) return {lvl:2,txt:'формируется - предварительная (Расчёт)',cls:'rd2'};
  if(hasSP(byKey(d,'Калькулятор GG'))||hasSP(byKey(d,'Закупка'))) return {lvl:1,txt:'черновая - только прикидка (Калькулятор)',cls:'rd1'};
  return {lvl:0,txt:'нет расчёта - с/с ещё не формировалась',cls:'rd0'};
}
// колонка «Смарты»: цепочка меток - запущен/с·с/источник итоговой с/с
const SMLET={'Калькулятор GG':'К','Расчёт':'Р','Закупка':'З','Производство  GG':'Пр','Сборка':'Сб','Логистика':'Л','Монтаж':'М'};
function ssSource(d){ if(hasSP(byKey(d,'Производство  GG')))return 'Производство  GG'; if(hasSP(byKey(d,'Расчёт')))return 'Расчёт'; return null; }
function smartCell(d){ const src=ssSource(d); let html='';
  for(const k of ORDER){ const sp=byKey(d,k); const cards=sp?(sp.cards||[]).filter(c=>!c.bad):[]; const launched=cards.length>0; const hasss=cards.some(c=>realMoney(c.money).length>0); const isSrc=(k===src);
    let cls='smseg'; if(!launched)cls+=' smoff'; else if(hasss)cls+=' smss'; else cls+=' smon'; if(isSrc)cls+=' smsrc';
    const tip=(SMLET[k]||k)+(hasss?' - с/с внесена':(launched?' - запущен, с/с нет':' - не запущен'))+(isSrc?' · источник итоговой с/с':'');
    html+='<span class="'+cls+'" title="'+esc(tip)+'">'+esc(SMLET[k]||k)+'</span>'; }
  return '<td class="smcell">'+html+'</td>';
}
// Σ с/с с цветовой гистограммой готовности
function ssCell(d,ss){ const r=readiness(d);
  return '<td class="num" title="с/с за партию · '+esc(r.txt)+'">'+(ss?fmt(ss):'<span class="cell-o">-</span>')+' <span class="rdbar '+r.cls+'"><i></i><i></i><i></i></span></td>';
}
// разворот сделки - панель: по каждому изделию с/с по смартам со ссылками
function detailRow(d){ const izd=izdelia(d), svc=svcRows(d); let inner='';
  if(izd.length){
    inner+='<table class="ptab"><tr><th>Изделие (НС/артикул)</th><th>Кол-во</th>'+ORDER.map(k=>'<th>'+esc(SMLET[k]||k)+'</th>').join('')+'<th>Σ с/с</th></tr>';
    for(const g of izd){ const cells=ORDER.map(k=>{ const e=g.sp[k];
        if(e&&e.vB) return '<td class="num cell-g"><a href="'+spUrl(e.cards[0].etid,e.cards[0].id)+'" target="_blank" onclick="event.stopPropagation()">'+fmt(e.vB)+'</a></td>';
        if(e&&e.cards&&e.cards.length) return '<td class="num"><a class="nocs" href="'+spUrl(e.cards[0].etid,e.cards[0].id)+'" target="_blank" onclick="event.stopPropagation()">нет с/с</a></td>';
        return '<td class="num cell-o">·</td>'; }).join('');
      const ssTot=((g.sp['Производство  GG']&&g.sp['Производство  GG'].vB)||(g.sp['Расчёт']&&g.sp['Расчёт'].vB)||0)+((g.sp['Закупка']&&g.sp['Закупка'].vB)||0);
      inner+='<tr><td class="pnm" title="'+esc(g.nm||'')+'"><span class="art-code">'+esc(g.art||g.ns||('#'+g.firstId))+'</span> '+esc(cleanNm(g.nm).slice(0,50))+'</td><td class="num">'+(g.qty?g.qty+' шт':'')+'</td>'+cells+'<td class="num">'+(ssTot?fmt(ssTot):'<span class="cell-o">-</span>')+'</td></tr>'; }
    inner+='</table>';
  }
  if(svc.length){ inner+='<div class="pusl"><b>Услуги:</b> '+svc.map(p=>esc(p.name)+' - '+fmt((+p.price||0)*(+p.qty||0))).join(' · ')+'</div>'; }
  if(!izd.length&&!svc.length) inner='<div class="pusl">изделий с артикулом в карточках нет'+(d.sps.length?' (смарты запущены, артикул не заполнен)':'; смарты не запущены')+'</div>';
  return '<tr class="detail"><td colspan="'+COLS.length+'"><div class="pwrap">'+inner+'</div></td></tr>';
}
function marginCell(d,ss,marginShown){
  if(!(marginShown&&ss)) return '<td class="num" title="маржа считается со стадии производства"><span class="cell-o">-</span></td>';
  const m=d.budget-ss;
  if(m>=0) return '<td class="num" title="бюджет за партию − с/с за партию">'+fmt(m)+'</td>';
  const lowPrice=d.budget<=100||d.budget<ss*0.05;
  const tag=lowPrice?'нет цены':'убыток', fl=lowPrice?'warn':'bad';
  const tip=lowPrice?('бюджет '+fmt(d.budget)+' не заполнен, а с/с '+fmt(ss)+' есть - минус ложный, проставить цену'):('цена '+fmt(d.budget)+' ниже с/с '+fmt(ss)+' - убыток по данным, разобрать');
  return '<td class="num" title="'+esc(tip)+'"><span class="cell-dn">'+fmt(m)+'</span> <span class="flag '+fl+'">'+tag+'</span></td>';
}
// маржинальность % = (бюджет − Σ с/с)/бюджет. null там, где маржа не считается или «нет цены»
function marginPctVal(d){ const pr=spCost(byKey(d,'Производство  GG')); const marginShown=(pr&&!pr.empty)||prodRankOf(d)>=5;
  const ss=prodSS(d); if(!(marginShown&&ss)||!(d.budget>0))return null;
  if(d.budget<=100||d.budget<ss*0.05)return null; // «нет цены» - процент бессмысленный
  return Math.round((d.budget-ss)/d.budget*100); }
// пороги подсветки - терцили по фактическим данным (адаптивно): красный низ, белый середина, зелёный верх
const MPCT_LO=20, MPCT_HI=50; // фиксированные пороги: красный <20%, жёлтый 20-50%, зелёный >50%
function mpctCell(d){ const mv=marginPctVal(d);
  if(mv===null)return '<td class="num"><span class="cell-o">-</span></td>';
  const cls=mv<MPCT_LO?'mp-red':mv>MPCT_HI?'mp-grn':'mp-yel';
  const tip='маржинальность '+mv+'% · красный <'+MPCT_LO+'%, жёлтый '+MPCT_LO+'-'+MPCT_HI+'%, зелёный >'+MPCT_HI+'%';
  return '<td class="num mp '+cls+'" title="'+esc(tip)+'">'+mv+'%</td>'; }
function rankOf(d){ return RANK[d.stage]!==undefined?RANK[d.stage]:2; }
function prodRankOf(d){ return PROD[d.stage]||0; }
// полнота с/с: сколько карточек с с/с против числа позиций
function coverage(d){ const pos=posOf(d); let best=0; for(const k of ['Расчёт','Производство  GG','Закупка','Калькулятор GG']){ const n=ssCardsOf(byKey(d,k)); if(n>best)best=n; }
  if(best===0) return {cls:'',t:'-',r:-1};
  if(pos===0) return {cls:'warn',t:'с/с есть, товаров 0',r:0.5};
  if(best>=pos) return {cls:'ok',t:'полная',r:1};
  return {cls:'warn',t:'частичная '+best+'/'+pos,r:best/pos}; }
function gate(d){ if(/провал/i.test(d.stage)) return {cls:'lost',t:'провалена'};
  const pr=spCost(byKey(d,'Производство  GG')); const est=spCost(byKey(d,'Расчёт'))||spCost(byKey(d,'Калькулятор GG')); const p5=prodRankOf(d);
  if(p5>=5){ if(!pr||pr.empty) return {cls:'bad',t:'нет с/с производства'}; return {cls:'ok',t:'с/с есть'}; }
  if(p5>=4){ if(!pr||pr.empty) return {cls:'warn',t:'в произв., с/с нет'}; return {cls:'ok',t:'ок'}; }
  if(rankOf(d)>=3){ if(!est||est.empty) return {cls:'warn',t:'КП без расчёта'}; return {cls:'ok',t:'ок'}; }
  return {cls:'',t:''}; }

const N=DATA.deals.length;

const CP=DATA.chainPrev||{}, CPat=DATA.chainPrevAt;
function trend(cur,prev){ if(prev===null||prev===undefined)return ''; const d=cur-prev; if(d===0)return '<span class="trend flat" title="без изменений">=</span>'; const up=d>0; return '<span class="trend '+(up?'up':'dn')+'" title="было '+prev+'%">'+(up?'▲':'▼')+Math.abs(d)+'</span>'; }
const cpTip=CPat?('к снимку '+new Date(CPat).toLocaleString('ru')):'первый снимок - динамики пока нет';
// здоровье цепочки вшито в карточку таймлайна каждого смарта
function spHealth(k){ let L=0,F=0; for(const d of DATA.deals){ const s=byKey(d,k); if(s){L++; const c=spCost(s); if(c&&!c.empty)F++;} }
  const pL=Math.round(100*L/N), pF=L?Math.round(100*F/L):0; const dot=L===0?'o':F===0?'r':pF>=70?'g':'y';
  const pv=CP[k]; return {pL,pF,dot,L,tL:pv?trend(pL,pv.pL):'',tF:pv?trend(pF,pv.pF):''}; }
document.getElementById('tl').innerHTML=DATA.spTimeline.map(s=>{ const h=spHealth(s.k);
  return '<div class="tlc" title="'+esc(cpTip)+'">'
    +'<div class="tlc-h"><span class="dot '+h.dot+'"></span><b>'+esc(SHORT[s.k]||s.k)+'</b></div>'
    +'<div class="d">создан '+ruD(s.created)+' · 1-я боевая '+ruD(s.real)+'</div>'
    +'<div class="d">боевых карточек '+s.cards+'</div>'
    +'<div class="tlc-m">запуск '+h.pL+'% '+h.tL+' · с/с '+(h.L?h.pF+'% '+h.tF:'нет')+'</div></div>'; }).join('');

const present=new Set(DATA.deals.map(d=>d.stage));
// справочники для фильтров-столбцов
const stageList=DATA.stageOrder.filter(s=>present.has(s));
const assorts=[...new Set(DATA.deals.map(d=>d.assort).filter(Boolean))].sort();
const statuses=[...new Set(DATA.deals.map(d=>gate(d).t).filter(Boolean))];
const stageSet=new Set(); // мультивыбор этапов (из строки фильтров и из таблицы разбивки)

const today=DATA.deals.reduce((mx,d)=>d.created>mx?d.created:mx, '2026-01-01');
function daysAgo(n){ const t=new Date(today+'T00:00:00Z'); t.setUTCDate(t.getUTCDate()-n); return t.toISOString().slice(0,10); }
// пресеты периода по образцу РОП: сегмент-пилюля + диапазон с–по с кнопкой ОК
const PSET=[['today','Сегодня'],['yest','Вчера'],['7','7 дн'],['30','30 дн'],['60','60 дн'],['90','90 дн'],['all','Всё'],['mig','После переезда']];
function econSetPeriod(p){ const df=document.getElementById('dfrom'), dt=document.getElementById('dto');
  if(p==='all'){ df.value=''; dt.value=''; }
  else if(p==='today'){ df.value=today; dt.value=today; }
  else if(p==='yest'){ df.value=daysAgo(1); dt.value=daysAgo(1); }
  else if(p==='mig'){ df.value='2026-04-01'; dt.value=''; }
  else { df.value=daysAgo(+p-1); dt.value=today; } }
const pdiv=document.getElementById('presets');
const clearPeriod=()=>{ [...pdiv.querySelectorAll('.seg button')].forEach(x=>x.classList.remove('on')); };
pdiv.innerHTML='<span style="color:var(--ink-3);font-size:11.5px;align-self:center;margin-right:6px">Период:</span><div class="seg">'+PSET.map(p=>'<button data-p="'+p[0]+'"'+(p[0]==='mig'?' title="сделки, созданные после переезда - операционка с апреля 2026"':'')+'>'+esc(p[1])+'</button>').join('')+'</div>';
pdiv.addEventListener('click',e=>{ const b=e.target.closest('.seg button'); if(!b)return; clearPeriod(); b.classList.add('on'); econSetPeriod(b.dataset.p); render(); });
document.getElementById('applyRange').addEventListener('click',()=>{ clearPeriod(); render(); });

let sortIdx=0, sortDir=-1; // по умолчанию переопределим на «Полнота с/с» ниже, чтобы заполненные сделки были сверху
// услуги = товарные строки по названию (доставка/монтаж/замер/логистика/сборка), это ДАННЫЕ, не остаток.
const SVC=/доставк|монтаж|логист|сборк|подъ[её]м|пронос|разгруз|замер|установк|услуг|пэк/i;
const svcRows=d=>(d.products||[]).filter(p=>SVC.test(p.name||''));
const goodRows=d=>(d.products||[]).filter(p=>!SVC.test(p.name||''));
const sumRows=rs=>rs.reduce((a,p)=>a+(+p.price||0)*(+p.qty||0),0);
const svcSum=d=>sumRows(svcRows(d));
const goodsQty=d=>goodRows(d).reduce((a,p)=>a+(+p.qty||0),0);
const goodsPos=d=>goodRows(d).length;
const spN=ORDER.length; // ORDER всё ещё нужен для цепочки «Смарты» и панели разворота
const I_SM=6; // одна колонка «Смарты» вместо 7 колонок СП
// «Позиций» = число наименований (товарных строк). «Штук» = суммарное количество изделий.
const COLS=['Сделка','Название','Менеджер','Этап','Создана','Тип','Смарты','Услуги ₽','Бюджет','Позиций','Штук','Σ с/с','Маржа','Маржин.%','Полнота','Статус'];
const I_SVC=7, I_BUD=8, I_POS=9, I_QTY=10, I_SS=11, I_MRG=12, I_MPCT=13, I_COV=14, I_STAT=15;
// порядок: Сделка,Название,Менеджер,Этап,Создана,Тип,Смарты,Услуги,Бюджет,Позиций,Штук,Σсс,Маржа,Маржин%,Полнота,Статус
const COLW=[56,180,110,92,64,96,112,64,84,52,46,66,90,66,74,88];
function sortVal(d,i){
  if(i===0)return d.id; if(i===1)return (d.title||'').toLowerCase(); if(i===2)return (d.mgr||'').toLowerCase();
  if(i===3)return rankOf(d); if(i===4)return d.created||''; if(i===5)return (d.assort||'').toLowerCase();
  if(i===I_SM)return readiness(d).lvl;
  if(i===I_SVC)return svcSum(d);
  if(i===I_BUD)return d.budget;
  if(i===I_POS)return goodsPos(d);
  if(i===I_QTY)return goodsQty(d);
  if(i===I_SS)return prodSS(d);
  if(i===I_MRG){ const pr=spCost(byKey(d,'Производство  GG')); return (pr&&!pr.empty)||prodRankOf(d)>=5? d.budget-prodSS(d) : -1e15; }
  if(i===I_MPCT){ const mv=marginPctVal(d); return mv===null?-1e15:mv; }
  if(i===I_COV)return coverage(d).r;
  if(i===I_STAT)return rankOf(d);
  return 0;
}
// ячейка строки фильтров под соответствующим столбцом
function fcell(i){
  if(i===1)return '<input class="fcx" id="fcTitle" placeholder="фильтр">';
  if(i===2)return '<input class="fcx" id="fcMgr" placeholder="фильтр">';
  if(i===3)return '<button type="button" class="fcbtn" id="fcStageBtn">все ▾</button><div class="fcpop" id="fcStagePop"></div>';
  if(i===5)return '<select class="fcx" id="fcType"><option value="">все</option>'+assorts.map(a=>'<option>'+esc(a)+'</option>').join('')+'</select>';
  if(i===I_STAT)return '<select class="fcx" id="fcStat"><option value="">все</option>'+statuses.map(s=>'<option>'+esc(s)+'</option>').join('')+'</select>';
  if([I_SVC,I_BUD,I_POS,I_QTY,I_SS,I_MRG,I_MPCT].includes(i))return '<input class="fcx fcn" id="fcMin_'+i+'" placeholder="≥" title="минимум">';
  return '';
}
function syncStage(){ const btn=document.getElementById('fcStageBtn'); if(btn)btn.textContent=(stageSet.size?stageSet.size+' этап.':'все')+' ▾';
  const pop=document.getElementById('fcStagePop'); if(pop)pop.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.checked=stageSet.has(cb.value)); }
function wireFilters(){
  ['fcTitle','fcMgr','fcType','fcStat','fcMin_'+I_SVC,'fcMin_'+I_BUD,'fcMin_'+I_POS,'fcMin_'+I_QTY,'fcMin_'+I_SS,'fcMin_'+I_MRG,'fcMin_'+I_MPCT].forEach(id=>{const e=document.getElementById(id);if(e){e.addEventListener('input',render);e.addEventListener('change',render);}});
  document.getElementById('ftr').addEventListener('click',e=>e.stopPropagation());
  const pop=document.getElementById('fcStagePop'), btn=document.getElementById('fcStageBtn');
  pop.innerHTML=stageList.map(s=>'<label><input type="checkbox" value="'+esc(s)+'"> '+esc(s)+'</label>').join('')+'<div class="fcpa"><button type="button" id="fcStageClear">сброс</button></div>';
  btn.addEventListener('click',e=>{e.stopPropagation(); const open=!pop.classList.contains('open'); if(open){const r=btn.getBoundingClientRect(); pop.style.left=Math.max(4,r.left)+'px'; pop.style.top=(r.bottom+2)+'px';} pop.classList.toggle('open',open);});
  pop.addEventListener('click',e=>e.stopPropagation());
  pop.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.addEventListener('change',()=>{ if(cb.checked)stageSet.add(cb.value);else stageSet.delete(cb.value); syncStage(); render(); }));
  document.getElementById('fcStageClear').addEventListener('click',()=>{ stageSet.clear(); syncStage(); render(); pop.classList.remove('open'); });
  document.addEventListener('click',()=>pop.classList.remove('open'));
}
function head(){ const tbl=document.getElementById('tbl'); const oc=tbl.querySelector('colgroup'); if(oc)oc.remove();
  tbl.insertAdjacentHTML('afterbegin','<colgroup>'+COLW.map(w=>'<col style="width:'+w+'px">').join('')+'</colgroup>');
  const thead=document.querySelector('#tbl thead');
  if(!document.getElementById('ftr')){
    thead.innerHTML='<tr id="htr"></tr><tr id="ftr" class="frow">'+COLS.map((h,i)=>'<td>'+fcell(i)+'</td>').join('')+'</tr>';
    wireFilters(); syncStage();
  }
  document.getElementById('htr').innerHTML=COLS.map((h,i)=>'<th class="'+([I_SVC,I_BUD,I_POS,I_QTY,I_SS,I_MRG,I_MPCT].includes(i)?'num':'')+'" data-i="'+i+'">'+esc(h)+(i===sortIdx?' <span class="ar">'+(sortDir>0?'▲':'▼')+'</span>':'')+'</th>').join('');
  document.querySelectorAll('#htr th').forEach(th=>th.addEventListener('click',()=>{ const i=+th.dataset.i; if(i===sortIdx)sortDir=-sortDir; else{sortIdx=i;sortDir=(i===0?-1:1);} head(); render(); })); }

// ячейка СП на уровне сделки: точки по товарам в этом смарте (одна на карточку).
// Горит = товар вернул с/с из смарта; тусклая = товар ещё в смарте (данные не вернулись).
function cellSP(d,k){ const s=byKey(d,k); if(!s) return '<td class="num cell-o">·</td>';
  const cards=(s.cards||[]).filter(c=>!c.bad); if(!cards.length) return '<td class="num cell-o">·</td>';
  const lit=cards.filter(c=>realMoney(c.money).length>0).length; const cap=14;
  let dots=''; cards.slice(0,cap).forEach(c=>{ dots+='<span class="sd'+(realMoney(c.money).length>0?' on':'')+'"></span>'; });
  const more=cards.length>cap?('<span class="dmore">+'+(cards.length-cap)+'</span>'):'';
  const c=spCost(s); const title=(c&&!c.empty?fmt(c.v)+' с/с · ':'')+lit+' из '+cards.length+' карточек с с/с';
  return '<td title="'+esc(title)+'"><span class="dots">'+dots+more+'</span></td>'; }

const OPEN=new Set();
// с/с одной карточки: поле-итог, иначе сумма денежных полей
// с/с одной карточки за штуку: итог-поле, иначе сумма денежных полей.
// Высокую с/с НЕ режем - может быть реальной (рекламация/переделка); показываем как есть с флагом убытка.
function cardSS(c){ const f=realMoney(c.money); if(!f.length)return 0; const it=f.find(m=>ITOG.test(m.label)); return it?it.value:f.reduce((a,m)=>a+m.value,0); }
// множитель партии: поля с/с в Bitrix записаны либо ЗА ШТУКУ (тогда «Сумма»≈«Металл-сталь»×кол-во),
// либо УЖЕ ЗА ПАРТИЮ (тогда «Сумма»≈«Металл-сталь»). Определяем по каждой карточке, чтобы не завышать.
function cardMult(c){ const raw=c.money||[]; const q=Math.max(1,+c.qty||1);
  const S=(raw.find(m=>/^сумма$/i.test(m.label))||{}).value||0;
  const M=(raw.find(m=>/металл-сталь/i.test(m.label))||{}).value||0;
  if(M>0&&S>0&&Math.abs(S-M*q)<Math.abs(S-M))return q; // с/с за штуку -> умножаем
  return 1; }                                          // с/с уже за партию -> не умножаем
function cardBatch(c){ const u=cardSS(c); return u?u*cardMult(c):0; } // с/с карточки за партию
// НС-код из названия карточки - единый номер изделия, связывает Расчёт<->Производство
const NSRE=/НС\\s*\\d+\\s*-\\s*\\d+/i;
function nsCode(nm){ const m=String(nm||'').match(NSRE); return m?m[0].replace(/\\s+/g,'').toUpperCase():''; }
// сигнатура названия (срезаем номер сделки, НС, город капсом, Nшт, пунктуацию) - запасной ключ
function nameSig(nm){ let s=String(nm||'');
  s=s.replace(/^\\s*№?\\s*\\d+[.\\d]*\\s*/,'').replace(NSRE,' ').replace(/МАХАЧКАЛА/gi,' ').replace(/\\d+\\s*шт/gi,' ');
  return s.replace(/[^\\p{L}\\p{N}]+/gu,'').toLowerCase().slice(0,48); }
// ключ изделия по приоритету: артикул -> НС-код (единый б24-номер) -> название -> айди карточки
function izdKey(c){ if(c.art) return 'art:'+c.art; const ns=nsCode(c.nm); if(ns) return 'ns:'+ns; const sg=nameSig(c.nm); if(sg) return 'sig:'+sg; return 'id:'+c.id; }
// изделия сделки: группируем карточки СП по артикулу, с/с по каждому смарту
function izdelia(d){
  const g={};
  for(const s of d.sps){ for(const c of (s.cards||[])){ if(c.bad)continue; const ss=cardSS(c); const key=izdKey(c);
    const it=g[key]=g[key]||{art:c.art||'',ns:nsCode(c.nm),firstId:c.id,qty:0,sp:{},nm:''};
    if((+c.qty||0)>it.qty)it.qty=+c.qty||0;
    if(c.nm&&c.nm.length>(it.nm||'').length)it.nm=c.nm; // самое полное название изделия из заголовка карточки
    const e=it.sp[s.key]=it.sp[s.key]||{vU:0,vB:0,cards:[]}; e.vU+=ss; e.vB+=cardBatch(c); e.cards.push({id:c.id,etid:s.etid}); } }
  // строка изделия имеет смысл, если по нему есть с/с или дошло до Расчёта/Производства (там живёт единый НС-номер)
  return Object.values(g).filter(it=>Object.values(it.sp).some(e=>e.vB>0)||(it.sp['Расчёт']&&it.sp['Расчёт'].cards.length)||(it.sp['Производство  GG']&&it.sp['Производство  GG'].cards.length));
}
function izdRow(d,g){
  // Σ с/с за партию = производственная база (Производство, иначе Расчёт) + стекло (Закупка), уже × кол-во
  const baseB=((g.sp['Производство  GG']&&g.sp['Производство  GG'].vB)||(g.sp['Расчёт']&&g.sp['Расчёт'].vB)||0);
  const baseU=((g.sp['Производство  GG']&&g.sp['Производство  GG'].vU)||(g.sp['Расчёт']&&g.sp['Расчёт'].vU)||0);
  const glassB=(g.sp['Закупка']&&g.sp['Закупка'].vB)||0, glassU=(g.sp['Закупка']&&g.sp['Закупка'].vU)||0;
  const ssTot=baseB+glassB, ssU=baseU+glassU;
  const perU=k=>{ const e=g.sp[k]; if(!e||!e.vB)return ''; return (g.qty&&Math.abs(e.vB-e.vU*g.qty)<1)?(fmt(e.vU)+'/шт × '+g.qty+' шт = '+fmt(e.vB)):('с/с за партию '+fmt(e.vB)); };
  const spCells=ORDER.map(k=>{ const e=g.sp[k];
    if(e&&e.vB) return '<td class="num cell-g" title="'+esc(perU(k))+'"><a href="'+spUrl(e.cards[0].etid,e.cards[0].id)+'" target="_blank" onclick="event.stopPropagation()">'+fmt(e.vB)+'</a></td>';
    // карточка товара в смарте есть, но с/с не внесена - серый линк на карточку, проверить в смарте
    if(e&&e.cards&&e.cards.length) return '<td class="num" title="карточка есть, с/с не внесена - открыть в смарте"><a class="nocs" href="'+spUrl(e.cards[0].etid,e.cards[0].id)+'" target="_blank" onclick="event.stopPropagation()">нет с/с</a></td>';
    return '<td class="num cell-o">·</td>'; }).join('');
  const cov=(baseB>0)?'<span class="flag ok">есть</span>':'<span class="cell-o">-</span>';
  const ssTip='с/с за партию '+fmt(ssTot);
  return '<tr class="izd">'
    +'<td class="izcol">↳</td>'
    +'<td class="iname" title="'+esc((g.art||g.ns||('#'+g.firstId))+(g.nm?' · '+g.nm:''))+'"><span class="art-code">'+esc(g.art||g.ns||('#'+g.firstId))+'</span>'+(g.nm?' '+esc(cleanNm(g.nm).slice(0,60)):'')+'</td>'
    +'<td></td><td></td><td></td>'
    +'<td></td>'
    +spCells
    +'<td></td>'
    +'<td></td>'
    +'<td></td>'
    +'<td class="num">'+(g.qty?g.qty+' <span class="cell-o">шт</span>':'')+'</td>'
    +'<td class="num" title="'+esc(ssTip)+'">'+(ssTot?fmt(ssTot):'<span class="cell-o">-</span>')+'</td>'
    +'<td class="num cell-o">-</td>'
    +'<td class="num cell-o">-</td>'
    +'<td>'+cov+'</td>'
    +'<td></td>'
    +'</tr>';
}
// строка услуг (доставка/монтаж/замер по товарным строкам) в той же таблице
function svcRow(d,svc){ const sum=sumRows(svc);
  return '<tr class="izd"><td class="izcol">↳</td>'
    +'<td class="iname" title="'+esc(svc.map(p=>p.name+' '+fmt((+p.price||0)*(+p.qty||0))).join('; '))+'">Услуги: доставка / монтаж / замер</td>'
    +'<td></td><td></td><td></td>'
    +'<td></td>'
    +ORDER.map(()=>'<td class="num cell-o">·</td>').join('')
    +'<td class="num cell-g">'+fmt(sum)+'</td>'
    +'<td></td>'
    +'<td class="num">'+svc.length+'</td>'
    +'<td></td>'
    +'<td class="num cell-o">-</td><td class="num cell-o">-</td><td class="num cell-o">-</td><td></td><td></td></tr>'; }
// строка-заглушка, когда в карточках нет изделий с артикулом
function emptyRow(d){ return '<tr class="izd"><td class="izcol">↳</td><td colspan="'+(COLS.length-1)+'" class="iname">изделий с артикулом в карточках нет'+(d.sps.length?' (смарты запущены, артикул не заполнен)':'; смарты не запущены')+'</td></tr>'; }

// --- Верхние метрики: классификация сделки по запасу маржинальности ---
const MARG_WEAK=20; // [ГИПОТЕЗА] порог слабого запаса, % от бюджета - калибруется с финансами
function hasAnySS(d){ return (d.sps||[]).some(s=>(s.cards||[]).some(c=>!c.bad&&realMoney(c.money).length>0)); }
function classify(d){
  if(!hasAnySS(d)) return 'noss';                       // нет данных о с/с
  const ss=prodSS(d);
  if(ss<=0) return 'draft';                             // с/с только в калькуляторе (черновик)
  if(d.budget<=100||d.budget<ss*0.05) return 'noprice'; // бюджет не заполнен, с/с есть
  const m=d.budget-ss;
  if(m<=0) return 'loss';                               // убыток/ноль
  if(m/d.budget*100 < MARG_WEAK) return 'weak';         // слабый запас
  return 'good';                                        // с запасом
}
const TILES=[
  {k:'',label:'Всего',desc:'все сделки в текущем диапазоне'},
  {k:'good',label:'С запасом',desc:'маржа ≥ '+MARG_WEAK+'% бюджета'},
  {k:'weak',label:'Слабый запас',desc:'маржа 0-'+MARG_WEAK+'% бюджета'},
  {k:'loss',label:'Убыток / ноль',desc:'с/с ≥ цены при заполненной цене'},
  {k:'noprice',label:'Нет цены',desc:'бюджет ≈0, а с/с есть - проставить цену'},
  {k:'draft',label:'Черновой расчёт',desc:'с/с только в калькуляторе, Расчёт/Производство пусто'},
  {k:'noss',label:'Без с/с',desc:'нет данных о с/с ни в одном смарте'}
];
let quick='';
const _gv=id=>{const e=document.getElementById(id);return e?e.value:'';};
function passesBase(d,skipStage){
  const q=document.getElementById('q').value.trim().toLowerCase();
  const df=document.getElementById('dfrom').value, dt=document.getElementById('dto').value;
  const noprod=document.getElementById('fnoprod').checked, gap=document.getElementById('fgap').checked, part=document.getElementById('fpart').checked;
  if(q && !(String(d.id).includes(q)||(d.title||'').toLowerCase().includes(q))) return false;
  if(df && (d.created||'')<df) return false;
  if(dt && (d.created||'')>dt) return false;
  if(noprod && d.hasProducts) return false;
  if(gap && gate(d).cls!=='bad') return false;
  if(part){ const r=coverage(d).r; if(!(r>=0&&r<1)) return false; }
  // фильтры-столбцы
  const ft=_gv('fcTitle').trim().toLowerCase(); if(ft && !(d.title||'').toLowerCase().includes(ft)) return false;
  const fm=_gv('fcMgr').trim().toLowerCase(); if(fm && !(d.mgr||'').toLowerCase().includes(fm)) return false;
  if(!skipStage && stageSet.size && !stageSet.has(d.stage)) return false;
  const fty=_gv('fcType'); if(fty && (d.assort||'')!==fty) return false;
  const fst=_gv('fcStat'); if(fst && gate(d).t!==fst) return false;
  const minChk=(id,val)=>{const s=_gv(id).replace(/[^0-9.\\-]/g,'');if(s===''||isNaN(+s))return true;return val!=null&&val>=+s;};
  if(!minChk('fcMin_'+I_SVC,svcSum(d)))return false;
  if(!minChk('fcMin_'+I_BUD,d.budget))return false;
  if(!minChk('fcMin_'+I_POS,goodsPos(d)))return false;
  if(!minChk('fcMin_'+I_QTY,goodsQty(d)))return false;
  if(!minChk('fcMin_'+I_SS,prodSS(d)))return false;
  if(!minChk('fcMin_'+I_MRG,d.budget-prodSS(d)))return false;
  if(!minChk('fcMin_'+I_MPCT,marginPctVal(d)))return false;
  return true;
}
function renderKPI(base){
  const cnt={}; for(const d of base){ const c=classify(d); cnt[c]=(cnt[c]||0)+1; } cnt['']=base.length;
  document.getElementById('kpi').innerHTML=TILES.map(t=>'<div class="kt '+t.k+(quick===t.k?' act':'')+'" data-q="'+t.k+'" title="'+esc(t.desc)+'"><div class="v">'+(cnt[t.k]||0)+'</div><div class="l">'+esc(t.label)+'</div></div>').join('');
}
// денежная сводка по текущей выборке (реагирует на фильтры и диапазон дат)
function renderSummary(base){
  const n=base.length;
  let bud=0,budN=0,svc=0,svcCnt=0,ss=0,ssCnt=0,mrg=0,budM=0,mCnt=0,pos=0,qty=0;
  for(const d of base){ if(d.budget>0){bud+=d.budget;budN++;}
    pos+=goodsPos(d); qty+=goodsQty(d);
    const sv=svcSum(d); if(sv){svc+=sv;svcCnt++;}
    const s=prodSS(d); if(s){ss+=s;ssCnt++;}
    const pr=spCost(byKey(d,'Производство  GG')); const shown=(pr&&!pr.empty)||prodRankOf(d)>=5;
    if(shown&&s){ mrg+=(d.budget-s); budM+=d.budget; mCnt++; } }
  const mpct=budM>0?Math.round(mrg/budM*100):null;
  const pc=x=>n?Math.round(100*x/n)+'%':'0%';
  const tile=(l,v,sub,cls,tip)=>'<div class="sm'+(cls?' '+cls:'')+'" title="'+esc(tip||'')+'"><div class="smv">'+v+'</div><div class="sml">'+esc(l)+(sub?' <span class="smsub">'+esc(sub)+'</span>':'')+'</div></div>';
  document.getElementById('sums').innerHTML=
    tile('сделок',n,'','','всего в выборке (фильтры + даты)')
    +tile('бюджет есть',budN,pc(budN),'sm-ok','сделок с ценой - на них считается доход')
    +tile('с/с есть',ssCnt,pc(ssCnt),ssCnt/(n||1)<0.3?'sm-lo':'sm-ok','сделок с посчитанной с/с - ТОЛЬКО на них репрезентативны затраты и маржа')
    +tile('услуги есть',svcCnt,pc(svcCnt),'','сделок с доставкой/монтажом/замером')
    +tile('Σ позиций',pos,'','','наименований (товарных строк) по выборке')
    +tile('Σ штук',qty,'','','суммарное количество изделий по выборке')
    +tile('Σ бюджет',fmt(bud),'','','доход по '+budN+' сделкам с ценой')
    +tile('Σ услуги',fmt(svc),'','','по '+svcCnt+' сделкам')
    +tile('Σ с/с',fmt(ss),'','','затраты по '+ssCnt+' сделкам с с/с')
    +tile('Σ маржа',fmt(mrg),'','','по '+mCnt+' сделкам, где есть и цена, и с/с')
    +tile('маржин-ть',(mpct!==null?mpct+'%':'-'),'','','Σ маржа / Σ бюджет по '+mCnt+' сделкам');
}
function matchQuick(d){ if(!quick)return true; if(quick==='hasss')return classify(d)!=='noss'; return classify(d)===quick; }
function renderByStage(base){
  const byS={}; for(const d of base){ const s=d.stage||'(без этапа)'; (byS[s]=byS[s]||[]).push(d); }
  const order=DATA.stageOrder.filter(s=>byS[s]); for(const s of Object.keys(byS)) if(!order.includes(s)) order.push(s);
  const cur=stageSet, cq=quick;
  // ячейка = клик по этапу+классу: показать именно эти сделки
  const cell=(s,qk,v,cls)=>'<td class="bc'+(cls?' '+cls:'')+((cur.has(s)&&cq===qk)?' selc':'')+'" data-stage="'+esc(s)+'" data-q="'+qk+'">'+v+'</td>';
  let rows='<tr><th>Этап</th><th>Сделок</th><th>С с/с</th><th>Без с/с</th><th>С запасом</th><th>Слабый</th><th>Убыток/0</th><th>Нет цены</th></tr>';
  for(const s of order){ const L=byS[s]; const c={}; for(const d of L){ const k=classify(d); c[k]=(c[k]||0)+1; } const withSS=L.length-(c.noss||0);
    rows+='<tr class="br" data-stage="'+esc(s)+'">'
      +'<td class="bname bc'+((cur.has(s)&&!cq)?' selc':'')+'" data-stage="'+esc(s)+'" data-q="">'+esc(s)+'</td>'
      +cell(s,'',L.length)+cell(s,'hasss',withSS)+cell(s,'noss',c.noss||0)
      +cell(s,'good',c.good||0,'cell-g')+cell(s,'weak',c.weak||0,'cell-y')+cell(s,'loss',c.loss||0,'cell-dn')+cell(s,'noprice',c.noprice||0)+'</tr>'; }
  document.getElementById('byst').innerHTML='<table>'+rows+'</table>';
}
// строка ИТОГО под таблицей - суммы по столбцам текущей выборки
function renderTotals(list){
  let bud=0,pos=0,qty=0,svc=0,ss=0,mrg=0,budM=0;
  for(const d of list){ bud+=d.budget||0; pos+=goodsPos(d); qty+=goodsQty(d); svc+=svcSum(d);
    const s=prodSS(d); if(s)ss+=s;
    const pr=spCost(byKey(d,'Производство  GG')); const shown=(pr&&!pr.empty)||prodRankOf(d)>=5;
    if(shown&&s){ mrg+=(d.budget-s); budM+=d.budget; } }
  const mpct=budM>0?Math.round(mrg/budM*100):null;
  const tr='<tr class="totrow">'
    +'<td>ИТОГО '+list.length+'</td>'
    +'<td></td><td></td><td></td><td></td>'
    +'<td></td>'
    +'<td></td>'
    +'<td class="num">'+fmt(svc)+'</td>'
    +'<td class="num">'+fmt(bud)+'</td>'
    +'<td class="num">'+pos+'</td>'
    +'<td class="num">'+qty+' <span class="cell-o">шт</span></td>'
    +'<td class="num">'+fmt(ss)+'</td>'
    +'<td class="num">'+fmt(mrg)+'</td>'
    +'<td class="num">'+(mpct!==null?mpct+'%':'-')+'</td>'
    +'<td></td><td></td>'
    +'</tr>';
  document.querySelector('#tbl tfoot').innerHTML=tr;
}
function render(){
  const base=DATA.deals.filter(d=>passesBase(d));
  renderSummary(base); renderKPI(base);
  renderByStage(DATA.deals.filter(d=>passesBase(d,true))); // разбивка по этапам - все этапы видимы для мультивыбора
  let list=base.filter(matchQuick);
  list.sort((a,b)=>{ const x=sortVal(a,sortIdx),y=sortVal(b,sortIdx); return (x<y?-1:x>y?1:0)*sortDir; });
  let rows='';
  for(const d of list){
    const ss=prodSS(d); const pr=spCost(byKey(d,'Производство  GG')); const g=gate(d); const cv=coverage(d);
    const marginShown=(pr&&!pr.empty)||prodRankOf(d)>=5; const op=OPEN.has(d.id); const bs=budgetSrc(d);
    const goods=goodRows(d), svc=svcRows(d), gQty=goodsQty(d), sSum=svcSum(d);
    rows+='<tr class="drow" data-id="'+d.id+'">'
      +'<td><span class="exp">'+(op?'▾':'▸')+'</span> <a href="'+dealUrl(d.id)+'" target="_blank" onclick="event.stopPropagation()">'+d.id+'</a></td>'
      +'<td title="'+esc(d.title)+'">'+esc((d.title||'').slice(0,38))+'</td>'
      +'<td>'+esc(d.mgr||'')+'</td>'
      +'<td><span class="st">'+esc(d.stage||'')+'</span></td>'
      +'<td class="num">'+ruD(d.created)+'</td>'
      +'<td class="ctype" title="'+esc(d.assort||'')+'">'+(d.assort?esc(d.assort):'<span class="cell-o">-</span>')+'</td>'
      +smartCell(d)
      +'<td class="num" title="'+esc(svc.map(p=>p.name+' '+fmt((+p.price||0)*(+p.qty||0))).join('; ').slice(0,300))+'">'+(svc.length?'<span class="cell-g">'+fmt(sSum)+'</span> <span class="cell-o">('+svc.length+')</span>':'<span class="cell-o">-</span>')+'</td>'
      +'<td class="num" title="'+esc(bs?('бюджет сформирован смартом: '+(BUDNAME[bs.tag]||bs.tag)+' ('+fmt(bs.v)+')'):'бюджет проставлен вручную, ни один смарт его не формировал')+'">'+fmt(d.budget)+(bs?' <span class="bsrc">'+bs.tag+'</span>':'')+'</td>'
      +'<td class="num" title="наименований (товарных строк): '+goods.length+'">'+(goods.length?goods.length:'<span class="cell-o">-</span>')+'</td>'
      +'<td class="num" title="'+esc(goods.map(p=>p.name+' x'+p.qty).join('; ').slice(0,300))+'">'+(goods.length?gQty+' <span class="cell-o">шт</span>':'<span class="cell-o">-</span>')+'</td>'
      +ssCell(d,ss)
      +marginCell(d,ss,marginShown)
      +mpctCell(d)
      +'<td>'+(cv.cls?'<span class="flag '+cv.cls+'">'+esc(cv.t)+'</span>':'<span class="cell-o">-</span>')+'</td>'
      +'<td><span class="flag '+(g.cls||'')+'">'+esc(g.t||'')+'</span></td>'
      +'</tr>';
    if(op){ rows+=detailRow(d); }
  }
  document.querySelector('#tbl tbody').innerHTML=rows;
  renderTotals(list);
  document.getElementById('cnt').textContent='показано '+list.length+' из '+DATA.deals.length;
}
document.querySelector('#tbl tbody').addEventListener('click',e=>{ if(e.target.closest('a'))return; const tr=e.target.closest('tr.drow'); if(!tr)return; const id=+tr.dataset.id; if(OPEN.has(id))OPEN.delete(id); else OPEN.add(id); render(); });
['q','dfrom','dto','fnoprod','fgap','fpart'].forEach(id=>document.getElementById(id).addEventListener('input',render));
const _drawer=document.getElementById('drawer'), _scrim=document.getElementById('scrim');
function drawerOpen(o){ _drawer.classList.toggle('open',o); _scrim.classList.toggle('open',o); }
document.getElementById('burger').addEventListener('click',()=>drawerOpen(!_drawer.classList.contains('open')));
document.getElementById('drawerX').addEventListener('click',()=>drawerOpen(false));
_scrim.addEventListener('click',()=>drawerOpen(false));
document.addEventListener('keydown',e=>{ if(e.key==='Escape')drawerOpen(false); });
document.getElementById('kpi').addEventListener('click',e=>{ const t=e.target.closest('.kt'); if(!t)return; const k=t.dataset.q; quick=(quick===k)?'':k; render(); });
document.getElementById('byst').addEventListener('click',e=>{ const td=e.target.closest('td.bc'); if(!td)return; const s=td.dataset.stage, qk=td.dataset.q||'';
  if(qk===''){ if(stageSet.has(s))stageSet.delete(s); else stageSet.add(s); if(!stageSet.size)quick=''; }
  else { if(stageSet.has(s)&&quick===qk){ stageSet.delete(s); quick=''; } else { stageSet.add(s); quick=qk; } }
  syncStage(); render(); });
// сворачивание блоков смарт-процессов и метрик (состояние в localStorage)
function applySect(k,collapsed){ const body=document.getElementById(k+'_body'), h=document.querySelector('.sect[data-sect="'+k+'"]'); if(!body||!h)return; body.style.display=collapsed?'none':''; h.querySelector('.cv').textContent=collapsed?'▸':'▾'; }
['sp','m'].forEach(k=>{ let c=true; try{const v=localStorage.getItem('econ_sect_'+k); if(v!==null)c=(v==='1');}catch(e){} applySect(k,c); }); // по умолчанию свёрнуто
document.querySelectorAll('.sect').forEach(h=>h.addEventListener('click',()=>{ const k=h.dataset.sect, body=document.getElementById(k+'_body'); const collapse=body.style.display!=='none'; applySect(k,collapse); try{localStorage.setItem('econ_sect_'+k,collapse?'1':'0');}catch(e){} }));
sortIdx=I_COV; sortDir=-1; // старт: сделки с заполненной с/с (горящие точки, разворот) - сверху
head(); render();
</script></body></html>`;

writeFileSync("public/econ-control.html", HTML.replace(/—/g, "-"));
console.log("written", HTML.length, "bytes");
