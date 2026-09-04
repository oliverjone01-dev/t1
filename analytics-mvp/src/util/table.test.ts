import { describe, it, expect } from "vitest";
import { toTable, findCol, cellNum, cellDate, detectDelimiter } from "./table.js";
import { unzip, isZip } from "./zip.js";
import { deflateRawSync } from "node:zlib";

describe("table", () => {
  it("детект разделителя и заголовок после служебных строк", () => {
    const t = toTable("﻿Отчёт сформирован 01.09.2026\n\nВаш SKU;Название товара;Продано, шт;Возвращено, шт\nGGM-01;\"Зеркало; большое\";3;1\nGGT-02;Стол;\"1 200\";0\n");
    expect(t.delimiter).toBe(";");
    expect(t.headers).toEqual(["Ваш SKU", "Название товара", "Продано, шт", "Возвращено, шт"]);
    expect(t.rows.length).toBe(2);
    expect(t.rows[0]![1]).toBe("Зеркало; большое");
    expect(cellNum(t.rows[1]![2])).toBe(1200);
    expect(findCol(t.headers, ["^Ваш SKU$"])).toBe(0);
    expect(findCol(t.headers, ["Возвращ"])).toBe(3);
    expect(findCol(t.headers, ["нет такой"])).toBe(-1);
  });
  it("числа и даты отчётов", () => {
    expect(cellNum("1 234,56")).toBeCloseTo(1234.56);
    expect(cellNum("−12")).toBe(-12);
    expect(cellNum("")).toBe(0);
    expect(cellDate("05.08.2026")).toBe("2026-08-05");
    expect(cellDate("2026-08-05T00:00:00")).toBe("2026-08-05");
    expect(cellDate("не дата")).toBe("");
    expect(detectDelimiter("a,b,c")).toBe(",");
  });
});

// Минимальный zip: одна deflate-запись, собранный вручную (local header + central dir + EOCD).
function makeZip(name: string, content: Buffer): Buffer {
  const comp = deflateRawSync(content);
  const n = Buffer.from(name, "utf-8");
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(8, 8);
  lh.writeUInt32LE(0, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(content.length, 22); lh.writeUInt16LE(n.length, 26); lh.writeUInt16LE(0, 28);
  const local = Buffer.concat([lh, n, comp]);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(8, 10); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(content.length, 24);
  cd.writeUInt16LE(n.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32); cd.writeUInt32LE(0, 42);
  const central = Buffer.concat([cd, n]);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12); eocd.writeUInt32LE(local.length, 16);
  return Buffer.concat([local, central, eocd]);
}

describe("zip", () => {
  it("распаковка deflate-записи", () => {
    const z = makeZip("report.csv", Buffer.from("a;b\n1;2\n", "utf-8"));
    expect(isZip(z)).toBe(true);
    const e = unzip(z);
    expect(e.length).toBe(1); expect(e[0]!.name).toBe("report.csv"); expect(e[0]!.data.toString()).toBe("a;b\n1;2\n");
  });
});
