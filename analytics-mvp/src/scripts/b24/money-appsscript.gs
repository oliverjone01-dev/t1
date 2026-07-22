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

// ISO-дату «2026-07-21T13:07:41+03:00» -> ['21.07.2026','13:07'] (дата и время отдельно).
function dsplit_(v) {
  if (!v) return ['', ''];
  var m = String(v).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (m) return [m[3] + '.' + m[2] + '.' + m[1], m[4] + ':' + m[5]];
  var d = String(v).match(/(\d{4})-(\d{2})-(\d{2})/);
  return d ? [d[3] + '.' + d[2] + '.' + d[1], ''] : [String(v), ''];
}

// Цвета групп колонок: [фон заголовка (насыщ.), фон тела (светлый)].
var GCOL = {
  'Сделка':          ['#4A86E8', '#D6E2FA'],
  'Расчёт':          ['#38A169', '#DDF3E4'],
  'Калькулятор':     ['#D69E2E', '#FBF0D0'],
  'Закупка':         ['#DD6B20', '#FCE4D2'],
  'Производство GG': ['#805AD5', '#E7DEF9'],
  'Производство GM': ['#D53F8C', '#FBDCEC']
};

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
    rows.push(['=HYPERLINK("' + PORTAL + '/crm/deal/details/' + id + '/";"' + id + '")', nf.title || '', mgr, opp]
      .concat(ssv).concat([tot, opp - tot, funnel, stage, nf.close || '']));
  });

  var sh = SpreadsheetApp.getActiveSheet();
  sh.clearContents();
  sh.getRange(1, 1, rows.length, header.length).setValues(rows);
  sh.setFrozenRows(1);
  SpreadsheetApp.getActiveSpreadsheet().toast('Готово: ' + (rows.length - 1) + ' сделок за ' + Math.round((Date.now() - t0) / 1000) + ' сек');
}

// Названия стадий КОНКРЕТНОГО СП (у каждого свои). crm.item.fields -> поле stageId со списком
// значений items:[{ID,NAME}] (STATUS_ID/VALUE - на других порталах). Возвращаем карту код->имя.
function spStages_(etid) {
  var f = (call_('crm.item.fields', { entityTypeId: etid }).result || {}).fields || {};
  var def = f.stageId || f.STAGE_ID || {};
  var items = def.items || (def.settings && def.settings.items) || [];
  var m = {};
  items.forEach(function (it) {
    var code = it.ID != null ? it.ID : (it.STATUS_ID != null ? it.STATUS_ID : it.VALUE);
    m[String(code)] = it.NAME || it.VALUE || '';
  });
  return m;
}

