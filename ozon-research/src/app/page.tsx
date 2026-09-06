import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, Eyebrow } from "@/components/section";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/stat-tile";
import { Photo } from "@/components/photo";
import { VerdictBadge } from "@/components/verdict-badge";
import { cases, meta, niches, PASS_VERDICTS } from "@/lib/data";
import { Badge as Pill } from "@/components/ui/badge";
import { num, pct, rub } from "@/lib/format";

const SECTIONS = [
  {
    title: "Разделы",
    links: [
      { href: "/method", label: "Методика", note: "сито и модель денег" },
      { href: "/niches", label: "Карта ниш", note: `${meta.counts.niches} штук` },
      { href: "/cases", label: "Кейсы", note: `${meta.counts.cases} карточки` },
    ],
  },
  {
    title: "Проверки",
    links: [
      { href: "/audit", label: "Reality Audit", note: `${meta.audit.noGo} из ${meta.audit.total} - NO_GO` },
      { href: "/knowhow", label: "Ноу-хау", note: `0 из ${meta.counts.knowhow} выжили` },
      { href: "/method#sensitivity", label: "Чувствительность", note: "46% против 52%" },
    ],
  },
  {
    title: "Решения",
    links: [
      { href: "/decisions#commission", label: "Комиссия", note: "проверить в кабинете" },
      { href: "/decisions#rule", label: "Правило ×4,5", note: "пересмотр порога" },
      { href: "/decisions#gate", label: "Ворота спроса", note: "проверять до карточки" },
      { href: "/decisions#mode", label: "Режим цеха", note: "премиум или серия" },
    ],
  },
];

