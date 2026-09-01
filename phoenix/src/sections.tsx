import { useState } from "react";
import * as D from "./data";
import { Reveal, Num, T, fmt, pct } from "./lib";
import * as Ch from "./charts";

export const SECTIONS = [
  { id: "glavnoe", n: "01", t: "Главное" },
  { id: "zayavki", n: "02", t: "Заявки: откуда и почём" },
  { id: "dengi", n: "03", t: "Куда уходят деньги" },
  { id: "poisk", n: "04", t: "Бесплатный поиск" },
  { id: "rynok", n: "05", t: "Кто соперники" },
  { id: "obyavleniya", n: "06", t: "Объявления" },
  { id: "cena", n: "07", t: "Цена" },
  { id: "neiroseti", n: "08", t: "Нейросети" },
  { id: "plan-iyul", n: "09", t: "План июля: факты" },
  { id: "plan-sentyabr", n: "10", t: "План сентября" },
  { id: "stop", n: "11", t: "Стоп-правила и риски" },
  { id: "neizvestno", n: "12", t: "Чего мы не знаем" },
];

/* Якорь стоит ПЕРЕД заголовком: иначе подсветка в рельсе отстаёт на раздел. */
function Head({ id, n, t, lead }: { id: string; n: string; t: string; lead?: string }) {
  return (
    <>
      <span id={id} aria-hidden="true" />
      <Reveal>
        <div className="sec__head"><span className="sec__n">{n}</span><h2>{t}</h2></div>
        {lead && <p className="sec__lead">{lead}</p>}
      </Reveal>
    </>
  );
}

/* ================= обложка ================= */
export function Hero() {
  return (
    <header className="hero">
      <Reveal>
        <div className="hero__kicker">
          <span>GENGROUP · GENGLASS</span><span>·</span>
          <span>разбор направления</span><span>·</span>
          <b>замер {D.MEASURED}</b>
        </div>
      </Reveal>
      <Reveal delay={90}>
        <h1>Перегородки забрали <em>весь</em> рекламный бюджет и не забрали выдачу</h1>
      </Reveal>
      <Reveal delay={180}>
        <p className="hero__sub">
          За август направление съело всю рекламу компании и принесло 95 заявок.
          Бесплатный поиск за тот же месяц принёс 133 заявки и не стоил ни рубля за клики.
          Перегородок в нём почти нет.
        </p>
      </Reveal>
      <Reveal delay={260}>
        <div className="figurehead">
          <div>
            <div className="fh__v"><Num v={D.SPEND_TOTAL} /> ₽</div>
            <div className="fh__l">расход на рекламу за 30 дней</div>
            <div className="fh__n">все восемь работавших кампаний перегородочные</div>
          </div>
          <div>
            <div className="fh__v oxide"><Num v={95} dur={900} /></div>
            <div className="fh__l">заявок с рекламы</div>
            <div className="fh__n">по <Num v={D.CPL} dur={1300} /> ₽ за заявку</div>
          </div>
          <div>
            <div className="fh__v moss"><Num v={133} dur={900} /></div>
            <div className="fh__l">заявок из бесплатного поиска</div>
            <div className="fh__n">0 ₽ за клики</div>
          </div>
          <div>
            <div className="fh__v">0 <span style={{ fontSize: ".42em", letterSpacing: 0 }}>из 10</span></div>
            <div className="fh__l">перегородочных страниц в десятке сильнейших страниц сайта</div>
            <div className="fh__n">там зеркала, стеллажи, столы, доски</div>
          </div>
        </div>
      </Reveal>
    </header>
  );
}

