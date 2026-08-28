#!/usr/bin/env node
/**
 * liveedit-cli - аварийная расшифровка патчей и версий вне браузера.
 *
 * Зачем. Текст правок живёт зашифрованным в Supabase, а ключ выводится из
 * пароля документа. Если панель недоступна (проект уснул, RLS перекрыт, база
 * переехала), без этого файла содержимое не прочитать ничем. Выгружаете строки
 * из Supabase в JSON и расшифровываете здесь.
 *
 * Соль берётся из самой страницы: ключ у патчей тот же, что у тела документа,
 * а соль лежит в начале payload гейта.
 *
 *   node liveedit-cli.js decrypt <gated.html> <rows.json> <пароль> [doc_key]
 *
 * rows.json - массив строк из doc_blocks и/или doc_versions, как их отдаёт
 * Supabase (Table editor -> Export -> JSON, или обычный REST-запрос).
 *
 * Форматы байтов разные, не перепутать:
 *   тело документа  base64( salt[16] || iv[12] || ciphertext+tag )
 *   патч и снимок   base64(            iv[12] || ciphertext+tag )
 * Патчи и снимки дополнительно связаны с местом через AAD:
 *   патч   doc_key + '|' + block_id
 *   снимок doc_key + '|version'
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');

const ITER = 250000;

function saltFromPage(file) {
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/<script id="payload(?:-[a-z0-9-]+)?"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('в файле нет зашифрованной нагрузки, это не собранная страница');
  return Buffer.from(m[1].trim(), 'base64').subarray(0, 16);
}

function open(payloadB64, key, aad) {
  const raw = Buffer.from(payloadB64, 'base64');
  const iv = raw.subarray(0, 12);
  const ct = raw.subarray(12, raw.length - 16);
  const tag = raw.subarray(raw.length - 16);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  if (aad) d.setAAD(Buffer.from(aad, 'utf8'));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

function main() {
  const [, , mode, page, rowsFile, pass, docKeyArg] = process.argv;
  if (mode !== 'decrypt' || !page || !rowsFile || !pass) {
    console.error('node liveedit-cli.js decrypt <gated.html> <rows.json> <пароль> [doc_key]');
    process.exit(1);
  }
  const key = crypto.pbkdf2Sync(pass, saltFromPage(page), ITER, 32, 'sha256');
  const rows = JSON.parse(fs.readFileSync(rowsFile, 'utf8'));
  const list = Array.isArray(rows) ? rows : (rows.data || []);
  const out = { blocks: {}, versions: [] };
  let bad = 0;

  for (const r of list) {
    const dk = r.doc_key || docKeyArg;
    try {
      if (r.block_id) {
        out.blocks[r.block_id] = {
          html: open(r.payload, key, dk + '|' + r.block_id),
          author: r.author || null, updated_at: r.updated_at || null
        };
      } else if (r.snapshot) {
        out.versions.push({
          id: r.id, label: r.label || null, author: r.author || null,
          created_at: r.created_at || null, state: JSON.parse(open(r.snapshot, key, dk + '|version'))
        });
      }
    } catch (e) {
      bad++;
      console.error('не расшифровалось: ' + (r.block_id || ('версия ' + r.id)) + ' (' + e.message + ')');
    }
  }

  const dst = rowsFile.replace(/(\.json)?$/, '') + '-plain.json';
  fs.writeFileSync(dst, JSON.stringify(out, null, 2));
  console.log('блоков: ' + Object.keys(out.blocks).length + ', версий: ' + out.versions.length +
    (bad ? ', не открылось: ' + bad : ''));
  console.log('записано: ' + dst);
  console.log('ВНИМАНИЕ: файл открытый. В публичный репозиторий его класть нельзя.');
}

main();
