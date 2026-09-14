#!/usr/bin/env node
/**
 * Сторож двух дефектов, которые уже возвращались.
 *
 * Первый. Шорткат `font:` с ключевым словом `inherit` в позиции семейства
 * невалиден: браузер отбрасывает объявление ЦЕЛИКОМ, вместе с размером и
 * весом. Дефект незаметен в коде и заметен только на чужой странице, где
 * элементы модуля вдруг наследуют её типографику. Один раз он был вычищен,
 * README объявил это фактом, а четыре штуки остались, включая сам стенд.
 *
 * Второй. Модуль не имеет права читать переменные страницы-хозяина по общим
 * именам: --ink, --card, --line, --cta и подобные. Именно так панель однажды
 * получила чёрный текст на тёмном фоне. Своё держим под префиксом --le-.
 *
 * Запуск: node test-css.js   (ненулевой код возврата = дефект вернулся)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const FILES = fs.readdirSync(DIR).filter(f => /\.(js|html)$/.test(f) && !f.startsWith('test-'));

// Разрешены только собственные переменные и те две, что объявляет проект.
const OWN = /^--le-/;

const rules = [
  {
    name: 'шорткат font с inherit в позиции семейства',
    re: /font:\s*[^;'"`]*\binherit\b/g,
    why: 'браузер отбрасывает объявление целиком: пропадают и размер, и вес'
  },
  {
    name: 'чужая CSS-переменная без префикса --le-',
    re: /var\(\s*(--[a-z0-9-]+)/gi,
    why: 'имя может совпасть с переменной страницы-хозяина и подменить цвет',
    ok: m => OWN.test(m[1]),
    // demo.html это страница-ХОЗЯИН, а не модуль. Свои переменные ей
    // положены: на ней и проверяется, что модуль их не подхватывает.
    skip: f => f === 'demo.html'
  }
];

// Комментарии вырезаем, сохраняя разбиение на строки: иначе сторож ловит
// собственное описание дефекта в комментарии, которым дефект и объяснён.
function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length))
    .replace(/<!--[\s\S]*?-->/g, c => c.replace(/[^\n]/g, ' '));
}

let bad = 0;
for (const f of FILES) {
  const raw = fs.readFileSync(path.join(DIR, f), 'utf8');
  const src = strip(raw);
  const lines = raw.split('\n');
  for (const rule of rules) {
    if (rule.skip && rule.skip(f)) continue;
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(src))) {
      if (rule.ok && rule.ok(m)) continue;
      const line = src.slice(0, m.index).split('\n').length;
      console.error(`НАЙДЕНО  ${f}:${line}  ${rule.name}`);
      console.error(`         ${lines[line - 1].trim().slice(0, 100)}`);
      console.error(`         ${rule.why}`);
      bad++;
    }
  }
}

if (bad) {
  console.error(`\nдефектов: ${bad}`);
  process.exit(1);
}
console.log(`ok   ${FILES.length} файлов, оба сторожа молчат`);
