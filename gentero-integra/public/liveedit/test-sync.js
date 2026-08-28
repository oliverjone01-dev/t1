#!/usr/bin/env node
/**
 * Сверка двух копий модуля.
 *
 * Канонический исходник лежит в smm/public/liveedit/. Вторая копия живёт в
 * gentero-integra/public/liveedit/, потому что GitHub Pages раскладывает
 * проекты по подпапкам, а боевая страница грузит модуль относительным путём.
 *
 * Пока копии синхронизирует рука, расхождение неизбежно и незаметно: правка
 * уезжает в одну копию, боевая страница грузит другую, и на экране остаётся
 * прежнее поведение при свежем коде в репозитории. Это уже происходило.
 *
 * Запуск: node test-sync.js   (ненулевой код возврата = копии разошлись)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const A = __dirname;
const B = path.resolve(__dirname, '../../../gentero-integra/public/liveedit');

if (!fs.existsSync(B)) {
  console.log('ok   второй копии нет, сверять нечего');
  process.exit(0);
}

const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 12);
const list = d => fs.readdirSync(d).filter(f => fs.statSync(path.join(d, f)).isFile()).sort();

const a = list(A), b = list(B);
const all = Array.from(new Set(a.concat(b))).sort();

let bad = 0;
for (const f of all) {
  const inA = a.includes(f), inB = b.includes(f);
  if (!inA) { console.error(`ЛИШНИЙ   ${f} есть только во второй копии`); bad++; continue; }
  if (!inB) { console.error(`ПРОПУЩЕН ${f} не скопирован во вторую копию`); bad++; continue; }
  const ha = hash(path.join(A, f)), hb = hash(path.join(B, f));
  if (ha !== hb) { console.error(`РАЗОШЛИСЬ ${f}  ${ha} против ${hb}`); bad++; }
}

if (bad) {
  console.error(`\nрасхождений: ${bad}`);
  console.error(`выровнять: cp ${A}/* ${B}/`);
  process.exit(1);
}
console.log(`ok   ${all.length} файлов, копии совпадают`);
