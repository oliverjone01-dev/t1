import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', 'public');

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

// Утверждение об оценке бывает в трёх формах, и мера в нём необязательна.
// Третья форма важнее всех: «Оценка страницы по внутреннему аудиту: 9,9.»
// Так написан и собственный подвал этой страницы, поэтому без неё гейт не
// видел три из четырёх своих же оценок.
const MEASURE = '(?:из\\s*10|\\/\\s*10|балл(?:а|ов)?|по\\s+десятибалльной)';
const CLAIM_RE = new RegExp('(\\d+(?:[.,]\\d+)?)\\s*' + MEASURE + '(?!\\d)(?![.,]\\d)', 'g');
const SCORE_WORD = /(оценк|балл|вердикт|аудит|провер|гейт|score|gate|феникс|итог|результат|набрал|поставил|дал |принято|доработа)/i;
// За числом стоит своя единица - значит это количество, а не оценка.
const OWN_UNIT = /^\s*(%|₽|руб|коп|млн|тыс|млрд|задач|дн(ей|я)|день|недел|месяц|год|лет|час|мин|сек|человек|людей|штук|шт\b|позиц|артикул|строк|раз\b|процент|кг|м2|мм|см|блок|сценар|форм|проб|итераци|пункт|шаг|ширин|тем\b|круг|из\s+\d)/i;
// Даты и время маскируем пробелами той же длины: индексы не сдвигаются, а
// «19.09.2026» перестаёт выглядеть как «19» и «09».
function maskDates(txt) {
  return txt
    .replace(/\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}/g, m => ' '.repeat(m.length))
    .replace(/\d{4}-\d{1,2}-\d{1,2}/g, m => ' '.repeat(m.length))
    .replace(/\b\d{1,2}:\d{2}\b/g, m => ' '.repeat(m.length));
}

// Форму «оценка 9,9» без меры гейт НЕ ищет по всему тексту, и это осознанно.
// Пробовал: слово про оценку рядом с числом встречается в прозе («оценка дыры
// расходится в 2,8 раза») и в структурных данных (колонка «Гейт» стоит рядом с
// часами и днями в каждой строке CSV). Детектор на такой догадке краснел
// десятками ложных срабатываний, а проверка, которая всегда красная, это
// проверка, которую перестают запускать.
// Вместо угадывания форма без меры запрещена там, где оценки публикуются:
// см. VERDICT_FIELDS ниже. Остаточный пробел назван в README.
function isScoreClaim(value, around) {
  return /[.,]/.test(value) || SCORE_WORD.test(around);
}

