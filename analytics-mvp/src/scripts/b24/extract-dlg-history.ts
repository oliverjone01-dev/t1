// История ежедневных снимков диалогов из git-ветки dialog-export-v1.
// Для каждого дня берётся ПОСЛЕДНИЙ снимок дня; из него - очереди с разбивкой
// по менеджерам (byMgr) и менеджеры (rating/deals/lossRub). Питает свечи,
// СРАВНИТЬ и «Пульс сервиса» в СВОДе v2.
// Запуск: HIST_REF=origin/dialog-export-v1 HIST_OUT=dialog/data/history.json npx tsx src/scripts/b24/extract-dlg-history.ts
// В CI ветка уже сфетчена (deploy-pages.yml делает git fetch origin dialog-export-v1).
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const REF = process.env.HIST_REF || "origin/dialog-export-v1";
const OUT = process.env.HIST_OUT || "dialog/data/history.json";
const FILE = "analytics-mvp/dialog/data/dialog.json";
const MAX_DAYS = 60;

const log = execSync(`git log --format='%H %ad' --date=format:'%Y-%m-%d' ${REF} -- ":/${FILE}"`, { maxBuffer: 1 << 24 })
  .toString().trim().split("\n").filter(Boolean);
const byDay: Record<string, string> = {};
for (const line of log) { const [h, d] = line.replace(/'/g, "").split(" "); if (d && !byDay[d]) byDay[d] = h; }
const days = Object.keys(byDay).sort().slice(-MAX_DAYS);

const hist: any[] = [];
for (const day of days) {
  try {
    const j = JSON.parse(execSync(`git show ${byDay[day]}:${FILE}`, { maxBuffer: 1 << 26 }).toString());
    const sc = j.scoring || {};
    const queues: Record<string, { n: number; money: number; byMgr: Record<string, number> }> = {};
    for (const dl of (sc.deals || [])) {
      if (!dl.uKey || dl.outcome !== "open") continue;
      (queues[dl.uKey] ||= { n: 0, money: 0, byMgr: {} });
      queues[dl.uKey].n++; queues[dl.uKey].money += dl.budget || 0;
      queues[dl.uKey].byMgr[dl.mgr] = (queues[dl.uKey].byMgr[dl.mgr] || 0) + 1;
    }
    const mgrs: Record<string, any> = {};
    for (const m of (sc.managers || [])) mgrs[m.mgr] = { rating: m.rating, deals: m.deals, lossRub: Math.round(m.lossRub || 0) };
    hist.push({ day, queues, mgrs, hasQ: Object.keys(queues).length > 0 ? 1 : 0 });
  } catch { /* повреждённый снимок дня пропускаем - лучше дыра в истории, чем падение сборки */ }
}
writeFileSync(OUT, JSON.stringify({ generatedFrom: REF, days: hist }));
console.log(`extract-dlg-history: дней ${hist.length} (${days[0] || "-"} .. ${days[days.length - 1] || "-"}) -> ${OUT}`);
