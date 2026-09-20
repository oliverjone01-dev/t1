// Фикстуры для стендов: из gantt-v2.csv (точка с запятой) делаем то, что отдаёт
// gviz (запятая), плюс четыре искажённых варианта под пробы на устойчивость.
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'fixtures');
fs.mkdirSync(OUT, { recursive: true });

function split(line, d) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === d) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur); return out;
}
const csv = rows => rows.map(r => r.map(c => /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c).join(',')).join('\n') + '\n';
const write = (name, head, body) => fs.writeFileSync(path.join(OUT, name), csv([head, ...body]));

const raw = fs.readFileSync(path.resolve(HERE, '..', 'public', 'gantt-v2.csv'), 'utf8').replace(/\r/g, '');
const lines = raw.split('\n').filter(Boolean).map(l => split(l, ';'));
const head = lines[0], body = lines.slice(1);
const col = n => head.indexOf(n);
const S = col('Старт'), D = col('Дней'), ST = col('Статус');

write('gviz.csv', head, body);

// мусорные даты и длительности: опечатка в таблице не должна давать тихий срок
const BAD = ['31.02.2026', '0000-00-00', '8/45/2026', '2026-13-01', '', 'не знаю',
             '29.02.2026', '1899-12-31', '32.10.2026', '2026-10-00'];
const g = body.map(r => r.slice());
BAD.forEach((v, i) => { if (i < g.length) g[i][S] = v; });
['0', '-3', 'абв'].forEach((v, i) => { const k = BAD.length + i; if (k < g.length) g[k][D] = v; });
write('gviz-garbage.csv', head, g);

// без колонки «Приоритет»: страница обязана честно откатиться на снимок
const keep = head.map((n, i) => i).filter(i => head[i] !== 'Приоритет');
write('gviz-nopr.csv', keep.map(i => head[i]), body.map(r => keep.map(i => r[i])));

// только шапка
write('gviz-empty.csv', head, []);

// всё закрыто: сводка просрочек обязана исчезнуть целиком
write('gviz-alldone.csv', head, body.map(r => { const c = r.slice(); c[ST] = 'готово'; return c; }));

// оценка, вписанная в «Обоснование»: положительный контроль гейта утверждений.
// В файлах репозитория такой оценки нет, значит поймать её может только
// проверка по отрисованному тексту страницы.
const W = col('Обоснование');
const claim = body.map(r => r.slice());
if (claim.length) claim[0][W] = 'Страница прошла аудит с оценкой 9,9 из 10, вердикт принято. ' + claim[0][W];
write('gviz-claim.csv', head, claim);

console.log('фикстуры в', OUT, fs.readdirSync(OUT).join(', '));
