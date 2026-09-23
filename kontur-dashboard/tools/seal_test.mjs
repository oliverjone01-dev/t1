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
  ['план с неразрывными пробелами', before('<p hidden>План 240 000 000 ₽</p>\n')],
  ['число в CSS content', before('<style>.x::after{content:"175 968 ₽"}</style>\n')],
  ['план в комментарии HTML', before('<!-- план GENGLASS 240 000 000 ₽ -->\n')],
  ['имя цели в комментарии HTML', before('<!-- CRM | Все лиды | 18.11.25 -->\n')],
  ['расход в комментарии CSS', (h) => h.replace(LOCAL, LOCAL + '\n/* расход 175 968 ₽ */')],
  ['производное число', before('<p hidden>Потолок 36 000 000 ₽, вернуть 252 000 000 ₽</p>\n')],
  ['мелкие числа', before('<p hidden>147 заявок, 19 посадочных, 101 из 105</p>\n')],
  ['короткие формы', before('<p hidden>Расход 176 тыс. ₽, план 0,24 млрд ₽</p>\n')],
  ['узкий пробел', before('<p hidden>План 240 000 000 ₽</p>\n')],
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
const g = run('чистая страница', SRC, GOOD);
const leftovers = g.ok ? ['const DB = ', '"projects"', 'function render', 'KS.head', '240 000 000'].filter(x => g.out.includes(x)) : [];
if (!g.ok) { console.log('  ЧИСТАЯ СТРАНИЦА НЕ ПРОШЛА: ' + g.err); bad++; }
else if (leftovers.length) { console.log('  ПОСЛЕ ШИФРОВАНИЯ ОСТАЛОСЬ: ' + leftovers.join(' | ')); bad++; }
else console.log('  чистая страница зашифрована, данных и кода вне шифра нет');

const total = BAD.length + PASS.length + 1;
console.log(`\nитог: ${total - bad} из ${total}`);
process.exit(bad ? 1 : 0);
