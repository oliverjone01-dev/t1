// HTML строк сверки с актом (цвет ячеек) и плашки вверху при выбранном месяце. node rowhtml.js <html> <месяц>
const J = require("/tmp/claude-0/-home-user-t1/bf8da627-8182-59b8-a23c-b2eb02fe1be2/scratchpad/feniks-flow/tools/node_modules/jsdom");
const fs = require("fs");
const [, , htmlPath, month] = process.argv;
const vc = new J.VirtualConsole();
const dom = new J.JSDOM(fs.readFileSync(htmlPath, "utf8"), { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url: "https://example.org/x.html" });
const w = dom.window;
w.rpyInit();
const sel = w.document.getElementById("rp-month");
sel.value = month; w.rpyRender();
for (const tr of w.document.querySelectorAll("#rp-flow tbody tr")) {
  const first = (tr.children[0] && tr.children[0].textContent) || "";
  if (/^Сверка «Списал»|^остаток: мебель|^Перевёл на счёт/.test(first.trim())) {
    console.log("ROW:", first.trim(), "| tr.class=", tr.className, "| style=", tr.getAttribute("style"));
    [...tr.children].slice(1, 10).forEach((td, i) => console.log("   td", i, "class=", td.className, "style=", td.getAttribute("style") || "", "html=", td.innerHTML.slice(0, 120)));
  }
}
const flags = w.document.getElementById("rp-flags").textContent;
console.log("FLAG сверки вверху:", /не сходится с актом/.test(flags), "| слово «акт» в плашках:", (flags.match(/акт[а-я]*/g) || []).slice(0, 5));
setTimeout(() => process.exit(0), 20);
