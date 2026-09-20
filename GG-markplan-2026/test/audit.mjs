import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(HERE, '..', 'public');
const FIX = fs.readFileSync(path.join(HERE, 'fixtures', 'gviz.csv'), 'utf8');
const MIME = { '.html':'text/html;charset=utf-8', '.css':'text/css;charset=utf-8', '.js':'application/javascript;charset=utf-8', '.csv':'text/csv;charset=utf-8', '.json':'application/json;charset=utf-8' };

const srv = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/') f = '/plan.html';
  const p = path.join(ROOT, f);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'text/plain' });
  res.end(fs.readFileSync(p));
});
await new Promise(r => srv.listen(0, r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

// ---------------------------------------------------------------------------
// ГЕЙТ УТВЕРЖДЕНИЙ ОБ ОЦЕНКАХ
//
// Что он делает: находит на всех публикуемых поверхностях любое утверждение
// вида «N из 10» или «N/10» и требует, чтобы такое число было подтверждено
// отчётом аудита, который лежит в knowledge/episodes и называет в
// deliverable_ref именно этот артефакт.
//
// Чего он НЕ делает, и это важно понимать: он не доказывает подлинность
// оценки. Отчёты пишет тот же, кто правит страницу, поэтому приписать себе
// девять баллов можно, положив рядом отчёт на девять баллов. Это проверка
// согласованности, а не подлинности, и подменить её на «страница прошла
// аудит» нельзя. Единственная настоящая защита это чужой аудит.
//
// Что уже пробовали сломать (итерация 4 ФЕНИКСА) и что теперь ловится:
//   целое число «8 из 10»; неразрывный пробел и &nbsp; между числом и мерой;
//   разметка внутри числа («<b>9,2</b>/10»); перенос строки между числом и
//   мерой; исключение, растянутое на весь файл; файл в подпапке и .json;
//   утверждение, пришедшее в текст из живой таблицы, а не из репозитория.
// ---------------------------------------------------------------------------
const REPO = path.resolve(HERE, '..', '..');
const ARTIFACT = 'GG-markplan';

// Любое «N из 10» / «N/10», целое или дробное, с любым пробелом или переносом.
// Отрицание после «10» отсекает только продолжение числа (100, 10.5), но не
// знак препинания: «9,9 из 10, вердикт принято» это оценка, и прежняя версия
// с (?![\d.,]) её пропускала из-за запятой.
const CLAIM_RE = /(\d+(?:[.,]\d+)?)\s*(?:из\s*10|\/\s*10)(?!\d)(?![.,]\d)/g;
// Целое число в этой форме встречается и в обычной речи («хотя бы 8 из 10
// человек»), поэтому целое считается оценкой только рядом со словом про оценку.
// Дробное считается оценкой всегда: «7,25 из 10» в живой речи не бывает.
// Остаточная дыра признана: «8 из 10» без таких слов рядом гейт не поймает.
const SCORE_WORD = /(оценк|балл|вердикт|аудит|провер|гейт|score|gate|из 10 баллов)/i;
function isScoreClaim(value, around) {
  return /[.,]/.test(value) || SCORE_WORD.test(around);
}
// Текст перед поиском: снимаем разметку, приводим пробелы к обычным.
// Пробелы приводим к обычным всегда. Разметку снимаем ОТДЕЛЬНЫМ вариантом, а не
// вместо исходного текста: в js-файле «<» и «>» могут стоять как обычные знаки,
// и снятие «тегов» проглотило бы весь кусок между ними вместе с оценкой.
// Поэтому ищем в обоих вариантах и объединяем находки.
function normWs(txt) {
  return txt
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/[\u00A0\u2007\u202F\u2009\u200A]/g, ' ')  // неразрывные и тонкие пробелы
    .replace(/[ \t]+/g, ' ');
}
function variants(txt) {
  const a = normWs(txt);
  const b = normWs(txt.replace(/<[^>]*>/g, ' '));   // «<b>9,2</b>/10» -> «9,2 /10»
  return b === a ? [a] : [a, b];
}
const normNum = v => String(Number(String(v).replace(',', '.'))).replace('.', ',');

function walk(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, fn); }
    else fn(p);
  }
}

