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

const payload = { generated_at: J.generated_at, bakedAt: BAKED_AT, since: J.since || null, portal: PORTAL, order: ORDER, short: SHORT, etid: etidByKey, stageOrder: STAGE_ORDER, spStages: J.spStages || {}, rank: RANK, prodRank: PROD_RANK, moveDate: MOVE_DATE, spTimeline: SP_TL, chainPrev, chainPrevAt: prevEntry ? prevEntry.gen : null, deals: J.deals };

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
.bar{display:flex;flex-wrap:nowrap;gap:8px;align-items:center;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin:10px 0 10px;overflow-x:auto}
.bar input,.bar select{background:var(--elev);border:1px solid var(--border);color:var(--ink);border-radius:8px;padding:7px 10px;font-size:12.5px}
.bar input[type=text]{min-width:200px}
.bar label{display:flex;gap:6px;align-items:center;color:var(--ink-2);font-size:12px;cursor:pointer;user-select:none}
.presets{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0}
.msel{position:relative}
.msel>summary{list-style:none;cursor:pointer;background:var(--elev);border:1px solid var(--border);color:var(--ink-2);border-radius:8px;padding:6px 11px;font-size:12px;white-space:nowrap;user-select:none}
.msel>summary::-webkit-details-marker{display:none}
.msel[open]>summary,.msel.has>summary{border-color:var(--accent);color:var(--ink)}
.msel-pop{position:absolute;top:calc(100% + 4px);left:0;z-index:40;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:8px;min-width:230px;max-height:340px;overflow:auto;box-shadow:0 10px 30px rgba(0,0,0,.45)}
.msel-pop label{display:flex;gap:7px;align-items:center;padding:4px 6px;border-radius:6px;font-size:12px;color:var(--ink-2);cursor:pointer;white-space:nowrap}
.msel-pop label:hover{background:var(--elev)}
.msel-act{display:flex;gap:8px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid var(--border)}
.msel-act button{flex:1;background:var(--elev);border:1px solid var(--border);color:var(--ink-2);border-radius:6px;padding:4px;font-size:11px;cursor:pointer}
.msel-act button:hover{border-color:var(--accent)}
.pbtn{background:var(--elev);border:1px solid var(--border);color:var(--ink-2);border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer}
.pbtn:hover{border-color:var(--accent)}.pbtn.act{background:var(--accent);color:#04222a;border-color:var(--accent);font-weight:700}
.seg{display:inline-flex;background:var(--elev);border:1px solid var(--border);border-radius:8px;overflow:hidden}
.seg button{background:transparent;border:0;border-right:1px solid var(--border);color:var(--ink-3);font:inherit;font-size:12px;padding:6px 11px;cursor:pointer;transition:.15s;white-space:nowrap}
.seg button:last-child{border-right:0}
.seg button:hover:not(.on){color:var(--ink)}
.seg button.on{background:var(--accent);color:#04222a;font-weight:700}
.dbtn{background:var(--accent);border:1px solid var(--accent);color:#04222a;border-radius:8px;padding:7px 12px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.dsep{color:var(--ink-4)}
.cnt{color:var(--ink-3);font-size:12px;margin-left:6px}
.barsp{flex:1 1 auto}
.scrollx{overflow:auto;max-height:74vh;border:1px solid var(--border);border-radius:12px}
/* скроллбары в цвет дашборда (тёмная тема), а не системные белые/серые */
html{scrollbar-width:thin;scrollbar-color:var(--ink-4) var(--bg)}
.scrollx,.pwrap,.dbody,.byst,.drawer{scrollbar-width:thin;scrollbar-color:var(--ink-4) var(--card)}
.scrollx::-webkit-scrollbar,.pwrap::-webkit-scrollbar,.dbody::-webkit-scrollbar,.byst::-webkit-scrollbar,.drawer::-webkit-scrollbar,body::-webkit-scrollbar{width:11px;height:11px}
.scrollx::-webkit-scrollbar-track,.pwrap::-webkit-scrollbar-track,.dbody::-webkit-scrollbar-track,.byst::-webkit-scrollbar-track,.drawer::-webkit-scrollbar-track,body::-webkit-scrollbar-track{background:var(--card)}
body::-webkit-scrollbar-track{background:var(--bg)}
.scrollx::-webkit-scrollbar-thumb,.pwrap::-webkit-scrollbar-thumb,.dbody::-webkit-scrollbar-thumb,.byst::-webkit-scrollbar-thumb,.drawer::-webkit-scrollbar-thumb,body::-webkit-scrollbar-thumb{background:var(--ink-4);border:2px solid var(--card);border-radius:8px}
body::-webkit-scrollbar-thumb{border-color:var(--bg)}
.scrollx::-webkit-scrollbar-thumb:hover,.pwrap::-webkit-scrollbar-thumb:hover,.dbody::-webkit-scrollbar-thumb:hover,.byst::-webkit-scrollbar-thumb:hover,.drawer::-webkit-scrollbar-thumb:hover,body::-webkit-scrollbar-thumb:hover{background:var(--accent)}
.scrollx::-webkit-scrollbar-corner,.pwrap::-webkit-scrollbar-corner,body::-webkit-scrollbar-corner{background:var(--card)}
table{border-collapse:separate;border-spacing:0;width:100%;font-size:11px;min-width:0;table-layout:fixed}
th,td{padding:5px 6px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mp{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
.mp-grn{background:rgba(60,170,110,.20);color:#82dcaa}
.mp-yel{background:rgba(217,164,65,.20);color:#e6c069}
.mp-wht{background:rgba(200,205,215,.09);color:var(--ink-1)}
.mp-red{background:rgba(214,92,110,.22);color:#ec93a4}
#izdtbl .ss-bad{background:rgba(214,92,110,.22);color:#ec93a4;font-weight:700}
#izdtbl .ss-src{font-size:9px;font-weight:700;color:var(--ink-3);letter-spacing:.02em;cursor:help}
#izdtbl .dno{color:var(--ink-2);font-variant-numeric:tabular-nums}
#izdtbl .izcat{display:inline-block;font-size:9px;font-weight:700;color:var(--info);background:rgba(167,139,250,.14);border:1px solid rgba(167,139,250,.32);border-radius:5px;padding:0 5px;vertical-align:middle}
#izdtbl .izcatc{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
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
.izst{display:inline-block;font-size:10px;font-weight:700;padding:1px 7px;border-radius:6px;margin-right:6px;vertical-align:middle;white-space:nowrap}
.atype{font-size:10px;padding:1px 6px;border-radius:6px;background:rgba(90,140,200,.14);border:1px solid rgba(90,140,200,.3);color:var(--ink-2);white-space:nowrap;margin-left:4px}
.mpct{font-size:10px;color:var(--ink-3);font-variant-numeric:tabular-nums}
.mpct.dn{color:var(--dn,#e0687a)}
.bsrc{font-size:9.5px;padding:0 4px;border-radius:4px;background:rgba(120,150,120,.16);border:1px solid rgba(120,150,120,.32);color:var(--ink-2);font-weight:700}
.note{color:var(--ink-3);font-size:11.5px;line-height:1.55;max-width:1300px;margin:2px 0 12px;padding:8px 10px;background:var(--elev);border:1px solid var(--border);border-radius:8px}
.note b{color:var(--ink-2)}.note i{color:var(--ink-2);font-style:normal}
.burger{position:fixed;top:12px;right:14px;z-index:60;cursor:pointer;font-size:12px;font-weight:700;color:var(--ink-2);background:var(--elev);border:1px solid var(--border);border-radius:8px;padding:6px 10px}
.burger:hover{color:var(--ink-1);border-color:var(--accent)}
.tabs{display:flex;gap:6px;margin:12px 0 8px}
.tabs .tb{cursor:pointer;background:var(--elev);border:1px solid var(--border);color:var(--ink-2);border-radius:8px;padding:6px 16px;font-weight:600;font-size:13px}
.tabs .tb:hover{color:var(--ink);border-color:var(--accent)}
.tabs .tb.on{background:var(--accent);color:#06231b;border-color:var(--accent)}
#izdSum{color:var(--ink-3);font-size:12px;margin:2px 0 8px}
#izdtbl thead th{position:sticky;top:0;z-index:3;background:var(--card);color:var(--ink-3);font-weight:600;text-align:left;padding:7px 6px;border-bottom:1px solid var(--border);white-space:nowrap;font-size:10px}
#izdtbl thead th.num{text-align:right}
/* шапка и строка фильтров липнут при прокрутке (по образцу таблицы «Сделки»: липнет строка-tr) */
#izdtbl #ihtr{position:sticky;top:0;z-index:7}
#izdtbl #iftr{position:sticky;top:31px;z-index:6}
#izdtbl #iftr td{background:var(--card);border-bottom:1px solid var(--border)}
/* мультивыбор стадий прямо в строке фильтров: компактный summary + всплывашка position:fixed (не режется .scrollx) */
.fmsel{position:relative}
.fmsel>summary{list-style:none;cursor:pointer;display:block;width:100%;background:var(--elev);border:1px solid var(--border);color:var(--ink-2);border-radius:6px;padding:3px 7px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fmsel>summary::-webkit-details-marker{display:none}
.fmsel.has>summary{border-color:var(--accent);color:var(--ink)}
.msel-pop.msel-fixed{position:fixed;z-index:90}
#izdtbl td{padding:5px 6px;border-bottom:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}
tr.izgrp{cursor:pointer;background:var(--card)}
tr.izgrp:hover{background:var(--elev)}
tr.izgrp>td{border-top:1px solid var(--border);font-weight:700}
tr.izgrp .exp{color:var(--ink-3)}
.izgnm{color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#izdtbl .iznum{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#izdtbl .izdt{white-space:nowrap;color:var(--ink-2);font-size:11px}
#izdtbl .izship{white-space:nowrap;color:var(--ink-2);font-size:11px}
#izdtbl .izready{white-space:nowrap;color:var(--ink-2);font-size:11px}
#izdtbl .izdt .izgc{color:var(--ink-3);font-size:10px}
.subdeals{margin:0;background:var(--bg)}
#izdtbl .subdeals thead th{position:static;top:auto;background:var(--elev);color:var(--ink-3);font-weight:600;text-align:left;padding:5px 8px;border-bottom:1px solid var(--border);font-size:10.5px;white-space:nowrap}
#izdtbl .subdeals thead th.num{text-align:right}
#izdtbl .iznum .art-code{font-size:11px}
#izdtbl .izsm{font-size:11px;color:var(--ink-2);white-space:nowrap}
.izgnm .izgc{color:var(--ink-3);font-weight:400}
tr.izdeal{cursor:pointer}
tr.izdeal:hover>td{background:rgba(255,255,255,.02)}
#izdtbl tr.izdeal>td:first-child{padding-left:24px}
#izdtbl .izdl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
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
#izdtbl tfoot td{position:sticky;bottom:0;background:#111a24;border-top:2px solid var(--accent);font-weight:700;color:var(--ink);z-index:6;padding:6px 8px}
.smcell{white-space:nowrap;overflow:visible}
.smbar{display:inline-flex;gap:3px;align-items:center;height:16px}
.smb{width:6px;height:16px;border-radius:2px;display:inline-block;background:rgba(200,205,215,.12)}
.smb-off{background:rgba(200,205,215,.10)}
.smb-on{background:rgba(200,205,215,.42)}
.smb-ss{background:#4fb387}
.smb-src{outline:2px solid #e6c069;outline-offset:1px}
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
#htr{position:sticky;top:0;z-index:7}
#htr th{background:#0f1620}
#ftr{position:sticky;top:26px;z-index:6}
#ftr td{padding:2px 3px;background:#131c26;border-bottom:1px solid var(--border);overflow:visible;vertical-align:middle}
.fcx{width:100%;min-width:0;box-sizing:border-box;font-size:10px;padding:2px 4px;background:var(--bg-1,#0b0f16);border:1px solid var(--border);border-radius:4px;color:var(--ink-1)}
select.fcsel{cursor:pointer;-webkit-appearance:none;appearance:none;padding-right:14px;background-image:linear-gradient(45deg,transparent 50%,var(--ink-3) 50%),linear-gradient(135deg,var(--ink-3) 50%,transparent 50%);background-position:calc(100% - 7px) 55%,calc(100% - 4px) 55%;background-size:3px 3px,3px 3px;background-repeat:no-repeat}
select.fcsel:disabled{opacity:.5;cursor:not-allowed}
input.fcd{color-scheme:dark}
input.fcd::-webkit-calendar-picker-indicator{filter:invert(.7);cursor:pointer}
.fcx.fcn{text-align:right}
.iz-nofill{color:#e0645a;font-size:9.5px;font-style:italic;opacity:.9}
/* Календарь диапазона дат (как в Яндекс.Метрике) */
.calbtn{cursor:pointer;white-space:nowrap;text-align:left;background:var(--elev);border:1px solid var(--border);color:var(--ink-2);border-radius:8px;padding:7px 12px;font:inherit;font-size:12px;font-weight:600}
.calbtn:hover{border-color:var(--accent);color:var(--ink)}
.cal-pop{position:fixed;z-index:120;background:var(--card,#141a24);border:1px solid var(--border);border-radius:12px;padding:32px 12px 12px;box-shadow:0 16px 44px rgba(0,0,0,.55);font-size:12px;color:var(--ink-1)}
.cal-x{position:absolute;top:8px;right:10px;width:24px;height:24px;border:1px solid var(--border);background:var(--elev,#1a212b);color:var(--ink-3);border-radius:7px;font-size:17px;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;z-index:1}
.cal-x:hover{color:var(--ink);border-color:var(--accent)}
.cal-nav{display:flex;align-items:flex-start;gap:8px}
.cal-nav>button{background:var(--elev);border:1px solid var(--border);color:var(--ink-2);border-radius:8px;width:26px;height:26px;cursor:pointer;font-size:15px;line-height:1;flex:0 0 auto;margin-top:2px}
.cal-nav>button:hover{border-color:var(--accent);color:var(--ink)}
.cal-months{display:flex;gap:18px}
.cal-mo{min-width:210px}
.cal-mh{text-align:center;font-weight:700;color:var(--ink);margin-bottom:6px}
.cal-dow{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px}
.cal-dow span{text-align:center;font-size:10px;color:var(--ink-3)}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.cal-grid .cal-e{height:26px}
.cal-d{height:26px;border:0;background:transparent;color:var(--ink-1);border-radius:6px;cursor:pointer;font-size:11.5px}
.cal-d:hover{background:var(--elev)}
.cal-d.in{background:rgba(90,150,255,.16);border-radius:0}
.cal-d.prev{background:rgba(90,150,255,.09);border-radius:0}
.cal-d.edge{background:var(--accent,#5a96ff);color:#fff;border-radius:6px;font-weight:700}
.cal-foot{display:flex;align-items:center;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)}
.cal-io{color:var(--ink-3)}
.cal-io input{width:88px;background:var(--bg-1,#0b0f16);border:1px solid var(--border);border-radius:6px;color:var(--ink-1);font-size:11px;padding:3px 6px;margin-left:3px}
.cal-sp{flex:1}
.cal-pop .cal-pset{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}
.cal-pop .cal-pset button{background:var(--elev);border:1px solid var(--border);color:var(--ink-2);border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer}
.cal-pop .cal-pset button:hover{border-color:var(--accent);color:var(--ink)}
.fcrange{display:flex;flex-direction:column;gap:2px}
.fcrange .fcd{font-size:9px;padding:1px 3px}
#izdtbl .izmgr{font-size:10.5px;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#izdtbl .izmgr .izgc{color:var(--ink-3);font-size:10px}
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
  <span style="color:var(--ink-3);font-size:11.5px;align-self:center" title="какой датой фильтрует период: дата создания сделки или дата получения предоплаты">Период по</span><div class="seg" id="econBasis"><button data-b="created" class="on">создание</button><button data-b="prepay">предоплата</button></div>
  <span id="econAmtLbl" style="color:var(--ink-3);font-size:11.5px;align-self:center" title="чем считать сумму сделки: бюджет (поле сделки) или полученная предоплата (поле «Предоплата»)">Сумма</span><div class="seg" id="econAmt"><button data-a="budget" class="on">бюджет</button><button data-a="prepay">предоплата</button></div>
  <span class="barsp"></span>
  <div class="presets" id="presets"></div>
  <button class="calbtn" id="dateBtn" title="выбрать дату или диапазон дат (календарь как в Метрике)">📅 <span id="dateBtnTxt">даты</span></button>
  <input type="hidden" id="dfrom"><input type="hidden" id="dto">
  <span class="cnt" id="cnt" style="margin-left:10px"></span>
</div>
<div class="tabs" id="tabs"><button class="tb on" data-v="deals">Сделки</button><button class="tb" data-v="izd">Изделия</button></div>

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
      <tr><td>Σ с/с (тег К/Р)</td><td>каким смартом сформирована сумма: <b>Р</b> Расчёт, <b>К</b> Калькулятор, З Закупка, Пр Производство, Сб Сборка, Л Логистика. Нет тега = сумма вбита вручную</td></tr>
      <tr><td>Тип</td><td>тип ассортимента из поля сделки Bitrix (чип в «Название»)</td></tr>
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

<div class="scrollx" id="dealsWrap"><table id="tbl"><thead></thead><tbody></tbody><tfoot></tfoot></table></div>
<div id="izdwrap" hidden><div id="izdSum"></div><div class="scrollx"><table id="izdtbl"><thead></thead><tbody></tbody><tfoot></tfoot></table></div></div>
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
const SMFULL={'Калькулятор GG':'Калькулятор','Расчёт':'Расчёт','Закупка':'Закупка','Производство  GG':'Производство','Сборка':'Сборка','Логистика':'Логистика','Монтаж':'Монтаж'};
function ssSource(d){ if(hasSP(byKey(d,'Производство  GG')))return 'Производство  GG'; if(hasSP(byKey(d,'Расчёт')))return 'Расчёт'; return null; }
function smartCell(d){ const src=ssSource(d); let html='';
  for(const k of ORDER){ const sp=byKey(d,k); const cards=sp?(sp.cards||[]).filter(c=>!c.bad):[]; const launched=cards.length>0; const hasss=cards.some(c=>realMoney(c.money).length>0); const isSrc=(k===src);
    let cls='smb'; if(!launched)cls+=' smb-off'; else if(hasss)cls+=' smb-ss'; else cls+=' smb-on'; if(isSrc)cls+=' smb-src';
    const tip=(SMFULL[k]||k)+(hasss?' - с/с внесена':(launched?' - запущен, с/с нет':' - не запущен'))+(isSrc?' · источник итоговой с/с':'');
    html+='<span class="'+cls+'" title="'+esc(tip)+'"></span>'; }
  return '<td class="smcell"><span class="smbar">'+html+'</span></td>';
}
// Σ с/с с цветовой гистограммой готовности
function ssCell(d,ss){ const r=readiness(d); const bs=budgetSrc(d);
  return '<td class="num" title="с/с за партию · '+esc(r.txt)+'">'+(ss?fmt(ss):'<span class="cell-o">-</span>')+(bs?' <span class="bsrc" title="каким смартом сформирована сумма: '+esc(BUDNAME[bs.tag]||bs.tag)+'">'+bs.tag+'</span>':'')+' <span class="rdbar '+r.cls+'"><i></i><i></i><i></i></span></td>';
}
// разворот сделки - панель: по каждому изделию с/с по смартам со ссылками
// Текущий этап изделия по смарт-процессам + прогресс по цепочке (Калькулятор→…→Монтаж).
// Берём самый дальний по цепочке смарт с живой карточкой, внутри него - позицию этапа (по SORT).
// prog: 0 = самый ранний этап, 1 = ближе к закрытию (SUCCESS/конец цепочки).
function izdStageInfo(g){ let idx=-1,card=null,key=null;
  for(let i=0;i<ORDER.length;i++){ const e=g.sp[ORDER[i]]; if(e&&e.cards&&e.cards.length){ idx=i; card=e.cards[e.cards.length-1]; key=ORDER[i]; } }
  if(idx<0||!card) return null;
  const stages=(DATA.spStages&&DATA.spStages[String(card.etid)])||[]; const live=stages.filter(s=>!s.fail);
  let frac=0.5, name=SMFULL[key]||key, fail=false; const cur=stages.find(s=>s.code===card.st);
  if(cur){ name=cur.name||name; if(cur.fail){fail=true;frac=1;} else if(cur.success){frac=1;} else { const p=live.findIndex(s=>s.code===cur.code); frac=(live.length>1&&p>=0)?p/(live.length-1):0.5; } }
  return {prog:Math.max(0,Math.min(1,(idx+frac)/ORDER.length)), name, smart:SMFULL[key]||key, fail}; }
// Оттенок по прогрессу: светлее ранние, темнее ближе к закрытию (dark-тема, зелёная шкала).
function izdShade(p){ const L=Math.round(46-p*32); return {bg:'hsl(162,42%,'+L+'%)', fg:(L>32?'#06231b':'#dff7ee')}; }
function izdBadge(g){ const si=izdStageInfo(g); if(!si) return '';
  const sh=izdShade(si.prog); return '<span class="izst" style="background:'+sh.bg+';color:'+sh.fg+(si.fail?';outline:1px solid var(--dn)':'')+'" title="Этап смарт-процесса '+esc(si.smart)+': '+esc(si.name)+(si.fail?' (провал)':'')+' · чем темнее, тем ближе к закрытию">'+esc(si.name.length>20?si.name.slice(0,20)+'…':si.name)+'</span> '; }
function detailInner(d){ const izd=izdelia(d), svc=svcRows(d); let inner='';
  if(izd.length){
    inner+='<table class="ptab"><tr><th>Артикул/НС</th><th>Изделие</th><th>Смарт</th><th>Этап</th><th title="в какие смарты запущен товар (есть карточки)">Смарты</th><th>Кол-во</th><th title="цена за штуку">Цена/шт</th>'+ORDER.map(k=>'<th>'+esc(SMFULL[k]||k)+'</th>').join('')+'<th>Σ с/с</th><th title="цена за штуку × количество">Выручка</th></tr>';
    let tQty=0,tSs=0,tRev=0;
    for(const g of izd){ const cells=ORDER.map(k=>{ const e=g.sp[k];
        if(e&&e.vB) return '<td class="num cell-g"><a href="'+spUrl(e.cards[0].etid,e.cards[0].id)+'" target="_blank" onclick="event.stopPropagation()">'+fmt(e.vB)+'</a></td>';
        if(e&&e.cards&&e.cards.length) return '<td class="num"><a class="nocs" href="'+spUrl(e.cards[0].etid,e.cards[0].id)+'" target="_blank" onclick="event.stopPropagation()">нет с/с</a></td>';
        return '<td class="num cell-o">·</td>'; }).join('');
      const ssTot=((g.sp['Производство  GG']&&g.sp['Производство  GG'].vB)||(g.sp['Расчёт']&&g.sp['Расчёт'].vB)||0)+((g.sp['Закупка']&&g.sp['Закупка'].vB)||0);
      const _si=izdStageInfo(g); const _pr=izPrice(d,g), _q=g.qty||0, _rev=_pr*_q; tQty+=_q; tSs+=ssTot; tRev+=_rev;
      inner+='<tr>'
        +'<td class="pnm"><span class="art-code">'+esc(g.art||g.ns||('#'+g.firstId))+'</span></td>'
        +'<td class="pnm" title="'+esc(g.nm||'')+'">'+esc(cleanNm(g.nm).slice(0,50))+'</td>'
        +'<td>'+(_si?esc(_si.smart):'<span class="cell-o">-</span>')+'</td>'
        +'<td>'+izdBadge(g)+'</td>'
        +'<td>'+izDots(izSmartsOf(g))+'</td>'
        +'<td class="num">'+(_q?_q+' шт':'')+'</td>'
        +'<td class="num">'+(_pr?fmt(_pr):'<span class="cell-o">-</span>')+'</td>'+cells+'<td class="num">'+(ssTot?fmt(ssTot):'<span class="cell-o">-</span>')+'</td>'
        +'<td class="num">'+(_rev?fmt(_rev):'<span class="cell-o">-</span>')+'</td></tr>'; }
    inner+='<tr style="font-weight:700;background:var(--elev)"><td>Итого</td><td></td><td></td><td></td><td></td><td class="num">'+tQty+' шт</td><td></td>'+ORDER.map(()=>'<td></td>').join('')+'<td class="num">'+(tSs?fmt(tSs):'-')+'</td><td class="num">'+(tRev?fmt(tRev):'-')+'</td></tr>';
    inner+='</table>';
  }
  if(svc.length){ inner+='<div class="pusl"><b>Услуги:</b> '+svc.map(p=>esc(p.name)+' - '+fmt((+p.price||0)*(+p.qty||0))).join(' · ')+'</div>'; }
  if(!izd.length&&!svc.length) inner='<div class="pusl">изделий с артикулом в карточках нет'+(d.sps.length?' (смарты запущены, артикул не заполнен)':'; смарты не запущены')+'</div>';
  return inner;
}
function detailRow(d){ return '<tr class="detail"><td colspan="'+COLS.length+'"><div class="pwrap">'+detailInner(d)+'</div></td></tr>'; }
function marginCell(d,ss,marginShown){
  if(!(marginShown&&ss)) return '<td class="num" title="маржа считается со стадии производства"><span class="cell-o">-</span></td>';
  const m=dBud(d)-ss;
  if(m>=0) return '<td class="num" title="сумма за партию − с/с за партию">'+fmt(m)+'</td>';
  const lowPrice=dBud(d)<=100||dBud(d)<ss*0.05;
  const tag=lowPrice?'нет цены':'убыток', fl=lowPrice?'warn':'bad';
  const tip=lowPrice?('сумма '+fmt(dBud(d))+' не заполнена, а с/с '+fmt(ss)+' есть - минус ложный, проставить цену'):('цена '+fmt(dBud(d))+' ниже с/с '+fmt(ss)+' - убыток по данным, разобрать');
  return '<td class="num" title="'+esc(tip)+'"><span class="cell-dn">'+fmt(m)+'</span> <span class="flag '+fl+'">'+tag+'</span></td>';
}
// маржинальность % = (бюджет − Σ с/с)/бюджет. null там, где маржа не считается или «нет цены»
function marginPctVal(d){ const pr=spCost(byKey(d,'Производство  GG')); const marginShown=(pr&&!pr.empty)||prodRankOf(d)>=5;
  const ss=prodSS(d); if(!(marginShown&&ss)||!(dBud(d)>0))return null;
  if(dBud(d)<=100||dBud(d)<ss*0.05)return null; // «нет цены» - процент бессмысленный
  return Math.round((dBud(d)-ss)/dBud(d)*100); }
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
const present=new Set(DATA.deals.map(d=>d.stage));
// справочники для фильтров-столбцов
const stageList=DATA.stageOrder.filter(s=>present.has(s));
const assorts=[...new Set(DATA.deals.map(d=>d.assort).filter(Boolean))].sort();
const statuses=[...new Set(DATA.deals.map(d=>gate(d).t).filter(Boolean))];
const stageSet=new Set(); // мультивыбор этапов (из строки фильтров и из таблицы разбивки)

const today=DATA.deals.reduce((mx,d)=>d.created>mx?d.created:mx, '2026-01-01');
function daysAgo(n){ const t=new Date(today+'T00:00:00Z'); t.setUTCDate(t.getUTCDate()-n); return t.toISOString().slice(0,10); }
// пресеты периода по образцу РОП: сегмент-пилюля + диапазон с–по с кнопкой ОК
const PSET=[['today','Сегодня'],['yest','Вчера'],['month','Текущий месяц'],['lastmonth','Прошлый месяц'],['7','7 дн'],['30','30 дн'],['60','60 дн'],['90','90 дн'],['all','Всё'],['mig','После переезда']];
function econSetPeriod(p){ const df=document.getElementById('dfrom'), dt=document.getElementById('dto');
  if(p==='all'){ df.value=''; dt.value=''; }
  else if(p==='today'){ df.value=today; dt.value=today; }
  else if(p==='yest'){ df.value=daysAgo(1); dt.value=daysAgo(1); }
  else if(p==='month'){ df.value=today.slice(0,7)+'-01'; dt.value=today; }
  else if(p==='lastmonth'){ const _d=new Date(today+'T00:00:00'),_y=_d.getFullYear(),_m=_d.getMonth(),_l=new Date(_y,_m,0),_p=n=>String(n).padStart(2,'0'); df.value=(_m===0?_y-1:_y)+'-'+_p(_m===0?12:_m)+'-01'; dt.value=_l.getFullYear()+'-'+_p(_l.getMonth()+1)+'-'+_p(_l.getDate()); }
  else if(p==='mig'){ df.value='2026-04-01'; dt.value=''; }
  else { df.value=daysAgo(+p-1); dt.value=today; } }
const pdiv=document.getElementById('presets');
const clearPeriod=()=>{ [...pdiv.querySelectorAll('.seg button')].forEach(x=>x.classList.remove('on')); };
pdiv.innerHTML='<span style="color:var(--ink-3);font-size:11.5px;align-self:center;margin-right:6px">Период:</span><div class="seg">'+PSET.map(p=>'<button data-p="'+p[0]+'"'+(p[0]==='mig'?' title="сделки, созданные после переезда - операционка с апреля 2026"':'')+'>'+esc(p[1])+'</button>').join('')+'</div>';
pdiv.addEventListener('click',e=>{ const b=e.target.closest('.seg button'); if(!b)return; clearPeriod(); b.classList.add('on'); econSetPeriod(b.dataset.p); updateDateBtn(); render(); });

// ===== Календарь диапазона дат (как в Яндекс.Метрике): один общий поповер на все триггеры =====
const _cpad=n=>String(n).padStart(2,'0');
const _ruShort=s=>s?s.slice(8,10)+'.'+s.slice(5,7)+'.'+s.slice(0,4):'дд.мм.гггг';
const CALP={from:'',to:'',hover:'',view:new Date(),onApply:null};
function calGrid(y,m){ const off=(new Date(y,m,1).getDay()+6)%7, dim=new Date(y,m+1,0).getDate();
  const MN=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  let h='<div class="cal-mo"><div class="cal-mh">'+MN[m]+' '+y+'</div><div class="cal-dow">'+['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>'<span>'+d+'</span>').join('')+'</div><div class="cal-grid">';
  for(let i=0;i<off;i++)h+='<span class="cal-e"></span>';
  const _hlo=CALP.hover&&CALP.hover<CALP.from?CALP.hover:CALP.from, _hhi=CALP.hover&&CALP.hover>CALP.from?CALP.hover:CALP.from;
  for(let d=1;d<=dim;d++){ const iso=y+'-'+_cpad(m+1)+'-'+_cpad(d); const inr=CALP.from&&CALP.to&&iso>=CALP.from&&iso<=CALP.to; const prev=CALP.from&&!CALP.to&&CALP.hover&&iso>=_hlo&&iso<=_hhi; const edge=(iso===CALP.from||iso===CALP.to);
    h+='<button type="button" class="cal-d'+(inr?' in':'')+(prev?' prev':'')+(edge?' edge':'')+'" data-d="'+iso+'">'+d+'</button>'; }
  return h+'</div></div>'; }
function calDraw(){ const pop=document.getElementById('calPop'); if(!pop)return; const y=CALP.view.getFullYear(), m=CALP.view.getMonth(), nm=new Date(y,m+1,1);
  pop.querySelector('.cal-months').innerHTML=calGrid(y,m)+calGrid(nm.getFullYear(),nm.getMonth());
  pop.querySelector('#calFrom').value=_ruShort(CALP.from); pop.querySelector('#calTo').value=_ruShort(CALP.to); }
function calClose(){ const pop=document.getElementById('calPop'); if(pop)pop.hidden=true; }
function calEnsure(){ if(document.getElementById('calPop'))return;
  const pop=document.createElement('div'); pop.id='calPop'; pop.className='cal-pop'; pop.hidden=true;
  pop.innerHTML='<button type="button" class="cal-x" data-cal="x" aria-label="Закрыть">×</button><div class="cal-nav"><button type="button" class="cal-pv" data-nav="-1">‹</button><div class="cal-months"></div><button type="button" class="cal-nx" data-nav="1">›</button></div>'
    +'<div class="cal-foot"><span class="cal-io">с<input id="calFrom" readonly></span><span class="cal-io">по<input id="calTo" readonly></span><span class="cal-sp"></span><button type="button" class="dbtn" data-cal="clr">Сброс</button><button type="button" class="dbtn" data-cal="ok">Применить</button></div>';
  document.body.appendChild(pop);
  pop.addEventListener('click',e=>{ e.stopPropagation();
    const nav=e.target.closest('[data-nav]'); if(nav){ CALP.view=new Date(CALP.view.getFullYear(),CALP.view.getMonth()+(+nav.dataset.nav),1); calDraw(); return; }
    const dd=e.target.closest('.cal-d'); if(dd){ const iso=dd.dataset.d;
      if(!CALP.from||CALP.to){ CALP.from=iso; CALP.to=''; CALP.hover=''; calDraw(); }
      else { if(iso<CALP.from){CALP.to=CALP.from;CALP.from=iso;} else CALP.to=iso; CALP.hover=''; if(CALP.onApply)CALP.onApply(CALP.from,CALP.to); calClose(); }
      return; }
    const act=e.target.closest('[data-cal]'); if(act){ const a=act.dataset.cal; if(a==='x'){ calClose(); return; } if(a==='clr'){ if(CALP.onApply)CALP.onApply('',''); } else { const f=CALP.from,t=CALP.to||CALP.from; if(CALP.onApply)CALP.onApply(f,t); } calClose(); } });
  pop.addEventListener('mouseover',e=>{ const dd=e.target.closest('.cal-d'); if(!dd)return; if(CALP.from&&!CALP.to){ const iso=dd.dataset.d; if(iso!==CALP.hover){ CALP.hover=iso; calDraw(); } } });
  document.addEventListener('click',()=>calClose()); }
function calOpen(anchor,from,to,onApply){ calEnsure(); CALP.from=from||''; CALP.to=to||''; CALP.hover=''; CALP.onApply=onApply;
  const base=to||from; CALP.view=base?new Date(base+'T00:00:00'):new Date(); CALP.view=new Date(CALP.view.getFullYear(),CALP.view.getMonth()-1,1);
  const pop=document.getElementById('calPop'); pop.hidden=false; calDraw();
  const r=anchor.getBoundingClientRect(), pw=pop.offsetWidth, ph=pop.offsetHeight;
  // прижимаем правым краем к кнопке (кнопки дат у правого края), затем держим в пределах экрана
  let left=Math.min(r.right-pw, innerWidth-pw-8); left=Math.max(6,left);
  let top=r.bottom+4; if(top+ph>innerHeight-8) top=Math.max(6,r.top-ph-4);
  pop.style.left=left+'px'; pop.style.top=top+'px'; }
function updateDateBtn(){ const t=document.getElementById('dateBtnTxt'); if(!t)return; const f=(document.getElementById('dfrom')||{}).value, d=(document.getElementById('dto')||{}).value;
  t.textContent=(f||d)?(_ruShort(f||d)+(d&&d!==f?' - '+_ruShort(d):'')):'даты'; }
{ const db=document.getElementById('dateBtn'); if(db)db.addEventListener('click',ev=>{ ev.stopPropagation(); const _cp=document.getElementById('calPop'); if(_cp&&!_cp.hidden){ calClose(); return; } const df=document.getElementById('dfrom'),dt=document.getElementById('dto');
  calOpen(db,df.value,dt.value,(f,t)=>{ df.value=f; dt.value=t; clearPeriod(); updateDateBtn(); render(); }); }); updateDateBtn(); }
{ const eb=document.getElementById('econBasis'); if(eb)eb.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b)return; eb.querySelectorAll('button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); econDateBasis=b.dataset.b; render(); }); }
{ const ea=document.getElementById('econAmt'); if(ea)ea.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b)return; ea.querySelectorAll('button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); econAmt=b.dataset.a; head(); render(); }); }
// мультивыбор менеджеров: применяется в passesBase -> фильтрует обе вкладки (Сделки и Изделия)
const MGRS=[...new Set(DATA.deals.map(d=>d.mgr).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
const mgrSel=new Set();
const fcMgrSel=new Set();   // мультивыбор менеджеров в колонке «Менеджер» (вкладка Сделки)
const fcSmartSel=new Set(); // мультивыбор смарт-процессов в колонке «Смарты» (вкладка Сделки)
const SP_KEYS=[...new Set(DATA.deals.flatMap(d=>(d.sps||[]).map(s=>s.key)))].sort((a,b)=>a.localeCompare(b,'ru'));
const mgrPop=document.getElementById('mgrPop');
if(mgrPop){ mgrPop.innerHTML='<div class="msel-act"><button type="button" id="mgrAll">все</button><button type="button" id="mgrNone">сброс</button></div>'
    +MGRS.map(m=>'<label><input type="checkbox" value="'+esc(m)+'"> '+esc(m)+'</label>').join('');
  const mgrSync=()=>{ mgrSel.clear(); mgrPop.querySelectorAll('input:checked').forEach(c=>mgrSel.add(c.value));
    document.getElementById('mgrSum').textContent=mgrSel.size?('Менеджеры: '+mgrSel.size):'Менеджеры';
    document.getElementById('mselMgr').classList.toggle('has',mgrSel.size>0); render(); };
  mgrPop.addEventListener('change',mgrSync);
  mgrPop.addEventListener('click',e=>{ if(e.target.id==='mgrAll'){mgrPop.querySelectorAll('input').forEach(c=>c.checked=true);mgrSync();} else if(e.target.id==='mgrNone'){mgrPop.querySelectorAll('input').forEach(c=>c.checked=false);mgrSync();} }); }

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
const COLS=['Сделка','Название','Менеджер','Этап','Создана','Тип','Смарты','Услуги ₽','Бюджет','Позиций','Штук','Σ с/с','Маржа','Маржин.%'];
const I_SVC=7, I_BUD=8, I_POS=9, I_QTY=10, I_SS=11, I_MRG=12, I_MPCT=13, I_COV=14, I_STAT=15;
// порядок: Сделка,Название,Менеджер,Этап,Создана,Тип,Смарты,Услуги,Бюджет,Позиций,Штук,Σсс,Маржа,Маржин%,Полнота,Статус
const COLW=[56,180,110,92,64,96,112,64,84,52,46,66,90,66];
function sortVal(d,i){
  if(i===0)return d.id; if(i===1)return (d.title||'').toLowerCase(); if(i===2)return (d.mgr||'').toLowerCase();
  if(i===3)return rankOf(d); if(i===4)return d.created||''; if(i===5)return (d.assort||'').toLowerCase();
  if(i===I_SM)return readiness(d).lvl;
  if(i===I_SVC)return svcSum(d);
  if(i===I_BUD)return dBud(d);
  if(i===I_POS)return goodsPos(d);
  if(i===I_QTY)return goodsQty(d);
  if(i===I_SS)return prodSS(d);
  if(i===I_MRG){ const pr=spCost(byKey(d,'Производство  GG')); return (pr&&!pr.empty)||prodRankOf(d)>=5? dBud(d)-prodSS(d) : -1e15; }
  if(i===I_MPCT){ const mv=marginPctVal(d); return mv===null?-1e15:mv; }
  if(i===I_COV)return coverage(d).r;
  if(i===I_STAT)return rankOf(d);
  return 0;
}
// ячейка строки фильтров под соответствующим столбцом
function fcell(i){
  if(i===1)return '<input class="fcx" id="fcTitle" placeholder="фильтр">';
  if(i===2)return '<details class="msel fmsel" id="mselFcMgr"><summary id="fcMgrSum" title="фильтр по менеджеру (мультивыбор)">менеджер</summary><div class="msel-pop msel-fixed" id="fcMgrPop"></div></details>';
  if(i===3)return '<button type="button" class="fcbtn" id="fcStageBtn">все ▾</button><div class="fcpop" id="fcStagePop"></div>';
  if(i===4)return '<button class="fcx calbtn" id="fcCreBtn" title="создана: выбрать дату или диапазон (календарь)">дата</button><input type="hidden" id="fcCreFrom"><input type="hidden" id="fcCreTo">';
  if(i===I_SM)return '<details class="msel fmsel" id="mselFcSmart"><summary id="fcSmartSum" title="фильтр по запущенным смарт-процессам (мультивыбор)">смарты</summary><div class="msel-pop msel-fixed" id="fcSmartPop"></div></details>';
  if(i===5)return '<select class="fcx" id="fcType"><option value="">все</option>'+assorts.map(a=>'<option>'+esc(a)+'</option>').join('')+'</select>';
  if(i===I_STAT)return '<select class="fcx" id="fcStat"><option value="">все</option>'+statuses.map(s=>'<option>'+esc(s)+'</option>').join('')+'</select>';
  if([I_SVC,I_BUD,I_POS,I_QTY,I_SS,I_MRG,I_MPCT].includes(i))return '<input class="fcx fcn" id="fcMin_'+i+'" placeholder="≥" title="минимум">';
  return '';
}
function syncStage(){ const btn=document.getElementById('fcStageBtn'); if(btn)btn.textContent=(stageSet.size?stageSet.size+' этап.':'все')+' ▾';
  const pop=document.getElementById('fcStagePop'); if(pop)pop.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.checked=stageSet.has(cb.value)); }
function wireFilters(){
  ['fcTitle','fcType','fcStat','fcMin_'+I_SVC,'fcMin_'+I_BUD,'fcMin_'+I_POS,'fcMin_'+I_QTY,'fcMin_'+I_SS,'fcMin_'+I_MRG,'fcMin_'+I_MPCT].forEach(id=>{const e=document.getElementById(id);if(e){e.addEventListener('input',render);e.addEventListener('change',render);}});
  document.getElementById('ftr').addEventListener('click',e=>e.stopPropagation());
  const pop=document.getElementById('fcStagePop'), btn=document.getElementById('fcStageBtn');
  pop.innerHTML=stageList.map(s=>'<label><input type="checkbox" value="'+esc(s)+'"> '+esc(s)+'</label>').join('')+'<div class="fcpa"><button type="button" id="fcStageClear">сброс</button></div>';
  btn.addEventListener('click',e=>{e.stopPropagation(); const open=!pop.classList.contains('open'); if(open){const r=btn.getBoundingClientRect(); pop.style.left=Math.max(4,r.left)+'px'; pop.style.top=(r.bottom+2)+'px';} pop.classList.toggle('open',open);});
  pop.addEventListener('click',e=>e.stopPropagation());
  pop.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.addEventListener('change',()=>{ if(cb.checked)stageSet.add(cb.value);else stageSet.delete(cb.value); syncStage(); render(); }));
  document.getElementById('fcStageClear').addEventListener('click',()=>{ stageSet.clear(); syncStage(); render(); pop.classList.remove('open'); });
  document.addEventListener('click',()=>pop.classList.remove('open'));
  // календарь «Создана» (вкладка Сделки), с тумблером закрытия
  { const cb=document.getElementById('fcCreBtn'); if(cb){ const fi=document.getElementById('fcCreFrom'),ti=document.getElementById('fcCreTo');
    const cu=()=>{ cb.textContent=(fi.value||ti.value)?(_ruShort(fi.value||ti.value)+(ti.value&&ti.value!==fi.value?' … '+_ruShort(ti.value):'')):'дата'; };
    cu(); cb.addEventListener('click',ev=>{ ev.stopPropagation(); const _cp=document.getElementById('calPop'); if(_cp&&!_cp.hidden){ calClose(); return; } calOpen(cb,fi.value,ti.value,(f,t)=>{ fi.value=f; ti.value=t; cu(); render(); }); }); } }
  // мультивыбор менеджеров (колонка «Менеджер», вкладка Сделки)
  { const mp=document.getElementById('fcMgrPop'); if(mp){ mp.innerHTML='<div class="msel-act"><button type="button" data-a="all">все</button><button type="button" data-a="none">сброс</button></div>'+MGRS.map(m=>'<label><input type="checkbox" value="'+esc(m)+'"'+(fcMgrSel.has(m)?' checked':'')+'> '+esc(m)+'</label>').join('');
    const sm=()=>{ fcMgrSel.clear(); mp.querySelectorAll('input:checked').forEach(c=>fcMgrSel.add(c.value)); document.getElementById('fcMgrSum').textContent=fcMgrSel.size?('менеджер: '+fcMgrSel.size):'менеджер'; document.getElementById('mselFcMgr').classList.toggle('has',fcMgrSel.size>0); render(); };
    mp.addEventListener('change',sm); mp.addEventListener('click',e=>{ e.stopPropagation(); const a=e.target&&e.target.dataset?e.target.dataset.a:''; if(a==='all'){mp.querySelectorAll('input').forEach(c=>c.checked=true);sm();} else if(a==='none'){mp.querySelectorAll('input').forEach(c=>c.checked=false);sm();} });
    const mm=document.getElementById('mselFcMgr'); mm.addEventListener('toggle',()=>{ if(mm.open){ const r=document.getElementById('fcMgrSum').getBoundingClientRect(); mp.style.left=Math.max(6,Math.min(r.left,innerWidth-250))+'px'; mp.style.top=(r.bottom+2)+'px'; } }); } }
  // мультивыбор смарт-процессов (колонка «Смарты», вкладка Сделки)
  { const sp2=document.getElementById('fcSmartPop'); if(sp2){ sp2.innerHTML='<div class="msel-act"><button type="button" data-a="all">все</button><button type="button" data-a="none">сброс</button></div>'+SP_KEYS.map(k=>'<label><input type="checkbox" value="'+esc(k)+'"'+(fcSmartSel.has(k)?' checked':'')+'> '+esc(k)+'</label>').join('');
    const ss=()=>{ fcSmartSel.clear(); sp2.querySelectorAll('input:checked').forEach(c=>fcSmartSel.add(c.value)); document.getElementById('fcSmartSum').textContent=fcSmartSel.size?('смарты: '+fcSmartSel.size):'смарты'; document.getElementById('mselFcSmart').classList.toggle('has',fcSmartSel.size>0); render(); };
    sp2.addEventListener('change',ss); sp2.addEventListener('click',e=>{ e.stopPropagation(); const a=e.target&&e.target.dataset?e.target.dataset.a:''; if(a==='all'){sp2.querySelectorAll('input').forEach(c=>c.checked=true);ss();} else if(a==='none'){sp2.querySelectorAll('input').forEach(c=>c.checked=false);ss();} });
    const mm2=document.getElementById('mselFcSmart'); mm2.addEventListener('toggle',()=>{ if(mm2.open){ const r=document.getElementById('fcSmartSum').getBoundingClientRect(); sp2.style.left=Math.max(6,Math.min(r.left,innerWidth-250))+'px'; sp2.style.top=(r.bottom+2)+'px'; } }); } }
}
function head(){ const tbl=document.getElementById('tbl'); const oc=tbl.querySelector('colgroup'); if(oc)oc.remove();
  tbl.insertAdjacentHTML('afterbegin','<colgroup>'+COLW.map(w=>'<col style="width:'+w+'px">').join('')+'</colgroup>');
  const thead=document.querySelector('#tbl thead');
  if(!document.getElementById('ftr')){
    thead.innerHTML='<tr id="htr"></tr><tr id="ftr" class="frow">'+COLS.map((h,i)=>'<td>'+fcell(i)+'</td>').join('')+'</tr>';
    wireFilters(); syncStage();
  }
  document.getElementById('htr').innerHTML=COLS.map((h,i)=>'<th class="'+([I_SVC,I_BUD,I_POS,I_QTY,I_SS,I_MRG,I_MPCT].includes(i)?'num':'')+'" data-i="'+i+'">'+esc(i===I_BUD&&econAmt==='prepay'?'Предоплата':h)+(i===sortIdx?' <span class="ar">'+(sortDir>0?'▲':'▼')+'</span>':'')+'</th>').join('');
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
// артикул годится как ключ группировки только если это полный код, а не обрывок-заглушка
// (напр. «С26-», «НС26-», «-» - префикс номера без самого номера; такие склеивают разные товары).
function goodArt(a){ a=String(a||'').trim(); return a.length>=2 && !/-\s*$/.test(a); }
// ключ изделия по приоритету: артикул -> НС-код (единый б24-номер) -> название -> айди карточки
function izdKey(c){ if(c.art&&goodArt(c.art)) return 'art:'+c.art; const ns=nsCode(c.nm); if(ns) return 'ns:'+ns; const sg=nameSig(c.nm); if(sg) return 'sig:'+sg; return 'id:'+c.id; }
// изделия сделки: группируем карточки СП по артикулу, с/с по каждому смарту
function izdelia(d){
  const g={};
  for(const s of d.sps){ for(const c of (s.cards||[])){ if(c.bad)continue; const ss=cardSS(c); const key=izdKey(c);
    const it=g[key]=g[key]||{art:(c.art&&goodArt(c.art))?c.art:'',ns:nsCode(c.nm),firstId:c.id,qty:0,sp:{},nm:''};
    if((+c.qty||0)>it.qty)it.qty=+c.qty||0;
    if(c.nm&&c.nm.length>(it.nm||'').length)it.nm=c.nm; // самое полное название изделия из заголовка карточки
    const e=it.sp[s.key]=it.sp[s.key]||{vU:0,vB:0,cards:[]}; e.vU+=ss; e.vB+=cardBatch(c); e.cards.push({id:c.id,etid:s.etid,st:c.st}); } }
  // Склейка «голого» артикула-префикса: если карточка подписана префиксом (напр. «НС26»),
  // а в сделке есть полный артикул с этим префиксом («НС26-435/-436»), это дефект заполнения,
  // а не отдельная позиция. Сливаем такую группу в позицию с ТЕМ ЖЕ названием, но только
  // если она ровно одна - иначе не угадываем (не искажаем с/с).
  { const ents=Object.entries(g); const arts=ents.map(([,v])=>v.art).filter(Boolean);
    const bare=a=>!!a&&arts.some(o=>o!==a&&o.startsWith(a+'-'));
    // полная сигнатура: убираем номер заказа и артикул-коды, но СОХРАНЯЕМ габариты (2440/2170),
    // чтобы различать одноимённые позиции разного размера
    const fsig=nm=>String(nm||'').replace(/\\b\\d{5,7}\\b/g,'').replace(/[A-Za-zА-Яа-я]{1,4}\\d+(?:-\\d+)?/g,'').toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu,'');
    for(const [k,it] of ents){ if(!bare(it.art))continue; const sig=fsig(it.nm); if(!sig)continue;
      const tw=ents.filter(([kk,v])=>kk!==k&&v.art&&!bare(v.art)&&fsig(v.nm)===sig);
      if(tw.length===1){ const t=tw[0][1];
        for(const sk in it.sp){ const e=it.sp[sk]; const te=t.sp[sk]=t.sp[sk]||{vU:0,vB:0,cards:[]}; te.vU+=e.vU; te.vB+=e.vB; te.cards.push(...e.cards); }
        delete g[k]; } } }
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
  if(dBud(d)<=100||dBud(d)<ss*0.05) return 'noprice'; // сумма не заполнена, с/с есть
  const m=dBud(d)-ss;
  if(m<=0) return 'loss';                               // убыток/ноль
  if(m/dBud(d)*100 < MARG_WEAK) return 'weak';         // слабый запас
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
let econDateBasis='created'; // «Период по»: created | prepay - какое поле даты фильтрует верхний период
let econAmt='budget'; // «Сумма»: budget | prepay - чем считать сумму сделки в экране «Сделки»
// Сумма сделки для экрана «Сделки»: бюджет (поле сделки) или полученная предоплата (поле «Предоплата»).
const dBud=d=>econAmt==='prepay'?(d.prepayAmt||0):(d.budget||0);
function passesBase(d,skipStage){
  const q=document.getElementById('q').value.trim().toLowerCase();
  const df=document.getElementById('dfrom').value, dt=document.getElementById('dto').value;
  if(q && !(String(d.id).includes(q)||(d.title||'').toLowerCase().includes(q))) return false;
  // «Период по»: фильтр верхней панели по дате создания (по умолчанию) или по дате предоплаты.
  // В режиме предоплаты сделки без предоплаты (пустая дата) выпадают из выбранного периода.
  const _dfld=(econDateBasis==='prepay')?(d.prepayAt||''):(d.created||'');
  if(df && _dfld<df) return false;
  if(dt && _dfld>dt) return false;
  // фильтры-столбцы
  const ft=_gv('fcTitle').trim().toLowerCase(); if(ft && !(d.title||'').toLowerCase().includes(ft)) return false;
  if(fcMgrSel.size && !fcMgrSel.has(d.mgr||'')) return false;
  if(mgrSel.size && !mgrSel.has(d.mgr||'')) return false;
  if(!skipStage && stageSet.size && !stageSet.has(d.stage)) return false;
  const fty=_gv('fcType'); if(fty && (d.assort||'')!==fty) return false;
  const fst=_gv('fcStat'); if(fst && gate(d).t!==fst) return false;
  const _cf=_gv('fcCreFrom'),_ct=_gv('fcCreTo'); if(_cf||_ct){ const cd=d.created||''; if(_cf&&cd<_cf)return false; if(_ct&&(!cd||cd>_ct))return false; }
  if(fcSmartSel.size && !((d.sps||[]).some(s=>fcSmartSel.has(s.key)))) return false;
  const minChk=(id,val)=>{const s=_gv(id).replace(/[^0-9.\\-]/g,'');if(s===''||isNaN(+s))return true;return val!=null&&val>=+s;};
  if(!minChk('fcMin_'+I_SVC,svcSum(d)))return false;
  if(!minChk('fcMin_'+I_BUD,dBud(d)))return false;
  if(!minChk('fcMin_'+I_POS,goodsPos(d)))return false;
  if(!minChk('fcMin_'+I_QTY,goodsQty(d)))return false;
  if(!minChk('fcMin_'+I_SS,prodSS(d)))return false;
  if(!minChk('fcMin_'+I_MRG,dBud(d)-prodSS(d)))return false;
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
  for(const d of base){ if(dBud(d)>0){bud+=dBud(d);budN++;}
    pos+=goodsPos(d); qty+=goodsQty(d);
    const sv=svcSum(d); if(sv){svc+=sv;svcCnt++;}
    const s=prodSS(d); if(s){ss+=s;ssCnt++;}
    const pr=spCost(byKey(d,'Производство  GG')); const shown=(pr&&!pr.empty)||prodRankOf(d)>=5;
    if(shown&&s){ mrg+=(dBud(d)-s); budM+=dBud(d); mCnt++; } }
  const _sumL=econAmt==='prepay'?'предоплата':'бюджет';
  const mpct=budM>0?Math.round(mrg/budM*100):null;
  const pc=x=>n?Math.round(100*x/n)+'%':'0%';
  const tile=(l,v,sub,cls,tip)=>'<div class="sm'+(cls?' '+cls:'')+'" title="'+esc(tip||'')+'"><div class="smv">'+v+'</div><div class="sml">'+esc(l)+(sub?' <span class="smsub">'+esc(sub)+'</span>':'')+'</div></div>';
  document.getElementById('sums').innerHTML=
    tile('сделок',n,'','','всего в выборке (фильтры + даты)')
    +tile(_sumL+' есть',budN,pc(budN),'sm-ok','сделок с суммой - на них считается доход')
    +tile('с/с есть',ssCnt,pc(ssCnt),ssCnt/(n||1)<0.3?'sm-lo':'sm-ok','сделок с посчитанной с/с - ТОЛЬКО на них репрезентативны затраты и маржа')
    +tile('услуги есть',svcCnt,pc(svcCnt),'','сделок с доставкой/монтажом/замером')
    +tile('Σ позиций',pos,'','','наименований (товарных строк) по выборке')
    +tile('Σ штук',qty,'','','суммарное количество изделий по выборке')
    +tile('Σ '+_sumL,fmt(bud),'','','доход по '+budN+' сделкам с суммой')
    +tile('Σ услуги',fmt(svc),'','','по '+svcCnt+' сделкам')
    +tile('Σ с/с',fmt(ss),'','','затраты по '+ssCnt+' сделкам с с/с')
    +tile('Σ маржа',fmt(mrg),'','','по '+mCnt+' сделкам, где есть и цена, и с/с')
    +tile('маржин-ть',(mpct!==null?mpct+'%':'-'),'','','Σ маржа / Σ '+_sumL+' по '+mCnt+' сделкам');
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
  for(const d of list){ bud+=dBud(d)||0; pos+=goodsPos(d); qty+=goodsQty(d); svc+=svcSum(d);
    const s=prodSS(d); if(s)ss+=s;
    const pr=spCost(byKey(d,'Производство  GG')); const shown=(pr&&!pr.empty)||prodRankOf(d)>=5;
    if(shown&&s){ mrg+=(dBud(d)-s); budM+=dBud(d); } }
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
    +'</tr>';
  document.querySelector('#tbl tfoot').innerHTML=tr;
}
// ===== ВКЛАДКА «ИЗДЕЛИЯ»: изделие -> сделки с ним -> содержание сделки (3 уровня) =====
let VIEW='deals';
const OPENIZD=new Set();      // раскрытые изделия (ключ изделия)
const OPENIZDDEAL=new Set();  // раскрытые сделки внутри изделия (ключ изделия + id сделки)
const izKeyG=g=> (g.art&&goodArt(g.art))?('art:'+g.art) : (g.ns?('ns:'+g.ns) : (nameSig(g.nm)?('sig:'+nameSig(g.nm)):('id:'+g.firstId)));
// с/с по приоритету: Калькулятор GG (итоговая) -> иначе Расчёт+Закупка (сумма) -> иначе Производство GG.
const _vbOf=(g,k)=>g.sp[k]&&g.sp[k].vB>0?g.sp[k].vB:0;
const izSS=g=>{ const K=_vbOf(g,'Калькулятор GG'); if(K)return K;
  const R=_vbOf(g,'Расчёт'),Z=_vbOf(g,'Закупка'); if(R||Z)return R+Z;
  return _vbOf(g,'Производство  GG'); };
// из каких смартов взята с/с (тот же приоритет): К=Калькулятор, Р=Расчёт, З=Закупка, П=Производство.
const SSABBR={'Калькулятор GG':'К','Производство  GG':'П','Расчёт':'Р','Закупка':'З'};
const SSFULL={'К':'Калькулятор GG','Р':'Расчёт','З':'Закупка','П':'Производство GG'};
function izSsSrcOf(g){ if(_vbOf(g,'Калькулятор GG'))return ['К'];
  const R=_vbOf(g,'Расчёт'),Z=_vbOf(g,'Закупка'); if(R||Z){const s=[];if(R)s.push('Р');if(Z)s.push('З');return s;}
  if(_vbOf(g,'Производство  GG'))return ['П'];
  return []; }
// цена товара: цена клиента из товарной строки сделки, сопоставленной изделию по сигнатуре названия
const izPrice=(d,g)=>{const sig=nameSig(g.nm);if(!sig)return 0;for(const p of goodRows(d)){if(nameSig(p.name)===sig){const pr=+p.price||0;if(pr>1)return pr;}}return 0;};
// на каких смарт-процессах у изделия есть карточки (сейчас в работе)
const izSmartsOf=g=>ORDER.filter(k=>g.sp[k]&&g.sp[k].cards&&g.sp[k].cards.length);
const izDots=arr=>'<span class="dots">'+ORDER.map(k=>'<span class="sd'+(arr.includes(k)?' on':'')+'" title="'+esc(SMFULL[k]||k)+(arr.includes(k)?' - есть карточки':' - нет')+'"></span>').join('')+'</span>';
// полоса-индикатор смартов как в «Сделках»: off - нет карточек, on - есть, ss - внесена с/с
const izBar=e=>'<span class="smbar">'+ORDER.map(k=>{let c='smb-off';if(e.smartsSS&&e.smartsSS.has(k))c='smb-ss';else if(e.smarts.has(k))c='smb-on';return '<span class="smb '+c+'" title="'+esc(SMFULL[k]||k)+(e.smartsSS&&e.smartsSS.has(k)?' - с/с внесена':(e.smarts.has(k)?' - есть карточки':' - нет'))+'"></span>';}).join('')+'</span>';
// бейдж самого «дальнего» по цепочке производственного этапа среди экземпляров изделия
// самый «дальний» экземпляр -> {смарт-процесс, бейдж стадии этого смарта}
function izStageParts(e){let best=null,bp=-1;for(const it of e.deals){const si=izdStageInfo(it.g);if(si&&si.prog>bp){bp=si.prog;best=it.g;}}
  if(!best)return {smart:'<span class="cell-o">-</span>',badge:'<span class="cell-o">-</span>'};
  const si=izdStageInfo(best); return {smart:'<span class="izsm">'+esc(si.smart)+'</span>',badge:izdBadge(best)};}
// маржинальность цветом как в «Сделках» (mp-red/mp-yel/mp-grn по MPCT_LO/MPCT_HI)
function izMpct(mpct){ if(mpct==null)return '<td class="num"><span class="cell-o">-</span></td>'; const mv=Math.round(mpct*100); const cls=mv<MPCT_LO?'mp-red':mv>MPCT_HI?'mp-grn':'mp-yel'; return '<td class="num mp '+cls+'" title="маржинальность '+mv+'% · красный <'+MPCT_LO+'%, жёлтый '+MPCT_LO+'-'+MPCT_HI+'%, зелёный >'+MPCT_HI+'%">'+mv+'%</td>'; }
// Σ с/с: подсветка красным недостоверной себестоимости (нет с/с или неправдоподобно мало).
// Порог: партия изделия не может стоить меньше SS_MIN ₽ (артефакт незаполненного калькулятора).
const SS_MIN=1000;
function izSsSrcTag(srcSet){ if(!srcSet||!srcSet.size)return '';
  const ord=['К','Р','З','П'].filter(a=>srcSet.has(a)); if(!ord.length)return '';
  const full=ord.map(a=>SSFULL[a]).join(' + ');
  return ' <span class="ss-src" title="с/с взята из смарт-процесса: '+esc(full)+'">'+esc(ord.join('+'))+'</span>';
}
function izSsCell(ss,srcSet){
  if(!ss)return '<td class="num ss-bad" title="нет данных по себестоимости - калькулятор GG не заполнен">нет с/с</td>';
  const tag=izSsSrcTag(srcSet);
  if(ss<SS_MIN)return '<td class="num ss-bad" title="с/с '+fmt(ss)+' ₽ - недостоверно мало для партии, проверьте калькулятор GG">'+fmt(ss)+tag+'</td>';
  return '<td class="num">'+fmt(ss)+tag+'</td>';
}
// категория изделия: официальные категории берём из assort сделок, но выбираем ту, что
// соответствует товару по названию (перегородка -> «...перегородки», зеркало -> «Зеркала»),
// иначе самую частую среди сделок изделия. Так перегородка не покажется «Зеркалами».
const CAT_KW=[[/перегород/,/перегород/],[/зеркал/,/зеркал/],[/стол|столеш|подстол/,/стол/],[/каркас|комплект|фурнит/,/каркас|комплект|фурнит/],[/доск|маркерн/,/доск|маркерн/],[/огражд|балкон|лестниц/,/огражд|балкон|лестниц/]];
function izPickCat(nm,cnt){ const keys=Object.keys(cnt); if(!keys.length)return ''; const low=(nm||'').toLowerCase();
  for(const [nre,cre] of CAT_KW){ if(nre.test(low)){ const m=keys.find(k=>cre.test(k.toLowerCase())); if(m)return m; } }
  return keys.sort((a,b)=>cnt[b]-cnt[a])[0]; }
function buildIzd(list){
  const M=new Map();
  for(const d of list){ for(const g of izdelia(d)){ const key=izKeyG(g)+'::'+d.id; // отдельная строка на каждое изделие В КАЖДОЙ сделке (без склейки одинаковых товаров между сделками)
    let e=M.get(key); if(!e){ e={key,art:g.art,ns:g.ns,nm:g.nm||'',qty:0,ss:0,rev:0,deals:[],smarts:new Set(),smartsSS:new Set(),dmin:null,dmax:null,ssSrc:new Set()}; M.set(key,e); }
    izSsSrcOf(g).forEach(a=>e.ssSrc.add(a));
    if(d.created){ if(!e.dmin||d.created<e.dmin)e.dmin=d.created; if(!e.dmax||d.created>e.dmax)e.dmax=d.created; }
    if((g.nm||'').length>(e.nm||'').length)e.nm=g.nm; if(!e.art&&g.art)e.art=g.art; if(!e.ns&&g.ns)e.ns=g.ns;
    const ss=izSS(g),price=izPrice(d,g),qty=g.qty||0,rev=price*qty;
    e.qty+=qty; e.ss+=ss; e.rev+=rev; izSmartsOf(g).forEach(k=>{e.smarts.add(k); if(g.sp[k]&&g.sp[k].vB>0)e.smartsSS.add(k);});
    e.deals.push({d,qty,ss,price,rev,g}); } }
  const arr=[...M.values()];
  for(const e of arr){ e.price=e.qty?Math.round(e.rev/e.qty):0; e.margin=e.rev-e.ss; e.mpct=e.rev>0?e.margin/e.rev:null; e.sp=-1; let best=null,bestD=null; const stSet=new Set(); const catCnt={}; const shipArr=[]; const readyArr=[]; const mgrCnt={};
    for(const it of e.deals){ if(it.d.stage)stSet.add(it.d.stage); if(it.d.assort)catCnt[it.d.assort]=(catCnt[it.d.assort]||0)+1; if(it.d.shippedAt)shipArr.push(it.d.shippedAt); if(it.d.readyAt)readyArr.push(it.d.readyAt); if(it.d.mgr)mgrCnt[it.d.mgr]=(mgrCnt[it.d.mgr]||0)+1; const si=izdStageInfo(it.g);if(si&&si.prog>e.sp){e.sp=si.prog;best=si;bestD=it.d;}}
    e.smartName=best?best.smart:''; e.stageName=best?best.name:'';
    e.dealStage=bestD&&bestD.stage?bestD.stage:(e.deals[0]&&e.deals[0].d.stage||''); e.dealStages=[...stSet];
    e.cats=Object.keys(catCnt); e.cat=izPickCat(e.nm,catCnt);
    e.mgrs=Object.keys(mgrCnt).sort((a,b)=>mgrCnt[b]-mgrCnt[a]); e.mgr=e.mgrs[0]||'';
    shipArr.sort(); e.shippedAt=shipArr.length?shipArr[shipArr.length-1]:''; e.shippedN=shipArr.length;
    readyArr.sort(); e.readyAt=readyArr.length?readyArr[readyArr.length-1]:''; e.readyN=readyArr.length; }
  return arr;
}
// Товар-центричная таблица: свои колонки, сортировка и фильтры (как в «Сделках»).
const ICOLS=['Номер заказа','Изделие','Категория','Менеджер','Создана','Дата готовности','Дата реализации','Сделок / №','Кол-во','Цена, ₽','Смарты','Смарт','Этап','Стадия сделки','Σ с/с','Выручка, ₽','Маржа, ₽','Маржин.%'];
const ICOLW=[92,116,88,104,72,92,92,70,52,60,80,84,100,100,62,94,70,74];
const INUM=[7,8,9,14,15,16,17];
let izSortIdx=15, izSortDir=-1;
const izStageSel=new Set(); // мультивыбор стадий сделки в фильтре колонки «Стадия сделки»
const izMgrSel=new Set();   // мультивыбор менеджеров в фильтре колонки «Менеджер»
const izCatSel=new Set();   // мультивыбор категорий в фильтре колонки «Категория»
const izSmartSel=new Set(); // мультивыбор смарт-процессов в колонке «Смарт»
const izEtapSel=new Set();  // мультивыбор этапов в колонке «Этап»
const _igv=id=>{const el=document.getElementById(id);return el?el.value:'';};
const izNo=e=>e.art||e.ns||'';
function izVal(e,i){switch(i){case 0:return izNo(e).toLowerCase();case 1:return (e.nm||'').toLowerCase();case 2:return (e.cat||'').toLowerCase();case 3:return (e.mgr||'').toLowerCase();case 4:return e.dmax||'';case 5:return e.readyAt||'';case 6:return e.shippedAt||'';case 7:return e.deals.length;case 8:return e.qty;case 9:return e.price;case 10:return e.smarts.size;case 11:return e.sp;case 12:return e.sp;case 13:return (e.dealStage||'').toLowerCase();case 14:return e.ss;case 15:return e.rev;case 16:return e.margin;case 17:return e.mpct==null?-1:e.mpct;}return 0;}
function izPass(e){ const fn=_igv('ifNum').trim().toLowerCase(); if(fn&&!izNo(e).toLowerCase().startsWith(fn))return false;
  const ft=_igv('ifName').trim().toLowerCase(); if(ft&&!((e.nm||'').toLowerCase().includes(ft)))return false;
  if(izCatSel.size && !((e.cats||[]).flatMap(c=>String(c).split(',').map(s=>s.trim())).some(c=>izCatSel.has(c))))return false;
  if(izMgrSel.size && !((e.mgrs||[]).some(m=>izMgrSel.has(m))))return false;
  // «Создана»: диапазон дат (от/до) по окну создания сделок изделия (dmin..dmax)
  const fdf=_igv('ifDateFrom').trim(); if(fdf&&!((e.dmax||'')>=fdf))return false;
  const fdt=_igv('ifDateTo').trim(); if(fdt&&!(e.dmin&&e.dmin<=fdt))return false;
  if(izSmartSel.size && !izSmartSel.has(e.smartName||''))return false;
  if(izEtapSel.size && !izEtapSel.has(e.stageName||''))return false;
  if(izStageSel.size && !((e.dealStages||[]).some(s=>izStageSel.has(s))))return false;
  // «Дата готовности»: диапазон дат (от/до) по дате перехода в «Заказ произведен»
  const frf=_igv('ifReadyFrom').trim(); if(frf&&!((e.readyAt||'')>=frf))return false;
  const frt=_igv('ifReadyTo').trim(); if(frt&&!(e.readyAt&&e.readyAt<=frt))return false;
  // «Дата реализации»: диапазон дат (от/до) по дате отгрузки
  const fshf=_igv('ifShipFrom').trim(); if(fshf&&!((e.shippedAt||'')>=fshf))return false;
  const fsht=_igv('ifShipTo').trim(); if(fsht&&!(e.shippedAt&&e.shippedAt<=fsht))return false;
  const mn=(id,v)=>{const s=_igv(id).replace(/[^0-9.\-]/g,'');if(s===''||isNaN(+s))return true;return v!=null&&v>=+s;};
  return mn('ifMin_7',e.deals.length)&&mn('ifMin_8',e.qty)&&mn('ifMin_9',e.price)&&mn('ifMin_14',e.ss)&&mn('ifMin_15',e.rev)&&mn('ifMin_16',e.margin)&&mn('ifMin_17',e.mpct==null?null:e.mpct*100); }
function izFcell(i){ if(i===0)return '<input class="fcx" id="ifNum" placeholder="НС/НМ/С">'; if(i===1)return '<input class="fcx" id="ifName" placeholder="фильтр">'; if(i===2)return '<details class="msel fmsel" id="mselIzCat"><summary id="izCatSum" title="фильтр по категории товара (мультивыбор)">категория</summary><div class="msel-pop msel-fixed" id="izCatPop"></div></details>'; if(i===3)return '<details class="msel fmsel" id="mselIzMgr"><summary id="izMgrSum" title="фильтр по ответственному менеджеру (мультивыбор)">менеджер</summary><div class="msel-pop msel-fixed" id="izMgrPop"></div></details>'; if(i===4)return '<button class="fcx calbtn" id="ifDateBtn" title="создана: выбрать дату или диапазон (календарь)">дата</button><input type="hidden" id="ifDateFrom"><input type="hidden" id="ifDateTo">'; if(i===5)return '<button class="fcx calbtn" id="ifReadyBtn" title="дата готовности: выбрать дату или диапазон (календарь)">дата</button><input type="hidden" id="ifReadyFrom"><input type="hidden" id="ifReadyTo">'; if(i===6)return '<button class="fcx calbtn" id="ifShipBtn" title="дата реализации: выбрать дату или диапазон (календарь)">дата</button><input type="hidden" id="ifShipFrom"><input type="hidden" id="ifShipTo">'; if(i===11)return '<details class="msel fmsel" id="mselIzSmart"><summary id="izSmartSum" title="фильтр по смарт-процессу (мультивыбор)">смарт</summary><div class="msel-pop msel-fixed" id="izSmartPop"></div></details>'; if(i===12)return '<details class="msel fmsel" id="mselIzEtap"><summary id="izEtapSum" title="фильтр по этапу (мультивыбор)">этап</summary><div class="msel-pop msel-fixed" id="izEtapPop"></div></details>'; if(i===13)return '<details class="msel fmsel" id="mselStage"><summary id="stageSum" title="фильтр по стадии сделки (мультивыбор)">стадия</summary><div class="msel-pop msel-fixed" id="stagePop"></div></details>'; if(INUM.includes(i))return '<input class="fcx fcn" id="ifMin_'+i+'" placeholder="≥" title="минимум">'; return ''; }
function izHeadRow(){ document.getElementById('ihtr').innerHTML=ICOLS.map((h,i)=>'<th class="'+(INUM.includes(i)?'num':'')+'" data-i="'+i+'">'+esc(h)+(i===izSortIdx?' <span class="ar">'+(izSortDir>0?'▲':'▼')+'</span>':'')+'</th>').join('');
  document.querySelectorAll('#ihtr th').forEach(th=>th.addEventListener('click',()=>{const i=+th.dataset.i;if(i===izSortIdx)izSortDir=-izSortDir;else{izSortIdx=i;izSortDir=((i===0||i===1||i===2||i===3)?1:-1);}izHeadRow();render();})); }
// карта Смарт -> его этапы (по фактическим данным, теми же izdStageInfo, что дают значения колонок)
let _ssMap=null;
function izSmartStageMap(){ if(_ssMap)return _ssMap; const m=new Map();
  for(const d of DATA.deals){ for(const g of izdelia(d)){ const si=izdStageInfo(g); if(si&&si.smart){ if(!m.has(si.smart))m.set(si.smart,new Set()); if(si.name)m.get(si.smart).add(si.name); } } }
  _ssMap=m; return m; }
function izHead(){ const tbl=document.getElementById('izdtbl'); if(tbl.querySelector('colgroup'))return;
  tbl.insertAdjacentHTML('afterbegin','<colgroup>'+ICOLW.map(w=>'<col style="width:'+w+'px">').join('')+'</colgroup>');
  tbl.querySelector('thead').innerHTML='<tr id="ihtr"></tr><tr id="iftr" class="frow">'+ICOLS.map((h,i)=>'<td>'+izFcell(i)+'</td>').join('')+'</tr>';
  izHeadRow();
  ['ifNum','ifName','ifMin_7','ifMin_8','ifMin_9','ifMin_14','ifMin_15','ifMin_16','ifMin_17'].forEach(id=>{const el=document.getElementById(id);if(el){el.addEventListener('input',render);el.addEventListener('change',render);}});
  // кнопки-календари в колонках «Создана», «Дата готовности» и «Дата реализации» (дата или диапазон)
  const _colCal=(btnId,fromId,toId,label)=>{ const btn=document.getElementById(btnId); if(!btn)return;
    const upd=()=>{ const f=document.getElementById(fromId).value, t=document.getElementById(toId).value; btn.textContent=(f||t)?(_ruShort(f||t)+(t&&t!==f?' … '+_ruShort(t):'')):label; };
    upd(); btn.addEventListener('click',ev=>{ ev.stopPropagation(); const _cp=document.getElementById('calPop'); if(_cp&&!_cp.hidden){ calClose(); return; } const fi=document.getElementById(fromId),ti=document.getElementById(toId);
      calOpen(btn,fi.value,ti.value,(f,t)=>{ fi.value=f; ti.value=t; upd(); render(); }); }); };
  _colCal('ifDateBtn','ifDateFrom','ifDateTo','дата'); _colCal('ifReadyBtn','ifReadyFrom','ifReadyTo','дата'); _colCal('ifShipBtn','ifShipFrom','ifShipTo','дата');
  document.getElementById('iftr').addEventListener('click',e=>e.stopPropagation());
  // мультивыбор смарт-процессов (колонка «Смарт») и этапов (колонка «Этап») - единообразно со «Стадией»
  const ssm=izSmartStageMap();
  const _izMsel=(popId,sumId,mselId,items,selSet,lbl)=>{ const pp=document.getElementById(popId); if(!pp)return;
    pp.innerHTML='<div class="msel-act"><button type="button" data-a="all">все</button><button type="button" data-a="none">сброс</button></div>'
      +items.map(s=>'<label><input type="checkbox" value="'+esc(s)+'"'+(selSet.has(s)?' checked':'')+'> '+esc(s)+'</label>').join('');
    const sync=()=>{ selSet.clear(); pp.querySelectorAll('input:checked').forEach(c=>selSet.add(c.value));
      document.getElementById(sumId).textContent=selSet.size?(lbl+': '+selSet.size):lbl;
      document.getElementById(mselId).classList.toggle('has',selSet.size>0); render(); };
    pp.addEventListener('change',sync);
    pp.addEventListener('click',e=>{ e.stopPropagation(); const a=e.target&&e.target.dataset?e.target.dataset.a:''; if(a==='all'){pp.querySelectorAll('input').forEach(c=>c.checked=true);sync();} else if(a==='none'){pp.querySelectorAll('input').forEach(c=>c.checked=false);sync();} });
    const mm=document.getElementById(mselId); mm.addEventListener('toggle',()=>{ if(mm.open){ const r=document.getElementById(sumId).getBoundingClientRect(); pp.style.left=Math.max(6,Math.min(r.left,innerWidth-250))+'px'; pp.style.top=(r.bottom+2)+'px'; } }); };
  const smarts=(ORDER||[]).map(k=>SMFULL[k]||k).filter(nm=>ssm.has(nm)); for(const nm of ssm.keys()) if(!smarts.includes(nm))smarts.push(nm);
  const etaps=[...new Set([...ssm.values()].flatMap(set=>[...set]))].sort((a,b)=>a.localeCompare(b,'ru'));
  _izMsel('izSmartPop','izSmartSum','mselIzSmart',smarts,izSmartSel,'смарт');
  _izMsel('izEtapPop','izEtapSum','mselIzEtap',etaps,izEtapSel,'этап');
  // мультивыбор стадий сделки: список стадий с чекбоксами, всплывашка фиксированная (не режется контейнером)
  const sp=document.getElementById('stagePop');
  if(sp){ const opts=(DATA.stageOrder||[]).filter(s=>DATA.deals.some(d=>d.stage===s)); const extra=[...new Set(DATA.deals.map(d=>d.stage).filter(Boolean))].filter(s=>!opts.includes(s)); const IZ_STAGES=[...opts,...extra];
    sp.innerHTML='<div class="msel-act"><button type="button" data-a="all">все</button><button type="button" data-a="none">сброс</button></div>'
      +IZ_STAGES.map(s=>'<label><input type="checkbox" value="'+esc(s)+'"'+(izStageSel.has(s)?' checked':'')+'> '+esc(s)+'</label>').join('');
    const sync=()=>{ izStageSel.clear(); sp.querySelectorAll('input:checked').forEach(c=>izStageSel.add(c.value));
      document.getElementById('stageSum').textContent=izStageSel.size?('стадия: '+izStageSel.size):'стадия';
      document.getElementById('mselStage').classList.toggle('has',izStageSel.size>0); render(); };
    sp.addEventListener('change',sync);
    sp.addEventListener('click',e=>{ e.stopPropagation(); const a=e.target&&e.target.dataset?e.target.dataset.a:''; if(a==='all'){sp.querySelectorAll('input').forEach(c=>c.checked=true);sync();} else if(a==='none'){sp.querySelectorAll('input').forEach(c=>c.checked=false);sync();} });
    const ms=document.getElementById('mselStage');
    ms.addEventListener('toggle',()=>{ if(ms.open){ const r=document.getElementById('stageSum').getBoundingClientRect(); sp.style.left=Math.max(6,Math.min(r.left,innerWidth-250))+'px'; sp.style.top=(r.bottom+2)+'px'; } });
  }
  // мультивыбор менеджеров в колонке «Менеджер» (тот же список, что и в верхней панели)
  const mp2=document.getElementById('izMgrPop');
  if(mp2){ mp2.innerHTML='<div class="msel-act"><button type="button" data-a="all">все</button><button type="button" data-a="none">сброс</button></div>'
      +MGRS.map(m=>'<label><input type="checkbox" value="'+esc(m)+'"'+(izMgrSel.has(m)?' checked':'')+'> '+esc(m)+'</label>').join('');
    const sync2=()=>{ izMgrSel.clear(); mp2.querySelectorAll('input:checked').forEach(c=>izMgrSel.add(c.value));
      document.getElementById('izMgrSum').textContent=izMgrSel.size?('менеджер: '+izMgrSel.size):'менеджер';
      document.getElementById('mselIzMgr').classList.toggle('has',izMgrSel.size>0); render(); };
    mp2.addEventListener('change',sync2);
    mp2.addEventListener('click',e=>{ e.stopPropagation(); const a=e.target&&e.target.dataset?e.target.dataset.a:''; if(a==='all'){mp2.querySelectorAll('input').forEach(c=>c.checked=true);sync2();} else if(a==='none'){mp2.querySelectorAll('input').forEach(c=>c.checked=false);sync2();} });
    const mm=document.getElementById('mselIzMgr');
    mm.addEventListener('toggle',()=>{ if(mm.open){ const r=document.getElementById('izMgrSum').getBoundingClientRect(); mp2.style.left=Math.max(6,Math.min(r.left,innerWidth-250))+'px'; mp2.style.top=(r.bottom+2)+'px'; } });
  }
  // мультивыбор категорий в колонке «Категория»
  const cp2=document.getElementById('izCatPop');
  if(cp2){ const CATS=[...new Set(DATA.deals.flatMap(d=>String(d.assort||'').split(',').map(s=>s.trim()).filter(Boolean)))].sort((a,b)=>a.localeCompare(b,'ru'));
    cp2.innerHTML='<div class="msel-act"><button type="button" data-a="all">все</button><button type="button" data-a="none">сброс</button></div>'
      +CATS.map(c=>'<label><input type="checkbox" value="'+esc(c)+'"'+(izCatSel.has(c)?' checked':'')+'> '+esc(c)+'</label>').join('');
    const sync3=()=>{ izCatSel.clear(); cp2.querySelectorAll('input:checked').forEach(c=>izCatSel.add(c.value));
      document.getElementById('izCatSum').textContent=izCatSel.size?('категория: '+izCatSel.size):'категория';
      document.getElementById('mselIzCat').classList.toggle('has',izCatSel.size>0); render(); };
    cp2.addEventListener('change',sync3);
    cp2.addEventListener('click',e=>{ e.stopPropagation(); const a=e.target&&e.target.dataset?e.target.dataset.a:''; if(a==='all'){cp2.querySelectorAll('input').forEach(c=>c.checked=true);sync3();} else if(a==='none'){cp2.querySelectorAll('input').forEach(c=>c.checked=false);sync3();} });
    const mc=document.getElementById('mselIzCat');
    mc.addEventListener('toggle',()=>{ if(mc.open){ const r=document.getElementById('izCatSum').getBoundingClientRect(); cp2.style.left=Math.max(6,Math.min(r.left,innerWidth-250))+'px'; cp2.style.top=(r.bottom+2)+'px'; } });
  } }
function izDealRow(e,it){ const d=it.d,dk=e.key+'::'+d.id,dop=OPENIZDDEAL.has(dk),marg=it.rev-it.ss,mp=it.rev>0?marg/it.rev:null;
  return '<tr class="izdeal" data-dk="'+esc(dk)+'">'
    +'<td class="cell-o">·</td>'
    +'<td class="izdl" title="'+esc(d.title||'')+'"><span class="exp">'+(dop?'▾':'▸')+'</span> '+esc((d.title||'').slice(0,40))+' <span class="cell-o">'+esc((d.mgr||'').split(' ')[0])+'</span></td>'
    +'<td class="num"><a href="'+dealUrl(d.id)+'" target="_blank" onclick="event.stopPropagation()">'+d.id+'</a></td>'
    +'<td class="num">'+(it.qty||'-')+'</td>'
    +'<td class="num">'+(it.price?fmt(it.price):'<span class="cell-o">-</span>')+'</td>'
    +'<td>'+izDots(izSmartsOf(it.g))+'</td>'
    +'<td>'+izdBadge(it.g)+'</td>'
    +'<td class="num">'+(it.ss?fmt(it.ss):'<span class="cell-o">-</span>')+'</td>'
    +'<td class="num">'+(it.rev?fmt(it.rev):'<span class="cell-o">-</span>')+'</td>'
    +'<td class="num">'+(it.rev?fmt(marg):'<span class="cell-o">-</span>')+'</td>'
    +'<td class="num">'+(mp==null?'<span class="cell-o">-</span>':Math.round(mp*100)+'%')+'</td>'
    +'</tr>'; }
function renderIzd(base){
  izHead();
  { const _h=document.getElementById('ihtr'),_f=document.getElementById('iftr'); if(_h&&_f&&_h.offsetHeight){ _f.style.top=_h.offsetHeight+'px'; } }
  const items=buildIzd(base).filter(izPass);
  items.sort((a,b)=>{const x=izVal(a,izSortIdx),y=izVal(b,izSortIdx);return (x<y?-1:x>y?1:0)*izSortDir;});
  let html='';
  for(const e of items){ const open=OPENIZD.has(e.key); const _izsp=izStageParts(e);
    html+='<tr class="izgrp" data-k="'+esc(e.key)+'">'
      +'<td class="iznum"'+(izNo(e)?' title="'+esc(izNo(e))+'"':' title="артикул/НС не заполнен в Bitrix"')+'><span class="exp">'+(open?'▾':'▸')+'</span> '+(izNo(e)?'<span class="art-code">'+esc(izNo(e))+'</span>':'<span class="iz-nofill">не заполнено</span>')+'</td>'
      +'<td class="izgnm" title="'+esc(e.nm||'')+'">'+esc(cleanNm(e.nm).slice(0,58)||'(без названия)')+'</td>'
      +'<td class="izcatc" title="'+esc(e.cat?('категория: '+e.cat+(e.cats&&e.cats.length>1?' · у сделок изделия есть и другие категории: '+e.cats.filter(c=>c!==e.cat).join(', '):'')):'категория не указана')+'">'+(e.cat?'<span class="izcat">'+esc(e.cat)+'</span>'+(e.cats&&e.cats.length>1?' <span class="izgc" title="ещё '+(e.cats.length-1)+' категор. у сделок этого изделия">+'+(e.cats.length-1)+'</span>':''):'<span class="cell-o">-</span>')+'</td>'
      +'<td class="izmgr" title="'+esc(e.mgr?('ответственный: '+e.mgr+(e.mgrs&&e.mgrs.length>1?' · ещё менеджеры по сделкам изделия: '+e.mgrs.slice(1).join(', '):'')):'менеджер не указан')+'">'+(e.mgr?esc(e.mgr)+(e.mgrs&&e.mgrs.length>1?' <span class="izgc">+'+(e.mgrs.length-1)+'</span>':''):'<span class="cell-o">-</span>')+'</td>'
      +'<td class="izdt" title="'+(e.dmin&&e.dmin!==e.dmax?'сделки '+ruD(e.dmin)+' - '+ruD(e.dmax):'дата создания сделки')+'">'+(e.dmax?ruD(e.dmax):'<span class="cell-o">—</span>')+(e.dmin&&e.dmin!==e.dmax?' <span class="izgc">+'+(e.deals.length-1)+'</span>':'')+'</td>'
      +'<td class="izready" title="'+(e.readyAt?'дата перехода в «Заказ произведен»'+(e.readyN>1?' (последняя из '+e.readyN+' сделок)':''):'сделка ещё не переходила в «Заказ произведен»')+'">'+(e.readyAt?ruD(e.readyAt)+(e.readyN>1?' <span class="izgc">+'+(e.readyN-1)+'</span>':''):'<span class="cell-o">не наступила</span>')+'</td>'
      +'<td class="izship" title="'+(e.shippedAt?'дата перехода в «Заказ отправлен»'+(e.shippedN>1?' (последняя из '+e.shippedN+' сделок)':''):'сделка ещё не переходила в «Заказ отправлен»')+'">'+(e.shippedAt?ruD(e.shippedAt)+(e.shippedN>1?' <span class="izgc">+'+(e.shippedN-1)+'</span>':''):'<span class="cell-o">не наступила</span>')+'</td>'
      +'<td class="num">'+(e.deals.length===1?'<span class="dno" title="номер сделки '+e.deals[0].d.id+' (без ссылки)">'+e.deals[0].d.id+'</span>':'<span title="сделок: '+e.deals.length+' - номера видны при разворачивании">'+e.deals.length+' сд.</span>')+'</td>'
      +'<td class="num"><b>'+(e.qty||'-')+'</b></td>'
      +'<td class="num">'+(e.price?fmt(e.price):'<span class="cell-o">-</span>')+'</td>'
      +'<td>'+izBar(e)+'</td>'
      +'<td>'+_izsp.smart+'</td>'
      +'<td>'+_izsp.badge+'</td>'
      +'<td title="'+esc(e.dealStages&&e.dealStages.length>1?'стадии сделок: '+e.dealStages.join(', '):'стадия сделки')+'">'+(e.dealStage?'<span class="st">'+esc(e.dealStage)+'</span>'+(e.dealStages&&e.dealStages.length>1?' <span class="izgc">+'+(e.dealStages.length-1)+'</span>':''):'<span class="cell-o">-</span>')+'</td>'
      +izSsCell(e.ss,e.ssSrc)
      +'<td class="num"><b>'+(e.rev?fmt(e.rev):'<span class="cell-o">-</span>')+'</b></td>'
      +'<td class="num">'+(e.rev?fmt(e.margin):'<span class="cell-o">-</span>')+'</td>'
      +izMpct(e.mpct)
      +'</tr>';
    if(open){
      const numH=[I_SVC,I_BUD,I_POS,I_QTY,I_SS,I_MRG,I_MPCT];
      let sub='<table class="subdeals"><colgroup>'+COLW.map(w=>'<col style="width:'+w+'px">').join('')+'</colgroup><thead><tr>'+COLS.map((h,i)=>'<th class="'+(numH.includes(i)?'num':'')+'">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>';
      for(const it of e.deals.slice().sort((a,b)=>b.rev-a.rev||b.ss-a.ss)){ const d=it.d,dk=e.key+'::'+d.id,dop=OPENIZDDEAL.has(dk);
        sub+='<tr class="drow izsub" data-dk="'+esc(dk)+'">'+dealCells(d,dop)+'</tr>';
        if(dop)sub+=detailRow(d); }
      sub+='</tbody></table>';
      html+='<tr class="detail izsubwrap"><td colspan="'+ICOLS.length+'"><div class="pwrap">'+sub+'</div></td></tr>';
    }
  }
  document.querySelector('#izdtbl tbody').innerHTML=html||'<tr><td colspan="'+ICOLS.length+'" class="pusl">нет изделий в выборке</td></tr>';
  { let tq=0,tdl=0,tss=0,trv=0,tmg=0; for(const e of items){ tq+=e.qty||0; tdl+=e.deals.length; tss+=e.ss||0; trv+=e.rev||0; tmg+=e.margin||0; } const tmp=trv>0?Math.round(tmg/trv*100):null;
    const ft='<tr class="totrow"><td>ИТОГО '+items.length+'</td><td></td><td></td><td></td><td></td><td></td><td></td>'
      +'<td class="num">'+tdl+'</td>'
      +'<td class="num">'+tq+' <span class="cell-o">шт</span></td>'
      +'<td></td><td></td><td></td><td></td><td></td>'
      +'<td class="num">'+fmt(tss)+'</td>'
      +'<td class="num">'+fmt(trv)+'</td>'
      +'<td class="num">'+fmt(tmg)+'</td>'
      +'<td class="num">'+(tmp!==null?tmp+'%':'-')+'</td></tr>';
    document.querySelector('#izdtbl tfoot').innerHTML=ft; }
  document.getElementById('izdSum').textContent='';
  document.getElementById('cnt').textContent='изделий: '+items.length;
}
// ячейки строки сделки (те же колонки, что в таблице «Сделки») - переиспользуются во вкладке «Изделия»
function dealCells(d,op){
  const ss=prodSS(d); const pr=spCost(byKey(d,'Производство  GG')); const bs=budgetSrc(d);
  const marginShown=(pr&&!pr.empty)||prodRankOf(d)>=5;
  const goods=goodRows(d), svc=svcRows(d), gQty=goodsQty(d), sSum=svcSum(d);
  return '<td><span class="exp">'+(op?'▾':'▸')+'</span> <a href="'+dealUrl(d.id)+'" target="_blank" onclick="event.stopPropagation()">'+d.id+'</a></td>'
    +'<td title="'+esc(d.title)+'">'+esc((d.title||'').slice(0,38))+'</td>'
    +'<td>'+esc(d.mgr||'')+'</td>'
    +'<td><span class="st">'+esc(d.stage||'')+'</span></td>'
    +'<td class="num">'+ruD(d.created)+'</td>'
    +'<td class="ctype" title="'+esc(d.assort||'')+'">'+(d.assort?esc(d.assort):'<span class="cell-o">-</span>')+'</td>'
    +smartCell(d)
    +'<td class="num" title="'+esc(svc.map(p=>p.name+' '+fmt((+p.price||0)*(+p.qty||0))).join('; ').slice(0,300))+'">'+(svc.length?'<span class="cell-g">'+fmt(sSum)+'</span> <span class="cell-o">('+svc.length+')</span>':'<span class="cell-o">-</span>')+'</td>'
    +'<td class="num" title="'+esc(econAmt==='prepay'?('полученная предоплата (поле «Предоплата»)'+(d.budget?'; бюджет сделки '+fmt(d.budget):'')):(bs?('бюджет сформирован смартом: '+(BUDNAME[bs.tag]||bs.tag)+' ('+fmt(bs.v)+')'):'бюджет проставлен вручную, ни один смарт его не формировал'))+'">'+fmt(dBud(d))+'</td>'
    +'<td class="num" title="наименований (товарных строк): '+goods.length+'">'+(goods.length?goods.length:'<span class="cell-o">-</span>')+'</td>'
    +'<td class="num" title="'+esc(goods.map(p=>p.name+' x'+p.qty).join('; ').slice(0,300))+'">'+(goods.length?gQty+' <span class="cell-o">шт</span>':'<span class="cell-o">-</span>')+'</td>'
    +ssCell(d,ss)
    +marginCell(d,ss,marginShown)
    +mpctCell(d);
}
function render(){
  { const ea=document.getElementById('econAmt'), el=document.getElementById('econAmtLbl'), off=(VIEW==='izd');
    if(ea){ ea.style.opacity=off?'.4':''; ea.style.pointerEvents=off?'none':''; ea.title=off?'«Сумма» влияет только на вкладку «Сделки»':''; }
    if(el){ el.style.opacity=off?'.4':''; el.title=off?'«Сумма» влияет только на вкладку «Сделки»':'чем считать сумму сделки: бюджет (поле сделки) или полученная предоплата (поле «Предоплата»)'; } }
  const base=DATA.deals.filter(d=>passesBase(d));
  if(VIEW==='izd'){ renderIzd(base); return; }
  let list=base.filter(matchQuick);
  list.sort((a,b)=>{ const x=sortVal(a,sortIdx),y=sortVal(b,sortIdx); return (x<y?-1:x>y?1:0)*sortDir; });
  let rows='';
  for(const d of list){
    const op=OPEN.has(d.id);
    rows+='<tr class="drow" data-id="'+d.id+'">'+dealCells(d,op)+'</tr>';
    if(op){ rows+=detailRow(d); }
  }
  document.querySelector('#tbl tbody').innerHTML=rows;
  renderTotals(list);
  document.getElementById('cnt').textContent='показано '+list.length+' из '+DATA.deals.length;
}
document.querySelector('#tbl tbody').addEventListener('click',e=>{ if(e.target.closest('a'))return; const tr=e.target.closest('tr.drow'); if(!tr)return; const id=+tr.dataset.id; if(OPEN.has(id))OPEN.delete(id); else OPEN.add(id); render(); });
['q','dfrom','dto'].forEach(id=>document.getElementById(id).addEventListener('input',render));
// переключение вкладок Сделки / Изделия
document.getElementById('tabs').addEventListener('click',e=>{ const b=e.target.closest('.tb'); if(!b)return; VIEW=b.dataset.v;
  document.querySelectorAll('#tabs .tb').forEach(x=>x.classList.toggle('on',x===b));
  document.getElementById('dealsWrap').hidden=(VIEW!=='deals');
  document.getElementById('izdwrap').hidden=(VIEW!=='izd'); render(); });
// разворот 3 уровней во вкладке «Изделия»: изделие -> сделки (полные колонки) -> содержание сделки
document.querySelector('#izdtbl tbody').addEventListener('click',e=>{ if(e.target.closest('a'))return;
  const dl=e.target.closest('tr.izsub'); if(dl){ const dk=dl.dataset.dk; if(OPENIZDDEAL.has(dk))OPENIZDDEAL.delete(dk); else OPENIZDDEAL.add(dk); render(); return; }
  const gr=e.target.closest('tr.izgrp'); if(gr){ const k=gr.dataset.k; if(OPENIZD.has(k))OPENIZD.delete(k); else OPENIZD.add(k); render(); return; } });
const _drawer=document.getElementById('drawer'), _scrim=document.getElementById('scrim');
function drawerOpen(o){ _drawer.classList.toggle('open',o); _scrim.classList.toggle('open',o); }
document.getElementById('burger').addEventListener('click',()=>drawerOpen(!_drawer.classList.contains('open')));
document.getElementById('drawerX').addEventListener('click',()=>drawerOpen(false));
_scrim.addEventListener('click',()=>drawerOpen(false));
document.addEventListener('keydown',e=>{ if(e.key==='Escape')drawerOpen(false); });
sortIdx=4; sortDir=-1; // старт: новые сделки сверху (по дате создания)
head(); render();
</script></body></html>`;

writeFileSync("public/econ-control.html", HTML.replace(/—/g, "-"));
console.log("written", HTML.length, "bytes");
