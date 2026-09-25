/* Тест на подмену для шифровальщика tools/seal_page.mjs. Каждый плохой случай обязан
   остановить публикацию (код выхода не 0), хороший обязан пройти, и в нём после
   шифрования не должно остаться ни данных, ни кода приложения.
   Случаи утечек взяты из аудита ФЕНИКСА, итерация 6: утечка в комментарии HTML и CSS,
   производные и мелкие числа, короткие формы, узкий пробел, обработчики событий,
   лишний скрипт через путь «..» на cdnjs.
   Запуск: node tools/seal_test.mjs   (временные файлы в KONTUR_TMP) */
import fs from 'fs';
import { execFileSync } from 'child_process';

const OUT = (process.env.KONTUR_TMP || '/tmp/claude-0') + '/seal-test';
const SEAL = new URL('./seal_page.mjs', import.meta.url).pathname;
const SRC = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
fs.mkdirSync(OUT, { recursive: true });

const GATE = '<div class="gate" id="gate">';
const TITLE = '<title>Контур: SEO, GEO, Директ</title>';
const LOCAL = '<style id="kontur-local">';
const APEX_TAG = SRC.match(/<script src="https:\/\/cdnjs[^>]*><\/script>/)[0];
const before = (x) => (h) => h.replace(GATE, x + GATE);
const GOOD = 'Kontur-Seal-Test-' + Math.random().toString(36).slice(2, 10);

const BAD = [
  ['скрытый абзац с расходом', before('<p hidden>Расход 175 968 ₽, клики 1 595</p>\n')],
  ['план с неразрывными пробелами', before('<p hidden>План 240\u00a0000\u00a0000 ₽</p>\n')],
  ['число в CSS content', before('<style>.x::after{content:"175 968 ₽"}</style>\n')],
  ['план в комментарии HTML', before('<!-- план GENGLASS 240 000 000 ₽ -->\n')],
  ['имя цели в комментарии HTML', before('<!-- CRM | Все лиды | 18.11.25 -->\n')],
  ['расход в комментарии CSS', (h) => h.replace(LOCAL, LOCAL + '\n/* расход 175 968 ₽ */')],
  ['производное число', before('<p hidden>Потолок 36 000 000 ₽, вернуть 252 000 000 ₽</p>\n')],
  ['мелкие числа', before('<p hidden>147 заявок, 19 посадочных, 101 из 105</p>\n')],
  ['короткие формы', before('<p hidden>Расход 176 тыс. ₽, план 0,24 млрд ₽</p>\n')],
  ['узкий пробел', before('<p hidden>План 240\u202f000\u202f000 ₽</p>\n')],
  ['число в заголовке окна', (h) => h.replace(TITLE, '<title>Контур: план 240 000 000 ₽</title>')],
  ['обработчик события', before('<img alt="" src="data:," onerror="window.__h=1">\n')],
  ['лишний JSON-скрипт', before('<script type="application/json" id="x">{"a":"b"}</script>\n')],
  ['обработчик на скрипте ApexCharts', (h) => h.replace(APEX_TAG, APEX_TAG.replace('></script>', ' onload="window.__o=1"></script>'))],
  ['чужой скрипт через «..» на cdnjs', (h) => h.replace(APEX_TAG, APEX_TAG + '\n<script src="https://cdnjs.cloudflare.com/ajax/libs/apexcharts/../jquery/3.7.1/jquery.min.js"></script>')],
  ['ApexCharts без хэша', (h) => h.replace(APEX_TAG, APEX_TAG.replace(/ integrity="[^"]*"/, ''))],
  ['пустая строка в разметке', (h) => h.replace(GATE, '\n' + GATE)],
];
const PASS = [
  ['секрет не задан', ''],
  ['пароль короче 12 знаков', 'abcdefghijk'],
  ['старый пароль хаба', 'genmonster2026'],
  ['старый пароль хаба с заглавной', 'Genmonster2026'],
  ['старый пароль хаба с суффиксом', 'genmonster2026!'],
  ['совпадает с HUB_PASS', 'Hub-Pass-Secret-77', 'Hub-Pass-Secret-77'],
];

function run(name, html, pass, hub) {
  const f = OUT + '/case.html';
  fs.writeFileSync(f, html);
  try {
    execFileSync('node', [SEAL, f], { env: { ...process.env, KONTUR_PASS: pass, HUB_PASS: hub || '' }, stdio: ['ignore', 'ignore', 'pipe'] });
    return { ok: true, out: fs.readFileSync(f, 'utf8') };
  } catch (e) { return { ok: false, err: String(e.stderr || '').trim().split('\n').pop() }; }
}

let bad = 0;
for (const [name, mut] of BAD) {
  const h = mut(SRC);
  if (h === SRC) { console.log('  ПОДМЕНА НЕ ПРОИЗОШЛА: ' + name); bad++; continue; }
  const r = run(name, h, GOOD);
  if (r.ok) { console.log('  ПРОСКОЧИЛО: ' + name); bad++; } else console.log('  поймано: ' + name + '  ->  ' + r.err.slice(0, 90));
}
for (const [name, pass, hub] of PASS) {
  const r = run(name, SRC, pass, hub);
  if (r.ok) { console.log('  ПРОСКОЧИЛО: ' + name); bad++; } else console.log('  поймано: ' + name + '  ->  ' + r.err.slice(0, 90));
}
// Правка исходников: копия проекта во временном каталоге, правка, пересборка,
// шифрование. Первый слой здесь пройдёт (страница совпадает со своими исходниками),
// поймать обязан второй. Без второго слоя эти случаи проскакивают.
const ROOT = new URL('../..', import.meta.url).pathname;
function srcCase(name, edit) {
  const ws = OUT + '/ws';
  fs.rmSync(ws, { recursive: true, force: true });
  for (const d of ['kontur-dashboard', 'kontur-ds'])
    fs.cpSync(ROOT + d, ws + '/' + d, { recursive: true, filter: f => !/node_modules|__pycache__|\/rive\/|specimen/.test(f) });
  if (edit) edit(ws);
  try {
    execFileSync('python3', [ws + '/kontur-dashboard/src/build.py'], { stdio: ['ignore', 'ignore', 'pipe'] });
    execFileSync('node', [ws + '/kontur-dashboard/tools/seal_page.mjs', ws + '/kontur-dashboard/public/index.html'],
      { env: { ...process.env, KONTUR_PASS: GOOD, HUB_PASS: '' }, stdio: ['ignore', 'ignore', 'pipe'] });
    return { ok: true };
  } catch (e) { return { ok: false, err: String(e.stderr || '').trim().split('\n').pop() }; }
}
const patch = (ws, rel, from, to) => { const f = ws + '/' + rel, t = fs.readFileSync(f, 'utf8');
  if (!t.includes(from)) throw new Error('правка не нашла место: ' + rel); fs.writeFileSync(f, t.replace(from, to)); };
// Числа для случаев с правкой исходников берутся из текущих данных страницы: второй
// слой ищет значения, которые есть в данных, а выгрузки обновляются каждый день.
const DBX = JSON.parse(SRC.match(/const DB = (\{.*?\});\n/s)[1]);
const gg = DBX.projects.gg, dr = gg.direct || {};
const NB = '\u00a0', grp = (n) => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const SPEND = dr.spend && dr.spend.v, CPC = dr.cpc && dr.cpc.v, CLICKS = dr.clicks && dr.clicks.v;
const LEADS = gg.ym && gg.ym.conv && gg.ym.conv.organic && gg.ym.conv.organic.leads, PLAN = gg.plan.v;
// нули срезаются только в дробной части: 240 остаётся «240», а не «24»
const dec = (x, d) => x.toFixed(d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '').replace('.', ',');
const inHead = (x) => (ws) => patch(ws, 'kontur-dashboard/src/modules/head.py', '<title>Контур: SEO, GEO, Директ</title>', '<title>Контур: SEO, GEO, Директ</title>\n' + x);
const inBody = (x) => (ws) => patch(ws, 'kontur-dashboard/src/modules/shell.py', '<div class="gate" id="gate">', x + '\n<div class="gate" id="gate">');
const SRC_BAD = [
  ['исходники: расход в правиле kit.css', (ws) => fs.appendFileSync(ws + '/kontur-ds/kit/kit.css', '\n.x::after{ content:"Расход 175 968 ₽"; }\n')],
  ['исходники: заявки из поиска в разметке', inBody('<p hidden>' + LEADS + ' заявок</p>')],
  ['исходники: расход в тысячах', inBody('<p hidden>Расход ' + dec(SPEND / 1000, 0) + ' тыс. ₽</p>')],
  ['исходники: план с узким пробелом', inBody('<p hidden>План 240\u2009000\u2009000 ₽</p>')],
  ['исходники: план в комментарии своего CSS', (ws) => patch(ws, 'kontur-dashboard/src/modules/head.py', "LOCAL_CSS = r'''", "LOCAL_CSS = r'''\n/* план 240 000 000 ₽ */")],
  ['исходники: <img onerror>', inBody('<img alt="" src="data:," onerror="window.__h=1">')],
  ['исходники: <svg/onload>', inBody('<svg/onload="window.__h=1"></svg>')],
  ['исходники: <SCRIPT> заглавными', inBody('<SCRIPT>window.__s=1</SCRIPT>')],
  // итерация 8
  ['исходники: meta description с планом в млн', inHead('<meta name="description" content="План ' + dec(PLAN / 1e6, 0) + ' млн ₽">')],
  ['исходники: meta og с расходом', inHead('<meta property="og:description" content="Расход ' + grp(SPEND) + ' ₽">')],
  ['исходники: второй блок ks-tokens', inHead('<style id="ks-tokens">/* CRM | Все лиды */</style>')],
  ['исходники: второй блок ks-kit', inHead('<style id="ks-kit">.x::after{ content:"175 968 ₽"; }</style>')],
  ['исходники: iframe srcdoc', inBody('<iframe srcdoc="<p>x</p>" hidden></iframe>')],
  ['исходники: дробная цена клика', inBody('<p hidden>Клик ' + String(CPC).replace('.', ',') + ' ₽</p>')],
  // форма посчитана без dec(): ловит, если шифровальщик снова начнёт резать нули у целых
  ['исходники: план в млн целым числом', inBody('<p hidden>План ' + Math.round(PLAN / 1e6) + ' млн ₽</p>')],
  ['исходники: расход в тыс. целым числом', inBody('<p hidden>Расход ' + Math.round(SPEND / 1e3) + ' тыс. ₽</p>')],
  ['исходники: клики в тысячах с запятой', inBody('<p hidden>Кликов ' + dec(CLICKS / 1000, 1) + ' тыс.</p>')],
];
if (!SPEND || !CPC || !CLICKS || !LEADS || !PLAN || !String(CPC).includes('.')) { console.log('  В ДАННЫХ НЕТ ЧИСЕЛ ДЛЯ СЛУЧАЕВ С ИСХОДНИКАМИ: расход, цена клика (дробная), клики, заявки, план'); bad++; }
const ctl = srcCase('чистая копия', null);
if (!ctl.ok) { console.log('  ЧИСТАЯ КОПИЯ НЕ ПРОШЛА, случаи с исходниками не проверить: ' + ctl.err); bad++; }
else for (const [name, edit] of SRC_BAD) {
  const r = srcCase(name, edit);
  if (r.ok) { console.log('  ПРОСКОЧИЛО: ' + name); bad++; } else console.log('  поймано: ' + name + '  ->  ' + r.err.slice(0, 90));
}
fs.rmSync(OUT + '/ws', { recursive: true, force: true });

const g = run('чистая страница', SRC, GOOD);
const leftovers = g.ok ? ['const DB = ', '"projects"', 'function render', 'KS.head', '240 000 000'].filter(x => g.out.includes(x)) : [];
if (!g.ok) { console.log('  ЧИСТАЯ СТРАНИЦА НЕ ПРОШЛА: ' + g.err); bad++; }
else if (leftovers.length) { console.log('  ПОСЛЕ ШИФРОВАНИЯ ОСТАЛОСЬ: ' + leftovers.join(' | ')); bad++; }
else console.log('  чистая страница зашифрована, данных и кода вне шифра нет');

const total = BAD.length + PASS.length + SRC_BAD.length + 2;
console.log(`\nитог: ${total - bad} из ${total}`);
process.exit(bad ? 1 : 0);