// Белый список: только отчёты, которые называют ЭТОТ артефакт. Строки журнала
// сами по себе больше не авторизуют оценку: дописать строку в jsonl дешевле,
// чем положить отчёт, проходящий схему.
function recordedScores() {
  const out = new Set(), where = new Map();
  walk(path.join(REPO, 'knowledge', 'episodes'), p => {
    if (!/feniks.*\.json$/.test(p)) return;
    let d; try { d = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return; }
    if (!String(d.deliverable_ref || '').includes(ARTIFACT)) return;
    if (d.weighted_total == null) return;
    const v = normNum(d.weighted_total);
    out.add(v); where.set(v, path.relative(REPO, p));
  });
  return { set: out, where };
}

// Исключения привязаны к 40 символам контекста вокруг числа, а не к файлу:
// иначе разрешённое значение открывает дорогу тому же числу в любом другом
// месте того же файла.
// razbor.html это не страница плана, а опубликованный отчёт разбора
// стратсессии Квартета: её оценки это предмет страницы, а не её самооценка.
// Поэтому она выведена из общего правила целиком, но не бесплатно: взамен
// требуется, чтобы у оценки на первом экране стояли автор и статус записи.
// Пока записи нет, это держит задача Z23.
const REPORT_PAGES = {
  'razbor.html': {
    why: 'опубликованный отчёт разбора стратсессии Квартета: оценки в нём относятся к разговору, а не к странице',
    requires: ['Оценку поставил ФЕНИКС', 'запись этой проверки в журнале пока не завёдена'],
  },
};
const RENDERED = '<отрисованный текст страницы>';
const CLAIM_EXCEPTIONS = [
  { file: 'plan-data.js', value: '6,6', ctx: 'Z23',
    why: 'упоминание внутри задачи Z23, которая и требует завести запись под этой оценкой. Текст задачи сам говорит, что записи нет.' },
  { file: 'gantt-v2.csv', value: '6,6', ctx: 'Z23',
    why: 'та же задача Z23 в источнике импорта: CSV и снимок обязаны совпадать слово в слово.' },
  { file: RENDERED, value: '6,6', ctx: 'Завести запись проверки',
    why: 'текст задачи Z23 в разделе блоков: та же оговорка, что и в снимке.' },
];
function excuse(file, value, around) {
  return CLAIM_EXCEPTIONS.find(e => e.file === file && e.value === value && around.includes(e.ctx));
}

function findClaims(txt, file) {
  const hits = [], seen = new Set();
  for (const flat of variants(txt)) {
    for (const m of flat.matchAll(CLAIM_RE)) {
      const around = flat.slice(Math.max(0, m.index - 60), m.index + 60).replace(/\s+/g, ' ');
      // Окно привязки шире окна показа: исключение цепляется за идентификатор
      // задачи, внутри которой оценка упомянута, а не за случайную фразу.
      const ctxWin = flat.slice(Math.max(0, m.index - 220), m.index + 120).replace(/\s+/g, ' ');
      if (!isScoreClaim(m[1], around)) continue;
      const value = normNum(m[1]);
      const key = value + '|' + around.slice(20, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ value, line: flat.slice(0, m.index).split('\n').length, around, ctxWin, file });
    }
  }
  return hits;
}

function checkClaims(rec) {
  const bad = [], allowed = [];
  // Рекурсивно и с json: папка public публикуется целиком.
  walk(ROOT, p => {
    if (!/\.(html|js|css|csv|json|md|txt)$/.test(p)) return;
    const rel = path.relative(ROOT, p), file = path.basename(p);
    const txt = fs.readFileSync(p, 'utf8');
    const rep = REPORT_PAGES[file];
    if (rep) {
      // Страница-отчёт освобождена от сверки оценок, но обязана назвать автора
      // и статус записи. Не назвала - это провал, а не пропуск.
      const miss = rep.requires.filter(r => !txt.includes(r));
      if (miss.length) bad.push(`${rel}: страница-отчёт не называет автора или статус записи оценки (нет: ${miss.join('; ')})`);
      else allowed.push(`${rel} целиком: ${rep.why}; автор и статус записи указаны`);
      return;
    }
    for (const h of findClaims(txt, file)) {
      const exc = excuse(file, h.value, h.ctxWin);
      if (exc) { allowed.push(`${rel}:${h.line} ${h.value} (${exc.why})`); continue; }
      if (!rec.set.has(h.value)) bad.push(`${rel}:${h.line} оценка ${h.value} без отчёта, называющего ${ARTIFACT}: «…${h.around.trim()}…»`);
    }
  });
  console.log(`гейт оценок: отчётов по ${ARTIFACT} ${rec.set.size} (${[...rec.set].join(', ')}), исключений ${allowed.length}`);
  allowed.forEach(a => console.log('  ПРОПУЩЕНО ' + a));
  bad.forEach(b => console.log('  FAIL static: ' + b));
  return bad.length;
}

