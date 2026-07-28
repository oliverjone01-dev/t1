// Собирает дашборды менеджеров ОП из единого rop/data/rop.json - тем же билдером
// build-manager.ts, но циклом по АВТО-ростеру (без ручного списка). Ростер берём из данных:
// продавцы со сделками (та же логика, что opUsers внутри build-manager), поэтому новый менеджер
// в Bitrix -> на следующем прогоне у него сам появляется дашборд, а ушедший - отваливается.
// Слаг = транслит фамилии. Пишет <OUT_DIR>/rop-<slug>/index.html и v.txt (штамп для кэш-бастера).
//
// Порог MIN_DEALS отсекает исторические «призраки» с парой сделок, чтобы не печь тяжёлые
// страницы (~12 МБ) впустую. Активные + новички остаются. Порог - прозрачный knob.
//
// Запуск:  node src/scripts/b24/build-managers-all.mjs
//   PRINT_ONLY=1     - только напечатать ростер и слаги, ничего не собирать
//   OUT_DIR=_site    - куда писать (в деплое = _site)
//   MIN_DEALS=5      - минимум сделок за всё время, чтобы попасть в сборку (по умолчанию 5)
//   ONLY="Имя,Имя"   - собрать только перечисленных (для отладки)

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SRC = "rop/data/rop.json";
const OUT_DIR = (process.env.OUT_DIR || "public").replace(/\/+$/, "");
const PRINT_ONLY = process.env.PRINT_ONLY === "1";
const MIN_DEALS = Number(process.env.MIN_DEALS || "5");
const ONLY = (process.env.ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);

const rop = JSON.parse(readFileSync(SRC, "utf-8"));

// --- ростер ОП: идентично build-manager.ts (исключения GM/системные -> продавцы со сделками) ---
const EXCLUDE_MGR = new Set([
  "Виктория Преснякова", "Денис Белов", "Юлия Мавлина", "Системный пользователь MGM",
]);
const keepRec = (r) => !EXCLUDE_MGR.has(r.mgr) && r.dir !== "glass-memory";
const deals = (rop.deals || []).filter(keepRec);
const NOT_OP = new Set(["Дмитрий Янчоглов", "Алиса Алексеева"]);
const isSysName = (n) => /систем|^id\s?\d/i.test(n || "");
const isSalesRep = (name) => !NOT_OP.has(name) && !isSysName(name);
const dealsBy = {};
for (const d of deals) if (d.mgr) dealsBy[d.mgr] = (dealsBy[d.mgr] || 0) + 1;
const roster = Object.keys(dealsBy)
  .filter((n) => dealsBy[n] >= MIN_DEALS && isSalesRep(n))
  .sort((a, b) => dealsBy[b] - dealsBy[a]);

// --- транслит фамилии -> слаг (с защитой от коллизий добавлением имени) ---
const MAP = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",
  н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",
  ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
const translit = (s) => s.toLowerCase().split("").map((c) => (c in MAP ? MAP[c] : c)).join("")
  .replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, ""); // дефис сохраняем: Шура-Бура -> shura-bura
const parts = (name) => name.trim().split(/\s+/);
const surnameOf = (name) => { const p = parts(name); return p[p.length - 1] || name; };
const firstOf = (name) => parts(name)[0] || "";

const used = new Map(); // slug -> name (детект коллизий)
const slugFor = (name) => {
  const base = translit(surnameOf(name)) || "mgr";
  let slug = base;
  if (used.has(slug) && used.get(slug) !== name) {
    slug = base + "-" + (translit(firstOf(name)) || "x"); // Лысенко Юлия/Ольга -> lysenko-yuliya/-olga
    let i = 2; while (used.has(slug) && used.get(slug) !== name) slug = base + "-" + i++;
  }
  used.set(slug, name);
  return slug;
};

const list = roster.map((name) => ({ name, slug: slugFor(name), deals: dealsBy[name] }));

console.log(`Ростер ОП: ${list.length} менеджеров (MIN_DEALS=${MIN_DEALS}, источник ${SRC}, снят ${rop.generated_at || "?"})`);
for (const m of list) console.log(`  ${m.slug.padEnd(22)} <- ${m.name}  (${m.deals} сделок)`);

if (PRINT_ONLY) process.exit(0);

const targets = ONLY.length ? list.filter((m) => ONLY.includes(m.name)) : list;
console.log(`\nСобираю ${targets.length} дашбордов в ${OUT_DIR}/rop-<slug>/index.html ...`);
let ok = 0, fail = 0;
for (const m of targets) {
  const dir = `${OUT_DIR}/rop-${m.slug}`;
  const out = `${dir}/index.html`;
  mkdirSync(dir, { recursive: true });
  try {
    execFileSync("npx", ["tsx", "src/scripts/b24/build-manager.ts"], {
      stdio: ["ignore", "ignore", "inherit"],
      env: { ...process.env, MANAGER_NAME: m.name, MANAGER_OUT: out },
    });
    // v.txt = штамп сборки (bakedAt) для авто-обновления страницы при устаревшем кэше
    const html = readFileSync(out, "utf-8");
    const stamp = (html.match(/"bakedAt":"([^"]*)"/) || [])[1] || "";
    writeFileSync(`${dir}/v.txt`, stamp);
    ok++; console.log(`  ok  rop-${m.slug} <- ${m.name} (${stamp})`);
  } catch (e) {
    fail++; console.error(`  FAIL rop-${m.slug} <- ${m.name}: ${e.message}`);
  }
}
console.log(`\nГотово: ${ok} собрано, ${fail} ошибок.`);
if (fail) process.exit(1);
