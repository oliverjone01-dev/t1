// Тянет фото менеджеров из Bitrix24 (user.get -> PERSONAL_PHOTO) и кладёт их в хаб:
//   analytics-mvp/public/dashboards/mgr/<slug>.jpg
// Хаб подставляет фото по slug (совпадает с адресом /rop-<slug>/), при отсутствии - инициалы.
// Только чтение Bitrix + запись файлов в репозиторий. Запуск: B24_WEBHOOK_URL=... npx tsx <файл>
import process from "node:process";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const OUT_DIR = "public/dashboards/mgr"; // относительно analytics-mvp (рабочая папка воркфлоу)

// slug (как в /rop-<slug>/) -> фамилия в Bitrix (LAST_NAME)
const ROSTER: [string, string][] = [
  ["lakomova", "Лакомова"],
  ["lysanova", "Лысанова"],
  ["shura-bura", "Шура-Бура"],
  ["platonova", "Платонова"],
  ["zaznoba", "Зазноба"],
  ["lobova", "Лобова"],
];

async function call(method: string, p: any = {}): Promise<any> {
  for (let a = 0; a < 5; a++) {
    try {
      const res = await fetch(`${BASE}/${method}.json`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p), signal: AbortSignal.timeout(30000) });
      const j: any = await res.json();
      if (j.error) { if (/QUERY_LIMIT|OPERATION_TIME_LIMIT/i.test(String(j.error))) { await new Promise((r) => setTimeout(r, 1200)); continue; } throw new Error(`${method}: ${j.error_description || j.error}`); }
      return j;
    } catch (e) { if (a === 4) throw e; await new Promise((r) => setTimeout(r, 600 * (a + 1))); }
  }
}
async function listAll(method: string, p: any): Promise<any[]> {
  const all: any[] = []; let start = 0;
  for (;;) { const j = await call(method, { ...p, start }); (j.result || []).forEach((r: any) => all.push(r)); if (j.next === undefined) break; start = j.next; }
  return all;
}
const photoUrl = (u: any): string => { const p = u && u.PERSONAL_PHOTO; if (!p) return ""; if (typeof p === "string") return p; if (typeof p === "object") return String(p.src || p.url || p.downloadUrl || ""); return ""; };

(async () => {
  const users = await listAll("user.get", { ACTIVE: true });
  console.error(`user.get: ${users.length} пользователей`);
  mkdirSync(OUT_DIR, { recursive: true });
  let ok = 0; const missing: string[] = [];
  for (const [slug, surname] of ROSTER) {
    const u = users.find((x: any) => String(x.LAST_NAME || "").trim().toLowerCase() === surname.toLowerCase());
    if (!u) { missing.push(`${surname}: нет пользователя`); continue; }
    const url = photoUrl(u);
    if (!url) { missing.push(`${surname}: нет PERSONAL_PHOTO`); continue; }
    try {
      const full = /^https?:/i.test(url) ? url : `${new URL(BASE).origin}${url}`;
      const r = await fetch(full, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) { missing.push(`${surname}: HTTP ${r.status}`); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 200) { missing.push(`${surname}: пустой файл`); continue; }
      writeFileSync(`${OUT_DIR}/${slug}.jpg`, buf);
      ok++; console.error(`OK  ${surname} -> ${slug}.jpg (${buf.length} байт)`);
    } catch (e) { missing.push(`${surname}: ${String(e)}`); }
  }
  console.error(`Готово: фото ${ok}/${ROSTER.length}`);
  if (missing.length) console.error("Нет фото:\n  " + missing.join("\n  "));
})();
