// Выгрузка порции диалогов для разбора человеком или Claude Code (не через API).
// Печатает те же транскрипты, что уходили в Anthropic API, плюс служебную карту
// «номер строки -> src», чтобы разметку можно было привязать к событию и проверить.
//
// MGR="Лысанова Юлия"  - чей диалог берём (несколько через «;»)
// N=10                 - сколько диалогов в порции
// SKIP=0               - сколько пропустить с начала очереди (порции идут подряд)
// DONE=dialog/data/ai-review.json - уже разобранное пропускаем
// FORCE=1             - брать и уже разобранное (переразбор на новом каталоге)
// OLD=1               - брать ТОЛЬКО разобранное чужой моделью (переразбор старого)
// KEYS=/tmp/keys.json - взять ровно эти ключи и в этом порядке (очередь приоритета)
// OUT=/tmp/part.txt    - куда писать транскрипты (по умолчанию stdout)
// MAP=/tmp/part.map.json - карта номеров строк в src, нужна применяющему скрипту
import { readFileSync, writeFileSync, existsSync } from "node:fs";

type Ev = { ts: number; dt: string; dealId: string; leadId: string; mgr: string; type: string; dir: string; who: string; body: string; dealT: string; leadT: string; src?: string };

const MGR = (process.env.MGR || "").split(";").map((x) => x.trim()).filter(Boolean);
const N = Number(process.env.N || 10);
const SKIP = Number(process.env.SKIP || 0);
const DONE = process.env.DONE || "dialog/data/ai-review.json";
const FORCE = process.env.FORCE === "1";
const OLD = process.env.OLD === "1";
const BY = process.env.REVIEW_BY || "claude-code";
const KEYS: string[] = process.env.KEYS ? JSON.parse(readFileSync(process.env.KEYS, "utf8")) : [];
const OUT = process.env.OUT || "";
const MAP = process.env.MAP || "";

const dlg = JSON.parse(readFileSync("dialog/data/dialog.json", "utf8"));
const events: Ev[] = dlg.events || [];
const done = existsSync(DONE) ? (JSON.parse(readFileSync(DONE, "utf8")).reviews || {}) : {};

const byKey: Record<string, Ev[]> = {};
for (const e of events) (byKey[e.dealId ? "D" + e.dealId : "L" + e.leadId] ||= []).push(e);

// Очередь строится ровно как в ai-review.ts: те же фильтры, тот же порядок.
const raw = Object.entries(byKey)
  .map(([k, evs]) => { evs.sort((a, b) => a.ts - b.ts); const h = evs[evs.length - 1]!; return { k, evs, last: h.ts, mgr: h.mgr || "" }; })
  .filter((x) => x.evs.filter((e) => e.type.startsWith("Сообщение") || e.type === "Письмо").length >= 2)
  .filter((x) => !MGR.length || MGR.includes(x.mgr))
  // OLD - только то, что разобрано другой моделью: переразбор старого прогона.
  // FORCE - всё подряд. По умолчанию только новое и изменившееся.
  .filter((x) => OLD ? (done[x.k] && done[x.k].model !== BY)
    : FORCE ? true : (!done[x.k] || done[x.k].lastTs !== x.last))
  .sort((a, b) => b.last - a.last);

// Очередь приоритета важнее сортировки по свежести: разбираем сначала те сделки, где
// от разбора зависит решение по деньгам, а не те, где просто недавно писали.
const ordered = KEYS.length
  ? KEYS.map((k) => raw.find((x) => x.k === k)).filter(Boolean) as typeof raw
  : raw;
const part = ordered.slice(SKIP, SKIP + N);
const map: Record<string, { mgr: string; last: number; srcs: Record<number, string>; bodies: Record<number, string>; who: Record<number, string>; dir: Record<number, string> }> = {};
const out: string[] = [];

for (const x of part) {
  const slice = x.evs.slice(-40);
  const head = x.evs[x.evs.length - 1]!;
  const srcs: Record<number, string> = {}, bodies: Record<number, string> = {};
  const who: Record<number, string> = {}, dir: Record<number, string> = {};
  const lines = slice.map((e, idx) => {
    const n = idx + 1;
    srcs[n] = e.src || "";
    const role = e.dir === "входящее" ? "КЛИЕНТ" : e.dir === "исходящее" ? "МЕНЕДЖЕР" : "CRM";
    const author = String(e.who || "").trim();
    const raw2 = String(e.body || "").replace(/\s+/g, " ");
    bodies[n] = raw2;
    // Автор и направление строки нужны применяющему скрипту: по ним проверяется правило
    // «дефект текста ставится только автору строки».
    who[n] = String(e.who || "").trim();
    dir[n] = e.dir || "";
    const att = /^(Отправлено|Принято|Получено)\s+(Файл|Изображение|Видео|Документ|Аудио)\.?$/i.test(raw2.trim());
    const body = att ? "[ВЛОЖЕНИЕ, тело не выгружено]"
      : (raw2.length > 400 ? raw2.slice(0, 400) + " …[обрезано скриптом]" : raw2);
    return `[${n}] ${e.dt.slice(5, 16).replace("T", " ")} [${e.type}] ${author ? `${author} (${role})` : role}: ${body}`;
  });
  map[x.k] = { mgr: head.mgr || "", last: x.last, srcs, bodies, who, dir };
  out.push(`\n##### ${x.k} | менеджер: ${head.mgr} | ${head.dealT || head.leadT || ""}\n${lines.join("\n").slice(0, 12000)}`);
}

const text = `Порция: ${part.length} диалогов (пропущено ${SKIP}, в очереди всего ${ordered.length})\n` + out.join("\n");
if (OUT) writeFileSync(OUT, text); else console.log(text);
if (MAP) writeFileSync(MAP, JSON.stringify(map));
console.error(`Выгружено ${part.length} из ${ordered.length} в очереди${MGR.length ? " (" + MGR.join(", ") + ")" : ""}`);