const WIDTHS = [320, 360, 390, 768, 1024, 1440, 1920];
const THEMES = ['dark', 'light'];
const MODE = process.argv[2] || 'live';   // live | snapshot
let fails = 0, checks = 0;
const bad = (w, t, m) => { fails++; console.log(`  FAIL ${w}px/${t}: ${m}`); };
const ok = () => { checks++; };

const RECORDED = recordedScores();
fails += checkClaims(RECORDED); checks += 1;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

for (const w of WIDTHS) for (const t of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !(MODE === 'snapshot' && /ERR_FAILED/.test(m.text())) && !/CERT_AUTHORITY_INVALID|fonts\.googleapis/.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.route('**fonts.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', r => r.fulfill({ status: 200, contentType: 'font/woff2', body: '' }));
  await page.route('**/gviz/**', route => {
    if (MODE === 'live') route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', body: FIX });
    else route.abort();
  });
  await page.addInitScript(th => { try { localStorage.setItem('gg.theme', th); } catch (e) {} }, t);
  await page.goto(BASE + '/plan.html', { waitUntil: 'load' });
  await page.waitForTimeout(MODE === 'live' ? 1400 : 900);

  const r = await page.evaluate(() => {
    const q = s => document.querySelector(s);
    const rect = s => { const n = q(s); return n ? n.getBoundingClientRect() : null; };
    const dek = q('#s-gantt .sec-dek');
    // текст, вылезающий за левую панель Ганта
    const left = q('.g-left'); const lw = left ? left.getBoundingClientRect().width : 0;
    let over = 0;
    if (left) left.querySelectorAll('text, rect.g-chip-bg').forEach(n => {
      const b = n.getBBox ? n.getBBox() : null; if (!b) return;
      if (b.x + b.width > lw + 1.5) over++;
    });
    const navHrefs = Array.from(document.querySelectorAll('.mast-nav a')).map(a => a.getAttribute('href'));
    return {
      docW: document.documentElement.scrollWidth,
      winW: window.innerWidth,
      h1: document.querySelectorAll('h1').length,
      h1txt: q('h1') ? q('h1').textContent.trim() : '',
      obzor: !!q('#s-obzor'), prio: !!q('#s-prioritety'),
      secNos: Array.from(document.querySelectorAll('.sec-no')).map(n => n.textContent.trim()),
      dekClipped: dek ? (dek.scrollWidth > dek.clientWidth + 1 || dek.scrollHeight > dek.clientHeight + 1) : null,
      dekTail: dek ? dek.textContent.trim().slice(-24) : '',
      mastDate: q('#mast-date') ? q('#mast-date').textContent.trim() : '',
      badge: q('#src-badge') ? q('#src-badge').textContent.trim() : '',
      navHrefs,
      navDead: navHrefs.filter(h => h && h.startsWith('#') && !document.getElementById(h.slice(1))),
      navVisible: rect('.mast-nav') ? rect('.mast-nav').height > 4 : false,
      footRazbor: !!Array.from(document.querySelectorAll('.foot-links a')).find(a => /ФЕНИКС/.test(a.textContent)),
      navRazbor: !!Array.from(document.querySelectorAll('.mast-nav a')).find(a => /ФЕНИКС/.test(a.textContent)),
      footGate: q('#foot-gate') ? q('#foot-gate').textContent.trim().length : 0,
      rows: document.querySelectorAll('.g-left .bar-hit, .g-left g[data-id]').length,
      blocks: document.querySelectorAll('details.bcard').length,
      tasks: document.querySelectorAll('.trow').length,
      leftW: lw, over,
      allBtn: q('#blocks-all') ? q('#blocks-all').textContent.trim() : '',
      skip: !!q('a.skip'),
      aria: Array.from(document.querySelectorAll('.ttoggle button')).map(b => b.getAttribute('aria-pressed')).join(','),
      lateNote: q('#late-note') ? (q('#late-note').hidden ? '' : q('#late-note').textContent.trim()) : null,
      lateChips: document.querySelectorAll('.g-left .g-chip-late').length,
      latePills: document.querySelectorAll('.pill.late').length,
      lateLegend: !!q('.lg .st-late'),
      planNote: q('#plan-note') ? q('#plan-note').textContent.trim() : null,
      printStamp: q('#print-stamp') ? q('#print-stamp').textContent.trim() : null,
      footGateTxt: q('#foot-gate') ? q('#foot-gate').textContent.trim() : '',
      footAll: q('.foot') ? q('.foot').textContent.replace(/\s+/g, ' ').trim() : '',
      bodyTxt: document.body.innerText.replace(/\s+/g, ' ').trim(),
      assetVers: [...new Set(Array.from(document.querySelectorAll('link[href*="?v="],script[src*="?v="]'))
        .map(n => (n.getAttribute('href') || n.getAttribute('src')).split('?v=')[1]))],
      srcTags: document.querySelectorAll('.trow .tsrc').length,
      lateBorder: q('#late-note') ? getComputedStyle(q('#late-note')).borderLeftColor : '',
      chipFill: (() => { const n = q('.pill.late'); return n ? getComputedStyle(n).backgroundColor : ''; })(),
      oldDate: !!q('#mast-date'),
      badgeClip: (() => { const n = q('#src-badge'); if (!n) return null;
        return { sw: n.scrollWidth, cw: n.clientWidth, sh: n.scrollHeight, ch: n.clientHeight }; })(),
      badgeColor: (() => { const n = q('#src-badge'); return n ? getComputedStyle(n).backgroundColor : ''; })(),
      badDates: Array.from(document.querySelectorAll('.g-left text'))
        .map(n => n.textContent).filter(t => /18\d\d|19\d\d|20[3-9]\d|фев/.test(t)),
    };
  });

  if (r.docW > r.winW + 1) bad(w, t, `горизонтальный скролл документа ${r.docW} > ${r.winW}`); else ok();
  if (r.h1 !== 1) bad(w, t, `h1 должен быть один, найдено ${r.h1}`); else ok();
  if (r.h1txt !== 'Антикризисный план GENGROUP') bad(w, t, `h1 = "${r.h1txt}"`); else ok();
  if (r.obzor || r.prio) bad(w, t, `удалённые секции на месте: obzor=${r.obzor} prio=${r.prio}`); else ok();
  if (r.secNos.join(',') !== '01,02,03') bad(w, t, `нумерация секций ${r.secNos.join(',')}`); else ok();
  if (r.dekClipped) bad(w, t, `дек графика обрезан, хвост "${r.dekTail}"`); else ok();
  if (!/часы|в неделю/i.test(r.dekTail)) bad(w, t, `хвост дека не тот: "${r.dekTail}"`); else ok();
  if (/25\.08\.2026/.test(r.badge) && MODE === 'live') bad(w, t, `дата застыла: "${r.badge}"`); else ok();
  if (!r.badge) bad(w, t, 'пустая отметка свежести'); else ok();
  if (r.navDead.length) bad(w, t, `ссылки в никуда: ${r.navDead.join(',')}`); else ok();
  if (!r.navVisible) bad(w, t, 'навигации нет на экране'); else ok();
  if (!r.footRazbor) bad(w, t, 'нет ссылки на ФЕНИКС-разбор в подвале'); else ok();
  if (r.navRazbor) bad(w, t, 'ссылка на ФЕНИКС-разбор осталась в шапке'); else ok();
  if (!r.footGate) bad(w, t, 'пустой текст гейта в подвале'); else ok();
  if (r.over) bad(w, t, `${r.over} текстов/чипов вылезли за левую панель (${Math.round(r.leftW)}px)`); else ok();
  if (!r.skip) bad(w, t, 'нет skip-ссылки'); else ok();
  if (r.aria !== (t === 'light' ? 'true,false' : 'false,true')) bad(w, t, `aria-pressed = ${r.aria}`); else ok();
  if (MODE === 'live') {
    if (!/^таблица · /.test(r.badge)) bad(w, t, `бейдж "${r.badge}"`); else ok();
    if (r.tasks !== 133) bad(w, t, `задач в блоках ${r.tasks}, ждали 133`); else ok();
    if (r.blocks < 8) bad(w, t, `блоков ${r.blocks}`); else ok();
  } else {
    if (!/^данные не обновились · список от /.test(r.badge)) bad(w, t, `бейдж "${r.badge}"`); else ok();
    if (r.tasks !== 133) bad(w, t, `задач в блоках ${r.tasks}`); else ok();
  }

  // раскрыть все блоки
  if (r.allBtn === 'Раскрыть все блоки') {
    await page.click('#blocks-all');
    const o = await page.evaluate(() => {
      const d = Array.from(document.querySelectorAll('details.bcard'));
      return { all: d.every(x => x.open), n: d.length, txt: document.querySelector('#blocks-all').textContent.trim(),
               docW: document.documentElement.scrollWidth, winW: window.innerWidth };
    });
    if (!o.all) bad(w, t, 'кнопка не раскрыла все блоки'); else ok();
    if (o.txt !== 'Свернуть все блоки') bad(w, t, `подпись кнопки "${o.txt}"`); else ok();
    if (o.docW > o.winW + 1) bad(w, t, `скролл после раскрытия всех блоков ${o.docW}>${o.winW}`); else ok();
  } else bad(w, t, `кнопка блоков: "${r.allBtn}"`);

  // печать
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(600);
  const pr = await page.evaluate(() => {
    const d = Array.from(document.querySelectorAll('details.bcard'));
    const cs = getComputedStyle(document.body);
    const vis = sel => { const n = document.querySelector(sel); if (!n) return null;
      const st = getComputedStyle(n); const b = n.getBoundingClientRect();
      return st.display !== 'none' && st.visibility !== 'hidden' && b.height > 2; };
    const ps = document.querySelector('#print-stamp');
    return { open: d.every(x => x.open), mast: getComputedStyle(document.querySelector('.masthead')).display,
             bg: cs.backgroundColor, ink: cs.color, w: document.documentElement.scrollWidth,
             stampVis: vis('#print-stamp'), stampTxt: ps ? ps.textContent.trim() : '',
             srcOnPaper: document.querySelectorAll('.trow .tsrc').length,
             tagsOnPaper: (document.body.innerText.match(/\[(ДАННЫЕ|ГИПОТЕЗА|НЕТ ДАННЫХ)\]/g) || []).length,
             noteVis: vis('#plan-note'), lateVis: vis('#late-note') };
  });
  if (!pr.open) bad(w, t, 'на печати блоки закрыты'); else ok();
  if (pr.mast !== 'none') bad(w, t, 'на печати липкая шапка не скрыта'); else ok();
  if (!/255, 255, 255/.test(pr.bg)) bad(w, t, `на печати фон не белый: ${pr.bg}`); else ok();
  if (!pr.stampVis) bad(w, t, 'на печати нет отметки происхождения данных'); else ok();
  if (!/(взяты из Google-таблицы|сохранённый в странице)/.test(pr.stampTxt)) bad(w, t, `печатная отметка без источника: "${pr.stampTxt.slice(0,50)}"`); else ok();
  if (!/Всего задач: \d+/.test(pr.stampTxt)) bad(w, t, 'печатная отметка без числа задач'); else ok();
  if (!pr.noteVis) bad(w, t, 'на печати нет расшифровки меток источника'); else ok();
  if (!pr.lateVis) bad(w, t, 'на печати нет сводки просрочек'); else ok();
  if (pr.srcOnPaper < 100) bad(w, t, `на печати меток источника ${pr.srcOnPaper}: расшифровка объясняет то, чего на листе нет`); else ok();
  if (pr.tagsOnPaper < 50) bad(w, t, `на печати метки [ДАННЫЕ]/[ГИПОТЕЗА] встречаются ${pr.tagsOnPaper} раз`); else ok();
  await page.emulateMedia({ media: 'screen' });

  if (!/\[ДАННЫЕ\]/.test(r.planNote || '') || !/\[ГИПОТЕЗА\]/.test(r.planNote || ''))
    bad(w, t, `нет расшифровки меток источника: "${(r.planNote||'').slice(0,40)}"`); else ok();
  if (!/в неделю/.test(r.planNote || '')) bad(w, t, 'в записке нет расшифровки колонки часов'); else ok();
  // Проверяем ВЕСЬ подвал, а не тот узел, который правили: иначе зелёный стенд
  // не видит устаревшую оценку в соседнем абзаце того же подвала.
  const claims = r.footAll.match(/\d+[.,]\d+\s*(?:из 10|\/10)/g) || [];
  const strayClaims = claims.map(c => (c.match(/\d+[,.]\d+/) || [''])[0]).filter(v => !RECORDED.set.has(v));
  if (strayClaims.length) bad(w, t, `в подвале оценки без записи аудита: ${strayClaims.join(', ')}`); else ok();
  if (!/7,25|6,2/.test(r.footAll)) bad(w, t, 'подвал не ссылается ни на одну запись аудита'); else ok();
  if (/порог(е)? 8,0/.test(r.footAll)) bad(w, t, 'подвал называет порог 8,0 вместо 7,5'); else ok();
  // Язык читателя: в тексте страницы не должно быть внутреннего жаргона и путей к файлам
  // «ФЕНИКС» тут не жаргон: так разбор называет сам Иван, и так подписаны авторы
  // задач. Жаргон это термины протокола, пути к файлам и слова про сборку.
  const jargon = ['Step 12.5', 'адверсариальн', 'Адверсариальн', '.jsonl', 'traces/',
                  'вшитый в страницу', 'вшитый при сборке', 'Protocol', 'Comprehension'];
  const found = jargon.filter(j => r.bodyTxt.indexOf(j) >= 0);
  if (found.length) bad(w, t, `жаргон в тексте страницы: ${found.join(', ')}`); else ok();
  // Половина текста страницы приходит из Google-таблицы, поэтому оценку можно
  // вписать в «Обоснование» задачи, и в файлах репозитория её не будет.
  // Статическая проверка такое не видит в принципе, эта видит.
  for (const h of findClaims(r.bodyTxt, RENDERED)) {
    const exc = excuse(RENDERED, h.value, h.ctxWin);
    if (exc) continue;
    if (!RECORDED.set.has(h.value)) bad(w, t, `на отрисованной странице оценка ${h.value} без отчёта: «…${h.around.trim()}…»`);
  }
  ok();
  if (r.assetVers.length !== 1) bad(w, t, `версии ассетов разъехались: ${r.assetVers.join(', ')}`); else ok();
  if (r.srcTags < 100) bad(w, t, `меток источника в блоках ${r.srcTags}, ждали по одной на задачу`); else ok();
  if (r.lateBorder !== r.chipFill) bad(w, t, `два красных на одно понятие: рамка ${r.lateBorder} против чипа ${r.chipFill}`); else ok();
  if (r.oldDate) bad(w, t, 'остался второй бейдж свежести #mast-date'); else ok();
  // Фраза про источник это ответ на «свежие ли цифры». Обрезать её многоточием
  // значит убрать ответ, а на телефоне это заметно не сразу.
  const bc = r.badgeClip;
  if (bc && (bc.sw > bc.cw + 1 || bc.sh > bc.ch + 1))
    bad(w, t, `фраза про источник обрезана: ${bc.sw}x${bc.sh} в окне ${bc.cw}x${bc.ch}`); else ok();
  // Красный просрочки не должен означать ещё и «данные не обновились»
  if (r.badgeColor && r.badgeColor === r.chipFill)
    bad(w, t, `бейдж источника залит цветом просрочки ${r.badgeColor}`); else ok();
  if (!/(по таблице, прочитана|по списку от)/.test(r.lateNote || '')) bad(w, t, 'сводка просрочек не подписана источником списка'); else ok();
  if (r.badDates.length) bad(w, t, `подозрительные даты в графике: ${r.badDates.slice(0,3).join(' / ')}`); else ok();
  if (!/Срок прошёл у \d+ задач/.test(r.lateNote || '')) bad(w, t, `сводка просрочек: "${(r.lateNote||'').slice(0,50)}"`); else ok();
  if (!/счётчик будет расти сам|Готовыми отмечено/.test(r.lateNote || '')) bad(w, t, 'сводка не объясняет, почему счётчик растёт'); else ok();
  if (!r.lateLegend) bad(w, t, 'нет просрочки в легенде'); else ok();
  if (r.lateChips < 1) bad(w, t, 'нет чипов просрочки в графике'); else ok();
  if (r.latePills < 1) bad(w, t, 'нет пилюль просрочки в блоках'); else ok();
  if (errs.length) bad(w, t, 'console: ' + errs.slice(0, 2).join(' | ')); else ok();
  await ctx.close();
}
await browser.close(); srv.close();
console.log(`\n${MODE}: проверок ${checks + fails}, провалов ${fails}`);
process.exit(fails ? 1 : 0);
