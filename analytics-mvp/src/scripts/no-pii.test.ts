import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Репозиторий и Pages публичные: телефоны покупателей из ведомости доставки не должны попадать ни в
// data/, ни на страницы. 29.09 строка ведомости со сдвигом столбцов принесла контакты покупателя в
// «город» блока логистики (55712580-0145-1). Тест ловит такое до коммита.
const PHONE = /\+7[\s(-]*\d{3}|\b\d{3}-\d{3}-\d{2}-\d{2}\b/;

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

describe("персональные данные не публикуются", () => {
  it("в data/, data-ym/ и public/ нет телефонов", () => {
    const hits = [...scan("data", [".json", ".ndjson"]), ...scan("data-ym", [".json", ".ndjson"]), ...scan("public", [".html"])];
    expect(hits).toEqual([]);
  });
});
