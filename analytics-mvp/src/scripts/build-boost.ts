// СЛУЖЕБНАЯ вкладка «Бустинг»: что лежит в индексе бустинга и из чего он складывается.
//
// Решение Ивана от 24.09: boost_daily включать служебной вкладкой, не на главную. Причина
// простая - по этому файлу пока нельзя принимать решения: три дня наблюдения (09, 23 и 24.09),
// истории нет, расшифровка полей наша собственная, в документации площадки её нет. Страница
// нужна, чтобы файл лежал на виду и было видно, что в нём есть, а не чтобы что-то решать.
//
// ЧТО ЭТО. POST /api/pricing-bff-service/v1/get-boosting-info отдаёт по каждому SKU число
// boost и разбор его на слагаемые. Сумма слагаемых равна boost ровно, до последнего знака, на
// всех строках - это проверяется на странице, а не предполагается.
//
// ЗАЧЕМ ЭТО ТЕСТАМ. Одно из слагаемых - цветовой индекс цены (itemindexes_SUPER, GREEN, YELLOW,
// RED, WITHOWT_INDEX). Значит индекс цены входит в поисковый бустинг напрямую, и он РАЗНЫЙ у
// товаров одной объединённой карточки. Вкладка «Тесты» до 24.09 писала, что сосед по карточке
// делит с рекламируемым товаром индекс цены; это неверно, и здесь видно, почему.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dp, op, IS_OZON } from "../paths.js";
import { KPAGES, navButton } from "./katya-nav.js";

if (!IS_OZON) {
  console.log("build-boost: PLATFORM != ozon, служебная вкладка «Бустинг» не собирается");
  process.exit(0);
}

