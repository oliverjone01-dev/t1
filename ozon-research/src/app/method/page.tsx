import type { Metadata } from "next";
import { Container, Eyebrow, PageHeader } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/stat-tile";
import { meta, niches } from "@/lib/data";
import { num, pct } from "@/lib/format";

export const metadata: Metadata = {
  title: "Методика и экономика",
  description: "Как считалось сито: модель денег Ozon, шесть ворот отбора, допущения и их метки.",
};

const GATES = [
  { n: "Спрос", d: "Заказано за 28 дней по фразе и её вариантам из кабинета продавца. Порог - 300 тыс. ₽. Ниже порога ниша помечается флагом, но не отбрасывается." },
  { n: "Конверт цеха", d: "Изделие должно собираться из того, что цеха делают сегодня: труболазер, листолазер до 8 мм, гибка, сварка, порошок, стекло и зеркало, керамопечать, МДФ, LED." },
  { n: "Себестоимость", d: "С/С произв оценивается от реальных якорей внутренней таблицы, в двух режимах: премиум (TIG, зачистка, индивидуальная упаковка) и серийный (MIG, партии, простая упаковка)." },
  { n: "Экономика площадки", d: "Вознаграждение, логистика по объёму, эквайринг, последняя миля, надбавка за КГТ, реклама и резерв на возвраты - всё считается от предельной цены продавца." },
  { n: "Цена рынка", d: "Квартили витрины и средний чек покупки из кабинета. Требуемая цена сравнивается с тем, что рынок платит: отсюда «зазор»." },
  { n: "Доставка", d: "FBS и realFBS, без FBO: склады маркетплейса под риском, а КГТ дешевле возить своими силами." },
];

