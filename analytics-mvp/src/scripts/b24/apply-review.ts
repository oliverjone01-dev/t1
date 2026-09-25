// Вливание разбора, сделанного без API (Claude Code или человеком), в боевой ai-review.json.
// Валидация на входе, а не после публикации: каждый тег проверяется по карте порции.
// Отбрасывается и попадает в отчёт всё, что нарушает контракт:
//   - номер строки, которой нет в хронологии;
//   - цитата, которой нет в теле этой строки (дословность обязательна);
//   - код каталога вне T01-T09 / G01-G08;
//   - дефект текста (T01-T09) на строке, автор которой не оцениваемый менеджер;
//   - тег на заглушке вложения, кроме разрешённого T01 для письма.
//
// IN=/tmp/part.review.json  - моя разметка: { "D12345": {verdict, problem, ..., msgTags:[{i,k,tone,t,quote}]} }
// MAP=/tmp/part.map.json    - карта порции из dump-dialogs.ts
// OUT=dialog/data/ai-review.json - куда вливать (боевой файл по умолчанию)
// DRY=1                     - только проверить и напечатать отчёт, ничего не писать
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const IN = process.env.IN || "";
const MAP = process.env.MAP || "";
const OUT = process.env.OUT || "dialog/data/ai-review.json";
const DRY = process.env.DRY === "1";
const MODEL = process.env.REVIEW_BY || "claude-code";
if (!IN || !MAP) { console.error("нужны IN и MAP"); process.exit(2); }

const inp = JSON.parse(readFileSync(IN, "utf8"));
const map = JSON.parse(readFileSync(MAP, "utf8"));
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { reviews: {}, managers: {} };
const reviews = prev.reviews || {};

const norm = (s: any) => String(s || "").replace(/\s+/g, " ").trim();
const ATT = /^(Отправлено|Принято|Получено)\s+(Файл|Изображение|Видео|Документ|Аудио)\.?$/i;
const T = /^T0[1-9]$/, G = /^G0[1-8]$/;
// «Свой» ли автор строки. Имя в выгрузке пишется и как «Лакомова Татьяна», и как
// «Татьяна Лакомова», поэтому сравниваем множества слов, а не строки целиком.
const words = (s: any) => new Set(String(s || "").toLowerCase().split(/[^а-яёa-z]+/).filter((x) => x.length > 2));
const same = (a: any, b: any) => { const A = words(a), B = words(b); if (!A.size || !B.size) return false;
  let hit = 0; for (const w of A) if (B.has(w)) hit++; return hit >= Math.min(A.size, B.size); };

const rej: string[] = [];
let deals = 0, kept = 0, dropped = 0;

for (const [k, r] of Object.entries<any>(inp)) {
  const m = map[k];
  if (!m) { rej.push(`${k}: нет в карте порции, весь разбор отброшен`); continue; }
  // Шкала оценок 0-5 (как в каталоге ai-review.ts). Разбор с оценками вне шкалы или с тоном
  // вне good/warn/bad не принимается целиком: дашборд рисует полосы по шкале 0-5, и одна
  // пачка в 0-10 уже однажды сделала все полосы зелёными.
  const sc = r.scores || {};
  const badSc = ["polite", "qual", "deadline", "process", "result"].filter((x) => !Number.isInteger(sc[x]) || sc[x] < 0 || sc[x] > 5);
  if (badSc.length) { rej.push(`${k}: оценки вне шкалы 0-5 (${badSc.join(", ")}), весь разбор отброшен`); continue; }
  if (!["good", "warn", "bad"].includes(r.tone)) { rej.push(`${k}: тон «${r.tone}» вне good/warn/bad, весь разбор отброшен`); continue; }
  const tags: any[] = [];
  for (const t of (r.msgTags || [])) {
    const i = Number(t.i);
    const src = m.srcs[String(i)] ?? m.srcs[i];
    const body = norm(m.bodies[String(i)] ?? m.bodies[i]);
    const code = String(t.k || "");
    const q = norm(t.quote);
    const drop = (why: string) => { rej.push(`${k} строка ${i} [${code}] ${t.t}: ${why}`); dropped++; };
    if (!src) { drop("строки с таким номером нет в хронологии"); continue; }
    if (!code || (!T.test(code) && !G.test(code))) { drop("код каталога отсутствует или неизвестен"); continue; }
    if (!q) { drop("нет цитаты"); continue; }
    const att = ATT.test(body);
    if (!q || (!att && body.toLowerCase().indexOf(q.toLowerCase()) < 0)) { drop(`цитаты нет в теле строки: «${q.slice(0, 40)}»`); continue; }
    // Правило ответственности: ведение сделки всегда на оцениваемом менеджере, а дефект
    // ТЕКСТА ставится только автору этого текста. Строка клиента, бота или прежнего
    // сотрудника не может принести менеджеру опечатку или обращение.
    const wh = m.who?.[String(i)] ?? m.who?.[i] ?? "";
    const dr = m.dir?.[String(i)] ?? m.dir?.[i] ?? "";
    if (T.test(code) && !(dr === "исходящее" && same(wh, m.mgr))) {
      drop(`дефект текста на чужой строке (автор «${wh || "не указан"}», ${dr || "без направления"})`); continue;
    }
    if (att && code !== "T01") { drop("тег на заглушке вложения"); continue; }
    tags.push({ src, k: code, tone: t.tone, t: t.t, quote: t.quote });
    kept++;
  }
  reviews[k] = {
    verdict: r.verdict || "", problem: r.problem || "", recommendation: r.recommendation || "",
    tone: r.tone || "warn", scores: r.scores || {}, probDelta: typeof r.probDelta === "number" ? r.probDelta : 0,
    quotes: Array.isArray(r.quotes) ? r.quotes.slice(0, 2) : [],
    msgTags: tags, mgr: m.mgr, lastTs: m.last, at: new Date().toISOString(), model: MODEL,
  };
  deals++;
}

console.log(`Разборов принято: ${deals}, тегов оставлено ${kept}, отброшено ${dropped}`);
for (const r of rej.slice(0, 40)) console.log("  ОТБРОШЕНО: " + r);
if (rej.length > 40) console.log(`  ... ещё ${rej.length - 40}`);
if (DRY) { console.log("DRY=1, файл не тронут"); process.exit(0); }
mkdirSync("dialog/data", { recursive: true });
writeFileSync(OUT, JSON.stringify({ ...prev, generatedAt: new Date().toISOString(), reviews }));
console.log(`Записано -> ${OUT}`);
