import type { Metadata } from "next";
import Link from "next/link";
import { Container, Eyebrow, PageHeader } from "@/components/section";
import { StatTile } from "@/components/stat-tile";
import { AuditBadge, VerdictBadge } from "@/components/verdict-badge";
import { cases, meta } from "@/lib/data";
import { pct, rub } from "@/lib/format";

export const metadata: Metadata = {
  title: "Reality Audit",
  description: "Adversarial-проверка топ-10 шорт-листа: 9 из 10 - NO_GO, и разбор, что ломает картину системно.",
};

export default function AuditPage() {
  const audited = cases.filter((c) => c.audit);

  return (
    <>
      <PageHeader
        eyebrow="Reality Audit"
        title={`Проверка на прочность: ${meta.audit.noGo} из ${meta.audit.total} - NO_GO`}
        lead="Каждая ниша топ-10 прогнана через пять вопросов аудита и симуляцию реакции собственника. Задача проверки - не оправдать список, а найти, где расчёт держится на желаемом, а не на данных."
      />

      <Container>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile value={meta.audit.noGo} label="вердиктов NO_GO" tone="alert" />
          <StatTile value={meta.audit.needData} label="нужны данные" note="ближе всех к порогу" />
          <StatTile value={meta.counts.profitableToday} label="прибыльны сегодня" note={`из ${meta.counts.priced} просчитанных`} />
          <StatTile
            value="46% / 52%"
            label="комиссия: факт против гипотезы"
            note={`разница сдвигает медианную маржу проходных ниш примерно на ${meta.medianDelta46Passing === null ? "-" : Math.round(meta.medianDelta46Passing * 100)} пунктов и не закрывает разрыв`}
            tone="accent"
          />
        </div>
      </Container>

      <Container className="pt-16">
        <div className="rounded-3xl bg-surface p-6 sm:p-10">
          <Eyebrow>Общий вывод аудита</Eyebrow>
          <p className="mt-4 text-[13.5px] text-muted">
            Ниже дословный текст аудита. Он считал по своим ставкам: реклама 10% и резерв 4% против 8% и 2% в сите.
            По восьми нишам из десяти сито мягче аудита на 18-44 пункта, по двум (изголовье кровати и костровая чаша с
            крышкой) наоборот жёстче - на 196 и 54 пункта; почему по этим двум знак обратный, из текста аудита не
            восстанавливается. Текст оставлен дословно, а не подогнан под сито:{" "}
            <a href="/method#margin" className="text-teal-ink underline underline-offset-4">
              обе модели описаны на странице методики
            </a>
            . Ещё два места, где аудит говорит на своём языке: порог спроса он называет «300 шт или 1,5 млн ₽ в
            месяц», а сито считает по 300 000 ₽ за 28 дней по фразе; и «0-3 заказа» у отдельных ниш спорят с суммой
            спроса в подвале карточки: у изголовья кровати аудит называет 3 заказа по фразе, а кабинет по той же фразе
            отдаёт 473 штуки и 876 тыс. ₽. Причину расхождения по выгрузке восстановить нельзя, поэтому оно оставлено
            видимым, а не сглажено: это одна из тех дыр в данных, ради закрытия которых и написано решение о воротах
            спроса.
          </p>
          <div className="measure mt-5 space-y-4 text-[15.5px] leading-relaxed text-ink-2">
            {meta.audit.overall.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </Container>

      <Container className="pt-16">
        <Eyebrow>По нишам</Eyebrow>
        <h2 className="mt-3 font-display text-[clamp(24px,3.2vw,36px)] font-bold">Разбор каждой ниши топ-10</h2>
        <div className="mt-8 space-y-5">
          {audited.map((c) => (
            <article key={c.id} className="rounded-3xl border border-line bg-card p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
                    {c.id} · запрос «{c.query}»
                  </div>
                  <h3 className="mt-2 font-display text-[20px] font-bold">
                    <Link href={`/cases/${c.id}`} className="hover:text-teal-ink">
                      {c.name}
                    </Link>
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <VerdictBadge verdict={c.verdict} short />
                  {c.audit && <AuditBadge verdict={c.audit.verdict} />}
                </div>
              </div>

              <blockquote className="mt-5 border-l-2 border-orange pl-5 text-[15.5px] italic leading-relaxed text-ink">
                {c.audit?.bogdan}
              </blockquote>

              <dl className="mt-6 grid gap-4 text-[14px] leading-relaxed md:grid-cols-2">
                <div>
                  <dt className="font-display text-[12.5px] font-bold text-ink">На чём держится экономика</dt>
                  <dd className="mt-1 text-ink-2">{c.audit?.assumptions}</dd>
                </div>
                <div>
                  <dt className="font-display text-[12.5px] font-bold text-ink">Что при downside</dt>
                  <dd className="mt-1 text-ink-2">{c.audit?.downside}</dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-4 font-mono text-[11.5px] text-muted">
                <span>спрос {rub(c.demand, { short: true })} за 28 дней</span>
                <span>целевая цена {rub(c.market)}</span>
                <span>
                  маржа по модели сита {c.rentToday === null ? "убыток больше выручки" : pct(c.rentToday)}
                </span>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </>
  );
}
