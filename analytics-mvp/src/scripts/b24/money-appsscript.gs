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
var ONLY_CATEGORY = 49; // только воронка «GG Заказы РФ» (C49). null - все воронки.

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

// ВАЖНО про двойной счёт: во многих СП есть и ИТОГ, и его составляющие, и «ПЦ С/С» (цена) - если
// сложить всё, сумма задваивается. Поэтому тут задаём, КАКИЕ поля брать в конкретном СП (по части
// названия). Если СП нет в списке - берём все поля с «с/с/себестоимость» (может задваивать!).
// Посмотри showSsFields() и впиши для каждого СП его ИТОГОВОЕ поле.
var SS_PICK = {
  1056: ['с/с итого']  // Калькулятор: только «РАСЧЕТ С/С ИТОГО» (иначе плюсуются ПЦ С/С за объём/1шт)
  // 1060: ['производственная с/с'],   // Расчёт - впиши итоговое поле, глянув showSsFields()
  // 1086: ['себестоимость производственная'], // Производство GG - итог
  // 1074 (Закупка) можно оставить авто: там складываются РАЗНЫЕ материалы (стекло+металл+фурнитура)
};

// Для ДИАГНОСТИКИ (fillDiag): «денежное» поле - тип money ИЛИ число/строка с денежным названием
// (участки, материалы, стоимости, себестоимость). Служебные (кол-во/id/даты/номера) исключаем.
var MONEY_WIDE = /с\s*\/\s*с|себестоим|стоим|цена|прайс|бюджет|закуп|расч[её]т|калькул|маржа|прибыл|рентаб|наценк|доставк|металл|стекл|зеркал|фурнитур|дерев|покрас|раскрой|сварк|гибк|слесар|зачист|нарезк|трубогиб|листогиб|токарн|профил|обрешет|работ|сумма/i;
var MONEY_EXCL = /кол-?во|количеств|номер|№|дата|срок|статус|режим расч|комментар|описан|файл|чертеж|ведомост|артикул|заказ по/i;

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
  var pick = SS_PICK[etid]; // если задано - берём только эти поля (по части названия)
  var out = [];
  for (var id in f) {
    var t = String(lbl_(f[id])).trim(), ty = String(f[id].type || '');
    if (!SS_TYPES.test(ty)) continue;
    if (pick) {
      var lo = t.toLowerCase();
      if (pick.some(function (p) { return lo.indexOf(String(p).toLowerCase()) >= 0; })) out.push(id);
    } else if (SS_LABEL.test(t) && !SS_EXCLUDE.test(t)) out.push(id);
  }
  return out;
}

