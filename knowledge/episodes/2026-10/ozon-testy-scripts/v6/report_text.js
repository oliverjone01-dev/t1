// v6: снимает текст страницы «Отчет» OZON (analytics-mvp/public/katya-report.html) за выбранные месяцы.
// Запуск: OUT=/tmp/ozon-v6 node report_text.js 2026-09 2026-08 ... -> $OUT/rp_<месяц>.txt
// Числа «Отчета» берём со страницы, а не считаем заново: прогноз опирается на ту же аналитику, что видит Иван.
const path = require('path'), fs = require('fs');
const {chromium} = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const ROOT = __dirname.split('knowledge/')[0];
const OUT = process.env.OUT || '/tmp/ozon-v6';
(async () => {
  fs.mkdirSync(OUT, {recursive: true});
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.join(ROOT, 'analytics-mvp/public/katya-report.html')); await p.waitForTimeout(3000);
  for (const m of process.argv.slice(2)) {
    await p.selectOption('#rp-month', m); await p.waitForTimeout(1500);
    fs.writeFileSync(path.join(OUT, 'rp_' + m + '.txt'), await p.evaluate(() => document.body.innerText));
  }
  await b.close();
})();
