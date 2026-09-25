# -*- coding: utf-8 -*-
# Виджеты экранов. Прежние имена оставлены, чтобы экраны не переписывать целиком,
# но рисует всё кит Контур DS 1.5 (KS.*): один вид на всех 52 экранах и сторож DS.
WIDGETS = r'''
/* ============ ВИДЖЕТЫ ============ */
const ic = (n, cl, sz) => KS.ic(n, sz || 17, cl ? 'ks-ic ' + cl : undefined);

const bAPI  = KS.badge('api', 'ok', 'Данные приходят по API keys.so');
const bDEMO = KS.badge('демо', 'crit', 'Кабинет не подключён, экран собран на заглушках');
const bSOON = KS.badge('сборка', 'warn', 'Метод есть, выгрузка ещё не настроена');

/* Шапка экрана: заголовок, вопрос экрана, источник, строка про деньги.
   Строка про деньги обязательна: цифры нет, строка говорит почему. */
function head(t, sub, src, prio, badge, money){
  return KS.head({ title:t, sub, src, prio, badges: badge ? [badge] : [],
    lead: money || 'Строки про рубли на этом экране нет: он про метод или источник, а не про деньги. Деньги по проекту на экране «Мост до денег».' });
}

/* Плитка показателя. slot 0..4 это цвет спарклайна --cat-1..5, dfield даёт дельту за период. */
function mini(label, f, slot, icon, dfield){
  const sf_ = dfield ? sf(dfield) : null;
  const spark = sf_ ? slice().cur.map(r => r[sf_] == null ? null : r[sf_]) : null;
  return KS.tile({ label, f, slot: ((slot || 0) % 5) + 1, icon: icon || 'chart',
    delta: dfield ? dbadge(dfield) : '', spark: spark && spark.filter(x => x != null).length > 1 ? spark : null });
}

/* Карточка. У каждого графика таблица-двойник: кнопка «таблица» в шапке карточки. */
function card(t, sub, body, cls, right, table){
  return KS.card({ title:t, sub, body, cls, actions:right, table });
}
const ch = (id, h) => KS.chart(id, h);

/* Таблица. cols: [заголовок, числовая?]; от четырёх колонок на узком экране строки
   становятся карточками «подпись: значение». */
const tbl = (cols, rows, foot) => KS.table(cols, rows, { foot });
/* Горизонтальные полосы. Один ряд, один цвет слота, никакой заливки по величине. */
const bars = (items, slot) => KS.bars(items, ((slot || 0) % 5) + 1);
const note = (t, body, tone) => KS.note(t, body, tone);
/* Следующий шаг: без исполнителя и даты кит рисует предупреждение, а не шаг. */
const act = (what, who, when, crit) => KS.action({ what, who, when, crit });

/* Вердикт для собственника: стало лучше или хуже. Считается по ряду, а не по ощущению,
   и честно говорит, когда ряда не хватает. */
function verdict(){
  const s = slice();
  const tail = s.cur.length && !s.full
    ? '<div class="ks-page-src" style="margin-top:var(--sp-2)">Ряд короче выбранного периода: сравнение идёт от первой имеющейся точки '
      + ruD(SER()[0] ? SER()[0].date : '') + ', а не от полной глубины.</div>'
    : '';
  return KS.verdict(SER(), [['top10','запросы в топ-10'],['top50','запросы в топ-50'],['vis','видимость в ИИ']],
    PERIODS[PERIOD], PERIOD_LABEL[PERIOD]) + tail;
}

const g2 = 'ks-grid-2';
const g3 = 'ks-grid-kpi';
const g4 = 'ks-grid-3';
'''
