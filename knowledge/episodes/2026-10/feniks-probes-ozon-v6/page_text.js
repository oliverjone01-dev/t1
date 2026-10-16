// ФЕНИКС 14.10, аудит OZON v6: текст страницы «Отчет» из любого снимка html (сравнение снимков, независимый вход реплики).
// node page_text.js <katya-report.html> <outdir> <месяц...>   -> <outdir>/rp_<месяц>.txt
const path = require('path'), fs = require('fs');
const {chromium} = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const [html, out, ...months] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, {recursive: true});
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve(html)); await p.waitForTimeout(3000);
  for (const m of months) {
    await p.selectOption('#rp-month', m); await p.waitForTimeout(1500);
    fs.writeFileSync(path.join(out, 'rp_' + m + '.txt'), await p.evaluate(() => document.body.innerText));
  }
  await b.close();
})();
