// Подбор контроля решает, с чем сравнивают тест. Молчаливая ошибка тут не видна в числах:
// она просто делает разницу меньше, чем есть, и выглядит как отсутствие эффекта.
import { describe, it, expect } from "vitest";
import {
  corr, residuals, pickFor, pickAll, catKey,
  KIN_CORR, MATCH_MAX_DELTA,
  type Series, type PickInput, type Day,
} from "./pick-controls.js";
import { type CardMap } from "./card-kin.js";

const D = (n: number): string => `2026-09-${String(n).padStart(2, "0")}`;
const noCards: CardMap = { card: new Map(), groups: 0, source: "", real: false };
/** Настоящая карта карточек: правила 6 и 7 работают только по ней, префикс убран 23.09. */
const withCards = (pairs: Array<[string, string]>): CardMap =>
  ({ card: new Map(pairs), groups: 99, source: "test", real: true });

/** Ряд: артикул -> дни. По умолчанию товар живой, без рекламы и с ровным соинвестом. */
function mk(arts: Record<string, Partial<Day> & { views?: number; coinvBy?: (d: number) => number }>): Series {
  const s: Series = new Map();
  for (const [art, cfg] of Object.entries(arts)) {
    const m = new Map<string, Day>();
    for (let n = 1; n <= 30; n++) {
      m.set(D(n), {
        date: D(n), art,
        vsearch: cfg.views ?? 100,
        spend: cfg.spend ?? 0,
        coinv: cfg.coinvBy ? cfg.coinvBy(n) : 50,
        inPanel: true,
      });
    }
    s.set(art, m);
  }
  return s;
}

const input = (series: Series, tests: string[], extra: Partial<PickInput> = {}): PickInput => ({
  series,
  panelMedian: new Map(Array.from({ length: 30 }, (_, i) => [D(i + 1), 50])),
  cards: noCards,
  allTestArts: new Set(tests),
  candidates: [...series.keys()].filter((a) => !tests.includes(a)),
  ...extra,
});

const START = D(20);

describe("корреляция остатков", () => {
  it("на коротком ряду не считается", () => {
    const a = new Map([["d1", 1], ["d2", 2]]);
    expect(corr(a, a)).toBeNull();
  });

  it("ровный ряд без разброса корреляции не даёт", () => {
    const flat = new Map(Array.from({ length: 30 }, (_, i) => [D(i + 1), 5]));
    expect(corr(flat, flat)).toBeNull();
  });

  it("остаток это соинвест минус медиана панели того же дня", () => {
    const s = mk({ A: { coinvBy: (n) => 50 + n } });
    const r = residuals(s, new Map([[D(1), 50], [D(2), 50]]));
    expect(r.get("A")!.get(D(1))).toBe(1);
    expect(r.get("A")!.get(D(2))).toBe(2);
    expect(r.get("A")!.has(D(3))).toBe(false);   // нет медианы панели - нет остатка
  });
});

