import type { Metadata } from "next";
import { Container, Eyebrow, PageHeader } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { meta } from "@/lib/data";
import { pct } from "@/lib/format";

export const metadata: Metadata = {
  title: "Решения собственника",
  description: "Четыре решения, без которых дальнейший поиск продуктов считается на выдуманных цифрах, и план на 30/60/90 дней.",
};

const DECISIONS = [
  {
    id: "commission",
    title: "Подтвердить реальную комиссию по непрофильным категориям",
    why: "Сейчас 51-52% для «Дома и сада», «Дачи и сада», «Строительства и ремонта» - гипотеза по аналогии с зеркалами и столами, а не факт из кабинета по самим этим категориям. На этой цифре стоит вся экономика 120 ниш.",
    cost: "Один запрос в поддержку или одна тестовая карточка",
    risk: "Если не проверить, следующий раунд отбора повторит ту же ошибку в большем масштабе",
  },
  {
    id: "rule",
    title: "Решить судьбу правила «цена = С/С × 4-4,5»",
    why: "Правило откалибровано на комиссии 46,1% по текущему ассортименту. При комиссии выше 50% для выхода на те же 10-15% нужен множитель 5,5 и выше - а это отсекает почти весь товар дешевле 10-15 тысяч.",
    cost: "Решение на уровне собственника, без затрат",
    risk: "Либо принимаем более высокий множитель и узкий ассортимент, либо уходим из категорий с высокой комиссией",
  },
  {
    id: "gate",
    title: "Починить ворота спроса до того, как собирать карточки",
    why: "Требование аудита дословно: вернуться на этап лонг-листа и проверять реальный кабинетный спрос ДО составления карточки, а не после. Сейчас из восьми ниш, прошедших сито, четыре имеют спрос ниже объявленного порога 300 000 ₽ за 28 дней, а одна - 26 298 ₽ и 47 запросов. На такие ниши уже потрачен полный цикл разбора.",
    cost: "Правка одной проверки в конвейере отбора",
    risk: "Следующий раунд снова потратит недели на ниши, где спроса нет вовсе",
  },
  {
    id: "mode",
    title: "Выбрать режим цеха для маркетплейса",
    why: "Премиальный конверт (TIG, зачистка, индивидуальная упаковка) даёт себестоимость, которую целевая цена рынка не выдерживает. Серийный режим - MIG, минимальная зачистка, порошок партиями - по оценке дешевле на 30-45% по работе, но это гипотеза до подтверждения производством.",
    cost: "Расчёт производства по 5-8 нишам, 5 рабочих дней",
    risk: "Без этого решения производство не может посчитать реальную себестоимость, а сито остаётся на вилке",
  },
];

const PLAN = [
  {
    when: "Неделя 1",
    title: "Снять четыре неопределённости",
    items: [
      "Проверить реальную комиссию по трём непрофильным категориям в кабинете",
      "Выставить одну тестовую карточку по расчётной целевой цене и смотреть 7 дней: покупает ли рынок и даёт ли Ozon баллы на новых карточках",
      "Принять решение по режиму цеха - премиум или отдельный серийный стандарт",
      "Добавить в конвейер отбора жёсткую проверку кабинетного спроса до сборки карточки",
    ],
  },
  {
    when: "До 30 дней",
    title: "Точечный пилот по результатам недели",
    items: [
      "Если комиссия и баллы подтвердились: производство считает себестоимость по 5-8 верхним нишам в подтверждённом режиме",
      "Если комиссия ближе к 46%: пересчитать сито по факту и заново оценить, сколько ниш переходит из «не проходят» в проходные",
      "Схема доставки везде FBS и realFBS, без FBO",
    ],
  },
  {
    when: "До 90 дней",
    title: "Масштабирование только на подтверждённых цифрах",
    items: [
      "Новогодние ниши с отгрузкой до 15 декабря - но только те, что прошли пилот",
      "Пересчёт сита по факту первых продаж: баллы, реклама, возвраты вместо гипотез",
      "Решение по крупным распродажам принимать по факту пилота, а не заранее",
    ],
  },
];

export default function DecisionsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Решения"
        title="Четыре решения, без которых дальше считать нечего"
        lead="Исследование закончилось не списком готовых товаров, а развилками. Три первые сформулировал Reality Audit дословно, четвёртая нужна производству. Пока они не пройдены, любой следующий раунд отбора будет считаться на неподтверждённых цифрах и повторит те же выводы."
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/audit" variant="accent">
            Откуда эти решения
          </ButtonLink>
          <ButtonLink href="/niches" variant="secondary">
            Посмотреть данные
          </ButtonLink>
        </div>
      </PageHeader>

      <Container>
        <div className="space-y-5">
          {DECISIONS.map((d, i) => (
            <section key={d.id} id={d.id} className="scroll-mt-28 rounded-3xl border border-line bg-card p-6 sm:p-9">
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-[13px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                <h2 className="font-display text-[clamp(20px,2.6vw,28px)] font-bold">{d.title}</h2>
              </div>
              <p className="measure mt-4 text-[15.5px] leading-relaxed text-ink-2">{d.why}</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-surface p-4">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Чего стоит</div>
                  <div className="mt-1.5 text-[14px] text-ink">{d.cost}</div>
                </div>
                <div className="rounded-2xl bg-surface p-4">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Если не решать</div>
                  <div className="mt-1.5 text-[14px] text-ink">{d.risk}</div>
                </div>
              </div>
            </section>
          ))}
        </div>
      </Container>

      <Container className="pt-20">
        <Eyebrow>План</Eyebrow>
        <h2 className="mt-3 font-display text-[clamp(24px,3.2vw,36px)] font-bold">Неделя 1, месяц, квартал</h2>
        <p className="measure mt-4 text-[15.5px] leading-relaxed text-ink-2">
          План намеренно не начинается с запуска карточек: по данным исследования ни одна ниша не выходит в плюс по
          целевой цене ({meta.counts.profitableToday} из {meta.counts.priced}
          {meta.bestToday ? `, лучшая - ${pct(meta.bestToday.rentToday)}` : ""}). Сначала четыре дешёвые проверки, потом
          пилот, и только потом деньги в производство.
        </p>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {PLAN.map((p) => (
            <li key={p.when} className="rounded-3xl bg-surface p-6">
              <Badge tone="lime">{p.when}</Badge>
              <h3 className="mt-4 font-display text-[18px] font-bold leading-tight">{p.title}</h3>
              <ul className="mt-4 space-y-3">
                {p.items.map((it) => (
                  <li key={it} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-2">
                    <span className="mt-2 block size-1.5 shrink-0 rounded-full bg-teal" aria-hidden />
                    {it}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Container>
    </>
  );
}
