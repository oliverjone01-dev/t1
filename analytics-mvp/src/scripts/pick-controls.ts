// Подбор контроля к тестовым товарам: восемь правил, проверяемых машиной.
//
// ЗАЧЕМ. До 23.09 подбор был разовой ручной работой, результат лежал колонкой «контроль» в
// tests_campaigns.psv, а критерий жил в голове. Проверить его было нечем, повторить на
// следующей волне тоже. Ревью Ивана нашло пять дефектов, три из них одного рода: контроль
// одного теста оказывался роднёй тестового товара другого.
//
// ЧТО ИЗМЕНИЛОСЬ ПО СУЩЕСТВУ. Разрыв теперь считается к ГРУППОВОМУ контролю, а не к паре:
// групповой точнее (размах 11.4 против 21.5 на тесте 1) и устойчивее. Пара остаётся
// подписью к строке: по ней видно, на кого похож товар, и она ловит мёртвый и грязный
// контроль. Отдельного счётного смысла у пары больше нет.
//
// ВОСЕМЬ ПРАВИЛ. Пять прежних:
//   1. та же категория (первый сегмент артикула);
//   2. ближайшие показы в поиске за 14 дней до старта, расхождение не больше 50 %;
//   3. нет рекламного расхода в окне -14..+40 дней от старта;
//   4. один артикул не контроль дважды;
//   5. живой: показы есть и в последние 7 дней до старта, и после него.
// И три новых, из ревью:
//   6. не брат по объединённой карточке (только по настоящей карте, префикс убран 23.09);
//   7. не родня тестового товара ЛЮБОГО теста, не только своего;
//   8. корреляция остатков с любым тестовым товаром ниже порога.
//
// ПРО ПРАВИЛО 8. Сырая корреляция рядов соинвеста здесь бесполезна: магазин двигался целиком
// в 48 днях из 96, поэтому коррелирует всё со всем, фон по 400 случайным парам панели 0.316.
// Считаем корреляцию ОСТАТКОВ, то есть соинвеста минус медиана панели в тот же день. Фон
// остатков 0.011, а у настоящей родни 0.73..0.90. Порог 0.3 стоит посередине с запасом в обе
// стороны.
//
// ПРАВИЛА 1 И 6 ПРОТИВОРЕЧАТ ДРУГ ДРУГУ. Правило 1 тянет к похожему товару, правило 6
// запрещает брата. Правило 1 работает на уровне КАТЕГОРИИ (первый сегмент артикула: GGL
// зеркала, GGT столы, GGM светильники), правило 6 - на уровне карточки.
//
// ПРЕФИКС ИЗ ПРАВИЛА 6 УБРАН 23.09.2026 по решению Ивана: линия (два сегмента артикула)
// объединяет разные модели, то есть это догадка, выглядящая как данные. Пока настоящей
// карты карточек нет, правила 6 и 7 не срабатывают ни разу, и всю работу по родству
// делает правило 8. Это сознательный размен: пропустить родню неприятно, но выдать
// догадку за измеренное родство хуже, потому что второе не видно.
//
// Пары, отобранные правилом 8, подписываются «родство по корреляции, не по карточке»:
// читатель должен видеть, чем именно доказано родство.
//
// Без категории как гейта подбор ломается тихо: на прогоне 23.09 зеркало GGL-07-XL-2
// получило в пару стол GGT-47-3-5-90 просто потому, что трафик совпал на 10 %. Пара теперь
// только подпись к строке, но подпись «сравнили с этим» обязана быть честной.
//
// Запуск: npm run picks (сети не требует, читает только data/ и tools/tests/).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dp } from "../paths.js";
import { loadCardMap, kinKey, type CardMap } from "./card-kin.js";

/** Категория по артикулу: первый сегмент. GGL зеркала, GGT столы, GGM свет и так далее.
 *  Шире линии (двух сегментов), поэтому не конфликтует с запретом на братьев. */
export const catKey = (art: string): string => art.split("-")[0] ?? art;

const OUT = "tools/tests/control_picks.json";

/** Порог корреляции остатков, выше которого товар считается роднёй. Фон 0.011, родня
 *  0.73..0.90, так что порог не чувствителен к своему точному значению. */
