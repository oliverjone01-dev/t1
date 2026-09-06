"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Photo } from "@/components/photo";
import { VerdictBadge } from "@/components/verdict-badge";
import { num, rub } from "@/lib/format";
import { WORKSHOP_LABEL, type Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface CaseCard {
  id: string; name: string; workshop: string; verdict: Verdict; photo: string | null;
  demand: number; market: number | null; ssBase: number | null; kgt: boolean | null;
  auditVerdict: string | null; noCabinetData: boolean;
}

export function CaseGrid({ items }: { items: CaseCard[] }) {
  const [tab, setTab] = useState("all");
  const tabs = useMemo(() => {
    const present = [...new Set(items.map((i) => i.workshop || ""))].sort();
    return [
      { key: "all", label: "Все цеха" },
      ...present.map((k) => ({ key: k, label: WORKSHOP_LABEL[k] ?? k })),
    ];
  }, [items]);
  const view = useMemo(
    () => (tab === "all" ? items : items.filter((i) => (i.workshop || "") === tab)),
    [items, tab]
  );

  return (
    <div>
      <div className="inline-flex flex-wrap rounded-pill border border-line bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={cn(
              "rounded-pill px-4 py-1.5 font-display text-[13px] font-semibold transition-colors",
              tab === t.key ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {view.map((c) => (
          <Link
            key={c.id}
            href={`/cases/${c.id}`}
            className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-card transition-colors hover:border-teal-ink"
          >
            <Photo id={c.photo} alt={c.name} className="aspect-4/3 w-full" sizes="(max-width: 640px) 100vw, 33vw" />
            <div className="flex flex-1 flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <VerdictBadge verdict={c.verdict} short />
                {c.auditVerdict === "NO_GO" && <Badge tone="bad">аудит: NO_GO</Badge>}
                {c.auditVerdict === "NEED_DATA" && <Badge tone="dim">нужны данные</Badge>}
                {c.kgt && <Badge tone="outline">КГТ</Badge>}
              </div>
              <h3 className="font-display text-[17px] font-bold leading-tight text-ink">{c.name}</h3>
              <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[12px] text-muted">
                <div className="flex justify-between gap-2">
                  <dt>рынок</dt>
                  <dd className="tnum text-ink-2">{num(c.market)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>С/С</dt>
                  <dd className="tnum text-ink-2">{num(c.ssBase)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>спрос</dt>
                  <dd className="tnum text-ink-2">
                    {c.noCabinetData ? "нет данных" : rub(c.demand, { short: true })}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>цех</dt>
                  <dd className="text-ink-2">{WORKSHOP_LABEL[c.workshop || ""]}</dd>
                </div>
              </dl>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