// ДИАГНОСТИКА: все денежные поля СП (id + название) - для широкой выгрузки fillDiag.
function moneyFields_(etid) {
  var f = (call_('crm.item.fields', { entityTypeId: etid }).result || {}).fields || {};
  var out = [];
  for (var id in f) {
    var t = String(lbl_(f[id])).trim(), ty = String(f[id].type || '');
    if (MONEY_EXCL.test(t)) continue;
    if (ty === 'money' || ((ty === 'double' || ty === 'integer' || ty === 'string') && MONEY_WIDE.test(t))) out.push({ id: id, label: t });
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

// Названия воронок (crm.category.list) и стадий (crm.status.list) - вместо кодов C49:EXECUTING.
function nameMaps_() {
  var cats = { '0': 'Общая' }, stages = {};
  var c = (call_('crm.category.list', { entityTypeId: 2 }).result || {}).categories || [];
  c.forEach(function (x) { cats[String(x.id)] = x.name; });
  var st = call_('crm.status.list', { filter: {} }).result || [];
  var start = 50;
  while (st.length && st.length % 50 === 0) {
    var more = call_('crm.status.list', { filter: {}, start: start }).result || [];
    if (!more.length) break; st = st.concat(more); start += 50;
  }
  st.forEach(function (s) { stages[s.STATUS_ID] = s.NAME; });
  return { cats: cats, stages: stages };
}

// Справочник сотрудников: id -> «Фамилия Имя» (для колонки «Ответственный»).
function userMap_() {
  var m = {}, start = 0;
  for (;;) {
    var r = call_('user.get', { start: start }).result || [];
    if (!r.length) break;
    r.forEach(function (u) { m[String(u.ID)] = ((u.LAST_NAME || '') + ' ' + (u.NAME || '')).trim() || ('id' + u.ID); });
    if (r.length < 50) break;
    start += 50;
  }
  return m;
}

// СЛУЖЕБНАЯ: показать, какие поля идут в с/с по каждому СП (Просмотр -> Журналы выполнения).
function showSsFields() {
  SP.forEach(function (sp) {
    var f = (call_('crm.item.fields', { entityTypeId: sp.etid }).result || {}).fields || {};
    var picked = [];
    for (var id in f) {
      var t = String(lbl_(f[id])), ty = String(f[id].type || '');
      if (SS_LABEL.test(t) && !SS_EXCLUDE.test(t) && SS_TYPES.test(ty)) picked.push('«' + t + '» (' + ty + ')');
    }
    Logger.log(sp.key + ' [' + sp.etid + ']: ' + (picked.join(' + ') || 'нет'));
  });
}

function fillMoney() {
  var t0 = Date.now();
  var maps = nameMaps_();
  var users = {}; try { users = userMap_(); } catch (e) { /* нет доступа к user.get - оставим id */ }
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
    var r = call_('crm.deal.list', { filter: { '@ID': chunk }, select: ['ID', 'TITLE', 'OPPORTUNITY', 'ASSIGNED_BY_ID', 'CATEGORY_ID', 'STAGE_ID', 'CLOSEDATE'] }).result || [];
    r.forEach(function (d) { info[String(d.ID)] = { title: d.TITLE, opp: num_(d.OPPORTUNITY), mgr: d.ASSIGNED_BY_ID, cat: d.CATEGORY_ID, stage: d.STAGE_ID, close: d.CLOSEDATE }; });
  }

  // 3) Собрать строки и записать в лист.
  var header = ['Сделка', 'Название', 'Ответственный', 'Бюджет']
    .concat(SP.map(function (s) { return s.key + ' с/с'; }))
    .concat(['Σ с/с', 'Маржа', 'Воронка', 'Стадия', 'Дата закрытия']);
  var rows = [header];
  ids.map(Number).sort(function (a, b) { return b - a; }).forEach(function (idn) {
    var id = String(idn), rec = byDeal[id], nf = info[id] || {};
    if (ONLY_CATEGORY != null && String(nf.cat) !== String(ONLY_CATEGORY)) return; // только нужная воронка
    var ssv = SP.map(function (s) { return Math.round(rec.ss[s.key] || 0); });
    var tot = ssv.reduce(function (a, b) { return a + b; }, 0);
    var opp = Math.round(nf.opp || 0);
    if (!opp && !tot) return; // без денег - пропускаем
    var funnel = maps.cats[String(nf.cat)] || (nf.cat != null ? 'воронка ' + nf.cat : '');
    var stage = maps.stages[nf.stage] || nf.stage || '';
    var mgr = users[String(nf.mgr)] || (nf.mgr || '');
    rows.push(['=HYPERLINK("' + PORTAL + '/crm/deal/details/' + id + '/","' + id + '")', nf.title || '', mgr, opp]
      .concat(ssv).concat([tot, opp - tot, funnel, stage, nf.close || '']));
  });

  var sh = SpreadsheetApp.getActiveSheet();
  sh.clearContents();
  sh.getRange(1, 1, rows.length, header.length).setValues(rows);
  sh.setFrozenRows(1);
  SpreadsheetApp.getActiveSpreadsheet().toast('Готово: ' + (rows.length - 1) + ' сделок за ' + Math.round((Date.now() - t0) / 1000) + ' сек');
}

// ШИРОКАЯ ДИАГНОСТИКА: одна строка на сделку, но ВСЕ денежные поля по каждому СП отдельными
// колонками + индикатор «через что считали» (Калькулятор/Расчёт) + ссылки на карточки СП.
// Заполняет активный лист. Запусти вместо fillMoney, когда надо понять, как всё устроено.
function fillDiag() {
  var t0 = Date.now();
  var maps = nameMaps_();
  var users = {}; try { users = userMap_(); } catch (e) {}
  // Поля по каждому СП + сбор сумм/первой карточки на сделку.
  var spCols = [];               // [{ sp, cols:[{id,label,col}] }]
  var perDeal = {};              // dealId -> { vals:{col:sum}, card:{spKey:cardId} }
  SP.forEach(function (sp) {
    var mf = moneyFields_(sp.etid);
    var cols = mf.map(function (m) { return { id: m.id, label: m.label, col: sp.key + ' · ' + m.label }; });
    spCols.push({ sp: sp, cols: cols });
    if (!mf.length) return;
    var items = itemsAll_(sp.etid, ['id', 'parentId2'].concat(mf.map(function (m) { return m.id; })));
    items.forEach(function (it) {
      var d = String(it.parentId2 || ''); if (!d) return;
      var rec = perDeal[d] || (perDeal[d] = { vals: {}, card: {} });
      if (!rec.card[sp.key]) rec.card[sp.key] = it.id; // первая карточка СП - для ссылки
      cols.forEach(function (c) { var v = num_(it[c.id]); if (v) rec.vals[c.col] = (rec.vals[c.col] || 0) + v; });
    });
  });
  // Сделки (бюджет/название/стадия).
  var ids = Object.keys(perDeal), info = {};
  for (var i = 0; i < ids.length; i += 50) {
    var chunk = ids.slice(i, i + 50);
    var r = call_('crm.deal.list', { filter: { '@ID': chunk }, select: ['ID', 'TITLE', 'OPPORTUNITY', 'ASSIGNED_BY_ID', 'CATEGORY_ID', 'STAGE_ID'] }).result || [];
    r.forEach(function (d) { info[String(d.ID)] = { title: d.TITLE, opp: num_(d.OPPORTUNITY), mgr: d.ASSIGNED_BY_ID, cat: d.CATEGORY_ID, stage: d.STAGE_ID }; });
  }
  // Заголовок: фикс + ссылки на карточки СП + все денежные поля (сгруппированы по СП).
  var moneyCols = [];
  spCols.forEach(function (sc) { sc.cols.forEach(function (c) { moneyCols.push(c.col); }); });
  var header = ['Сделка', 'Название', 'Ответственный', 'Бюджет', 'Расчёт через']
    .concat(SP.map(function (s) { return '↗ ' + s.key; }))
    .concat(['Воронка', 'Стадия']).concat(moneyCols);
  var rows = [header];
  function itemLink_(etid, cardId) { return cardId ? '=HYPERLINK("' + PORTAL + '/crm/type/' + etid + '/details/' + cardId + '/","открыть")' : ''; }
  ids.map(Number).sort(function (a, b) { return b - a; }).forEach(function (idn) {
    var id = String(idn), rec = perDeal[id], nf = info[id] || {};
    if (ONLY_CATEGORY != null && String(nf.cat) !== String(ONLY_CATEGORY)) return;
    var via = []; if (rec.card['Калькулятор']) via.push('Калькулятор'); if (rec.card['Расчёт']) via.push('Расчёт');
    var row = ['=HYPERLINK("' + PORTAL + '/crm/deal/details/' + id + '/","' + id + '")', nf.title || '',
      users[String(nf.mgr)] || (nf.mgr || ''), Math.round(nf.opp || 0), via.join(' + ') || '—'];
    SP.forEach(function (s) { row.push(itemLink_(s.etid, rec.card[s.key])); });
    row.push(maps.cats[String(nf.cat)] || '', maps.stages[nf.stage] || nf.stage || '');
    moneyCols.forEach(function (col) { var v = Math.round(rec.vals[col] || 0); row.push(v || ''); });
    rows.push(row);
  });
  var sh = SpreadsheetApp.getActiveSheet();
  sh.clearContents();
  sh.getRange(1, 1, rows.length, header.length).setValues(rows);
  sh.setFrozenRows(1); sh.setFrozenColumns(1);
  SpreadsheetApp.getActiveSpreadsheet().toast('Диагностика: ' + (rows.length - 1) + ' сделок, ' + header.length + ' колонок за ' + Math.round((Date.now() - t0) / 1000) + ' сек');
}
