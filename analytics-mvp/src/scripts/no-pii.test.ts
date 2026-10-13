import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Репозиторий и Pages публичные: телефоны покупателей из ведомости доставки не должны попадать ни в
// data/, ни на страницы. 29.09 строка ведомости со сдвигом столбцов принесла контакты покупателя в
// «город» блока логистики (55712580-0145-1). Тест ловит такое до коммита.
// Номер целиком (+7 и 10 цифр с любыми разделителями), а не «+7» и три цифры: иначе денежный сдвиг
// «+7 740 ₽» на странице «Тесты» читается как телефон (12.10).
const PHONE = /\+7[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}\b|\b\d{3}-\d{3}-\d{2}-\d{2}\b/;

function scan(dir: string, exts: string[]): string[] {
  if (!existsSync(dir)) return [];
  const hits: string[] = [];
  for (const f of readdirSync(dir)) {
    if (!exts.some((e) => f.endsWith(e))) continue;
    const m = readFileSync(join(dir, f), "utf-8").match(PHONE);
    if (m) hits.push(`${dir}/${f}`);
  }
  return hits;
}

describe("шаблон телефона", () => {
  it("ловит номера в разной записи", () => {
    for (const t of ["+7 (916) 123-45-67", "+79161234567", "+7 916 123 45 67", "+7-916-123-45-67", "916-123-45-67"]) expect(t).toMatch(PHONE);
  });
  it("не ловит денежные суммы и сдвиги", () => {
    for (const t of ["+7 740 ₽", "+7 740 ₽ к контролю", "+72 732 ₽", "+7,4 п.", "+7 740 ₽ и +2 732 ₽ с заказа"]) expect(t).not.toMatch(PHONE);
  });
});

describe("персональные данные не публикуются", () => {
  it("в data/, data-ym/ и public/ нет телефонов", () => {
    const hits = [...scan("data", [".json", ".ndjson"]), ...scan("data-ym", [".json", ".ndjson"]), ...scan("public", [".html"])];
    expect(hits).toEqual([]);
  });
});
