import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ndLines, ndBad, ndBadNote } from "./nd-lines.js";

describe("ndLines: битая строка не теряет файл (ФЕНИКС iter10 gap 1)", () => {
  it("битая строка пропускается и называется, остальные строки остаются", () => {
    const p = join(mkdtempSync(join(tmpdir(), "nd-")), "ads_daily.ndjson");
    writeFileSync(p, '{"d":"2026-09-01","sp":100}\n{"d":"2026-09-02","sp\n\n{"d":"2026-09-03","sp":50}\n');
    const rows = ndLines(p).map((l) => JSON.parse(l));
    expect(rows.map((r) => r.sp)).toEqual([100, 50]);
    expect(ndBad).toContain("ads_daily.ndjson, строка 2");
    expect(ndBadNote()).toMatch(/ads_daily.ndjson, строка 2/);
  });
  it("нет файла - исключение, как у readFileSync (читатель ловит сам)", () => {
    expect(() => ndLines(join(tmpdir(), "нет-такого-файла.ndjson"))).toThrow();
  });
});
