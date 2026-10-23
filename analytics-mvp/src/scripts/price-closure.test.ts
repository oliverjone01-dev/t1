import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";

describe("закрытый тест 4 на собранной странице", () => {
  let card: any;
  beforeAll(() => {
    const out = mkdtempSync(join(tmpdir(), "ozon-price-close-"));
    execFileSync(process.execPath, ["--import", "tsx", "src/scripts/build-tests.ts"], {
      env: { ...process.env, OUT_DIR: out }, timeout: 120_000, stdio: "pipe",
    });
    card = new JSDOM(readFileSync(join(out, "katya-tests.html"), "utf8")).window.document.querySelector("#price_cut_hold");
  }, 120_000);
  it("статус закрытия отделён от научного вердикта", () => {
    expect(card.querySelector(".chead .chip").textContent).toBe("завершён");
    expect(card.querySelector(".verdict-h").textContent).toBe("Итог, тест закрыт");
    expect(card.querySelector(".verdict-main").textContent).toContain("3 из 10");
    expect(card.querySelector(".verdict-main").textContent).toContain("минимум 5");
    expect(card.querySelector(".verdict-main").textContent).toContain("не подтверждена и не опровергнута");
  });
  it("нет активного продления и напоминания менять цены у закрытого теста", () => {
    expect(card.querySelector(".meta").textContent).toContain("2026-10-23");
    expect(card.querySelector(".meta").textContent).not.toContain("Продление:");
    expect(card.querySelector(".remind")).toBeNull();
    expect(card.querySelector(".chead").textContent).not.toContain("через");
  });
  it("живые наблюдения явно отделены от зафиксированного итога", () => {
    expect(card.textContent).toContain("Справочно, текущие наблюдения");
    expect(card.textContent).toContain("Итог выше зафиксирован при закрытии");
  });
});
