// Пробы гейта накопительного слоя, зафиксированные как тесты.
//
// Три итерации аудита подряд проверяли одно и то же ВРУЧНУЮ: я гонял пробы из шелла и выбрасывал,
// ФЕНИКС писал свои с нуля. Каждая проверка стоила заново. Здесь они стоят ноль и падают сами,
// если защиту снова ослабят. Гоняем реальный CLI, а не копию его логики: копия логики в тесте -
// это ровно тот дефект, за который аудит снял балл дважды.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DIR = mkdtempSync(join(tmpdir(), "ym-gate-"));
const put = (name: string, rows: any[]) => {
  const p = join(DIR, name);
  writeFileSync(p, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return p;
};
// Код возврата CLI: 0 - аномалий нет, 1 - гейт остановил прогон.
const gate = (cur: string, base: string, args: string[], env: Record<string, string> = {}): number => {
  try {
    execFileSync("npx", ["tsx", "src/scripts/ym/validate-facts.ts", cur, base, ...args],
      { env: { ...process.env, ...env }, stdio: "pipe" });
    return 0;
  } catch (e: any) { return e.status ?? 1; }
};

const rows = Array.from({ length: 400 }, (_, i) => ({
  d: `2026-0${1 + Math.floor(i / 200)}-1${i % 9}`,
  business: i % 5 === 0 ? "1023124" : "74986385",
  amount: 100,
}));
const BASE = put("base.ndjson", rows);
const KEY = ["--month-key=d", "--sum=amount", "--by=business"];

describe("гейт накопительного слоя ловит порчу данных", () => {
  it("потеря половины строк месяца - блок", () => {
    expect(gate(put("loss.ndjson", rows.slice(0, 200)), BASE, KEY)).toBe(1);
  });
  it("ровное задвоение x2 - блок (раньше проходило: порог был «строго больше 100%»)", () => {
    expect(gate(put("dup.ndjson", rows.concat(rows)), BASE, KEY)).toBe(1);
  });
  it("потеря одного кабинета целиком - блок (по месяцу это 9.6%, под порогом)", () => {
    expect(gate(put("biz.ndjson", rows.filter((r) => r.business !== "1023124")), BASE, KEY)).toBe(1);
  });
});

describe("гейт нельзя выключить настройкой", () => {
  const LOSS = put("loss2.ndjson", rows.slice(0, 200));
  const DUP = put("dup2.ndjson", rows.concat(rows));
  it("нечисловой порог роняет прогон, а не печатает «аномалий нет»", () => {
    expect(gate(LOSS, BASE, KEY, { YM_FACTS_DROP_GATE: "abc" })).toBe(1);
  });
  it("порог 1 (снять защиту) роняет прогон", () => {
    expect(gate(LOSS, BASE, KEY, { YM_FACTS_DROP_GATE: "1" })).toBe(1);
  });
  it("порог роста 20 больше не проходит валидацию - это был выключатель детектора задвоения", () => {
    expect(gate(DUP, BASE, KEY, { YM_FACTS_GROW_GATE: "20" })).toBe(1);
  });
});

describe("гейт не кричит зря - иначе его снимут", () => {
  it("неизменённый файл - молчит", () => {
    expect(gate(BASE, BASE, KEY)).toBe(0);
  });
  it("смена ДАТЫ окна у агрегатов - не потеря: сравнивается ведро «агрегат окна», а не месяц", () => {
    // Этот тест раньше пиннил дыру: агрегаты выбрасывались из сравнения, и потому 3916 против 500
    // считалось нормой. Сегодня все 4504 строки sku_views несут aggregate, то есть гейт сравнивал
    // пустоту с пустотой. Правильное поведение: дата окна может меняться, объём - нет.
    const rowsA = (n: number, date: string) => Array.from({ length: n }, () => ({ date, business: "74986385", views: 5, aggregate: true }));
    const old = put("ag_old.ndjson", rowsA(3916, "2026-09-06"));
    const same = put("ag_same.ndjson", rowsA(3916, "2026-10-01"));   // окно переехало, объём тот же
    expect(gate(same, old, ["--month-key=date", "--sum=views", "--by=business"])).toBe(0);
  });
  it("рост текущего (самого свежего) месяца - законный добор, не задвоение", () => {
    const grow = rows.concat(rows.filter((r) => r.d.startsWith("2026-02")));
    expect(gate(put("grow.ndjson", grow), BASE, KEY)).toBe(0);
  });
});

describe("дыры, найденные четвёртым аудитом, закрыты", () => {
  const rowsA = (n: number, date: string) => Array.from({ length: n }, () => ({ date, business: "74986385", views: 5, aggregate: true }));
  it("потеря 90% строк-агрегатов - блок (раньше давала «аномалий нет»: гейт сравнивал пустоту)", () => {
    const old = put("h_ag_old.ndjson", rowsA(4504, "2026-09-06"));
    const loss = put("h_ag_loss.ndjson", rowsA(450, "2026-09-06"));
    expect(gate(loss, old, ["--month-key=date", "--sum=views", "--by=business"])).toBe(1);
  });
  it("задвоение месяца в файле БЕЗ ключа кабинета - блок по сигнатуре «сумма выросла, строк столько же»", () => {
    // Реализация не несёт business, повторный разбор сливается по SKU и не меняет число строк.
    // Законный добор УПД, наоборот, приносит новые SKU и число строк растит - вот разделитель.
    const base = put("h_rz.ndjson", [
      { ym: "2026-02", sku: "A", amount: 600000 }, { ym: "2026-02", sku: "B", amount: 659030 },
      { ym: "2026-03", sku: "C", amount: 100000 },
    ]);
    const dup = put("h_rz_dup.ndjson", [
      { ym: "2026-02", sku: "A", amount: 1200000 }, { ym: "2026-02", sku: "B", amount: 1318060 },
      { ym: "2026-03", sku: "C", amount: 100000 },
    ]);
    expect(gate(dup, base, ["--month-key=ym", "--sum=amount"])).toBe(1);
    // а законный добор новых SKU в тот же месяц - не блок
    const add = put("h_rz_add.ndjson", [
      { ym: "2026-02", sku: "A", amount: 600000 }, { ym: "2026-02", sku: "B", amount: 659030 },
      { ym: "2026-02", sku: "D", amount: 500000 }, { ym: "2026-03", sku: "C", amount: 100000 },
    ]);
    expect(gate(add, base, ["--month-key=ym", "--sum=amount"])).toBe(0);
  });
  it("порог роста 2 больше не разрешён - при нём ровное удвоение проходило под порогом", () => {
    expect(gate(put("h_dup.ndjson", rows.concat(rows)), BASE, KEY, { YM_FACTS_GROW_GATE: "2" })).toBe(1);
  });
});

// Знаковый реестр. Живой случай 2026-09-16: гейт остановил прогон на 1023124/2026-09 с
// «сумма была 387 595, стала 309 953», при этом про строки не сказал ни слова - то есть не
// потерялось ничего. В netting.ndjson начисления плюс, списания минус, месячная сумма - сальдо
// (387 595 ₽ при обороте 3 002 575 ₽). Добор одного дня со списаниями роняет сальдо на величину
// больше порога, ничего при этом не теряя. Режим --abs сравнивает оборот, и он строго СИЛЬНЕЕ:
// потеря строк всегда уменьшает оборот, задвоение всегда его растит.
describe("знаковый реестр: сравнивать надо оборот, а не сальдо", () => {
  // Сальдо 100 при обороте 2100: 20 начислений по +100 и 20 списаний по -95.
  const ledger = (n: number, plus: number, minus: number) => [
    ...Array.from({ length: n }, (_, i) => ({ d: `2026-09-0${1 + (i % 9)}`, business: "1023124", amount: plus })),
    ...Array.from({ length: n }, (_, i) => ({ d: `2026-09-0${1 + (i % 9)}`, business: "1023124", amount: -minus })),
  ];
  const LEDGER = put("ledger-base.ndjson", ledger(20, 100, 95));

  it("добор дня со списаниями роняет сальдо на 60%, но ни одной строки не теряет", () => {
    // Те же 40 строк плюс 4 новых списания: строк стало БОЛЬШЕ, оборот вырос, сальдо упало.
    const cur = put("ledger-day.ndjson", [...ledger(20, 100, 95),
      ...Array.from({ length: 4 }, () => ({ d: "2026-09-15", business: "1023124", amount: -15 }))]);
    expect(gate(cur, LEDGER, KEY), "по сальдо гейт ругается на добор - это и был живой false positive").toBe(1);
    expect(gate(cur, LEDGER, [...KEY, "--abs"]), "по обороту добор проходит").toBe(0);
  });

  it("--abs НЕ пропускает настоящую потерю строк", () => {
    const cur = put("ledger-loss.ndjson", ledger(20, 100, 95).slice(0, 20));
    expect(gate(cur, LEDGER, [...KEY, "--abs"])).toBe(1);
  });

  it("--abs НЕ пропускает задвоение закрытого месяца", () => {
    // Задвоение проверяем на ЗАКРЫТОМ месяце: самому свежему расти разрешено, и это правильно -
    // он ещё дополняется. Поэтому кладём хвост в октябре, чтобы сентябрь перестал быть свежим.
    const tail = [{ d: "2026-10-01", business: "1023124", amount: 10 }];
    const base = put("ledger-dup-base.ndjson", [...ledger(20, 100, 95), ...tail]);
    const cur = put("ledger-dup.ndjson", [...ledger(20, 100, 95), ...ledger(20, 100, 95), ...tail]);
    expect(gate(cur, base, [...KEY, "--abs"])).toBe(1);
  });

  it("--abs ловит потерю, которую сальдо маскирует: выбросили начисления и списания поровну", () => {
    // Сальдо почти не меняется (100 -> 50), а половина строк исчезла.
    const cur = put("ledger-masked.ndjson", ledger(10, 100, 95));
    expect(gate(cur, LEDGER, [...KEY, "--abs"])).toBe(1);
  });
});
