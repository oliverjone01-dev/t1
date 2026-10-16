// ФЕНИКС iter5 (381f11d5). Рендер блока «План» в jsdom на парах <dataDir>:<today> (planBlock дерева + клиентский скрипт страницы).
// Поля iter4 (render8.mts) сохранены, чтобы g1_summary.py iter4 читал вывод без правок: центр, l1, l2, l3, угол стрелки и метки
// в % шкалы, zone - дуга, внутри которой стрелка, с допуском 0,8 (как в iter4). Новое (строгая проба):
//   zone_exact - цвет нарисованной дуги ненулевой длины, внутри которой стрелка, без допуска ("gap" - между дугами);
//   near - цвет ближайшей нарисованной дуги и расстояние; zero - число дуг нулевой длины; arcs - все дуги [от, до, цвет];
//   data_zone / data_st - атрибуты, которые проверяет тест автора.
// npx tsx render9.mts <tree analytics-mvp> <out.jsonl> <dataDir>:<today> [...]
import { join } from "node:path";
import { appendFileSync, writeFileSync } from "node:fs";
const NM = "/home/user/t1-wt/analytics-mvp/node_modules/";
const { JSDOM, VirtualConsole } = await import(NM + "jsdom/lib/api.js");
const [tree, out, ...pairs] = process.argv.slice(2) as [string, string, ...string[]];
const { planBlock } = await import(join(tree, "src/scripts/plan-tab.ts"));
const COL: Record<string, string> = { "#34d399": "зелёный", "#e5b567": "жёлтый", "#ff7a7e": "красный", "#8b9eae": "серый", "#3a4654": "нет" };
const cx = 120, cy = 112, MAX = 150;
const pctOf = (x: number, y: number) => (1 - Math.atan2(cy - y, x - cx) / Math.PI) * MAX;
writeFileSync(out, "");
for (const pr of pairs) {
  const k = pr.lastIndexOf(":"); const dir = pr.slice(0, k), today = pr.slice(k + 1);
  const b = planBlock(today, (f: string) => join(dir, f));
  if (!b) { console.log(pr, "блока нет"); continue; }
  const page = `<!doctype html><html><head><style>${b.css}</style></head><body>${b.html}<script>${b.js}</script></body></html>`;
  const errs: string[] = []; const vc = new VirtualConsole();
  vc.on("jsdomError", (e: Error) => errs.push(e.message)); vc.on("error", (e: unknown) => errs.push(String(e)));
  const dom = new JSDOM(page, { runScripts: "dangerously", virtualConsole: vc, pretendToBeVisual: true });
  const doc = dom.window.document; const t = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  const PD = (dom.window as any).PD;
  const ids = ["pt-gauges", ...PD.cards.map((_: unknown, i: number) => `pt-mc${i}`), "pt-mcS", "pt-cardsel", "pt-metsel", "pt-dynchart", "pt-dyntbl", "pt-stU", "pt-stT", "pt-pills", "pt-pricepills"];
  const empty = ids.filter((id) => (doc.getElementById(id)?.innerHTML.length ?? -1) <= 0);
  const gauges = [...doc.querySelectorAll("#pt-gauges .gauge")].map((g) => {
    const zones = [...g.querySelectorAll('path[stroke-width="16"]')].map((p) => {
      const m = (p.getAttribute("d") ?? "").match(/M([\d.e-]+) ([\d.e-]+) A[\d.]+ [\d.]+ 0 0 1 ([\d.e-]+) ([\d.e-]+)/)!;
      return { a: pctOf(+m[1], +m[2]), b: pctOf(+m[3], +m[4]), col: COL[(p.getAttribute("stroke") ?? "").toLowerCase()] ?? p.getAttribute("stroke") };
    });
    const lines = [...g.querySelectorAll("line")];
    const needle = lines.find((l) => l.getAttribute("stroke-width") === "3.5"), mark = lines.find((l) => l.getAttribute("stroke-width") === "2.5");
    const np = needle ? pctOf(+needle.getAttribute("x2")!, +needle.getAttribute("y2")!) : null;
    const mp = mark ? pctOf((+mark.getAttribute("x1")! + +mark.getAttribute("x2")!) / 2, (+mark.getAttribute("y1")! + +mark.getAttribute("y2")!) / 2) : null;
    const z = np == null ? null : zones.find((zz) => np >= Math.min(zz.a, zz.b) - 0.8 && np <= Math.max(zz.a, zz.b) + 0.8) ?? null;   // iter4: с допуском 0,8
    const vis = zones.filter((zz) => zz.b - zz.a > 1e-6);
    const ze = np == null ? null : vis.find((zz) => np >= zz.a && np <= zz.b) ?? null;                                                // iter5: без допуска
    const near = np == null ? null : vis.map((zz) => ({ col: zz.col, d: Math.min(Math.abs(np - zz.a), Math.abs(np - zz.b)) })).sort((x, y) => x.d - y.d)[0] ?? null;
    const span = g.querySelector(".g-l2 span"); const stc = span ? COL[((span as any).style.color ? rgb2hex((span as any).style.color) : "")] ?? (span as any).style.color : null;
    const l2s = [...g.querySelectorAll(".g-l2")];
    const el = g as any;
    return { title: t(g.querySelector(".g-t")), v: t(g.querySelector(".gv")), l1: t(g.querySelector(".g-l1")), l2: t(l2s[0]), l3: l2s[1] ? t(l2s[1]) : "",
      needle: np == null ? null : Math.round(np * 10) / 10, mark: mp == null ? null : Math.round(mp * 10) / 10, zone: z ? z.col : null, status: span ? t(span) : null, status_col: stc,
      zone_exact: np == null ? null : ze ? ze.col : "gap", near: near ? [near.col, Math.round(near.d * 100) / 100] : null, zero: zones.length - vis.length,
      arcs: zones.map((zz) => [Math.round(zz.a * 100) / 100, Math.round(zz.b * 100) / 100, zz.col]),
      data_zone: COL[(el.dataset?.zone ?? "").toLowerCase()] ?? el.dataset?.zone ?? null, data_st: COL[(el.dataset?.st ?? "").toLowerCase()] ?? el.dataset?.st ?? null };
  });
  const t1 = [...doc.querySelectorAll("#pt-plan table")][0]!;
  const rows = [...t1.querySelectorAll("tr.crow")].map((r) => { const td = [...r.querySelectorAll("td")]; return { n: t(td[0]).replace("▸ ", ""), st: t(td[6]) }; });
  const cardRows = rows.filter((r) => !r.n.startsWith("Весь магазин"));
  const g2 = gauges[1]!; const m = g2.l1.match(/^(\d+) из 10/);
  const how = [...doc.querySelectorAll("li")].map((li) => t(li)).find((s) => s.startsWith("Спидометры")) ?? "";
  const rec = { dir: dir.split("/").slice(-1)[0], today, errs, empty, gauges, t1_go: cardRows.filter((r) => r.st === "идём").length, t1_early: cardRows.filter((r) => r.st === "рано").length,
    gauge_on: m ? Number(m[1]) : null, n_in: PD.n_in, G: PD.gauges, how };
  appendFileSync(out, JSON.stringify(rec) + "\n");
  console.log(`[${rec.dir} ${today}] ошибок ${errs.length}${errs.length ? " " + errs[0] : ""} | пустых ${empty.length} из ${ids.length} | n_in ${PD.n_in}`);
  for (const g of gauges) console.log(`   ${g.title}: ${g.v} | ${g.l1} | ${g.status} (${g.status_col}) | стрелка ${g.needle} метка ${g.mark} | зона iter4 ${g.zone} / строго ${g.zone_exact}${g.zone_exact === "gap" ? " ближе " + g.near : ""} | нулевых дуг ${g.zero} | data-zone ${g.data_zone} data-st ${g.data_st}`);
}
function rgb2hex(s: string): string {
  const m = s.match(/rgb\((\d+), ?(\d+), ?(\d+)\)/); if (!m) return s.toLowerCase();
  return "#" + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("");
}