/** Строка списка кликабельна, только если у ниши есть карточка кейса. */
function LinkOrDiv({ href, children }: { href: string | null; children: React.ReactNode }) {
  const className = "flex flex-wrap items-center gap-x-6 gap-y-3 p-5 sm:flex-nowrap";
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

export default function HomePage() {
  const caseIds = new Set(cases.map((c) => c.id));
  const top = [...niches]
    .filter((n) => PASS_VERDICTS.includes(n.verdict))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 4);
  const featured = cases.slice(0, 3);
  const best = meta.bestToday;
  const deltaPP = meta.medianDelta46Passing === null ? null : Math.round(meta.medianDelta46Passing * 100);

  return (
    <>
      <Container className="pb-8 pt-16 text-center sm:pt-24">
        <Eyebrow>Исследование · {meta.date}</Eyebrow>
        <h1 className="mx-auto mt-5 max-w-[15ch] font-display text-[clamp(36px,6.6vw,76px)] font-extrabold">
          {meta.counts.niches} ниш проверено. Прибыльных сегодня - ноль.
        </h1>
        <p className="measure mx-auto mt-6 text-[17px] leading-relaxed text-ink-2">
          Что Ozon реально покупает, во сколько это обходится цехам и почему правило «цена = себестоимость&nbsp;×&nbsp;4,5»
          ломается на комиссии 51-52%. Сито находит {meta.counts.passing} ниш, которые проходят порог 10-15%{" "}
          <b className="text-ink">условно</b> - если получится продавать по расчётной цене. Проверка реальными ценами
          конкурентов не подтверждает ни одну.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/niches" size="lg">
            Смотреть карту ниш
          </ButtonLink>
          <ButtonLink href="/method" variant="secondary" size="lg">
            Как считали <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-2 font-mono text-[13px] text-muted">
          <span>{meta.counts.withEcon} ниш с экономикой</span>
          <span>{meta.counts.withCabinet} с метриками кабинета</span>
          <span>{meta.counts.cases} карточки конкурентов</span>
          <span>{meta.counts.knowhow} идей ноу-хау</span>
        </div>
      </Container>

      <Container className="pt-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            value={meta.counts.passing}
            label="проходят сито условно"
            note={`если рынок примет расчётную цену; ${meta.counts.passingBelowFloor} из них ниже порога спроса`}
            tone="accent"
          />
          <StatTile
            value={meta.counts.profitableToday}
            label={`прибыльны сегодня из ${meta.counts.priced}`}
            note={best ? `лучшая - «${best.name}» при ${pct(best.rentToday)}` : undefined}
            tone="alert"
          />
          <StatTile
            value={`${meta.audit.noGo}/${meta.audit.total}`}
            label="NO_GO в Reality Audit"
            note={`${meta.audit.needData} - нужны данные, остальные отклонены`}
          />
          <StatTile value="51-52%" label="вознаграждение Ozon" note="гипотеза для новых категорий против 46% подтверждённых по текущим" />
        </div>
      </Container>

      {/* Главный вывод - то, ради чего собиралось исследование */}
      <Container className="pt-16">
        <div className="rounded-3xl border border-line bg-surface p-6 sm:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="orange">Главный вывод</Badge>
            <span className="font-mono text-[12px] uppercase tracking-wider text-muted">
              проверено adversarial-аудитом
            </span>
          </div>
          <h2 className="mt-5 max-w-[24ch] font-display text-[clamp(24px,3.4vw,38px)] font-bold">
            Разрыв не в комиссии, а в цене, которую платит рынок
          </h2>
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <p className="text-[15.5px] leading-relaxed text-ink-2">
              Сито отвечает на условный вопрос: «если задать расчётную цену, при которой выходит 15% чистой
              рентабельности, попадёт ли она в диапазон, который рынок платит». Reality Audit проверяет жёстче: «а если
              встать по целевой цене, той что рынок платит на верхней границе, сколько останется сегодня». По всем{" "}
              {meta.counts.priced} просчитанным нишам
              ответ один: ни одной с рентабельностью выше 10%.
            </p>
            <p className="text-[15.5px] leading-relaxed text-ink-2">
              Пересчёт по комиссии 46% (подтверждённый факт по текущему ассортименту вместо гипотезы 51-52% для
              новых категорий) сдвигает медианную маржу восьми проходных ниш примерно
              на {deltaPP ?? "-"} пунктов и не выводит в плюс ни одну: прибыльных при 46% ровно столько же, сколько
              при 51-52%, то есть {meta.counts.profitableToday}. Премиальный конверт производства (TIG, зачистка, индивидуальная упаковка) дороже, чем
              позволяет целевая цена в категории, где нас никто не знает.
            </p>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/audit" variant="accent">
              Читать аудит целиком
            </ButtonLink>
            <ButtonLink href="/decisions" variant="secondary">
              Четыре решения от собственника
            </ButtonLink>
          </div>
        </div>
      </Container>

      {/* Колоночная навигация - приём Mobbin */}
      <Container className="pt-16">
        <div className="grid gap-10 rounded-3xl bg-surface p-7 sm:p-10 md:grid-cols-3">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{s.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {s.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="group block">
                      <span className="font-display text-[17px] font-semibold tracking-tight text-ink group-hover:text-teal-ink">
                        {l.label}
                      </span>{" "}
                      <span className="text-[13px] text-muted">{l.note}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>

      {/* Что всё-таки прошло сито */}
      <Container className="pt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Ближе всего к порогу</Eyebrow>
            <h2 className="mt-3 font-display text-[clamp(24px,3.2vw,36px)] font-bold">Что прошло сито</h2>
          </div>
          <Link href="/niches" className="font-display text-sm font-semibold text-teal-ink hover:underline">
            Все {meta.counts.niches} ниш →
          </Link>
        </div>
        <ol className="mt-6 divide-y divide-line overflow-hidden rounded-3xl border border-line">
          {top.map((n, i) => (
            <li key={n.id} className="bg-card transition-colors hover:bg-surface">
              <LinkOrDiv href={caseIds.has(n.id) ? `/cases/${n.id}` : null}>
              <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-[200px] flex-1">
                <div className="font-display text-[17px] font-semibold text-ink">{n.name}</div>
                <div className="text-[13px] text-muted">
                  спрос {rub(n.demand, { short: true })} за 28 дней · рынок {rub(n.market)} · С/С произв{" "}
                  {rub(n.ssBase)}
                </div>
                {n.belowDemandFloor && (
                  <div className="mt-1.5">
                    <Pill tone="orange">спрос ниже порога 300 000 ₽</Pill>
                  </div>
                )}
              </div>
              <div className="text-right font-mono text-xs text-muted">
                целевая С/С
                <div className="tnum text-[15px] font-bold text-teal-ink">{num(n.ssMax55)} ₽</div>
              </div>
              <VerdictBadge verdict={n.verdict} short />
              </LinkOrDiv>
            </li>
          ))}
        </ol>
        <p className="measure mt-4 text-[13.5px] leading-relaxed text-muted">
          Спрос показан по поисковой фразе целиком. У части ниш наш подсегмент уже: например, по запросу «дровокол»
          рынок держат электрогидравлические станки за 22-28 тыс. ₽, а мы считаем ручной клин за 3 900 ₽. Разбор
          подсегмента есть внутри каждого кейса.
        </p>
      </Container>

      {/* Витрина кейсов */}
      <Container className="pt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Шорт-лист</Eyebrow>
            <h2 className="mt-3 font-display text-[clamp(24px,3.2vw,36px)] font-bold">Кейсы с конкурентами</h2>
          </div>
          <Link href="/cases" className="font-display text-sm font-semibold text-teal-ink hover:underline">
            Все {meta.counts.cases} кейса →
          </Link>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((c) => (
            <Link
              key={c.id}
              href={`/cases/${c.id}`}
              className="group overflow-hidden rounded-3xl border border-line bg-card transition-colors hover:border-teal-ink"
            >
              <Photo id={c.photo} alt={c.name} className="aspect-4/3 w-full" sizes="(max-width: 640px) 100vw, 33vw" />
              <div className="space-y-3 p-5">
                <div className="flex flex-wrap gap-2">
                  <VerdictBadge verdict={c.verdict} short />
                  {c.audit?.verdict === "NO_GO" && <Pill tone="bad">аудит: NO_GO</Pill>}
                  {c.audit?.verdict === "NEED_DATA" && <Pill tone="dim">нужны данные</Pill>}
                </div>
                <h3 className="font-display text-[17px] font-bold leading-tight">{c.name}</h3>
                <p className="font-mono text-[12px] text-muted">
                  спрос {c.noCabinetData ? "нет данных кабинета" : rub(c.demand, { short: true })} · рынок{" "}
                  {rub(c.market)}
                </p>
                <p className="line-clamp-2 text-[13.5px] text-muted">{c.angle}</p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </>
  );
}