export const KIN_CORR = 0.3;
/** Окно сопоставления по трафику, дней до старта. */
export const MATCH_DAYS = 14;
/** Предел расхождения трафика: «ближайший» обязан быть действительно близким. Без этого
 *  правило 2 вырождается в «хоть кто-нибудь»: на прогоне 23.09 оно выдало пары с
 *  расхождением +2675 % и +3751 %, потому что в категории после запрета родни почти никого
 *  не осталось. Пара без пары честнее пары с тридцатисемикратной разницей. */
export const MATCH_MAX_DELTA = 0.5;
/** Окно проверки на рекламный расход: от -14 до +40 дней от старта. */
export const SPEND_FROM = -14, SPEND_TO = 40;
/** Окно проверки живости до старта. */
export const ALIVE_DAYS = 7;

export interface Day { date: string; art: string; coinv?: number; vsearch?: number; spend?: number; inPanel?: boolean }
export type Series = Map<string, Map<string, Day>>;

export interface Reject { art: string; rule: number; why: string }
export interface Pick {
  test: string;
  ctl: string | null;
  /** Почему пары нет, если её нет. */
  why?: string;
  testViews: number; ctlViews?: number; delta?: number;
  /** Кандидаты, отсеянные правилами, в порядке правил. Нужны, чтобы решение читалось. */
  rejected: Reject[];
}

const mean = (v: number[]): number => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);

/** Корреляция Пирсона по общим дням. Меньше 20 общих дней - не считаем: на коротком ряду
 *  коэффициент скачет и отсечёт кого попало. */
export function corr(a: Map<string, number>, b: Map<string, number>, minDays = 20): number | null {
  const days = [...a.keys()].filter((d) => b.has(d));
  if (days.length < minDays) return null;
  const x = days.map((d) => a.get(d)!), y = days.map((d) => b.get(d)!);
  const mx = mean(x), my = mean(y);
  const sx = Math.sqrt(mean(x.map((v) => (v - mx) ** 2))), sy = Math.sqrt(mean(y.map((v) => (v - my) ** 2)));
  if (!sx || !sy) return null;
  return mean(x.map((v, i) => (v - mx) * (y[i]! - my))) / (sx * sy);
}

/** Остаток: соинвест товара минус медиана панели в тот же день. Убирает общее движение
 *  магазина, без которого корреляция ничего не различает. */
export function residuals(series: Series, panelMedian: Map<string, number>): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const [art, days] of series) {
    const m = new Map<string, number>();
    for (const [d, row] of days) {
      const c = panelMedian.get(d);
      if (row.coinv != null && c != null) m.set(d, row.coinv - c);
    }
    if (m.size) out.set(art, m);
  }
  return out;
}

const addDays = (d: string, k: number): string => {
  const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + k); return t.toISOString().slice(0, 10);
};
const range = (from: string, a: number, b: number): string[] => {
  const out: string[] = [];
  for (let k = a; k <= b; k++) out.push(addDays(from, k));
  return out;
};
const sum = (series: Series, art: string, days: string[], key: "vsearch" | "spend"): number =>
  days.reduce((s, d) => s + (series.get(art)?.get(d)?.[key] ?? 0), 0);

export interface PickInput {
  series: Series;
  panelMedian: Map<string, number>;
  cards: CardMap;
  /** Тестовые товары ВСЕХ тестов: правило 7 смотрит шире своего теста. */
  allTestArts: Set<string>;
  /** Кандидаты в контроль: панель минус тестовые. */
  candidates: string[];
}

/** Подбор контроля к одному тестовому товару. Возвращает и выбор, и отказы: без отказов
 *  решение нечитаемо, а спорить с ним невозможно. */
