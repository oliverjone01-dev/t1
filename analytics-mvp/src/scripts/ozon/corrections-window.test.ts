import { describe, it, expect } from "vitest";
import { replaceCorrections } from "./attribution-report.js";
const old = {from:"2026-09-01",to:"2026-10-20",values:{sp:-25}};
const fresh = {from:"2026-10-16",to:"2026-10-22",values:{sp:-5}};
describe("корректировки заменяются только при полном покрытии старого отчётного окна", () => {
  it("пустой fresh-отчёт не стирает историю и частично перекрывающийся старый отчёт", () => {
    expect(replaceCorrections([old], [], [[fresh.from,fresh.to]])).toEqual([old]);
  });
  it("успех свежих и исторических окон заменяет прежний полный отчёт", () => {
    expect(replaceCorrections([old], [fresh], [["2026-09-01","2026-10-15"],[fresh.from,fresh.to]])).toEqual([fresh]);
  });
  it("разрыв в покрытии сохраняет прежнюю недатированную корректировку", () => {
    expect(replaceCorrections([old], [], [["2026-09-01","2026-10-14"],[fresh.from,fresh.to]])).toEqual([old]);
  });
  it("повтор принятого диапазона идемпотентен и может снять исчезнувшую корректировку", () => {
    expect(replaceCorrections([old,fresh], [fresh], [[fresh.from,fresh.to]])).toEqual([old,fresh]);
    expect(replaceCorrections([old,fresh], [], [[fresh.from,fresh.to]])).toEqual([old]);
  });
  it("новая metadata вне принятого диапазона отклоняется", () => {
    expect(()=>replaceCorrections([old],[fresh],[["2026-10-17","2026-10-22"]])).toThrow("вне принятых");
  });
});
