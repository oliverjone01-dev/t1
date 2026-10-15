// Чтение ndjson по строкам (ФЕНИКС iter10 gap 1, класс N2): строка, которая не разбирается, пропускается и
// записывается в ndBad, а не роняет весь файл в catch читателя (раньше одна битая строка delivery_orders меняла
// «Валовую прибыль» сентября 4 735 507 -> 5 528 249 без пометки). Нет файла - исключение, как у readFileSync:
// читатели ловят его сами. ndBad показывается красной пометкой на страницах и строкой ::error:: в логе сборки.
import { readFileSync } from "node:fs";

export const ndBad: string[] = [];

export function ndLines(p: string): string[] {
  const out: string[] = [];
  readFileSync(p, "utf-8").split("\n").forEach((l, i) => {
    const t = l.trim(); if (!t) return;
    try { JSON.parse(t); out.push(t); } catch { const k = `${p.split("/").pop()}, строка ${i + 1}`; if (!ndBad.includes(k)) ndBad.push(k); }
  });
  return out;
}

// Текст пометки для страницы: пусто - нет пометки.
export const ndBadNote = (): string => ndBad.length ? `Файлы данных повреждены: не разбираются ${ndBad.slice(0, 8).join("; ")}${ndBad.length > 8 ? ` и ещё ${ndBad.length - 8}` : ""}. Эти строки пропущены, цифры страницы неполные - не использовать до пересборки.` : "";