export function pickFor(test: string, start: string, inp: PickInput, taken: Set<string>): Pick {
  const { series, cards, allTestArts } = inp;
  const res = residuals(series, inp.panelMedian);
  const matchWin = range(start, -MATCH_DAYS, -1);
  const aliveBefore = range(start, -ALIVE_DAYS, -1);
  const spendWin = range(start, SPEND_FROM, SPEND_TO);
  const afterWin = range(start, 0, SPEND_TO);
  const testViews = sum(series, test, matchWin, "vsearch");
  const rejected: Reject[] = [];
  // Пустой ключ это «карточка неизвестна», а не общая карточка: иначе без карты роднёй
  // оказались бы все кандидаты разом, и подбор молча вернул бы пусто по всем тестам.
  const kinKeys = new Set([...allTestArts].map((a) => kinKey(a, cards)).filter((k) => k !== ""));

  const ok: Array<{ art: string; views: number }> = [];
  for (const c of inp.candidates) {
    if (c === test || allTestArts.has(c)) continue;
    if (catKey(c) !== catKey(test)) continue;   // правило 1, тихо: чужих категорий сотни
    if (taken.has(c)) { rejected.push({ art: c, rule: 4, why: "уже контроль другой пары" }); continue; }
    const kc = kinKey(c, cards);
    if (kc !== "" && kinKeys.has(kc)) {
      const own = kc === kinKey(test, cards);
      rejected.push({ art: c, rule: own ? 6 : 7, why: own ? "брат тестового товара этой пары по карточке" : "родня тестового товара другого теста по карточке" });
      continue;
    }
    const sp = sum(series, c, spendWin, "spend");
    if (sp > 0) { rejected.push({ art: c, rule: 3, why: `рекламный расход ${Math.round(sp)} ₽ в окне теста` }); continue; }
    const before = sum(series, c, aliveBefore, "vsearch"), after = sum(series, c, afterWin, "vsearch");
    if (!before || !after) {
      rejected.push({ art: c, rule: 5, why: !before ? "нет показов за 7 дней до старта" : "нет показов после старта" });
      continue;
    }
    const rc = res.get(c), rt = res.get(test);
    if (rc && rt) {
      const k = corr(rc, rt);
      if (k != null && k >= KIN_CORR) { rejected.push({ art: c, rule: 8, why: `корреляция остатков ${k.toFixed(2)} при пороге ${KIN_CORR}` }); continue; }
    }
    ok.push({ art: c, views: sum(series, c, matchWin, "vsearch") });
  }

  if (!ok.length) {
    return { test, ctl: null, why: `в категории ${catKey(test)} ни один кандидат не прошёл правила`, testViews, rejected };
  }
  // Правило 2: ближайший по трафику внутри категории.
  ok.sort((a, b) => Math.abs(a.views - testViews) - Math.abs(b.views - testViews));
  const best = ok[0]!;
  const delta = testViews ? Math.round((best.views - testViews) / testViews * 100) : NaN;
  if (!testViews || Math.abs(delta) > MATCH_MAX_DELTA * 100) {
    for (const c of ok) rejected.push({ art: c.art, rule: 2, why: `трафик расходится на ${testViews ? Math.round((c.views - testViews) / testViews * 100) : NaN} %` });
    return {
      test, ctl: null,
      why: `сопоставимого по трафику контроля нет: ближайший расходится на ${delta} %`,
      testViews, rejected,
    };
  }
  return { test, ctl: best.art, testViews, ctlViews: best.views, delta, rejected };
}

export function pickAll(tests: Array<{ id: string; старт?: string; тест?: string[] }>, inp: PickInput): Record<string, Pick[]> {
  const taken = new Set<string>();
  const out: Record<string, Pick[]> = {};
  for (const t of tests) {
    if (!t.старт || !t.тест?.length) continue;
    const start = t.старт.slice(0, 10);
    out[t.id] = t.тест.map((a) => {
      const p = pickFor(a, start, inp, taken);
      if (p.ctl) taken.add(p.ctl);
      return p;
    });
  }
  return out;
}

