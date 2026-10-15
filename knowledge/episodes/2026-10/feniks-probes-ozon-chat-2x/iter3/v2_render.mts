// ФЕНИКС iter3, PR #478 @ 528604a. Блок «План» на живых data/ в jsdom: разделы <details>, таблица цен (колонки по датам),
// минимальный клик по плану v2, спидометры. npx tsx v2_render.mts <today> [dataDir]
import { join } from "node:path";
import { JSDOM, VirtualConsole } from "/tmp/claude-0/-home-user-t1/f57f6776-149c-58f9-8707-d73e74e89ad9/scratchpad/dom/node_modules/jsdom/lib/api.js";
const { planBlock, PLAN_FILE } = await import("/home/user/t1/analytics-mvp/src/scripts/plan-tab.ts");
const today = process.argv[2] ?? "2026-10-15", dir = process.argv[3] ?? "/home/user/t1/analytics-mvp/data";
const b = planBlock(today, (f: string) => join(dir, f))!;
const page = `<!doctype html><html><head><style>${b.css}</style></head><body>${b.html}<script>${b.js}</script></body></html>`;
const errs: string[] = []; const vc = new VirtualConsole(); vc.on("jsdomError", (e: Error) => errs.push(e.message));
const dom = new JSDOM(page, { runScripts: "dangerously", virtualConsole: vc, pretendToBeVisual: true });
const doc = dom.window.document; const t = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const root = doc.querySelector("#pt-plan")!;
console.log("PLAN_FILE", PLAN_FILE, "| jsdom ошибок", errs.length, errs.slice(0, 2), "| em dash", (page.match(/—/g) ?? []).length, "| warnings", b.warnings.length, b.warnings.slice(0, 2));
console.log("разделы:", [...root.querySelectorAll("details.pt-sec")].map((d) => `${t(d.querySelector("summary"))}${(d as any).open ? " [open]" : ""}`).join(" | "));
console.log("графики в свёрнутых разделах отрисованы:", ["pt-stU", "pt-stT", "pt-pills", "pt-pricepills", "pt-dynchart"].map((id) => `${id}=${(doc.getElementById(id)?.innerHTML.length ?? 0)}`).join(" "));
const tabs = [...root.querySelectorAll("table")]; const pt = tabs[tabs.length - 1]!;
console.log("цена, шапка:", [...pt.querySelectorAll("thead th")].map((th) => t(th) + (th.getAttribute("title") ? `(${th.getAttribute("title")})` : "")).join(" | "));
const rows = [...pt.querySelectorAll("tbody tr")];
console.log("цена, строк:", rows.length, "| статусы:", JSON.stringify(rows.reduce((a: Record<string, number>, r) => { const s = t(r.querySelector(".chip")); a[s] = (a[s] ?? 0) + 1; return a; }, {})));
const tr = rows.find((r) => /GGT-03-3-3-E-16080/.test(t(r))); console.log("TRUBIS 160:", tr ? t(tr) : "нет");
console.log("пилюли цены:", t(root.querySelector("#pt-pricepills")).slice(0, 300));
const ads = tabs.find((x) => /План, ₽\/нед/.test(t(x.querySelector("thead"))))!;
console.log("минимальный клик:", [...ads.querySelectorAll("tbody tr")].map(t).filter((s, i, a) => { const g = a.findIndex((x) => /Минимальный клик/.test(x)); const e = a.findIndex((x) => /11 кампаний/.test(x)); return i > g && i < e; }).join(" || "));
root.querySelectorAll("#pt-gauges .gauge").forEach((g) => console.log("  спидометр:", t(g.querySelector(".g-t")), "|", t(g.querySelector(".gv")), "|", t(g.querySelector(".g-l1"))));
root.querySelectorAll(".pt-notes li").forEach((li) => { const s = t(li); if (/Данные:/.test(s)) console.log("  *", s); });