// Пробелы приводим к обычным всегда. Разметку снимаем ОТДЕЛЬНЫМ вариантом, а не
// вместо исходного текста: в js-файле «<» и «>» могут стоять как обычные знаки,
// и снятие «тегов» проглотило бы весь кусок между ними вместе с оценкой.
// Поэтому ищем в обоих вариантах и объединяем находки.
function normWs(txt) {
  return txt
    .replace(/&nbsp;|&#160;|&#xA0;|&#32;|&#x20;|&thinsp;|&ensp;|&emsp;|&#8201;|&#8194;|&#8195;/gi, ' ')
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
// Ключ это ОТНОСИТЕЛЬНЫЙ путь, а не имя файла: иначе любой public/**/razbor.html
// получал бы освобождение. И освобождается не файл, а утверждения про предмет
// разбора: как только в контексте числа появляется слово про эту страницу или
// план, освобождение не действует и оценка требует отчёта.
const REPORT_PAGES = {
  'razbor.html': {
    why: 'опубликованный отчёт разбора стратсессии Квартета: оценки в нём относятся к разговору, а не к странице',
    requires: ['Оценку поставил ФЕНИКС', 'запись этой проверки в журнале пока не завёдена'],
    // Слова, при которых освобождение снимается: оценка относится уже не к
    // разговору, а к странице или плану, и должна иметь отчёт.
    notAbout: /(страниц|план|markplan|антикризис)/i,
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

// ПОЛЯ, КОТОРЫЕ ПУБЛИКУЮТ ВЕРДИКТ АУДИТА.
// Здесь правило не эвристика, а формат: любое число в пределах шкалы обязано
// нести меру. Тогда общий поиск по мере видит все оценки подвала, и «оценка
// страницы: 9,9» без меры становится провалом, а не невидимкой.
const VERDICT_FIELDS = ['gate', 'audit'];
const DATA_FILES = ['plan-data.js', 'plan-valonti-data.js'];
function loadMeta(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const win = {};
  new Function('window', src)(win);
  return (win.PLAN && win.PLAN.meta) || {};
}
function checkVerdictFields() {
  const bad = [];
  for (const f of DATA_FILES) {
    let meta; try { meta = loadMeta(f); } catch (e) { bad.push(`${f}: не читается (${e.message})`); continue; }
    for (const k of VERDICT_FIELDS) {
      const txt = meta[k]; if (!txt) continue;
      // Сначала вымарываем то, что уже написано правильно (число вместе с мерой),
      // потом ищем, что осталось. Иначе «10» из «из 10» само выглядит как оценка
      // без меры, и правильный текст валит собственную проверку.
      const masked = maskDates(String(txt))
        .replace(new RegExp(CLAIM_RE.source, 'g'), m => ' '.repeat(m.length))
        .replace(/\bB7\b|\bZ\d+\b/g, m => ' '.repeat(m.length));
      for (const m of masked.matchAll(/\b(\d{1,2}(?:[.,]\d{1,2})?)\b/g)) {
        const num = Number(String(m[1]).replace(',', '.'));
        if (!(num >= 0 && num <= 10)) continue;
        const after = masked.slice(m.index + m[0].length, m.index + m[0].length + 26);
        if (OWN_UNIT.test(after)) continue;                              // своя единица: «16 раз»
        bad.push(`${f} meta.${k}: число ${m[1]} без меры («…${masked.slice(Math.max(0, m.index - 45), m.index + 35).replace(/\s+/g, ' ')}…»). ` +
          'В полях вердикта каждая оценка пишется с мерой, иначе её не видит общий поиск.');
      }
    }
  }
  return bad;
}

function findClaims(txt, file) {
  const hits = [], seen = new Set();
  for (const flat of variants(txt)) {
    const push = (m, around) => {
      const ctxWin = flat.slice(Math.max(0, m.index - 220), m.index + 120).replace(/\s+/g, ' ');
      const value = normNum(m[1]);
      const key = value + '|' + around.slice(20, 80);
      if (seen.has(key)) return;
      seen.add(key);
      hits.push({ value, line: flat.slice(0, m.index).split('\n').length, around, ctxWin, file });
    };
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
    if (!/\.(html|js|css|csv|json|md|txt|svg|xml|webmanifest)$/.test(p)) return;
    const rel = path.relative(ROOT, p), file = path.basename(p);
    const txt = fs.readFileSync(p, 'utf8');
    const rep = REPORT_PAGES[rel];
    if (rep) {
      // Страница-отчёт освобождена от сверки оценок, но обязана назвать автора
      // и статус записи. Не назвала - это провал, а не пропуск.
      const miss = rep.requires.filter(r => !txt.includes(r));
      if (miss.length) bad.push(`${rel}: страница-отчёт не называет автора или статус записи оценки (нет: ${miss.join('; ')})`);
      else allowed.push(`${rel}: ${rep.why}; автор и статус записи указаны`);
      // Освобождение не покрывает утверждения про эту страницу или про план.
      for (const h of findClaims(txt, file)) {
        if (!rep.notAbout.test(h.around)) continue;
        if (!rec.set.has(h.value)) bad.push(`${rel}:${h.line} оценка ${h.value} относится к плану, а не к разбору, и отчёта нет: «…${h.around.trim()}…»`);
      }
      return;
    }
    for (const h of findClaims(txt, file)) {
      const exc = excuse(file, h.value, h.ctxWin);
      if (exc) { allowed.push(`${rel}:${h.line} ${h.value} (${exc.why})`); continue; }
      if (!rec.set.has(h.value)) bad.push(`${rel}:${h.line} оценка ${h.value} без отчёта, называющего ${ARTIFACT}: «…${h.around.trim()}…»`);
    }
  });
  bad.push(...checkVerdictFields());
  console.log(`гейт оценок: отчётов по ${ARTIFACT} ${rec.set.size} (${[...rec.set].join(', ')}), исключений ${allowed.length}`);
  allowed.forEach(a => console.log('  ПРОПУЩЕНО ' + a));
  bad.forEach(b => console.log('  FAIL static: ' + b));
  return bad.length;
}


export { ROOT, ARTIFACT, CLAIM_RE, MEASURE, SCORE_WORD, OWN_UNIT, maskDates, normWs, variants,
         normNum, recordedScores, findClaims, excuse, checkClaims, checkVerdictFields,
         CLAIM_EXCEPTIONS, REPORT_PAGES, RENDERED, VERDICT_FIELDS, loadMeta };
