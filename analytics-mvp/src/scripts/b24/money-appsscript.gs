/**
 * GENGROUP · Деньги по сделке -> в этот лист Google.
 * Собирает по каждой сделке: бюджет (OPPORTUNITY) + суммы С/С из смарт-процессов
 * Расчёт(1060)/Калькулятор(1056)/Закупка(1074)/Производство GG(1086)/Производство GM(1120).
 * С/С-поля находит сам по названию (с/с / себестоимость), включая текстовые (стекло в Закупке).
 *
 * КАК ЗАПУСТИТЬ:
 *   1. В таблице: Расширения -> Apps Script.
 *   2. Вставить весь этот код, в WEBHOOK вписать свой вебхук Bitrix (тот же, что у отдела маркетинга).
 *   3. Сохранить, выбрать функцию fillMoney, Запустить. Первый раз попросит разрешения - разрешить.
 *   4. Лист заполнится. ID сделки - кликабельной ссылкой.
 *
 * Идём от карточек СП к сделкам (не тянем все 46k сделок), чтобы уложиться в 6-мин лимит Apps Script.
 */

var WEBHOOK = 'https://glassmemory.bitrix24.ru/rest/XXX/XXXXXXXX/'; // <- ВПИШИ свой вебхук
var PORTAL  = 'https://glassmemory.bitrix24.ru';

var SP = [
  { etid: 1060, key: 'Расчёт' },
  { etid: 1056, key: 'Калькулятор' },
  { etid: 1074, key: 'Закупка' },
  { etid: 1086, key: 'Производство GG' },
  { etid: 1120, key: 'Производство GM' }
];

// Что считаем «с/с»: название содержит с/с/себестоимость; тип число или строка (в Закупке
// стекло/фурнитура - текст, но с числом). «Бюджет заказ» - цена продажи, не с/с - исключаем.
var SS_LABEL   = /с\s*\/\s*с|себестоим/i;
var SS_EXCLUDE = /бюджет|наценк|прибыл|сумма налога|режим расч|комментар/i;
var SS_TYPES   = /^(money|double|integer|string)$/i;

function call_(method, params) {
  var url = WEBHOOK.replace(/\/+$/, '') + '/' + method + '.json';
  for (var attempt = 0; attempt < 6; attempt++) {
    var res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(params || {}), muteHttpExceptions: true
    });
    var j = JSON.parse(res.getContentText());
    if (j.error) {
      if (/QUERY_LIMIT|OPERATION_TIME_LIMIT/i.test(String(j.error))) { Utilities.sleep(1200); continue; }
      throw new Error(method + ': ' + (j.error_description || j.error));
    }
    return j;
  }
  throw new Error(method + ': не удалось (лимит запросов)');
}

function num_(v) { var n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; }
function lbl_(d) { return d.formLabel || d.listLabel || d.editFormLabel || d.title || ''; }

function ssFields_(etid) {
  var f = (call_('crm.item.fields', { entityTypeId: etid }).result || {}).fields || {};
  var out = [];
  for (var id in f) {
    var t = String(lbl_(f[id])), ty = String(f[id].type || '');
    if (SS_LABEL.test(t) && !SS_EXCLUDE.test(t) && SS_TYPES.test(ty)) out.push(id);
  }
  return out;
}

function itemsAll_(etid, select) {
  var all = [], last = 0;
  for (;;) {
    var r = (call_('crm.item.list', { entityTypeId: etid, select: select, filter: { '>id': last }, order: { id: 'ASC' } }).result || {}).items || [];
    if (!r.length) break;
    all = all.concat(r);
    last = r[r.length - 1].id;
    if (r.length < 50) break; // crm.item.list отдаёт по 50
  }
  return all;
}

function fillMoney() {
  var t0 = Date.now();
  // 1) По каждому СП: найти с/с-поля, стянуть карточки, просуммировать с/с на сделку (parentId2).
  var byDeal = {}; // dealId -> { ss: { ключ_СП: сумма } }
  SP.forEach(function (sp) {
    var ss = ssFields_(sp.etid);
    if (!ss.length) return;
    var items = itemsAll_(sp.etid, ['id', 'parentId2'].concat(ss));
    items.forEach(function (it) {
      var d = String(it.parentId2 || '');
      if (!d) return;
      var rec = byDeal[d] || (byDeal[d] = { ss: {} });
      var s = 0; ss.forEach(function (fld) { s += num_(it[fld]); });
      rec.ss[sp.key] = (rec.ss[sp.key] || 0) + s;
    });
  });

  // 2) Подтянуть бюджет/название/стадию только по этим сделкам (батчами по 50).
  var ids = Object.keys(byDeal), info = {};
  for (var i = 0; i < ids.length; i += 50) {
    var chunk = ids.slice(i, i + 50);
    var r = call_('crm.deal.list', { filter: { '@ID': chunk }, select: ['ID', 'TITLE', 'OPPORTUNITY', 'ASSIGNED_BY_ID', 'STAGE_ID', 'CLOSEDATE'] }).result || [];
    r.forEach(function (d) { info[String(d.ID)] = { title: d.TITLE, opp: num_(d.OPPORTUNITY), mgr: d.ASSIGNED_BY_ID, stage: d.STAGE_ID, close: d.CLOSEDATE }; });
  }

  // 3) Собрать строки и записать в лист.
  var header = ['Сделка', 'Название', 'Ответственный(id)', 'Бюджет']
    .concat(SP.map(function (s) { return s.key + ' с/с'; }))
    .concat(['Σ с/с', 'Маржа', 'Стадия', 'Дата закрытия']);
  var rows = [header];
  ids.map(Number).sort(function (a, b) { return b - a; }).forEach(function (idn) {
    var id = String(idn), rec = byDeal[id], nf = info[id] || {};
    var ssv = SP.map(function (s) { return Math.round(rec.ss[s.key] || 0); });
    var tot = ssv.reduce(function (a, b) { return a + b; }, 0);
    var opp = Math.round(nf.opp || 0);
    if (!opp && !tot) return; // без денег - пропускаем
    rows.push(['=HYPERLINK("' + PORTAL + '/crm/deal/details/' + id + '/","' + id + '")', nf.title || '', nf.mgr || '', opp]
      .concat(ssv).concat([tot, opp - tot, nf.stage || '', nf.close || '']));
  });

  var sh = SpreadsheetApp.getActiveSheet();
  sh.clearContents();
  sh.getRange(1, 1, rows.length, header.length).setValues(rows);
  sh.setFrozenRows(1);
  SpreadsheetApp.getActiveSpreadsheet().toast('Готово: ' + (rows.length - 1) + ' сделок за ' + Math.round((Date.now() - t0) / 1000) + ' сек');
}