// ШИРОКАЯ ДИАГНОСТИКА: одна строка на сделку. По сделке И по каждому СП - своя цветная группа
// колонок: ссылка, текущая стадия, дата+время создания и закрытия (СП живёт в своём окне), а
// дальше все денежные поля этого СП отдельными столбцами. Сделка живёт от создания до закрытия;
// каждый СП - от запуска (createdTime) до закрытия (closedate) в своём окне, привязка к сделке
// через parentId2. Запусти вместо fillMoney, когда надо понять, как всё устроено.
function fillDiag() {
  var t0 = Date.now();
  var maps = nameMaps_();
  var users = {}; try { users = userMap_(); } catch (e) {}

  // По каждому СП: денежные поля + карта стадий + сбор карточки/сумм/окна жизни на сделку.
  var spMeta = [];   // [{ sp, cols:[{id,label,col}], sm:{код->стадия} }]
  var perDeal = {};  // dealId -> { vals:{col:sum}, sp:{ spKey:{card,etid,created,closed,stage} } }
  SP.forEach(function (sp) {
    var mf = moneyFields_(sp.etid);
    var cols = mf.map(function (m) { return { id: m.id, label: m.label, col: sp.key + ' · ' + m.label }; });
    var sm = {}; try { sm = spStages_(sp.etid); } catch (e) {}
    spMeta.push({ sp: sp, cols: cols, sm: sm });
    var sel = ['id', 'parentId2', 'stageId', 'createdTime', 'closedate'].concat(mf.map(function (m) { return m.id; }));
    var items = itemsAll_(sp.etid, sel);
    items.forEach(function (it) {
      var d = String(it.parentId2 || ''); if (!d) return;
      var rec = perDeal[d] || (perDeal[d] = { vals: {}, sp: {} });
      var s = rec.sp[sp.key] || (rec.sp[sp.key] = { card: it.id, etid: sp.etid, created: '', closed: '', stage: '' });
      s.card = it.id;                                                    // ASC -> последняя = самая свежая карточка
      s.stage = sm[String(it.stageId)] || it.stageId || '';             // текущая стадия СП (самой свежей карточки)
      if (it.createdTime && (!s.created || it.createdTime < s.created)) s.created = it.createdTime; // окно жизни: старт
      if (it.closedate && (!s.closed || it.closedate > s.closed)) s.closed = it.closedate;         // окно жизни: закрытие
      cols.forEach(function (c) { var v = num_(it[c.id]); if (v) rec.vals[c.col] = (rec.vals[c.col] || 0) + v; });
    });
  });

  // Сделки: бюджет/название/стадия + окно жизни (DATE_CREATE ... CLOSEDATE).
  var ids = Object.keys(perDeal), info = {};
  for (var i = 0; i < ids.length; i += 50) {
    var chunk = ids.slice(i, i + 50);
    var r = call_('crm.deal.list', { filter: { '@ID': chunk }, select: ['ID', 'TITLE', 'OPPORTUNITY', 'ASSIGNED_BY_ID', 'CATEGORY_ID', 'STAGE_ID', 'DATE_CREATE', 'CLOSEDATE'] }).result || [];
    r.forEach(function (d) { info[String(d.ID)] = { title: d.TITLE, opp: num_(d.OPPORTUNITY), mgr: d.ASSIGNED_BY_ID, cat: d.CATEGORY_ID, stage: d.STAGE_ID, created: d.DATE_CREATE, closed: d.CLOSEDATE }; });
  }

  // Группы колонок (для цвета): у каждой - имя (ключ GCOL), заголовки и функция ячеек строки.
  var groups = [];
  groups.push({ name: 'Сделка',
    heads: ['Сделка', 'Название', 'Ответственный', 'Бюджет', 'Воронка', 'Стадия сделки', 'Создана (дата)', '(время)', 'Закрыта (дата)', '(время)'],
    cells: function (id, rec, nf) {
      var cr = dsplit_(nf.created), cl = dsplit_(nf.closed);
      return ['=HYPERLINK("' + PORTAL + '/crm/deal/details/' + id + '/";"' + id + '")', nf.title || '',
        users[String(nf.mgr)] || (nf.mgr || ''), Math.round(nf.opp || 0),
        maps.cats[String(nf.cat)] || '', maps.stages[nf.stage] || nf.stage || '',
        cr[0], cr[1], cl[0], cl[1]];
    } });
  spMeta.forEach(function (m) {
    groups.push({ name: m.sp.key,
      heads: ['↗ ' + m.sp.key, 'Стадия СП', 'Создан (дата)', '(время)', 'Закрыт (дата)', '(время)'].concat(m.cols.map(function (c) { return c.label; })),
      cells: function (id, rec, nf) {
        var s = rec.sp[m.sp.key], out;
        if (s) {
          var cr = dsplit_(s.created), cl = dsplit_(s.closed);
          out = ['=HYPERLINK("' + PORTAL + '/crm/type/' + s.etid + '/details/' + s.card + '/";"открыть")', s.stage || '', cr[0], cr[1], cl[0], cl[1]];
        } else { out = ['', '', '', '', '', '']; }
        m.cols.forEach(function (c) { var v = Math.round(rec.vals[c.col] || 0); out.push(v || ''); });
        return out;
      } });
  });

  // Заголовок + строки.
  var header = [];
  groups.forEach(function (g) { header = header.concat(g.heads); });
  var rows = [header];
  ids.map(Number).sort(function (a, b) { return b - a; }).forEach(function (idn) {
    var id = String(idn), rec = perDeal[id], nf = info[id] || {};
    if (ONLY_CATEGORY != null && String(nf.cat) !== String(ONLY_CATEGORY)) return;
    var row = [];
    groups.forEach(function (g) { row = row.concat(g.cells(id, rec, nf)); });
    rows.push(row);
  });

  var sh = SpreadsheetApp.getActiveSheet();
  sh.clear(); // чистим и содержимое, и старую заливку прошлого прогона
  sh.getRange(1, 1, rows.length, header.length).setValues(rows);
  sh.setFrozenRows(1); sh.setFrozenColumns(1);

  // Заливка групп: заголовок насыщенный + белый жирный, тело - светлый оттенок того же цвета.
  var col = 1;
  groups.forEach(function (g) {
    var pal = GCOL[g.name] || ['#666666', '#EEEEEE'], w = g.heads.length;
    sh.getRange(1, col, 1, w).setBackground(pal[0]).setFontColor('#FFFFFF').setFontWeight('bold');
    if (rows.length > 1) sh.getRange(2, col, rows.length - 1, w).setBackground(pal[1]);
    col += w;
  });

  SpreadsheetApp.getActiveSpreadsheet().toast('Диагностика: ' + (rows.length - 1) + ' сделок, ' + header.length + ' колонок за ' + Math.round((Date.now() - t0) / 1000) + ' сек');
}