// ---------- чтение данных ----------
function load(): PickInput & { tests: any[] } {
  const T = JSON.parse(readFileSync("tools/tests/tests.json", "utf-8"));
  const series: Series = new Map();
  const cell = (art: string, date: string): Day => {
    let m = series.get(art); if (!m) { m = new Map(); series.set(art, m); }
    let c = m.get(date); if (!c) { c = { date, art }; m.set(date, c); }
    return c;
  };
  const nd = (f: string): any[] => (existsSync(f)
    ? readFileSync(f, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

  const panel = new Set<string>();
  for (const r of nd(dp("coinv_daily.ndjson"))) {
    if (r.observed === false) continue;
    const c = cell(r.art, r.date);
    c.coinv = r.coinv_paid_pct ?? r.coinv_pct;
    c.inPanel = r.in_panel !== false;
    if (c.inPanel) panel.add(r.art);
  }
  const sku2art = JSON.parse(readFileSync(dp("sku_offer.json"), "utf-8")) as Record<string, string>;
  for (const r of nd(dp("sku_views.ndjson"))) {
    const art = sku2art[String(r.sku)]; if (!art) continue;
    const c = cell(art, r.date); c.vsearch = (c.vsearch ?? 0) + (r.vsearch || 0);
  }
  for (const r of nd(dp("ads_sku_daily.ndjson"))) {
    const art = sku2art[String(r.sku)]; if (!art) continue;
    const c = cell(art, r.d); c.spend = (c.spend ?? 0) + (r.sp || 0);
  }
  for (const r of nd(dp("ads_daily.ndjson"))) {
    const art = String(r.off || "").trim(); if (!art) continue;
    const c = cell(art, r.d); c.spend = (c.spend ?? 0) + (r.sp || 0);
  }

  const allTestArts = new Set<string>();
  for (const t of T.тесты) for (const a of t.тест || []) allTestArts.add(a);

  // Медиана панели по дням: тестовые в неё не входят, иначе остаток съест сам себя.
  const byDay = new Map<string, number[]>();
  for (const [art, days] of series) {
    if (!panel.has(art) || allTestArts.has(art)) continue;
    for (const [d, row] of days) {
      if (row.coinv == null) continue;
      const a = byDay.get(d); if (a) a.push(row.coinv); else byDay.set(d, [row.coinv]);
    }
  }
  const panelMedian = new Map<string, number>();
  for (const [d, v] of byDay) {
    const s = v.sort((a, b) => a - b), i = s.length >> 1;
    panelMedian.set(d, s.length % 2 ? s[i]! : (s[i - 1]! + s[i]!) / 2);
  }
  return {
    series, panelMedian, cards: loadCardMap(), allTestArts,
    candidates: [...panel].filter((a) => !allTestArts.has(a)).sort(),
    tests: T.тесты,
  };
}

function main(): void {
  const inp = load();
  const picks = pickAll(inp.tests, inp);
  let paired = 0, total = 0;
  for (const [id, list] of Object.entries(picks)) {
    console.log(`\n=== ${id} ===`);
    for (const p of list) {
      total += 1; if (p.ctl) paired += 1;
      const byRule = new Map<number, number>();
      for (const r of p.rejected) byRule.set(r.rule, (byRule.get(r.rule) ?? 0) + 1);
      const tail = [...byRule.entries()].sort().map(([r, n]) => `${r}:${n}`).join(" ");
      console.log(`  ${p.test.padEnd(24)} -> ${(p.ctl ?? "пары нет").padEnd(24)}`
        + ` ${p.ctl ? `Δ ${p.delta! >= 0 ? "+" : ""}${p.delta} %` : p.why}   отсеяно по правилам ${tail}`);
    }
  }
  const kinRejects = Object.values(picks).flat().flatMap((p) => p.rejected).filter((r) => r.rule === 6 || r.rule === 7).length;
  console.log(`\nпар подобрано ${paired} из ${total}; отказов по родству (правила 6 и 7): ${kinRejects}`);
  console.log(`карта карточек: ${inp.cards.groups} групп из ${inp.cards.source || "нет файла"}`
    + (inp.cards.real ? "" : ", это заглушка - родство идёт по префиксу артикула"));
  writeFileSync(OUT, JSON.stringify({ built: new Date().toISOString().slice(0, 10), rules: { KIN_CORR, MATCH_DAYS, ALIVE_DAYS }, picks }, null, 1) + "\n");
  console.log(`-> ${OUT}`);
}

if (/pick-controls\.(ts|js)$/.test(process.argv[1] || "")) main();
