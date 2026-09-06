import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Container, Eyebrow } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Photo } from "@/components/photo";
import { AuditBadge, VerdictBadge } from "@/components/verdict-badge";
import { caseById, cases } from "@/lib/data";
import { num, pct, rub } from "@/lib/format";

export function generateStaticParams() {
  return cases.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = caseById(id);
  return c ? { title: c.name, description: c.spec ?? undefined } : { title: "Кейс не найден" };
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="text-right font-mono text-[13px] tnum text-ink">{value}</dd>
    </div>
  );
}

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = caseById(id);
  if (!c) notFound();

  return (
    <>
      <Container className="pt-10">
        <Link href="/cases" className="inline-flex items-center gap-2 font-display text-[13px] font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Все кейсы
        </Link>
      </Container>

      <Container className="pt-6">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <Eyebrow>
              {c.id} · запрос «{c.query}»
            </Eyebrow>
            <h1 className="mt-4 font-display text-[clamp(28px,4.4vw,50px)] font-extrabold">{c.name}</h1>
            <div className="mt-5 flex flex-wrap gap-2">
              <VerdictBadge verdict={c.verdict} />
              {c.audit && <AuditBadge verdict={c.audit.verdict} />}
              {c.kgt && <Badge tone="outline">КГТ</Badge>}
              {c.flags.split(";").filter(Boolean).map((f) => (
                <Badge key={f} tone="orange">{f.trim()}</Badge>
              ))}
            </div>
            {c.spec && <p className="measure mt-6 text-[15.5px] leading-relaxed text-ink-2">{c.spec}</p>}
            {c.position && (
              <p className="measure mt-4 rounded-2xl bg-surface p-4 text-[14px] leading-relaxed text-ink-2">
                <b className="text-ink">Наш подсегмент:</b> {c.position}
              </p>
            )}
          </div>
          <Photo id={c.photo} alt={c.name} className="aspect-4/3 w-full rounded-3xl" sizes="(max-width: 1024px) 100vw, 45vw" priority />
        </div>
      </Container>

      <Container className="pt-14">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-line bg-card p-6">
            <h2 className="font-display text-[17px] font-bold">Спрос и рынок</h2>
            <dl className="mt-4">
              <Row label="заказано за 28 дней" value={`${rub(c.demand, { short: true })} · ${num(c.units)} шт`} />
              <Row label="запросов / динамика" value={`${num(c.pop)} / ${c.dyn == null ? "-" : `${c.dyn}%`}`} />
              <Row label="средний чек покупки" value={rub(c.avgPrice)} />
              <Row label="цена: Q1 / медиана / Q3" value={`${num(c.q1)} / ${num(c.med)} / ${num(c.q3)}`} />
            </dl>
          </div>

          <div className="rounded-3xl border border-line bg-card p-6">
            <h2 className="font-display text-[17px] font-bold">Экономика</h2>
            <dl className="mt-4">
              <Row label="С/С произв: низ / база / верх" value={`${num(c.ssLow)} / ${num(c.ssBase)} / ${num(c.ssHigh)}`} />
              <Row label="целевая цена (верх рынка)" value={rub(c.market)} />
              <Row label="предельная цена для 10% / 15%" value={`${num(c.p10)} / ${num(c.p15)}`} />
              <Row label="целевая С/С для 15%" value={<span className="font-bold text-teal-ink">{num(c.ssMax55)} ₽</span>} />
              <Row label="рентабельность при ×4,5" value={pct(c.rent45)} />
              <Row
                label="маржа по целевой цене"
                value={
                  c.rentToday === null ? (
                    <span className="text-muted">убыток больше выручки</span>
                  ) : (
                    <span className={c.rentToday >= 0.1 ? "text-ok" : "text-bad"}>{pct(c.rentToday)}</span>
                  )
                }
              />
            </dl>
          </div>

          <div className="rounded-3xl border border-line bg-card p-6">
            <h2 className="font-display text-[17px] font-bold">Производство</h2>
            <dl className="mt-4">
              <Row label="лазер / сварка при 5% ниши" value={`${num(c.laserH, 1)} ч / ${num(c.weldH, 1)} ч в месяц`} />
              <Row label="логистика FBS / realFBS" value={`${num(c.logistics)} / ${num(c.logisticsReal)} ₽`} />
              <Row label="узкое место" value={<span className="font-body text-right text-[12.5px] leading-snug">{c.bottleneck ?? "-"}</span>} />
              <Row label="уверенность оценки" value={c.confidence ?? "-"} />
            </dl>
          </div>
        </div>
      </Container>

      {c.competitors.length > 0 && (
        <Container className="pt-16">
          <Eyebrow>Кто забирает нишу</Eyebrow>
          <h2 className="mt-3 font-display text-[clamp(22px,3vw,32px)] font-bold">Конкуренты</h2>
          <div className="mt-6 overflow-x-auto rounded-3xl border border-line">
            <table className="w-full min-w-[820px] border-collapse text-[13.5px]">
              <thead>
                <tr className="bg-surface text-left">
                  {["Карточка", "Цена", "Отзывы", "Рейтинг", "Продавец", "Доставка", "Чем берёт"].map((h, i) => (
                    <th key={h} className={`px-4 py-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted ${i >= 1 && i <= 3 ? "text-right" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.competitors.map((x, i) => (
                  <tr key={x.sku ?? i} className="border-t border-line align-top">
                    <td className="px-4 py-3">
                      {x.url ? (
                        <a href={x.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1.5 text-ink underline decoration-line-2 underline-offset-4 hover:decoration-teal-ink">
                          {x.name}
                          <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
                        </a>
                      ) : (
                        x.name
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs tnum">{num(x.price)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs tnum">{num(x.reviews)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs tnum">{x.rating ?? "-"}</td>
                    <td className="px-4 py-3 text-ink-2">
                      {x.seller}
                      {x.seller_orders && <div className="font-mono text-[11px] text-muted">{x.seller_orders} заказов</div>}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-muted">{x.delivery}</td>
                    <td className="max-w-[260px] px-4 py-3 text-[12.5px] leading-snug text-muted">{x.why_wins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      )}

      <Container className="pt-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { t: "Сезонность", v: c.seasonality },
            { t: "Дырки в предложении", v: c.gaps },
            { t: "Чем заходим", v: c.angle },
          ].map((b) => (
            <div key={b.t} className="rounded-3xl bg-surface p-6">
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{b.t}</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{b.v ?? "-"}</p>
            </div>
          ))}
        </div>
      </Container>

      {c.audit && (
        <Container className="pt-16">
          <div className="rounded-3xl border border-line bg-card p-6 sm:p-9">
            <div className="flex flex-wrap items-center gap-3">
              <Eyebrow>Reality Audit</Eyebrow>
              <AuditBadge verdict={c.audit.verdict} />
            </div>
            <blockquote className="mt-6 border-l-2 border-orange pl-5 font-body text-[16px] italic leading-relaxed text-ink">
              {c.audit.bogdan}
            </blockquote>
            <dl className="mt-8 grid gap-5 md:grid-cols-2">
              {[
                ["Аудитория и как покупает", c.audit.audience],
                ["На чём держится экономика", c.audit.assumptions],
                ["Каких данных нет", c.audit.gaps],
                ["Что при downside", c.audit.downside],
                ["Первый чекпоинт", c.audit.checkpoint],
                ["Задетые красные линии", c.audit.redLines],
              ].map(([t, v]) => (
                <div key={t as string}>
                  <dt className="font-display text-[13px] font-bold text-ink">{t}</dt>
                  <dd className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{v ?? "-"}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      )}

      <Container className="pt-14">
        <div className="rounded-3xl bg-surface p-6 text-[13.5px] leading-relaxed text-ink-2">
          <b className="text-ink">Риски:</b> {c.risks ?? "-"}
          <br />
          <b className="text-ink">Покупные узлы:</b> {c.purchased ?? "-"}
          <br />
          <b className="text-ink">Сертификация:</b> {c.certification ?? "-"}
          <br />
          <b className="text-ink">Якорь себестоимости:</b> {c.anchor ?? "-"}
        </div>
      </Container>
    </>
  );
}
