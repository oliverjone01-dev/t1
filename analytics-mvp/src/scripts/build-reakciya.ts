// Вкладка «Реакция»: что сделали по рекламе OZON, что из этого вышло, что делать дальше.
//
// Отличие от остальных семи вкладок: данные для неё приходят не из снимков data/*.ndjson,
// а из кабинета продавца (лог действий по кампаниям, история ставки оплаты за заказ,
// цены и акции, воронка по товарам). Кабинет отдаёт это только под живой сессией по кукам,
// автоматического синка нет - см. tools/reakciya/КАБИНЕТ_эндпоинты.md.
// Поэтому здесь скрипт только собирает страницу из готового среза data/reakciya.json
// и частей в katya/reakciya/. Пересчёт среза из выгрузок кабинета живёт в tools/reakciya/build.py.
//
// Страница самодостаточна: данные вшиты внутрь, внешних запросов и внешних ссылок нет.
// Механика соинвеста - чисто озоновская, для PLATFORM=ym страница не собирается.
import { readFileSync, writeFileSync } from "node:fs";
import { dp, op, IS_OZON } from "../paths.js";
import { KPAGES, navButton } from "./katya-nav.js";

const PARTS = ["app_head.js", "app_kpi_timeline.js", "app_bytype_feed.js", "app_tail.js"];
const part = (f: string): string => readFileSync(`katya/reakciya/${f}`, "utf-8");

if (!IS_OZON) {
  console.log("build-reakciya: PLATFORM != ozon, вкладка «Реакция» не собирается (соинвест - механика OZON)");
  process.exit(0);
}

type Raw = { updated: string; data_until: string; prices_until: string; feed: Array<{ ts: string; sp?: unknown }>; [k: string]: unknown };
const raw = JSON.parse(readFileSync(dp("reakciya.json"), "utf-8")) as Raw;

// Срез из кабинета несёт ещё пару веток, которые вкладка больше не рисует: заготовки тестов,
// инвентарь кампаний и полную историю ставки оплаты за заказ (от неё нужна только ступенчатая
// линия под таймлайном). Выкидываем здесь, а не в python: так страница не растолстеет,
// чей бы срез в data/reakciya.json ни лежал.
delete raw.tests;
delete raw.camps;
const cpo = raw.cpo as { steps?: unknown } | undefined;
if (cpo && typeof cpo === "object") raw.cpo = { steps: cpo.steps || [] };

// Шапка KATYA вместо собственной навигации страницы: список вкладок общий (katya-nav.ts).
const navStrip = `<div id="gg-nav" style="background:#1a2330;border-bottom:1px solid #22d3ee;color:#cfe8ef;font:13px/1.6 system-ui;padding:8px 18px">
  <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center">
    ${KPAGES.map(([h, l, key]) => navButton(h, l, key === "reakciya")).join(" ")}
    <span style="color:#5d7484;margin-left:8px">кабинет OZON · действия по ${raw.updated} · воронка по ${raw.data_until} · цены по ${raw.prices_until}</span>
  </div></div>`;

const appJs = PARTS.map((f) => { const t = part(f); return t.endsWith("\n") ? t : t + "\n"; }).join("");

function assemble(dataStr: string, light: boolean): string {
  const head = part("head.html").replace("<title>GENGLASS · Рычаги</title>", "<title>GENGLASS · Реакция</title>");
  let body = part("body1.html");
  if (light) {
    body = body.replace("Пульт маркетинга Ozon · что сделали, что из этого вышло, что делать дальше",
                        "Пульт маркетинга Ozon · облегчённая версия, действия за 45 дней");
  }
  // Своя навигация страницы заменяется общей шапкой KATYA.
  const navStart = body.indexOf('<div class="topnav">');
  const navEnd = body.indexOf("</div>", body.indexOf('id="navhint"')) + "</div>".length;
  if (navStart < 0 || navEnd <= navStart) throw new Error("build-reakciya: не найден блок навигации в katya/reakciya/body1.html");
  body = body.slice(0, navStart) + navStrip + body.slice(navEnd);

  const guard = part("guard.js");
  const end = part("endmark.js");
  const asm = (kb: number): string =>
    head + part("css_add.css") + body + "\n" + guard.replace("__SIZE__", String(kb)) +
    "\n<script>\nvar D=" + dataStr + ";\n</script>\n<script>\n" + appJs + "\n</script>\n" + end + "\n</body>\n</html>\n";
  return asm(Buffer.byteLength(asm(0), "utf-8") >> 10);
}

const kb = (s: string): number => Buffer.byteLength(s, "utf-8") >> 10;

const full = assemble(JSON.stringify(raw), false);
writeFileSync(op("katya-reakciya.html"), full);
console.log(`katya-reakciya.html: ${kb(full)} KB, действий ${raw.feed.length}`);

// Облегчённая версия: только свежие действия. В шапку не выведена, лежит на случай медленной сети.
const lite = { ...raw, feed: raw.feed.filter((f) => f.ts.slice(0, 10) >= "2026-08-01") };
const liteHtml = assemble(JSON.stringify(lite), true);
writeFileSync(op("katya-reakciya-lite.html"), liteHtml);
console.log(`katya-reakciya-lite.html: ${kb(liteHtml)} KB, действий ${lite.feed.length}`);