const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const nbsp = (n: number): string => {
  const s = Math.round(n).toString();
  let out = "";
  for (let i = 0; i < s.length; i++) out += s[i] + (((s.length - i - 1) % 3 === 0 && i < s.length - 1) ? " " : "");
  return out;
};
const readNd = (f: string): any[] => (existsSync(f)
  ? readFileSync(f, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

type BoostRow = { date: string; art: string; sku?: string; boost: number; parts?: Record<string, number> };
const rows = readNd(dp("boost_daily.ndjson")) as BoostRow[];
const days = [...new Set(rows.map((r) => r.date))].sort();
const arts = new Set(rows.map((r) => r.art));

// СУММА СЛАГАЕМЫХ ПРОТИВ ИТОГА. Это единственная сверка, которая здесь возможна без второго
// источника, и без неё разбор нельзя показывать: если сумма не сходится, значит часть вклада
// от нас скрыта, и читать состав как полный - ошибка.
let noParts = 0, mismatch = 0, worst = 0;
for (const r of rows) {
  const p = r.parts;
  if (!p || !Object.keys(p).length) { noParts += 1; continue; }
  const d = Math.abs(Object.values(p).reduce((a, b) => a + b, 0) - r.boost);
  worst = Math.max(worst, d);
  if (d > 0.0011) mismatch += 1;
}

// Состав: сколько артикуло-дней несёт каждое слагаемое и какие значения оно принимает.
const partDays = new Map<string, number>();
const partVals = new Map<string, Set<number>>();
for (const r of rows) {
  for (const [k, v] of Object.entries(r.parts || {})) {
    partDays.set(k, (partDays.get(k) ?? 0) + 1);
    (partVals.get(k) ?? partVals.set(k, new Set()).get(k)!).add(Math.round(v * 1000) / 1000);
  }
}
/** Наше чтение поля, а не документация площадки. Так и подписано. */
const MEAN: Record<string, string> = {
  boosting_motivation: "переменная часть, у большинства товаров упирается в 0.55",
  target_sell_with_action: "участие в акции площадки",
  subscription_Premium_Pro: "подписка Premium Pro на кабинете",
  itemindexes_SUPER: "цветовой индекс цены: «супер»",
  itemindexes_GREEN: "цветовой индекс цены: зелёный",
  itemindexes_YELLOW: "цветовой индекс цены: жёлтый",
  itemindexes_RED: "цветовой индекс цены: красный, вклад нулевой",
  itemindexes_WITHOWT_INDEX: "индекса цены нет (написание поля - площадки)",
};
const IDX = (r: BoostRow): string => Object.keys(r.parts || {}).find((k) => k.startsWith("itemindexes_")) ?? "-";

const compRows = [...partDays].sort((a, b) => b[1] - a[1]).map(([k, n]) => {
  const v = [...(partVals.get(k) ?? [])].sort((a, b) => a - b);
  return `<tr><td>${esc(k)}</td><td class="r">${nbsp(n)}</td>`
    + `<td class="r">${v.length > 4 ? `${v[0]!.toFixed(3)}..${v[v.length - 1]!.toFixed(3)} (${v.length} значений)` : v.map((x) => x.toFixed(3)).join(", ")}</td>`
    + `<td class="muted">${esc(MEAN[k] || "смысл поля нам неизвестен")}</td></tr>`;
}).join("");

// Индекс цены по товарам тестов: тут и видно, что внутри одной карточки он разный.
const T = existsSync("tools/tests/tests.json")
  ? JSON.parse(readFileSync("tools/tests/tests.json", "utf-8")) as { тесты: Array<{ id: string; роли?: Record<string, string[]>; закрыт?: { эталонная_пара?: { карточка: string; строки: Array<{ артикул: string; режим: string }> } } }> }
  : { тесты: [] };
const wave = T.тесты.find((t) => t.id === "boost_plus_exit");
const closed = T.тесты.find((t) => t.закрыт?.эталонная_пара)?.закрыт?.эталонная_пара;
const cards = existsSync(dp("card_groups.json"))
  ? (JSON.parse(readFileSync(dp("card_groups.json"), "utf-8")).groups as Array<{ main: string; skus: Array<{ offer: string }> }>)
  : [];
const cardOf = new Map<string, string>();
for (const g of cards) for (const s of g.skus) cardOf.set(s.offer, g.main);
const byArt = new Map<string, Map<string, BoostRow>>();
for (const r of rows) (byArt.get(r.art) ?? byArt.set(r.art, new Map()).get(r.art)!).set(r.date, r);

const groupRows = (list: Array<{ art: string; note: string }>): string => list.map(({ art, note }) => {
  const m = byArt.get(art);
  return `<tr><td>${esc(art)}</td><td class="muted">${esc(cardOf.get(art) || "нет в карте")}</td><td class="muted">${esc(note)}</td>`
    + days.map((d) => {
        const r = m?.get(d);
        return `<td class="r">${r ? `${r.boost.toFixed(3)}<span class="muted"> ${esc(IDX(r).replace("itemindexes_", ""))}</span>` : "-"}</td>`;
      }).join("") + `</tr>`;
}).join("");

const waveList = [
  ...(wave?.роли?.test_ad ?? []).map((a) => ({ art: a, note: "в рекламе" })),
  ...(wave?.роли?.test_sibling ?? []).map((a) => ({ art: a, note: "сосед, рекламы нет" })),
];
const closedList = (closed?.строки ?? []).map((r) => ({ art: r.артикул, note: r.режим }));

/** Различается ли индекс цены внутри одной карточки: считаем, а не утверждаем. */
const splitCards: string[] = [];
for (const g of cards) {
  const own = g.skus.map((s) => s.offer).filter((a) => byArt.has(a));
  if (own.length < 2) continue;
  const last = days[days.length - 1]!;
  const idx = new Set(own.map((a) => IDX(byArt.get(a)!.get(last) ?? { date: last, art: a, boost: 0 })).filter((x) => x !== "-"));
  if (idx.size > 1) splitCards.push(`${g.main} (${[...idx].map((x) => x.replace("itemindexes_", "")).join(", ")})`);
}

const head = `<tr><th>Артикул</th><th>Карточка</th><th>Режим</th>`
  + days.map((d) => `<th class="r">${esc(d.slice(5))}</th>`).join("") + `</tr>`;

const CSS = `:root{--bg:#0b0f15;--card:#111823;--line:#1e2836;--txt:#dce8f2;--muted:#7e93a6;--warn:#f0b429;--acc:#22d3ee}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:18px}
h1{font-size:21px;margin:14px 0 4px}h2{font-size:16px;margin:22px 0 8px;color:var(--acc)}
.sub{color:var(--muted);margin:0 0 14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;margin:0 0 16px}
.stop{border-left:3px solid var(--warn);padding:8px 10px;margin:10px 0;background:#1a1710;border-radius:0 6px 6px 0}
.cov{color:var(--muted);border-top:1px solid var(--line);margin-top:10px;padding-top:8px}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{border-bottom:1px solid var(--line);padding:5px 7px;text-align:left;vertical-align:top}
th{color:var(--muted);font-weight:600}.r{text-align:right;white-space:nowrap}
.muted{color:var(--muted)}.tw{overflow-x:auto}
@media(max-width:640px){.wrap{padding:12px}table{font-size:12px}}`;

const nav = `<div style="background:#1a2330;border-bottom:1px solid #22d3ee;color:#cfe8ef;font:13px/1.6 system-ui;padding:8px 18px">`
  + `<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center">`
  + KPAGES.map(([h, l, key]) => navButton(h, l, key === "boost")).join(" ")
  + `<span style="color:#5d7484;margin-left:8px">служебная вкладка · снимки ${days.length ? esc(days[0]!) + ".." + esc(days[days.length - 1]!) : "нет"}</span></div></div>`;

const body = rows.length
  ? `<section class="card"><h2>Что в файле</h2>`
    + `<div class="cov" style="border-top:none;padding-top:0">Снимков ${days.length}`
    + ` (${days.map((d) => esc(d)).join(", ")}), строк ${nbsp(rows.length)}, артикулов ${nbsp(arts.size)}.`
    + ` Источник: POST /api/pricing-bff-service/v1/get-boosting-info, батчами по 100 SKU.`
    + ` Истории нет и задним числом она не восстанавливается: снимок отдаёт только сегодняшнее состояние.</div>`
    + `<div class="cov"><b>Сверка состава с итогом.</b> Сумма слагаемых равна boost на ${nbsp(rows.length - noParts - mismatch)}`
    + ` строках из ${nbsp(rows.length)}; строк без разбора ${noParts}, расхождений больше 0.001 - ${mismatch},`
    + ` максимальное расхождение ${worst.toFixed(5)}. ${mismatch || noParts
        ? "Пока расхождения есть, состав нельзя читать как полный."
        : "Значит состав полный: скрытых слагаемых в ответе нет."}</div></section>`
    + `<section class="card"><h2>Из чего складывается индекс</h2>`
    + `<div class="tw"><table><thead><tr><th>Слагаемое</th><th class="r">Артикуло-дней</th><th class="r">Значения</th><th>Что это, по нашему чтению</th></tr></thead>`
    + `<tbody>${compRows}</tbody></table></div>`
    + `<div class="cov">Расшифровка правой колонки наша, в документации площадки её нет. Проверять её можно только`
    + ` сопоставлением с кабинетом вручную, поэтому решения по ней не принимаются.</div></section>`
    + `<section class="card"><h2>Индекс цены различается внутри одной карточки</h2>`
    + `<div class="stop"><b>Это правка к вкладке «Тесты».</b> До 24.09 там было написано, что сосед по объединённой`
    + ` карточке делит с рекламируемым товаром акцию и индекс цены. Акцию делит, индекс - нет:`
    + ` на ${esc(days[days.length - 1] || "-")} цветовой индекс расходится внутри ${splitCards.length}`
    + ` карточек из ${cards.length}${splitCards.length ? `, например ${esc(splitCards.slice(0, 4).join("; "))}` : ""}.`
    + ` Индекс входит в бустинг слагаемым, то есть сосед сидит в другом режиме выдачи, а не в том же.`
    + ` Контролем он от этого быть не перестаёт, но обоснование у него другое: общая акция и общая карточка, не индекс.</div>`
    + (waveList.length
        ? `<h2 style="font-size:14px">Волна выхода из акции</h2><div class="tw"><table><thead>${head}</thead><tbody>${groupRows(waveList)}</tbody></table></div>`
        : "")
    + (closedList.length
        ? `<h2 style="font-size:14px">Карточка ${esc(closed!.карточка)}, на которой закрыт тест про ставку</h2>`
          + `<div class="tw"><table><thead>${head}</thead><tbody>${groupRows(closedList)}</tbody></table></div>`
          + `<div class="cov">У трёх рекламируемых индекс на последний снимок «супер», у двоих без рекламы он ниже.`
          + ` Это не эффект рекламы сам по себе: индекс считается от цены на полке, а цену на полке двигает соинвест,`
          + ` который приходит вместе с рекламой. Направление связи по трём снимкам не устанавливается.</div>`
        : "")
    + `</section>`
    + `<section class="card"><h2>Чего здесь нельзя делать</h2>`
    + `<div class="cov" style="border-top:none;padding-top:0">Три снимка, из них два подряд. Ни тренда, ни реакции на`
    + ` наши действия по ним не видно, и сравнивать 09.09 с 23.09 как «до и после» нельзя: между ними две недели`
    + ` без наблюдений. Вкладка служебная: она показывает, что в файле лежит, и ловит расхождения вроде правки про`
    + ` индекс цены выше. Решения о выводе из акции читаются на вкладке «Тесты» и только по гейту плато.</div></section>`
  : `<section class="card"><div class="stop"><b>Файла data/boost_daily.ndjson нет.</b> Вкладка пустая не потому, что`
    + ` бустинга нет, а потому, что снимок не приехал: POST /api/pricing-bff-service/v1/get-boosting-info,`
    + ` тело {company_id, skus:[...]}, батчами по 100.</div></section>`;

const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">`
  + `<meta name="viewport" content="width=device-width,initial-scale=1">`
  + `<title>GENGLASS · Бустинг (служебное)</title><style>${CSS}</style></head><body>${nav}`
  + `<div class="wrap"><h1>Бустинг · служебная вкладка</h1>`
  + `<p class="sub">Индекс бустинга по товарам и его состав. Служебная: по трём снимкам решения не принимаются.</p>`
  + body + `</div></body></html>`;

writeFileSync(op("katya-boost.html"), html);
console.log(`katya-boost.html: ${Math.round(html.length / 1024)} KB, снимков ${days.length}, артикулов ${arts.size}`);