export default function MethodPage() {
  const A = meta.assumptions as Record<string, number>;
  const M = meta.model;
  const priced = niches.filter((n) => n.rentToday !== null && n.rent46 !== null);

  return (
    <>
      <PageHeader
        eyebrow="Методика"
        title="Как считали и на чём это держится"
        lead="Каждая цифра в исследовании получена одной и той же цепочкой: спрос из кабинета продавца, себестоимость от внутренних якорей, расходы площадки по реальным тарифам, цена - по витрине. Ниже вся модель целиком, включая допущения, которые могут её сломать."
      />

      <Container>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile value={meta.counts.niches} label="ниш в лонг-листе" note="собраны от спроса Ozon и от станков" />
          <StatTile value={meta.counts.withCabinet} label="с точными метриками кабинета" note="запросы, заказы, конкуренты" />
          <StatTile value={meta.counts.withEcon} label="с полным расчётом экономики" tone="accent" />
          <StatTile value={meta.counts.cases} label="карточки с конкурентами" note="реальные продавцы и цены" />
        </div>
      </Container>

      {/* Модель денег */}
      <Container className="pt-20">
        <Eyebrow>Модель денег</Eyebrow>
        <h2 className="mt-3 font-display text-[clamp(24px,3.4vw,38px)] font-bold">Куда уходит рубль на Ozon</h2>
        <p className="measure mt-4 text-[15.5px] leading-relaxed text-ink-2">
          Ozon считает вознаграждение и расходы от <b className="text-ink">предельной цены</b> продавца, а покупатель
          видит цену ниже: часть скидки площадка добавляет за свой счёт баллами. Доля, которую платит покупатель,
          обозначена как k. По проверенным лично карточкам k составил 0,45 - но по новым товарам это не гарантировано,
          поэтому в сите три сценария.
        </p>

        <ol className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            { t: "P = 100%", d: "Предельная цена продавца. От неё Ozon считает вознаграждение и все расходы." },
            { t: "53-60%", d: "Расходы площадки при FBS: вознаграждение 51-52%, логистика по объёму, эквайринг 1%, последняя миля 25 ₽, КГТ 280 ₽." },
            { t: "40-47%", d: "Доходит до продавца до рекламы. В июле реклама съела 11,8% оборота, в модели заложено 8%." },
            { t: "k = 45-65%", d: "Доля предельной цены, которую платит покупатель. Факт 0,45 по проверенным карточкам, гипотеза по новым." },
          ].map((s, i) => (
            <li key={s.t} className="rounded-3xl border border-line bg-surface p-5">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted">шаг {i + 1}</div>
              <div className="mt-2 font-display text-[26px] font-extrabold tracking-tight text-teal-ink tnum">{s.t}</div>
              <p className="mt-2 text-[13.5px] leading-snug text-ink-2">{s.d}</p>
            </li>
          ))}
        </ol>

        <p className="measure mt-8 text-[15.5px] leading-relaxed text-ink-2">
          Отсюда следует правило «предельная цена = С/С произв × 4-4,5»: при АДМ +49%, рекламе 8%, обычной логистике
          и <b className="text-ink">комиссии 46%</b>, на которой оно и было откалибровано, правило выводит на 10% и
          выше 66 ниш из {meta.counts.withEcon} (медиана 10,5%). При комиссии 51-52% то же правило не даёт 10%
          <b className="text-ink"> ни одной</b> из {meta.counts.withEcon} ниш с посчитанной экономикой: максимум 7%,
          медиана около минус 5%. Обратная сторона: покупатель при k&nbsp;0,55 видит цену 2,2-2,9 от нашей
          себестоимости производства, а массовые металлические ниши на Ozon покупают по 1,3-1,8. Поэтому сито считает
          для каждой ниши <b className="text-ink">целевую С/С</b> - какой должна быть себестоимость, чтобы цена рынка
          дала 15%.
        </p>
      </Container>

      {/* Шесть ворот */}
      <Container className="pt-20">
        <Eyebrow>Отбор</Eyebrow>
        <h2 className="mt-3 font-display text-[clamp(24px,3.4vw,38px)] font-bold">Шесть ворот сита</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {GATES.map((g, i) => (
            <div key={g.n} className="rounded-3xl border border-line bg-card p-5">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-display text-[17px] font-bold">{g.n}</h3>
              </div>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-2">{g.d}</p>
            </div>
          ))}
        </div>
      </Container>

      {/* Чувствительность */}
      <Container className="pt-20" id="sensitivity">
        <Eyebrow>Чувствительность</Eyebrow>
        <h2 className="mt-3 font-display text-[clamp(24px,3.4vw,38px)] font-bold">Что будет, если комиссия 46%</h2>
        <p className="measure mt-4 text-[15.5px] leading-relaxed text-ink-2">
          Комиссия 51-52% для категорий «Дом и сад», «Дача и сад», «Строительство и ремонт» взята по аналогии с
          зеркалами и столами - это <Badge tone="orange">гипотеза</Badge>, а не факт из кабинета по самим этим
          категориям. Проверка на факте 46% (подтверждённая комиссия по текущему ассортименту) улучшает картину, но не
          меняет вывод.
        </p>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="font-display text-[28px] font-extrabold tracking-tight text-teal-ink tnum">
              {meta.medianDelta46Passing === null ? "-" : `${num(meta.medianDelta46Passing * 100)} п.п.`}
            </div>
            <p className="mt-2 text-[13px] leading-snug text-ink-2">
              медианный сдвиг маржи по восьми нишам, прошедшим сито
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="font-display text-[28px] font-extrabold tracking-tight text-ink tnum">
              {num(meta.medianLoss52)} → {num(meta.medianLoss46)} ₽
            </div>
            <p className="mt-2 text-[13px] leading-snug text-ink-2">
              медианный убыток на одном изделии: комиссия 46% возвращает около 300 ₽ из пяти тысяч
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="font-display text-[28px] font-extrabold tracking-tight text-orange-ink tnum">
              {meta.profitableAt46} из {priced.length}
            </div>
            <p className="mt-2 text-[13px] leading-snug text-ink-2">
              ниш выходят на 10% при комиссии 46%. Столько же, сколько при 52%
            </p>
          </div>
        </div>
        <p className="measure mt-5 text-[13.5px] leading-relaxed text-muted">
          По всем {priced.length} нишам медиана сдвига выглядит куда драматичнее -{" "}
          {meta.medianDelta46 === null ? "-" : num(meta.medianDelta46 * 100)} пункта, но эту цифру задирают ниши с
          околонулевой чистой выручкой: там знаменатель почти ноль, и любой процент теряет смысл. Поэтому в
          заголовке стоит медиана по проходным нишам, а не по всем.
        </p>
        <h3 className="mt-10 font-display text-[19px] font-bold">
          Восемь лучших ниш по марже среди {priced.length} с осмысленным расчётом
        </h3>
        <p className="measure mt-2 text-[13.5px] text-muted">
          Это другая выборка, чем восемь проходных ниш выше: там отбор по вердикту сита, здесь по марже. Пересекаются
          шесть из восьми.
        </p>
        <div className="mt-4 overflow-x-auto rounded-3xl border border-line">
          <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-surface text-left">
                {["Ниша", "Целевая цена (верх рынка)", "С/С общая", "Маржа при комиссии из данных", "Маржа при 46%"].map((h, i) => (
                  <th key={h} className={`whitespace-nowrap px-4 py-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted ${i > 0 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...priced].sort((a, b) => (b.rentToday ?? -9) - (a.rentToday ?? -9)).slice(0, 8).map((n) => (
                <tr key={n.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{n.name}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs tnum">{num(n.market)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs tnum">{num(n.ssTotal)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs tnum text-bad">{pct(n.rentToday)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs tnum text-warn">{pct(n.rent46)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px] text-muted">
          Комиссия берётся по каждой нише отдельно ({meta.commissionRange.map((c) => `${Math.round(c * 100)}%`).join(", ")}),
          а не единой ставкой. Даже у них обе колонки
          отрицательные. Ещё у {meta.counts.lossExceedsRevenue} ниш убыток съедает всю чистую выручку - там процент
          не считается вовсе, а не «стремится к минус бесконечности».
        </p>
      </Container>

      {/* Формула маржи */}
      <Container className="pt-20" id="margin">
        <Eyebrow>Формула</Eyebrow>
        <h2 className="mt-3 font-display text-[clamp(24px,3.4vw,38px)] font-bold">Как считается «маржа сегодня»</h2>
        <p className="measure mt-4 text-[15.5px] leading-relaxed text-ink-2">
          Это единственный показатель на сайте, которого нет в исходной выгрузке сита: он считается заново в
          <code className="mx-1 rounded bg-surface px-1.5 py-0.5 font-mono text-[13px]">scripts/build_content.py</code>
          по тем же допущениям, что и сито, и отвечает на вопрос «сколько останется, если встать по целевой цене
          прямо сейчас».
        </p>
        <div className="mt-6 overflow-x-auto rounded-3xl border border-line bg-surface p-6">
          <pre className="font-mono text-[13px] leading-relaxed text-ink">
{`доля, которая доходит до продавца = 1 − комиссия − ${M.acq} (эквайринг) − ${M.ads} (реклама) − ${M.returns} (возвраты)
чистая выручка = цена × доля − логистика − ${M.lastMile} ₽ (последняя миля) − ${M.kgtFee} ₽ (КГТ, если применимо)
маржа = (чистая выручка − С/С общая) ÷ чистая выручка`}
          </pre>
        </div>
        <ul className="measure mt-6 space-y-2.5 text-[15px] leading-relaxed text-ink-2">
          <li>
            Знаменатель - чистая выручка, а не оборот. Поэтому проценты крупные по модулю: минус 70% означает, что
            себестоимость почти вдвое выше того, что осталось после расходов площадки.
          </li>
          <li>
            Если чистая выручка падает ниже {pct(M.netFloor)} цены, процент не выводится: он перестаёт что-либо
            значить. Таких ниш {meta.counts.lossExceedsRevenue}.
          </li>
          <li>
            Цена берётся из поля «целевая цена» - это верхняя граница того, что платит рынок, а не средний чек. То
            есть расчёт сделан в пользу проекта, и всё равно отрицательный.
          </li>
        </ul>
        <div className="mt-6 rounded-3xl border border-line bg-card p-6">
          <div className="font-display text-[15px] font-bold">Почему цифры аудита отличаются</div>
          <p className="measure mt-2 text-[14.5px] leading-relaxed text-ink-2">
            Reality Audit считал по своим ставкам: реклама 10% и резерв 4% против 8% и 2% здесь. По восьми нишам из
            десяти модель сита мягче аудита на 18-44 пункта, а по двум (изголовье кровати и костровая чаша с крышкой)
            наоборот жёстче - на 196 и 54 пункта. Почему по этим двум знак обратный, из текста аудита не
            восстанавливается. Цифры аудита оставлены дословно, а не подогнаны под сито: расхождение честнее показать,
            чем спрятать.
          </p>
        </div>
      </Container>

      {/* Допущения */}
      <Container className="pt-20">
        <Eyebrow>Прозрачность</Eyebrow>
        <h2 className="mt-3 font-display text-[clamp(24px,3.4vw,38px)] font-bold">Допущения и их источники</h2>
        <div className="mt-6 overflow-x-auto rounded-3xl border border-line">
          <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-surface text-left">
                {["Допущение", "Значение", "Источник"].map((h) => (
                  <th key={h} className="px-4 py-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["АДМ, надбавка к С/С произв", `× ${A.ADM}`, "данные", "Структура внутреннего листа расчёта себестоимости"],
                ["Вознаграждение Ozon", pct(A.COMM_DEFAULT as number), "гипотеза", "Факт кабинета по текущим категориям (зеркала, столы, консоли, вешалки). Для «Дома и сада», «Дачи и сада», «Строительства и ремонта» перенесено по аналогии и не подтверждено"],
                ["Эквайринг", pct(A.ACQ as number), "данные", "Кабинет продавца"],
                ["Реклама", pct(A.ADS as number), "гипотеза", "В июле по всему кабинету было 11,8%, для новых карточек заложено меньше. Reality Audit считал по 10%"],
                ["Резерв на возвраты и брак", pct(A.RETURNS as number), "гипотеза", "Оценка, фактических данных по новым категориям нет. Reality Audit считал по 4%"],
                ["Последняя миля и КГТ", `${A.LAST_MILE} ₽ и ${A.KGT_FEE} ₽`, "данные", "Кабинет продавца"],
                ["Софинансирование Ozon, k", "0,45 / 0,55 / 0,65 / 1,00", "гипотеза", "Факт 0,45 по проверенным SKU, по новым товарам не гарантирован"],
                ["Целевая доля ниши", pct(A.SHARE_TARGET as number), "гипотеза", "Для оценки загрузки цеха"],
                ["Порог спроса", `${num(A.DEMAND_MIN as number)} ₽ за 28 дней`, "гипотеза", "Отсечка, ниже которой ниша помечается флагом"],
              ].map(([label, value, kind, src]) => (
                <tr key={label as string} className="border-t border-line align-top">
                  <td className="px-4 py-3 font-medium">{label}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tnum">{value}</td>
                  <td className="px-4 py-3">
                    <Badge tone={kind === "данные" ? "ok" : "orange"}>{kind}</Badge>
                    <div className="mt-1.5 text-[13px] text-muted">{src}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="measure mt-6 text-[15.5px] leading-relaxed text-ink-2">
          Отдельная оговорка про метрики кабинета: у 35 ниш из 156 сумма заказов в рублях, делённая на штуки, расходится
          со средним чеком покупки больше чем в полтора раза. Ozon отдаёт эти показатели по-разному агрегированными, и
          свести их к одному знаменателю по выгрузке нельзя. Обе цифры показаны как есть, без подгонки: там, где они
          спорят, верить нужно порядку величины, а не точному числу.
        </p>
        <p className="measure mt-4 text-[15.5px] leading-relaxed text-ink-2">
          Чего в исследовании нет: нормы станко-часа (себестоимость - оценка с вилкой ±25%), проверенного k по новым
          категориям, лимитов габаритов FBS из кабинета (взяты из документации). Всё это закрывается одной тестовой
          карточкой и одним запросом в поддержку - об этом раздел{" "}
          <a href="/decisions" className="text-teal-ink underline underline-offset-4">решений</a>.
        </p>
      </Container>
    </>
  );
}
