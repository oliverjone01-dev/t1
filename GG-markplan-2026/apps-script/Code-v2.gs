/**
 * GG-MarkPlan V2 - мост между сайтом и таблицей GENGROUP_MarkPlan_2026_GANTT-V2.
 *
 * Делает две вещи:
 *  1. importFromSite() - разово заливает готовый список задач с сайта в лист GANTT.
 *     Запускается вручную из редактора, интернет-адрес файла зашит ниже.
 *  2. doGet() - принимает от сайта правку сроков, когда вы тянете край полоски
 *     мышкой. Пароль хранится только здесь, в коде сайта его нет.
 *
 * УСТАНОВКА (один раз, минут пять):
 *  1. Открыть таблицу GENGROUP_MarkPlan_2026_GANTT-V2.
 *  2. Расширения (Extensions) -> Apps Script.
 *  3. Удалить всё, что там есть, вставить этот файл целиком. Сохранить (Ctrl+S).
 *  4. Вверху в списке функций выбрать importFromSite и нажать «Выполнить» (Run).
 *     Google попросит разрешение - разрешить. Лист GANTT заполнится задачами.
 *  5. Задать пароль на правку сроков: вписать его ниже в PASSWORD_HERE,
 *     выбрать функцию setPassword, выполнить один раз, потом стереть пароль
 *     из кода обратно.
 *  6. Развернуть (Deploy) -> Новое развёртывание (New deployment) ->
 *     тип «Веб-приложение» (Web app) -> Запуск от имени: Я (Me),
 *     Доступ: Все (Anyone) -> Развернуть -> скопировать адрес.
 *  7. Прислать этот адрес Ивану, он встанет в настройку сайта (meta.writeUrl).
 */

var SHEET_NAME = 'GANTT';
var CSV_URL = 'https://oliverjone01-dev.github.io/t1/markplan/gantt-v2.csv';

// ЗАДАТЬ ПАРОЛЬ: впишите пароль между кавычек и выполните функцию один раз.
function setPassword() {
  var PASSWORD_HERE = '';
  if (!PASSWORD_HERE) throw new Error('Впишите пароль в переменную PASSWORD_HERE и запустите снова.');
  PropertiesService.getScriptProperties().setProperty('EDIT_SECRET', PASSWORD_HERE);
}

/**
 * Забирает готовый список задач с сайта и полностью перезаписывает лист GANTT.
 * Разделитель в файле - точка с запятой, потому что внутри текста есть запятые.
 */
function importFromSite() {
  var resp = UrlFetchApp.fetch(CSV_URL, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error('Не удалось скачать файл задач. Код ответа: ' + resp.getResponseCode());
  }
  var text = resp.getContentText('UTF-8').replace(/^﻿/, '');
  var rows = parseDelimited(text, ';');
  if (rows.length < 2) throw new Error('В файле задач меньше двух строк, заливать нечего.');

  var width = 0;
  rows.forEach(function (r) { if (r.length > width) width = r.length; });
  rows.forEach(function (r) { while (r.length < width) r.push(''); });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  sh.clear();
  var range = sh.getRange(1, 1, rows.length, width);
  // ВАЖНО: сначала переводим весь диапазон в текст, потом пишем.
  // Иначе Google распознаёт 2026-08-26 как дату и хранит её в своём формате
  // (месяц первым), а страница читает первое число как день и уносит
  // задачу на полгода вперёд.
  range.setNumberFormat('@');
  range.setValues(rows);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, width).setFontWeight('bold');
  sh.setColumnWidth(4, 320); // Задача
  sh.setColumnWidth(5, 460); // Обоснование
  return 'Залито строк: ' + (rows.length - 1);
}

/** Разбор текстового файла с учётом кавычек. */
function parseDelimited(text, sep) {
  var rows = [], row = [], cur = '', q = false;
  for (var i = 0; i < text.length; i++) {
    var c = text.charAt(i);
    if (q) {
      if (c === '"') { if (text.charAt(i + 1) === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === sep) { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c === '\r') { /* пропуск */ }
      else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(function (r) { return r.join('').trim() !== ''; });
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var cb = p.callback || 'callback';
  var out;
  try { out = handle(p); }
  catch (err) { out = { ok: false, error: String(err) }; }
  return ContentService
    .createTextOutput(cb + '(' + JSON.stringify(out) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function handle(p) {
  var secret = PropertiesService.getScriptProperties().getProperty('EDIT_SECRET') || '';
  if (!secret) return { ok: false, error: 'no_secret_set' };
  if (String(p.secret || '') !== secret) return { ok: false, error: 'bad_secret' };
  if (p.action === 'verify') return { ok: true };
  if (p.action === 'update') return updateCell(p.id, p.field, p.value);
  return { ok: false, error: 'unknown_action' };
}

function updateCell(id, field, value) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  var data = sh.getDataRange().getValues();
  var head = data[0].map(function (h) { return String(h).toLowerCase().trim(); });
  var idCol = head.indexOf('id');
  var aliasMap = { start: ['старт', 'начало'], days: ['дней', 'длит'] };
  var aliases = aliasMap[field];
  if (!aliases) return { ok: false, error: 'bad_field' };
  var col = -1;
  for (var a = 0; a < aliases.length; a++) { var i = head.indexOf(aliases[a]); if (i >= 0) { col = i; break; } }
  if (idCol < 0 || col < 0) return { ok: false, error: 'col_not_found' };
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol]).trim() === String(id).trim()) {
      sh.getRange(r + 1, col + 1).setValue(value);
      return { ok: true, id: id, field: field, value: value };
    }
  }
  return { ok: false, error: 'id_not_found' };
}
