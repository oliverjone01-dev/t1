// Ежедневный отчёт по челленджу «CRM-дисциплина».
// Читает снимок Bitrix (rop.json из ветки rop-dashboard-v1 - единый источник данных) и
// считает рейтинг менеджеров по доле сделок без дыр среди дошедших до предложения - ТОЙ ЖЕ
// логикой, что виджет-челлендж в дашбордах менеджеров (challengeWidget в
// manager-command.template.html). Ничего не пишет в репозиторий - только печатает JSON.
// Запуск: node src/scripts/b24/challenge-report.mjs [путь/к/rop.json]
import { readFileSync } from "node:fs";

const path = process.argv[2] || "rop/data/rop.json";
const rop = JSON.parse(readFileSync(path, "utf8"));
const deals = rop.deals || [];

// 3 оффер-этапа: КП отправлено / Принимают решение / Долгострой. Сделка «дошла до
// предложения», если её история касалась любого из них.
const OSET = new Set(["C49:PREPAYMENT_INVOIC", "C49:3", "C49:UC_8JTBV2"]);
// Ростер ОП = менеджеры со сделками, кроме владельца/системных (как build-manager).
const NOT_OP = new Set(["Дмитрий Янчоглов", "Алиса Алексеева"]);
const isSys = (n) => /систем|^id\s?\d/i.test(n || "");
// РОП вне челленджа: он руководит менеджерами, а не соревнуется с ними.
const REP = new Set(["Ольга Лысенко"]);

const dealsByMgr = {};
for (const d of deals) if (d.mgr) dealsByMgr[d.mgr] = (dealsByMgr[d.mgr] || 0) + 1;
const isOP = (n) => dealsByMgr[n] > 0 && !NOT_OP.has(n) && !isSys(n);

// «Дыра» в карточке: пустая категория / тип клиента / причина отказа (у отказных) / бюджет 0-1.
const eCat = (d) => { const a = d.assort; return !a || a === "нет данных" || a === "не указана"; };
const eCli = (d) => { const c = d.client; return !c || c === "нет данных" || c === "не указан"; };
const eRsn = (d) => d.lost && (!d.reason || d.reason === "не указана");
const eBud = (d) => (d.budget || 0) <= 1;
const bad = (d) => eRsn(d) || eCat(d) || eCli(d) || eBud(d);

const passed = deals.filter((d) => isOP(d.mgr) && !REP.has(d.mgr) && (d.hist || []).some((h) => OSET.has(h[0])));
const byM = {};
for (const d of passed) {
  const m = (byM[d.mgr] = byM[d.mgr] || { n: d.mgr, tot: 0, bad: 0 });
  m.tot++;
  if (bad(d)) m.bad++;
}
const all = Object.values(byM);
// Порог объёма: медаль честная только у тех, кто провёл >= FLOOR сделок до предложения.
let FLOOR = 15;
while (FLOOR > 3 && all.filter((m) => m.tot >= FLOOR).length < 3) FLOOR = Math.floor(FLOOR / 2);

const rows = all.filter((m) => m.tot >= FLOOR).map((m) => ({ ...m, clean: (m.tot - m.bad) / m.tot }));
rows.sort((a, b) => b.clean - a.clean || a.bad - b.bad || b.tot - a.tot);
rows.forEach((m, i) => (m.rank = i + 1));

const totBad = all.reduce((s, m) => s + m.bad, 0);
const out = {
  snapshot: rop.generated_at || null,
  floor: FLOOR,
  totalToFix: totBad,
  cleanManagers: rows.filter((m) => m.bad === 0).map((m) => m.n),
  ranked: rows.map((m) => ({ rank: m.rank, mgr: m.n, cleanPct: Math.round(m.clean * 100), toFix: m.bad, passed: m.tot })),
  belowFloor: all.filter((m) => m.tot < FLOOR).map((m) => ({ mgr: m.n, passed: m.tot, toFix: m.bad })),
};
console.log(JSON.stringify(out, null, 2));
