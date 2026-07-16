/**
 * GG-MarkPlan - мост записи в Google-таблицу.
 * Позволяет графику на сайте писать «Старт» и «Дней» обратно в лист при
 * перетаскивании краёв бара. Пароль хранится ТОЛЬКО здесь (Script Properties),
 * в коде сайта его нет.
 *
 * Установка (один раз):
 *  1. Таблица → Расширения (Extensions) → Apps Script.
 *  2. Удалить всё и вставить этот файл. Сохранить (Ctrl+S).
 *  3. Задать пароль: выбрать функцию setPassword в списке сверху, вписать
 *     свой пароль в строке ниже (PASSWORD_HERE), запустить (Run) один раз,
 *     разрешить доступ. Потом можно вернуть строку обратно на пусто.
 *     (или Project Settings → Script Properties → добавить EDIT_SECRET вручную)
 *  4. Deploy → New deployment → тип «Web app» → Execute as: Me,
 *     Who has access: Anyone → Deploy → скопировать «Web app URL».
 *  5. Прислать этот URL - вставим его в сайт (meta.writeUrl).
 */

var SHEET_NAME = 'GANTT'; // имя листа с задачами

// ЗАДАТЬ ПАРОЛЬ: впишите пароль между кавычек и запустите функцию один раз.
function setPassword() {
  var PASSWORD_HERE = '';
  if (!PASSWORD_HERE) throw new Error('Впишите пароль в переменную PASSWORD_HERE и запустите снова.');
  PropertiesService.getScriptProperties().setProperty('EDIT_SECRET', PASSWORD_HERE);
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
