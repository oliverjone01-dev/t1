// Рендер вкладки «Отчет» Маркета в jsdom: по каждому месяцу селектора снимаю блок 3а, строки блока 3
// «Начислил Маркет» / «К выплате Маркета», плашки и выгрузку Excel (перехват rpxZip).
// node render.js <katya-report.html> <out.json> [месяцы через запятую]
const J = require("/tmp/claude-0/-home-user-t1/bf8da627-8182-59b8-a23c-b2eb02fe1be2/scratchpad/feniks-flow/tools/node_modules/jsdom");
const fs = require("fs");
const [, , htmlPath, outPath, onlyMonths] = process.argv;
const html = fs.readFileSync(htmlPath, "utf8");
const errors = [];
const vc = new J.VirtualConsole();
vc.on("jsdomError", (e) => errors.push(String((e && e.message) || e)));
const dom = new J.JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url: "https://example.org/market/katya-report.html" });
const w = dom.window;
// jsdom не реализует innerText - выгрузка Excel читает его; подставляю textContent.
Object.defineProperty(w.HTMLElement.prototype, "innerText", { get() { return this.textContent; }, set(v) { this.textContent = v; } });
const txt = (el) => (el ? (el.textContent || "").replace(/\s+/g, " ").trim() : null);
function table(id) {
  const t = w.document.getElementById(id);
  if (!t) return null;
  const head = [...t.querySelectorAll("thead th")].map(txt);
  const rows = [...t.querySelectorAll("tbody tr")].map((tr) => ({ cls: tr.className || "", style: tr.getAttribute("style") || "", title: tr.children[0] ? (tr.children[0].getAttribute("title") || "") : "", cells: [...tr.children].map(txt) }));
  return { head, rows };
}
const out = { errors, months: {} };
try { if (typeof w.rpyInit === "function") w.rpyInit(); } catch (e) { errors.push("rpyInit: " + e.message); }
const sel = w.document.getElementById("rp-month");
const months = [...sel.options].map((o) => o.value);
out.options = months;
const want = onlyMonths ? onlyMonths.split(",") : months;
let captured = null;
w.rpxZip = function (files) { captured = files; return new w.Blob(["x"]); };
w.URL.createObjectURL = () => "blob:x";
w.URL.revokeObjectURL = () => {};
for (const m of want) {
  sel.value = m;
  const rec = {};
  try { w.rpyRender(); } catch (e) { rec.renderError = e.message; }
  rec.sub = txt(w.document.getElementById("rp-sub"));
  rec.flags = txt(w.document.getElementById("rp-flags"));
  rec.flow = table("rp-flow");
  const cost = table("rp-cost");
  rec.cost = cost ? { head: cost.head, rows: cost.rows.filter((r) => /Начислил Маркет|К выплате Маркета|Всего сборов|удержания без заказа|премия/i.test(r.cells[0] || "")) } : null;
  captured = null;
  try { w.rpyExport(); } catch (e) { rec.exportError = e.message + " | " + String(e.stack || "").split("\n").slice(0, 3).join(" / "); }
  if (captured) {
    rec.xlsxFiles = captured.map((f) => f[0]);
    const sheet = captured.find((f) => /sheet1\.xml$/.test(f[0]));
    rec.xlsxSheet = sheet ? sheet[1] : null;
  }
  out.months[m] = rec;
}
fs.writeFileSync(outPath, JSON.stringify(out));
console.log("months", want.length, "errors", errors.length, errors.slice(0, 5));
setTimeout(() => process.exit(0), 50);
