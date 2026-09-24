/* Снимки экранов для глаз: обе темы на 1440 и 390, меню на телефоне.
   Запуск: node tools/shots.mjs [каталог]   (библиотеки как у smoke.mjs) */
import { chromium } from 'playwright';
import fs from 'fs';
const LIBS = process.env.KONTUR_LIBS || '/tmp/claude-0';
const OUT  = process.argv[2] || (process.env.KONTUR_TMP || '/tmp/claude-0') + '/shots';
const CHROME = process.env.KONTUR_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
fs.mkdirSync(OUT, { recursive:true });
const page = OUT + '/page.html';
fs.writeFileSync(page, fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8')
  .replace(/<script src="https:\/\/cdnjs[^"]+"[^>]*><\/script>/, '<script src="file://' + LIBS + '/apex.js"></script>'));
const b = await chromium.launch(CHROME ? { executablePath:CHROME } : {});
const shots = [[1440,'light','gg','obzor'],[1440,'dark','gg','obzor'],[1440,'light','gg','mn-bridge'],
               [1440,'dark','gm','org-pg'],[390,'light','gg','obzor'],[390,'dark','gg','dyn-sum']];
for (const [w, t, p, v] of shots) {
  const pg = await b.newPage({ viewport:{ width:w, height:w > 500 ? 1000 : 844 }, deviceScaleFactor:w > 500 ? 1 : 2 });
  await pg.goto('file://' + page + '#' + p + '.' + v + '.30d'); await pg.waitForTimeout(900);
  await pg.evaluate(x => document.documentElement.setAttribute('data-theme', x), t); await pg.waitForTimeout(1300);
  await pg.screenshot({ path:`${OUT}/${w}-${t}-${p}-${v}.png` }); await pg.close();
}
const pg = await b.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
await pg.goto('file://' + page + '#gg.obzor.30d'); await pg.waitForTimeout(900);
await pg.click('#menu'); await pg.waitForTimeout(600);
await pg.screenshot({ path:`${OUT}/390-menu.png` });
await b.close(); console.log('снято в ' + OUT);