/* ================= 01 главное ================= */
export function Glavnoe() {
  const items = [
    ["Бесплатный поиск в сумме конвертирует вдвое лучше платного.",
      "Из ста посетителей с рекламы заявку оставляют двое, из ста пришедших из выдачи - пятеро. Но 72% визитов бесплатного поиска в срезе фраз - запросы с нашим названием, а такой человек уже выбрал."],
    ["Мы платим там, где дороже всего, и не занимаем то, что бесплатно.",
      "Клик по «стеклу» стоит 194 ₽ против 69 ₽ по «зонированию», и отдельной сильной страницы под стекло у нас нет."],
    ["Козырь по цене не используется в рекламе.",
      "Под ключ мы ниже средней по рынку на 20-43%, а ни в одном из 147 наших объявлений нет цифры цены. У троих из пяти конкурентов она есть."],
    ["Бюджет за месяц не сократился, он перетёк.",
      "Товарную галерею остановили 16 августа, и это правильно, но дневной расход после этого вырос на 13,5%."],
  ];
  return (
    <section className="sec">
      <Head id="glavnoe" n="01" t="Главное"
        lead="Прогресс есть в рекламном кабинете и почти отсутствует на сайте. Полтора месяца работа шла там, где деньги тратятся, и не шла там, где они экономятся." />
      <div className="stack">
        {items.map(([t, b], i) => (
          <Reveal key={i} delay={i * 70}><div className="stack__i"><i>{String(i + 1).padStart(2, "0")}</i>
            <p><b style={{ fontWeight: 600 }}>{t}</b> {b}</p></div></Reveal>
        ))}
      </div>
      <div className="rule rule--brass" />
    </section>
  );
}

/* ================= 02 заявки ================= */
export function Zayavki() {
  const bs = D.BRAND_SHARE;
  return (
    <section className="sec">
      <Head id="zayavki" n="02" t="Заявки: откуда и почём"
        lead={`Цели Метрики настроены и работают. Заявка - это достижение цели «CRM. Все лиды» за ${D.WINDOW_30}.`} />
      <Reveal><Ch.ChannelBars /></Reveal>

      <Reveal>
        <div className="note note--alarm">
          <b className="note__t">Оговорка, без которой цифра 133 вводит в заблуждение</b>
          <p>Значительная часть бесплатного поиска - люди, которые ищут нас по названию: «genglass официальный сайт», «генгласс».
            В срезе пятидесяти самых частых поисковых фраз такие запросы дают <b>{bs.brandVisits} визита из {bs.sliceVisits}, это {Math.round(100 * bs.brandVisits / bs.sliceVisits)}% среза</b> <T k="d" />.
            Человек, который ищет нас по имени, уже про нас знает: его готовность оставить заявку на новые страницы про перегородки не переносится.
            Сколько дают небрендовые запросы, мы не знаем: выгрузки заявок по фразам нет. Это задача 3.</p>
        </div>
      </Reveal>

      <Reveal>
        <div className="note note--good">
          <b className="note__t">«Бесплатный» не значит «даром»</b>
          <p>У бесплатного поиска нет платы за клики, но есть стоимость работы: страницы пишут и верстают люди.
            План сентября - это примерно <b>{D.EFFORT.reduce((s, e) => s + e.days, 0)} человеко-дней</b> <T k="h" />: {D.EFFORT.map((e) => `${e.who} ${e.days}`).join(", ")}.
            Правильное сравнение звучит так: {fmt(D.CPL)} ₽ за заявку, которая приходит только пока идёт оплата,
            против рабочих дней за поток, который остаётся с нами после того, как работа сделана.</p>
        </div>
      </Reveal>

      <Reveal>
        <h3 style={{ fontSize: "1.05rem", marginTop: "2rem" }}>Три оговорки, без которых цифру нельзя нести в решение</h3>
        <div className="stack">
          <div className="stack__i"><i>a</i><p><b>Расхождение по рекламным визитам.</b> Директ насчитал {fmt(D.CLICKS_TOTAL)} кликов, Метрика записала {fmt(4047)} рекламных визитов. Разница втрое. Это незакрытый вопрос атрибуции, флаг по нему висит с 8 июля. Числитель в цене заявки надёжен, знаменатель даёт та же атрибуция: если она относит к рекламе не те визиты, вместе с ними сдвинется и {fmt(D.CPL)} ₽.</p></div>
          <div className="stack__i"><i>b</i><p><b>По кампаниям заявки разложить пока нельзя.</b> Номер кампании несут только 43 заявки, ещё 49 идут под общей меткой без номера, 5 под прочими. Это дефект разметки ссылок, чинится за один заход.</p></div>
          <div className="stack__i"><i>c</i><p><b>Два среза одного файла расходятся:</b> разбивка по меткам даёт 97 заявок и 4 042 визита, разбивка по каналам 95 и 4 047. Разница небольшая, но её причину надо назвать, а не замалчивать.</p></div>
        </div>
      </Reveal>
      <div className="rule" />
    </section>
  );
}