describe("восемь правил", () => {
  it("правило 1: чужая категория не рассматривается вовсе", () => {
    const s = mk({ "GGL-01-1": {}, "GGT-99-1": {} });
    const p = pickFor("GGL-01-1", START, input(s, ["GGL-01-1"]), new Set());
    expect(p.ctl).toBeNull();                       // стол зеркалу не пара
    expect(p.rejected.some((r) => r.art === "GGT-99-1")).toBe(false);  // и в отказы не шумит
    expect(catKey("GGT-03-2-1-E-14080")).toBe("GGT");
  });

  it("правило 2: ближайший обязан быть близким", () => {
    const s = mk({ "GGL-01-1": { views: 100 }, "GGL-09-9": { views: 1000 } });
    const p = pickFor("GGL-01-1", START, input(s, ["GGL-01-1"]), new Set());
    expect(p.ctl).toBeNull();
    expect(p.why).toContain("расходится");
    expect(p.rejected.some((r) => r.rule === 2)).toBe(true);
    // А близкий проходит.
    const s2 = mk({ "GGL-01-1": { views: 100 }, "GGL-09-9": { views: 120 } });
    expect(pickFor("GGL-01-1", START, input(s2, ["GGL-01-1"]), new Set()).ctl).toBe("GGL-09-9");
    expect(MATCH_MAX_DELTA).toBe(0.5);
  });

  it("правило 3: реклама в окне теста дисквалифицирует", () => {
    const s = mk({ "GGL-01-1": {}, "GGL-09-9": { spend: 10 }, "GGL-08-8": {} });
    const p = pickFor("GGL-01-1", START, input(s, ["GGL-01-1"]), new Set());
    expect(p.ctl).toBe("GGL-08-8");
    expect(p.rejected.find((r) => r.art === "GGL-09-9")!.rule).toBe(3);
  });

  it("правило 4: один артикул не контроль дважды", () => {
    const s = mk({ "GGL-01-1": {}, "GGL-02-2": {}, "GGL-09-9": {} });
    const p = pickFor("GGL-01-1", START, input(s, ["GGL-01-1", "GGL-02-2"]), new Set(["GGL-09-9"]));
    expect(p.ctl).toBeNull();
    expect(p.rejected.find((r) => r.art === "GGL-09-9")!.rule).toBe(4);
  });

  it("правило 5: мёртвый контроль не проходит", () => {
    const s = mk({ "GGL-01-1": {}, "GGL-09-9": {} });
    // Обнуляем показы после старта: сдвинуться такой товар не может.
    for (let n = 20; n <= 30; n++) s.get("GGL-09-9")!.get(D(n))!.vsearch = 0;
    const p = pickFor("GGL-01-1", START, input(s, ["GGL-01-1"]), new Set());
    expect(p.ctl).toBeNull();
    expect(p.rejected.find((r) => r.art === "GGL-09-9")!.why).toContain("нет показов после старта");
  });

  it("правило 6: брат по КАРТОЧКЕ не контроль, даже если идеально похож", () => {
    // Ровно та ошибка, из-за которой 8 пар из 21 получили контролем родню.
    const cards = withCards([["GGL-01-1", "c1"], ["GGL-01-2", "c1"]]);
    const s = mk({ "GGL-01-1": {}, "GGL-01-2": {} });
    const p = pickFor("GGL-01-1", START, input(s, ["GGL-01-1"], { cards }), new Set());
    expect(p.ctl).toBeNull();
    expect(p.rejected.find((r) => r.art === "GGL-01-2")!.rule).toBe(6);
  });

  it("правило 7: родня тестового товара ДРУГОГО теста тоже не контроль", () => {
    // GGL-02-2 тестовый в другом тесте, GGL-02-9 с ним на одной карточке.
    const cards = withCards([["GGL-02-2", "c2"], ["GGL-02-9", "c2"]]);
    const s = mk({ "GGL-01-1": {}, "GGL-02-2": {}, "GGL-02-9": {} });
    const p = pickFor("GGL-01-1", START, input(s, ["GGL-01-1", "GGL-02-2"], { cards }), new Set());
    expect(p.ctl).toBeNull();
    expect(p.rejected.find((r) => r.art === "GGL-02-9")!.rule).toBe(7);
  });

  it("без карты карточек правила 6 и 7 молчат, а не отсекают всех подряд", () => {
    // Пустой ключ это «карточка неизвестна». Если считать его общим, роднёй окажутся
    // все кандидаты разом и подбор молча вернёт пусто по каждому тесту.
    const s = mk({ "GGL-01-1": {}, "GGL-01-2": {} });
    const p = pickFor("GGL-01-1", START, input(s, ["GGL-01-1"]), new Set());
    expect(p.ctl).toBe("GGL-01-2");
    expect(p.rejected.some((r) => r.rule === 6 || r.rule === 7)).toBe(false);
  });

  it("правило 8: высокая корреляция остатков отсекает скрытую родню", () => {
    // Разные линии, но ряды ходят вместе: родство есть, хоть в артикуле оно и не написано.
    const s = mk({ "GGL-01-1": { coinvBy: (n) => 50 + (n % 7) }, "GGL-09-9": { coinvBy: (n) => 50 + (n % 7) } });
    const p = pickFor("GGL-01-1", START, input(s, ["GGL-01-1"]), new Set());
    expect(p.ctl).toBeNull();
    const r = p.rejected.find((x) => x.art === "GGL-09-9")!;
    expect(r.rule).toBe(8);
    expect(r.why).toContain(String(KIN_CORR));
  });

  it("независимый ряд правилом 8 не отсекается", () => {
    const s = mk({ "GGL-01-1": { coinvBy: (n) => 50 + (n % 7) }, "GGL-09-9": { coinvBy: (n) => 50 + ((n * 13) % 5) } });
    const p = pickFor("GGL-01-1", START, input(s, ["GGL-01-1"]), new Set());
    expect(p.ctl).toBe("GGL-09-9");
  });
});

describe("подбор по всем тестам", () => {
  it("контроль занят одним тестом и недоступен другому", () => {
    const s = mk({ "GGL-01-1": {}, "GGL-02-2": {}, "GGL-09-9": {} });
    const out = pickAll([{ id: "t1", старт: START, тест: ["GGL-01-1"] },
                         { id: "t2", старт: START, тест: ["GGL-02-2"] }],
      input(s, ["GGL-01-1", "GGL-02-2"]));
    expect(out["t1"]![0]!.ctl).toBe("GGL-09-9");
    expect(out["t2"]![0]!.ctl).toBeNull();   // единственный кандидат уже занят
  });

  it("тест без старта или без товаров пропускается, а не падает", () => {
    const s = mk({ "GGL-01-1": {} });
    expect(pickAll([{ id: "t", тест: ["GGL-01-1"] }], input(s, []))).toEqual({});
    expect(pickAll([{ id: "t", старт: START, тест: [] }], input(s, []))).toEqual({});
  });
});
