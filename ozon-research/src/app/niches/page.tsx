import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/section";
import { StatTile } from "@/components/stat-tile";
import { NicheTable, type TableRow } from "@/components/niche-table";
import { cases, meta, niches } from "@/lib/data";
import { pct } from "@/lib/format";

export const metadata: Metadata = {
  title: "Карта ниш",
  description: "120 ниш с посчитанной экономикой: спрос, цена рынка, себестоимость, целевая себестоимость и маржа, плюс список ниш второго круга.",
};

export default function NichesPage() {
  const caseIds = new Set(cases.map((c) => c.id));
  const rows: TableRow[] = niches
    .filter((n) => n.verdict !== "NO_ECON")
    .map((n) => ({
      id: n.id, name: n.name, query: n.query, workshop: n.workshop, verdict: n.verdict,
      demand: n.demand, pop: n.pop, competitors: n.competitors, market: n.market,
      ssLow: n.ssLow, ssBase: n.ssBase, ssMax55: n.ssMax55, gapBase: n.gapBase, gapLow: n.gapLow,
      laserH: n.laserH, rentToday: n.rentToday, score: n.score,
      belowDemandFloor: n.belowDemandFloor, noCabinetData: n.noCabinetData, hasCase: caseIds.has(n.id),
    }));
  const noEcon = niches.filter((n) => n.verdict === "NO_ECON");

  return (
    <>
      <PageHeader
        eyebrow="Карта ниш"
        title={`${meta.counts.withEcon} ниш с посчитанной экономикой`}
        lead="Вердикт по каждой нише при комиссии 51-52%, АДМ 1,49 и софинансировании Ozon k 0,55. Колонка «целевая С/С» отвечает производству на вопрос, за сколько нужно научиться делать, чтобы цена рынка дала 15%."
      />

      <Container>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile value={meta.counts.passing} label="проходят условно" note="при расчётной цене" tone="accent" />
          <StatTile value={meta.counts.marginal} label="только маржинально" note="серийный режим, АДМ 1,2 и баллы как в июле" />
          <StatTile value={meta.counts.fails} label="не проходят" note="цена рынка ниже требуемой в разы" />
          <StatTile
            value={meta.counts.profitableToday}
            label="прибыльны по целевой цене"
            note={meta.bestToday ? `лучшая: ${pct(meta.bestToday.rentToday)}` : undefined}
            tone="alert"
          />
        </div>
      </Container>

      <div className="mx-auto w-full max-w-[1320px] px-4 pt-12 sm:px-6">
        <h2 className="sr-only">Таблица ниш с вердиктами</h2>
        <NicheTable rows={rows} />
      </div>

      <Container className="pt-16">
        <h2 className="font-display text-[clamp(20px,2.6vw,28px)] font-bold">
          Ниши второго круга: {noEcon.length} без расчёта экономики
        </h2>
        <p className="measure mt-3 text-[15px] leading-relaxed text-ink-2">
          Экономика по ним не считалась по одной из двух причин: спрос ниже порога для полного анализа либо расчёт не
          вернулся в конвейере. Список приведён целиком, чтобы было видно, что именно смотрели и что осталось на
          второй круг.
        </p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {noEcon.map((n) => (
            <li
              key={n.id}
              className="rounded-pill border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-2"
              title={n.verdictNote ?? undefined}
            >
              <span className="font-mono text-[11px] text-muted">{n.id}</span> {n.name}
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
