import type { Metadata } from "next";
import { Container, Eyebrow, PageHeader } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/stat-tile";
import { ideas, meta, WORKSHOP_LABEL } from "@/lib/data";
import { num } from "@/lib/format";

export const metadata: Metadata = {
  title: "Идеи ноу-хау",
  description: "48 идей под непокрытый спрос и разбор, почему скептик отклонил каждую.",
};

export default function KnowhowPage() {
  const byShop = ideas.reduce<Record<string, number>>((acc, i) => {
    const k = i.workshop || "";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        eyebrow="Ноу-хау"
        title={`${meta.counts.knowhowKept} из ${meta.counts.knowhow} идей пережили опровержение`}
        lead="Четыре генератора собрали идеи под непокрытый спрос: запросы без ответа, комбинации материалов, сезон и B2B. Скептик с правилом «при сомнении отклонить» не пропустил ни одной. Это тот же разрыв, что и в сите: идеи считались от целевой цены, а рынок платит меньше."
      />

      <Container>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile value={meta.counts.knowhow} label="идей сгенерировано" note="четыре независимых угла зрения" />
          <StatTile value={meta.counts.knowhowKept} label="прошли опровержение" tone="alert" />
          <StatTile value={meta.counts.knowhowWithFix} label="с предложением, как спасти" note="кандидаты на второй заход" tone="accent" />
          <StatTile
            value={Object.entries(byShop).length}
            label="цехов затронуто"
            note={Object.entries(byShop)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => `${WORKSHOP_LABEL[k] ?? k}: ${v}`)
              .join(", ")}
          />
        </div>
      </Container>

      <Container className="pt-16">
        <Eyebrow>Все идеи</Eyebrow>
        <h2 className="mt-3 font-display text-[clamp(24px,3.2vw,36px)] font-bold">Что предлагали и почему отклонили</h2>
        <p className="measure mt-4 text-[15.5px] leading-relaxed text-ink-2">
          Идеи с пометкой «как спасти» отклонены не из-за отсутствия спроса, а из-за цены позиционирования или канала.
          Если поднять чек, уйти в B2B или проверить пилотом - часть из них оживает.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {ideas.map((idea) => (
            <article key={idea.name} className="flex flex-col rounded-3xl border border-line bg-card p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="dim">{WORKSHOP_LABEL[idea.workshop || ""] ?? idea.workshop}</Badge>
                {idea.ss !== null && <Badge tone="outline">С/С {num(idea.ss)} ₽</Badge>}
                {idea.price !== null && <Badge tone="outline">цена {num(idea.price)} ₽</Badge>}
                {idea.fix && idea.fix.length > 40 && <Badge tone="orange">есть способ спасти</Badge>}
              </div>
              <h3 className="mt-4 font-display text-[18px] font-bold leading-tight">{idea.name}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-ink-2">{idea.what}</p>

              <dl className="mt-5 space-y-3 border-t border-line pt-5 text-[13.5px] leading-relaxed">
                {idea.evidence && (
                  <div>
                    <dt className="font-display text-[12.5px] font-bold text-ink">Доказательство спроса</dt>
                    <dd className="mt-1 text-ink-2">{idea.evidence}</dd>
                  </div>
                )}
                {idea.whyUs && (
                  <div>
                    <dt className="font-display text-[12.5px] font-bold text-ink">Почему можем мы</dt>
                    <dd className="mt-1 text-ink-2">{idea.whyUs}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-display text-[12.5px] font-bold text-bad">Почему отклонена</dt>
                  <dd className="mt-1 text-ink-2">{idea.reason}</dd>
                </div>
                {idea.fix && (
                  <div>
                    <dt className="font-display text-[12.5px] font-bold text-teal-ink">Как спасти</dt>
                    <dd className="mt-1 text-ink-2">{idea.fix}</dd>
                  </div>
                )}
              </dl>

              {idea.ops && (
                <p className="mt-4 border-t border-line pt-4 font-mono text-[11.5px] leading-relaxed text-muted">
                  Операции: {idea.ops}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11.5px] text-muted">
                {idea.season && <span>сезон: {idea.season}</span>}
                {idea.ttm !== null && idea.ttm !== undefined && <span>запуск: {idea.ttm} нед.</span>}
              </div>
            </article>
          ))}
        </div>
      </Container>
    </>
  );
}
