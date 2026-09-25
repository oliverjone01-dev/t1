/* Сканер текста экранов: рисует все экраны обоих проектов и проверяет то, что видит
   человек, а не исходники. Сейчас ловит одно: число и слово после него не согласованы
   («147 заявки», «5 602 визитов»). Исходник врёт: слово может приехать из данных.
   Запуск: node tools/text_scan.mjs [файл-дамп]   (библиотеки как у smoke.mjs)
   Дамп всего текста пишется в KONTUR_TMP/screens.txt, его удобно грепать. */
import { chromium } from 'playwright';
import fs from 'fs';
const LIBS = process.env.KONTUR_LIBS || '/tmp/claude-0';
const OUT  = process.env.KONTUR_TMP  || '/tmp/claude-0';
const CHROME = process.env.KONTUR_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
fs.mkdirSync(OUT, { recursive:true });
fs.writeFileSync(OUT + '/scan.html', fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8')
  .replace(/<script src="https:\/\/cdnjs[^"]+"[^>]*><\/script>/, '<script src="file://' + LIBS + '/apex.js"></script>')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts[^"]+">/, ''));

/* Три формы: одна, две-четыре, пять и больше (они же родительный множественного).
   Родительный единственного после «из», «до», «от» совпадает со второй формой. */
const NOUNS = [
  ['заявка','заявки','заявок'], ['визит','визита','визитов'], ['день','дня','дней'], ['точка','точки','точек'],
  ['запрос','запроса','запросов'], ['страница','страницы','страниц'], ['кластер','кластера','кластеров'],
  ['тема','темы','тем'], ['кампания','кампании','кампаний'], ['объявление','объявления','объявлений'],
  ['клик','клика','кликов'], ['ответ','ответа','ответов'], ['вопрос','вопроса','вопросов'],
  ['решение','решения','решений'], ['проверка','проверки','проверок'], ['единица','единицы','единиц'],
  ['система','системы','систем'], ['промпт','промпта','промптов'], ['домен','домена','доменов'],
  ['донор','донора','доноров'], ['ссылка','ссылки','ссылок'], ['цель','цели','целей'],
  ['неделя','недели','недель'], ['звено','звена','звеньев'], ['слово','слова','слов'], ['экран','экрана','экранов'],
  ['посадочная','посадочные','посадочных'], ['месяц','месяца','месяцев'], ['сделка','сделки','сделок'],
  ['показ','показа','показов'], ['конкурент','конкурента','конкурентов'], ['задание','задания','заданий'],
  ['публикация','публикации','публикаций'], ['съём','съёма','съёмов'], ['волна','волны','волн'],
];
const GEN = /(?:^|[\s(«])(из|до|от|около|более|менее|больше|меньше|свыше|без|кроме|для)\s+$/i;
const form = (n, i) => { const m = n % 100, d = n % 10; return (m >= 11 && m <= 14) ? 2 : d === 1 ? 0 : (d >= 2 && d <= 4) ? 1 : 2; };

const b = await chromium.launch(CHROME ? { executablePath:CHROME } : {});
const p = await b.newPage({ viewport:{ width:1280, height:900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + OUT + '/scan.html', { waitUntil:'load', timeout:60000 });
await p.waitForTimeout(800);
const views = await p.evaluate(() => Object.keys(screens()));
let dump = '', bad = [];
for (const proj of ['gm', 'gg']) for (const v of views) {
  const t = await p.evaluate(([pr, x]) => { CUR = pr; go(x); return document.getElementById('view').innerText; }, [proj, v]);
  dump += `\n===== ${proj}/${v} =====\n${t}\n`;
  // число и слово в одной строке одной ячейки: перенос и табуляция это граница блока
  const re = /(\d{1,3}(?:[ \u00a0\u202f]\d{3})*|\d+)(?![,.]\d)[ \u00a0]+([а-яё]+)/gi;
  let m;
  while ((m = re.exec(t))) {
    const n = +m[1].replace(/\D/g, ''), w = m[2].toLowerCase();
    const row = NOUNS.find(r => r.includes(w)); if (!row) continue;
    const prev = t.slice(Math.max(0, m.index - 12), m.index);
    if (/[,.]\d*$|\d[.,]$|[:/]$/.test(prev)) continue;                  // 4,78 и время
    const gen = GEN.test(prev);
    const want = gen ? row[form(n) === 0 ? 1 : 2] : row[form(n)];
    // после «из/до/от» годятся и родительный, и форма числа («из 41 точки»)
    if (w !== want && !(gen && w === row[form(n)])) {
      const ctx = t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 20).replace(/\s+/g, ' ');
      bad.push(`${proj}/${v}: «${m[0]}», нужно «${m[1]} ${want}»  …${ctx}…`);
    }
  }
}
await b.close();
fs.writeFileSync(process.argv[2] || OUT + '/screens.txt', dump);
[...new Set(bad)].forEach(x => console.log('  ' + x));
errs.forEach(e => console.log('  ! ' + e));
console.log(`экранов: ${views.length * 2}, несогласованных пар: ${new Set(bad).size}`);
process.exit(bad.length || errs.length ? 1 : 0);
