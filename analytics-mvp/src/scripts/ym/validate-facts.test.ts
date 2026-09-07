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
  it("смена окна у строк-агрегатов - не потеря: окно заменяется целиком", () => {
    const old = put("ag_old.ndjson", Array.from({ length: 3916 }, () => ({ date: "2026-09-06", business: "74986385", views: 5, aggregate: true })));
    const now = put("ag_new.ndjson", Array.from({ length: 500 }, () => ({ date: "2026-10-01", business: "74986385", views: 5, aggregate: true })));
    expect(gate(now, old, ["--month-key=date", "--sum=views", "--by=business"])).toBe(0);
  });
  it("рост текущего (самого свежего) месяца - законный добор, не задвоение", () => {
    const grow = rows.concat(rows.filter((r) => r.d.startsWith("2026-02")));
    expect(gate(put("grow.ndjson", grow), BASE, KEY)).toBe(0);
  });
});
