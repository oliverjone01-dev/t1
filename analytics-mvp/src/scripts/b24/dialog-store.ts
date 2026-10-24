// Хранение снимка диалогов в двух файлах (29.09): dialog.json упёрся в лимит GitHub 100 МБ,
// ночной снимок перестал пушиться. Схема dialog.json не меняется: те же events и
// scoring.deals, просто без полей, которые нужны только странице /dialog/.
//
//   dialog.json        - всё, что читают бот РОП, еженедельный отчёт, дашборды менеджеров,
//                        песочница (СВОД, памятка, ai-facts) и Константин;
//   dialog-extra.json  - остальные поля событий и сделок, их подмешивает обратно readDialog().
//
// Какие поля оставлены, сверено по всем внешним читателям на 29.09 (rop-tg-bot.yml,
// audit-build.mjs, build-manager.ts, konstantin/context.mjs, build-svod*.ts,
// build-ai-facts.ts, pamyatka-rules.ts, extract-dlg-history.ts). Внешнему читателю нужно
// новое поле - добавить его в EV_KEEP или DEAL_KEEP, иначе он его не увидит.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

export const DLG = "dialog/data/dialog.json";
export const EXTRA = "dialog/data/dialog-extra.json";

const EV_KEEP = new Set(["ts", "dt", "dealId", "leadId", "dealT", "leadT", "mgr", "type", "dir", "who", "title", "body", "status", "src"]);
const DEAL_KEEP = new Set([
  "key", "dealId", "leadId", "isLead", "mgr", "title", "client", "assort", "budget", "source", "stage", "stageCode",
  "stageDays", "stageRows", "createdAt", "cycle", "dir", "outcome", "won", "lost", "overdueD", "respMed", "silenceD",
  "objTotal", "objWorked", "evTags", "urgency", "uKey", "next", "nextStep", "lastDt", "ballWait", "prob", "base", "ai",
]);

function extraPath(path: string): string {
  return path === DLG ? EXTRA : path.replace(/\.json$/, "") + "-extra.json";
}

function pick(o: any, keep: Set<string>): [any, any | null] {
  const main: any = {}; let rest: any = null;
  for (const k of Object.keys(o)) {
    if (keep.has(k)) main[k] = o[k];
    else (rest = rest || {})[k] = o[k];
  }
  return [main, rest];
}

// Пишет снимок двумя файлами. dlg не меняется.
export function writeDialog(dlg: any, path = DLG): void {
  const events: any[] = dlg.events || [];
  const evMain: any[] = new Array(events.length);
  const ev: any[] = new Array(events.length);
  events.forEach((e, i) => { const [m, r] = pick(e, EV_KEEP); evMain[i] = m; ev[i] = r || 0; });
  const deals: any[] = (dlg.scoring && dlg.scoring.deals) || [];
  const dealsMain: any[] = [];
  const dx: Record<string, any> = {};
  for (const d of deals) {
    const [m, r] = pick(d, DEAL_KEEP);
    dealsMain.push(m);
    if (r) dx[d.key] = r;
  }
  const main = { ...dlg, events: evMain };
  if (dlg.scoring) main.scoring = { ...dlg.scoring, deals: dealsMain };
  // src каждого события - проверка, что extra снят с этого же снимка и лёг по тем же индексам.
  const extra = { generatedAt: dlg.generatedAt || null, n: events.length, src: events.map((e) => e.src || ""), ev, deals: dx };
  writeFileSync(path, JSON.stringify(main));
  writeFileSync(extraPath(path), JSON.stringify(extra));
}

// Подмешивает поля из extra в уже прочитанный снимок. Нет файла или он от другого снимка -
// снимок остаётся как есть (страница соберётся без этих полей, но не упадёт).
export function mergeExtra(dlg: any, path = DLG): any {
  const xp = extraPath(path);
  if (!existsSync(xp)) return dlg;
  let x: any;
  try { x = JSON.parse(readFileSync(xp, "utf8")); } catch (e: any) { console.warn(`${xp} не читается: ${e && e.message}`); return dlg; }
  const events: any[] = dlg.events || [];
  const same = x.n === events.length && (x.generatedAt || null) === (dlg.generatedAt || null)
    && events.every((e, i) => (e.src || "") === x.src[i]);
  if (!same) { console.warn(`${xp} от другого снимка - поля не подмешаны`); return dlg; }
  events.forEach((e, i) => { if (x.ev[i]) Object.assign(e, x.ev[i]); });
  for (const d of (dlg.scoring && dlg.scoring.deals) || []) { const r = x.deals[d.key]; if (r) Object.assign(d, r); }
  return dlg;
}

export function readDialog(path = DLG): any {
  return mergeExtra(JSON.parse(readFileSync(path, "utf8")), path);
}