/* ================= 03 деньги ================= */
export function Dengi() {
  return (
    <section className="sec">
      <Head id="dengi" n="03" t="Куда уходят деньги"
        lead={`Из 34 кампаний кабинета в августе работали восемь, и все восемь перегородочные. Семь тратили деньги, восьмая работала с нулевым расходом. Окно: ${D.WINDOW_30}.`} />
      <Reveal><Ch.SpendSplit /></Reveal>
      <Reveal>
        <div className="tw">
          <table>
            <thead><tr><th>Кампания</th><th className="n">Расход, ₽</th><th className="n">Клики</th><th className="n">Цена клика</th><th className="n">CTR</th><th>Статус</th></tr></thead>
            <tbody>
              {D.CAMPAIGNS.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td className="n">{fmt(c.spend)}</td>
                  <td className="n">{c.clicks}</td>
                  <td className="n">{c.cpc ? `${c.cpc} ₽` : <span className="dim">-</span>}</td>
                  <td className={"n " + (c.ctr < 3 ? "bad" : "")}>{pct(c.ctr, 2)}</td>
                  <td className={c.state.startsWith("остан") ? "mid" : "dim"}>{c.state}</td>
                </tr>
              ))}
              <tr><td><b>Итого</b></td><td className="n"><b>{fmt(D.SPEND_TOTAL)}</b></td><td className="n"><b>{fmt(D.CLICKS_TOTAL)}</b></td><td className="n"><b>112 ₽</b></td><td className="n dim">1,47%</td><td className="dim">см. сноску</td></tr>
            </tbody>
          </table>
        </div>
        <p className="chart__n">Итоговая кликабельность 1,47% ниже кликабельности любой отдельной кампании и их средней не является: {fmt(68647)} из {fmt(D.IMPRESSIONS_TOTAL)} показов приходятся на баннеры РСЯ и тянут общий знаменатель вниз. Сравнивать надо строки, а не итог. Ретаргетинг, судя по названию кампании, оплачивается за конверсии, а не за клики, поэтому у него ноль в расходе при 36 переходах.</p>
      </Reveal>

      <Reveal><Ch.DailySpend /></Reveal>
      <Reveal>
        <div className="note note--alarm">
          <b className="note__t">Порядок изменений нарушен</b>
          <p>Три кампании остановлены 16 августа при открытом с 8 июля флаге проверки атрибуции, который по нашему же регламенту блокирует изменения в кабинете.
            Записи о том, кто и на каком основании это сделал, в репозитории нет. Решение по сути верное, порядок нарушен.</p>
        </div>
      </Reveal>

      <Reveal><Ch.CtrPair /></Reveal>
      <Reveal><Ch.CpcThemes /></Reveal>
      <div className="rule" />
    </section>
  );
}

