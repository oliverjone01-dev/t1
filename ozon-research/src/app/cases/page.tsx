import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/section";
import { CaseGrid, type CaseCard } from "@/components/case-grid";
import { cases, meta } from "@/lib/data";

export const metadata: Metadata = {
  title: "Кейсы шорт-листа",
  description: "24 ниши шорт-листа: конкуренты с ценами и продавцами, сезонность из кабинета, дырки в предложении.",
};

export default function CasesPage() {
  const items: CaseCard[] = cases.map((c) => ({
    id: c.id, name: c.name, workshop: c.workshop, verdict: c.verdict, photo: c.photo,
    demand: c.demand, market: c.market, ssBase: c.ssBase, kgt: c.kgt,
    auditVerdict: c.audit?.verdict ?? null, noCabinetData: c.noCabinetData,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Шорт-лист"
        title={`${meta.counts.cases} ниши, разобранные до конкурентов`}
        lead="По каждой: кто сегодня забирает нишу и по какой цене, как выглядит сезон по данным кабинета, чего в предложении не хватает и чем можно зайти. Фотографии - примерные, заменяются в одном файле."
      />
      <Container>
        <h2 className="sr-only">Сетка кейсов</h2>
        <CaseGrid items={items} />
      </Container>
    </>
  );
}
