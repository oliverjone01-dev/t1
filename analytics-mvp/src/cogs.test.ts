import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { normSku } from "./cogs.js";

// Кириллические двойники латиницы в кодах артикулов. Живой факт 2026-09-21: в заказах пришёл
// GGTP-20-2х2 с КИРИЛЛИЧЕСКОЙ «х», на листе СС стоит GGTP-20-2x2 с латинской. Прежняя
// нормализация выбрасывала всё, кроме [A-Z0-9], то есть кириллическую букву просто стирала -
// GGTP2022 против GGTP202X2. Артикул числился без себестоимости в сверке, хотя в своде она
// была: одна страница показывала покрытие 100%, другая 99,7%, и объяснить было нечем.
describe("нормализация артикула сводит кириллических двойников с латиницей", () => {
  it("тот самый случай: кириллическая х против латинской x", () => {
    expect(normSku("GGTP-20-2х2")).toBe(normSku("GGTP-20-2x2"));
    // И не схлопывается в огрызок без «x», как было раньше.
    expect(normSku("GGTP-20-2х2")).toBe("GGTP202X2");
  });

  it("остальные двойники тоже сводятся", () => {
    for (const [cyr, lat] of [["А", "A"], ["В", "B"], ["Е", "E"], ["К", "K"], ["М", "M"],
      ["Н", "H"], ["О", "O"], ["Р", "P"], ["С", "C"], ["Т", "T"], ["У", "Y"], ["Х", "X"]]) {
      expect(normSku(`GG${cyr}-1`), `${cyr} не свёлся к ${lat}`).toBe(normSku(`GG${lat}-1`));
    }
  });

  it("разные артикулы остаются разными", () => {
    expect(normSku("GGTP-20-1x2")).not.toBe(normSku("GGTP-20-2x2"));
    expect(normSku("GGT-03-2-4-C-90")).not.toBe(normSku("GGT-03-2-3-C-90"));
    // Похожие, но не двойники: кириллическая «б» латиницы не имеет и обязана выпасть.
    expect(normSku("GGб-1")).toBe("GG1");
  });

  it("регистр, дефисы и пробелы не мешают", () => {
    expect(normSku(" ggtp-20-2X2 ")).toBe("GGTP202X2");
  });

  it("на живом листе СС нет двух артикулов, схлопывающихся в один ключ", () => {
    const p = "fixtures/cogs_ym_sku.csv";
    if (!existsSync(p)) return;
    const seen = new Map<string, string>();
    const dup: string[] = [];
    for (const line of readFileSync(p, "utf-8").split("\n").slice(1)) {
      const offer = (line.split(",")[0] || "").trim();
      if (!offer) continue;
      const k = normSku(offer);
      const prev = seen.get(k);
      // Один и тот же артикул может встретиться дважды - это не коллизия.
      if (prev && prev !== offer) dup.push(`${prev} и ${offer} -> ${k}`);
      else seen.set(k, offer);
    }
    expect(dup, "нормализация склеила РАЗНЫЕ артикулы - это дало бы им чужую себестоимость").toEqual([]);
  });
});