/* ================= 04 поиск ================= */
export function Poisk() {
  return (
    <section className="sec">
      <Head id="poisk" n="04" t="Бесплатный поиск"
        lead="Десять самых сильных страниц сайта - зеркала, стеллажи, столы и доски. Перегородок среди них нет." />
      <Reveal>
        <div className="tw">
          <table>
            <thead><tr><th>Страница</th><th className="n">Заметность</th><th className="n">топ-3</th><th className="n">топ-10</th><th className="n">топ-50</th></tr></thead>
            <tbody>
              {D.OUR_PAGES.map((p) => (
                <tr key={p.url}>
                  <td>{p.short}<div className="mono">{p.url}</div></td>
                  <td className={"n " + (p.vis >= 40 ? "good" : p.vis <= 1 ? "bad" : "")}>{p.vis}</td>
                  <td className="n">{p.t3}</td><td className="n">{p.t10}</td><td className="n">{p.t50}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
      <Reveal>
        <div className="note note--brass">
          <b className="note__t">Самое дешёвое движение</b>
          <p>Три страницы уже показываются по 18-29 запросам и ни по одному не попали в тройку: стеллажи-перегородки, раздвижные стеклянные, гармошка.
            Поднять существующую страницу с пятнадцатого места на пятое дешевле и быстрее, чем создать новую с нуля.</p>
        </div>
      </Reveal>
      <Reveal><Ch.PageTraffic /></Reveal>
      <Reveal>
        <p style={{ marginTop: "1.4rem" }}>На сайте живут два параллельных дерева перегородок. Четыре категории существуют в обеих ветках одновременно,
          ещё пять живут только в старом дереве и дают вместе 6 единиц заметности <T k="d" />. Поисковик видит два адреса под один смысл и делит между ними доверие.
          Чинится склейкой и переносом трёх категорий, а не написанием новых текстов. Это была задача со сроком 30 июля.</p>
      </Reveal>
      <div className="rule" />
    </section>
  );
}

/* ================= 05 рынок ================= */
export function Rynok() {
  return (
    <section className="sec">
      <Head id="rynok" n="05" t="Кто соперники"
        lead="В аукционе мы бьёмся в основном с теми, у кого в нашей теме нет бесплатной выдачи. А в выдаче нас обходят те, кто почти не платит." />
      <Reveal><Ch.CompetitorMap /></Reveal>
      <Reveal>
        <div className="tw">
          <table>
            <thead><tr><th>Сайт</th><th className="n">топ-3</th><th className="n">топ-10</th><th className="n">Заметность</th><th className="n">Рекламных запросов</th><th className="n">ИИ-ответы</th><th className="n">Авторитет</th></tr></thead>
            <tbody>
              {D.COMPETITORS.map((c) => (
                <tr key={c.d} className={c.us ? "us" : ""}>
                  <td>{c.d}{c.us && <span className="dim"> (мы)</span>}</td>
                  <td className="n">{c.t3}</td><td className="n">{c.t10}</td><td className="n">{c.vis}</td>
                  <td className={"n " + (c.ads > 400 ? "bad" : "")}>{c.ads}</td>
                  <td className="n">{c.ai}</td><td className="n">{c.dr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="chart__n">Авторитет - оценка keys.so по числу и качеству ссылок на сайт со стороны, шкала 0-100. Заметность здесь - шкала сайта целиком, с суммами по отдельным страницам ниже она не сравнивается.</p>
      </Reveal>
      <Reveal>
        <div className="stack">
          <div className="stack__i"><i>1</i><p><b>fdmebel.ru владеет выдачей и не платит вообще.</b> 750 запросов на первой странице, ноль рекламных запросов. Это модель, к которой мы хотим прийти.</p></div>
          <div className="stack__i"><i>2</i><p><b>kristal360 и peregorodki-prostor живут только в рекламе.</b> 701 и 491 рекламный запрос при нулевой выдаче. Переторговать их нельзя: им больше некуда тратить.</p></div>
          <div className="stack__i"><i>3</i><p><b>Мы посередине и в неудобной точке.</b> Третье место из семи по рекламным запросам и четвёртое по запросам в тройке. Платим как рекламный игрок, а в выдаче слабее трёх соперников.</p></div>
        </div>
      </Reveal>
      <Reveal><Ch.VisibilityGap /></Reveal>
      <Reveal>
        <div className="note">
          <b className="note__t">Что у loftcase устроено иначе</b>
          <p>Один короткий адрес под весь смысл вместо нашей россыпи из тридцати трёх. Отдельные страницы под конкретную ситуацию в квартире:
            «перегородка между кухней и коридором» даёт им 54 единицы одной страницей. И гардеробные, которых у нас нет вообще.</p>
          <p>А вот фильтры каталога, которые я собирался рекомендовать, у них почти не работают: девять адресов в индексе, семь из девяти с нулём,
            все вместе 4 единицы из 1 042. Поэтому в план они идут не задачей, а опытом на двух адресах. Копировать соседа без проверки результата не надо.</p>
        </div>
      </Reveal>
      <div className="rule" />
    </section>
  );
}

/* ================= 06 объявления ================= */
export function Obyavleniya() {
  const M = D.AD_MATRIX;
  return (
    <section className="sec">
      <Head id="obyavleniya" n="06" t="Объявления"
        lead="Шесть признаков, по которым человек выбирает между одинаковыми объявлениями. У нас нет ни одного." />
      <Reveal>
        <div className="tw">
          <table>
            <thead><tr><th>Признак</th>{M.domains.map((d) => <th key={d.d} className={d.us ? "" : "dim"}>{d.d}</th>)}</tr></thead>
            <tbody>
              {M.features.map((f, i) => (
                <tr key={f}>
                  <td>{f}</td>
                  {M.domains.map((d) => {
                    const v = d.v[i];
                    const bad = v === "нет";
                    return <td key={d.d} className={bad ? "bad" : d.us ? "" : "good"} style={{ fontSize: ".82rem" }}>{v}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="chart__n">fdmebel.ru в таблице нет: он вообще не рекламируется, объявлений у него ноль.</p>
      </Reveal>
      <Reveal>
        <div className="note note--alarm">
          <b className="note__t">Здесь и лежит нераскликанный главный запрос</b>
          <p>На фразе «межкомнатные перегородки» человеку показывают несколько похожих объявлений. У всех пяти конкурентов есть срок,
            у четверых гарантия со сроком, у троих цена. У нас на этом месте «Российский бренд» и быстрая ссылка «О компании».
            Наши быстрые ссылки - это меню сайта: 97 объявлений из {M.ourAds} ведут на «Виды перегородок» и «Консультацию».</p>
          <p><b>Важное ограничение.</b> Наши сильные факты (объём производства, число выполненных заказов) в рекламу ставить нельзя:
            по ним в июне зафиксировано вето, первоисточник не найден. Срок монтажа и гарантия тоже: производством не подтверждены.
            Без проверки можно взять только бесплатный замер и расчёт при замере - это регламент работы, а не цифра.</p>
        </div>
      </Reveal>
      <div className="rule" />
    </section>
  );
}

/* ================= 07 цена ================= */
export function Cena() {
  return (
    <section className="sec">
      <Head id="cena" n="07" t="Цена"
        lead="Под ключ значит перегородку вместе с замером, доставкой и монтажом. Снимок цен - июль 2026." />
      <Reveal><Ch.PriceDelta /></Reveal>
      <Reveal>
        <p>Не все конкуренты дороже нас: по распашной дешевле LOFT KREL ({fmt(241845)} ₽ против наших {fmt(251976)} ₽),
          по раздвижной дешевле kelman ({fmt(234800)} ₽) и LOFT KREL ({fmt(253150)} ₽). Отрыв считается от средней по рынку, а не от самого дешёвого предложения.
          Единственный тип, где мы дешевле всех, кого сравнивали, - стационарная: ближайший LOFT KREL стоит {fmt(118702)} ₽ против наших {fmt(93896)} ₽ <T k="d" />.</p>
        <p>Стационарные перегородки - точка, где сходятся три вещи: самый большой ценовой отрыв, слабая конкуренция в рекламе
          и отсутствие своей страницы в основном дереве каталога.</p>
      </Reveal>
      <div className="rule" />
    </section>
  );
}

/* ================= 08 нейросети ================= */
export function Neiroseti() {
  return (
    <section className="sec">
      <Head id="neiroseti" n="08" t="Нейросети"
        lead="keys.so считает, сколько раз домен всплывает в ответах нейросети внутри поисковой выдачи. Все домены сняты в один день одним способом." />
      <Reveal><Ch.AiCitations /></Reveal>
      <Reveal>
        <div className="note note--alarm">
          <b className="note__t">Зависимость, которую нельзя игнорировать</b>
          <p>Наш проверяющий робот получил от сайта отказ. Если сайт отвечает отказом не только нам, но и роботам поисковиков и нейросетей,
            то работа по цитируемости бессмысленна до устранения. Проверить это - первая задача сентября, и она была первой задачей июля, но не выполнена.</p>
        </div>
      </Reveal>
      <div className="rule" />
    </section>
  );
}

/* ================= 09 план июля ================= */
const S_LABEL: Record<string, [string, string]> = {
  ok: ["сделано", "good"], half: ["частично", "mid"], no: ["не сделано", "bad"],
  down: ["просело", "bad"], unknown: ["проверить нечем", "mid"],
};
export function PlanIyul() {
  const c = D.PLAN_COVERAGE;
  return (
    <section className="sec">
      <Head id="plan-iyul" n="09" t="План июля: факты"
        lead="Проверка не по отметкам в файле, а по фактам: появилась ли страница, изменился ли кабинет, есть ли след работы." />
      <Reveal>
        <div className="tw">
          <table>
            <thead><tr><th style={{ width: "3rem" }}>ID</th><th>Задача</th><th>Срок</th><th>Статус</th><th>Чем проверено</th></tr></thead>
            <tbody>
              {D.PLAN_STATUS.map((p) => {
                const [l, cls] = S_LABEL[p.s];
                return (
                  <tr key={p.id}>
                    <td className="mono">{p.id}</td><td>{p.t}</td><td className="dim">{p.due}</td>
                    <td className={cls} style={{ whiteSpace: "nowrap" }}>{l}</td>
                    <td className="dim" style={{ fontSize: ".82rem" }}>{p.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Reveal>
      <Reveal>
        <div className="note">
          <b className="note__t">Что проверено, а что нет</b>
          <p>В плане {c.total} задач, здесь проверены {c.checkedTasks} задачи в {c.checkedRows} строках. Статус {c.unchecked} пунктов не разбирался,
            причём две из них сам план помечает как повтор уже проверенных, то есть реально неизвестен статус {c.trulyUnknown}.
            Среди неразобранных весь контент-план: восемь статей со сроками с 28 июля по 31 августа.
            Косвенно видно одно: в срезе есть три перегородочные статьи блога, и у всех трёх заметность ноль.</p>
        </div>
      </Reveal>
      <Reveal>
        <div className="note note--alarm">
          <b className="note__t">Счёт по 16 проверенным задачам</b>
          <p>Сделано полностью 2. Частично 2. Держится без ухудшения 1. Просело 1. Не сделано 8. Проверить нечем 1.
            Четыре из непроверенных были помечены как первоочередные со сроком в июле: техаудит доступа роботов, склейка дублей,
            хаб гардеробных, снятие флага атрибуции. Полтора месяца работа шла в рекламном кабинете, а на сайте почти не шла.
            Это и есть главная причина, почему бесплатный поиск не вырос.</p>
        </div>
      </Reveal>
      <div className="rule rule--brass" />
    </section>
  );
}

/* ================= 10 план сентября ================= */
function TaskRow({ t }: { t: D.Task }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="task" data-open={open}>
      <button className="task__btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="task__n">{String(t.n).padStart(2, "0")}</span>
        <span>
          <span className="task__t">{t.title}</span>
          <span className="task__m"><span>{t.who}</span><span>до {t.due}</span></span>
        </span>
        <span className={`task__p p-${t.p}`}>{t.p}</span>
      </button>
      <div className="task__body"><div className="task__inner"><div className="task__wrap">
        <h4>Зачем</h4><p>{t.why}</p>
        <h4>Готово, когда</h4><p>{t.done}</p>
        {t.note && <><h4>Условия и откат</h4><p>{t.note}</p></>}
      </div></div></div>
    </div>
  );
}

export function PlanSentyabr() {
  return (
    <section className="sec">
      <Head id="plan-sentyabr" n="10" t="План сентября"
        lead="Порядок выбран по одному правилу: сначала то, что делает деньги видимыми или снимает блокировку, потом то, что строит бесплатный поток заявок. Нажмите на задачу, чтобы раскрыть обоснование и критерий приёмки." />
      <Reveal>
        <div className="note note--brass">
          <b className="note__t">Почему именно этот путь, а не два других</b>
          <p><b>Поднять ставки</b> - отклонено: соперникам в аукционе некуда уходить, торговля упирается в их бюджет, а не в нашу правоту.</p>
          <p><b>Купить ссылки</b> - отложено по нашему же правилу: ссылки покупаются на существующие страницы, а хабов гардеробных и стеклянных нет.</p>
          <p><b>Строить и чинить страницы</b> - выбрано: единственный путь, где результат остаётся с нами после того, как деньги перестали тратиться.
            Чем рискован: вдвое лучшая доля обращений у выдачи посчитана вместе с брендовыми запросами. Если небрендовый поиск конвертирует как реклама,
            выигрыш будет меньше. Выбор не меняется, ожидания держим на нижней границе до замера в задаче 3.</p>
        </div>
      </Reveal>
      <Reveal>
        <div className="tasks">{D.TASKS.map((t) => <TaskRow key={t.n} t={t} />)}</div>
      </Reveal>
      <Reveal>
        <h3 style={{ fontSize: "1.05rem", marginTop: "2.4rem" }}>Что сознательно не делаем</h3>
        <div className="stack">
          {D.NOT_DOING.map((n, i) => (
            <div className="stack__i" key={i}><i>×</i><p><b style={{ fontWeight: 600 }}>{n.t}.</b> {n.why}</p></div>
          ))}
        </div>
      </Reveal>
      <div className="rule" />
    </section>
  );
}

/* ================= 11 стоп-правила ================= */
export function Stop() {
  return (
    <section className="sec">
      <Head id="stop" n="11" t="Стоп-правила и риски"
        lead="Оба правила требуют вашего решения и сами не запускаются." />
      {D.STOP_RULES.map((r, i) => (
        <Reveal key={i} delay={i * 80}>
          <div className="note note--alarm">
            <b className="note__t">{r.t} <T k={r.tag} /></b><p>{r.body}</p>
          </div>
        </Reveal>
      ))}
      <Reveal>
        <h3 style={{ fontSize: "1.05rem", marginTop: "2rem" }}>Если план сработает наполовину</h3>
        <div className="stack">
          <div className="stack__i"><i>·</i><p><b>Только первоочередные задачи.</b> Нового трафика не будет, но мы увидим заявки по кампаниям, снимем торговлю с самими собой и закроем висящий с июля вопрос атрибуции.</p></div>
          <div className="stack__i"><i>·</i><p><b>Объявления перепишем, кликабельность не вырастет.</b> Значит проблема не в тексте, а в посадочной странице: сравниваем скорость загрузки и видно ли цену на первом экране.</p></div>
          <div className="stack__i"><i>·</i><p><b>Склейка сделана с ошибкой.</b> Можно потерять текущие 183 единицы заметности. Поэтому по одному адресу с проверкой через 48 часов, откат снимается одной правкой.</p></div>
          <div className="stack__i"><i>·</i><p><b>Не сработает ничего.</b> Продолжаем платить около 150 000 ₽ в месяц за поток, который прекращается в день остановки рекламы, а разрыв с fdmebel и loftcase растёт. Это цена бездействия.</p></div>
        </div>
      </Reveal>
      <Reveal>
        <h3 style={{ fontSize: "1.05rem", marginTop: "2rem" }}>Если сработает кризисный сценарий</h3>
        <div className="stack">
          <div className="stack__i"><i>!</i><p><b>Кабинет заблокирован или бюджет срезан.</b> Сегодня это минус 95 заявок в месяц, треть всего потока сайта. В ту же неделю: Виктор поднимает незакрытые заявки июля и августа на повторный контакт и ставит обзвон по базе. Это затыкает разрыв на две-три недели, но не заменяет поток.</p></div>
          <div className="stack__i"><i>!</i><p><b>Сайт недоступен или закрыт от роботов.</b> Проверяется задачей 1. Пока не проверено, это открытый риск всего направления.</p></div>
          <div className="stack__i"><i>!</i><p><b>Резкое падение позиций, как у лофт-страницы.</b> Одна страница уже просела втрое, причина неизвестна. Задача 10 существует для того, чтобы это не оказалось системным.</p></div>
        </div>
      </Reveal>
      <div className="rule" />
    </section>
  );
}

/* ================= 12 чего не знаем ================= */
export function Neizvestno() {
  return (
    <section className="sec">
      <Head id="neizvestno" n="12" t="Чего мы не знаем"
        lead="Список читают последним, поэтому самое крупное стоит первым." />
      <Reveal>
        <div className="stack">
          {D.UNKNOWNS.map((u, i) => (
            <div className="stack__i" key={i}><i>{String(i + 1).padStart(2, "0")}</i><p>{u}</p></div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export function Foot() {
  return (
    <footer className="foot">
      <Reveal>
        <div className="sec__n">приёмка</div>
        <div className="verdict">
          <span className="verdict__v">8,75 <span style={{ fontSize: ".4em", color: "var(--ink-3)" }}>из 10</span></span>
          <p style={{ maxWidth: "38ch" }}>Отчёт прошёл адверсариальную приёмку ФЕНИКСА за три круга: 6,25 → 7,35 → 8,75.
            Четырнадцать фактических ошибок найдены и исправлены до выпуска.</p>
        </div>
      </Reveal>
      <Reveal>
        <div className="rule" style={{ marginTop: "2.4rem" }} />
        <div className="sec__n" style={{ display: "block", marginTop: "1.6rem" }}>источники и окна данных</div>
        <ul className="foot__src">
          {D.SOURCES.map((s, i) => <li key={i}>· {s}</li>)}
        </ul>
        <p className="foot__src" style={{ marginTop: "1.2rem" }}>
          Замер {D.MEASURED}. Подготовили: Семён (поиск и цитируемость), Тимур (реклама), Дата (проверка цифр), Марко (механика рынка).
          Внутренний документ GENGROUP, не для распространения.
        </p>
      </Reveal>
    </footer>
  );
}
