"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VerdictBadge } from "@/components/verdict-badge";
import { num, pct } from "@/lib/format";
import { PASS_VERDICTS, WORKSHOP_LABEL, type Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface TableRow {
  id: string; name: string; query: string; workshop: string; verdict: Verdict;
  demand: number; pop: number | null; competitors: number | null;
  market: number | null; ssLow: number | null; ssBase: number | null;
  ssMax55: number | null; gapBase: number | null; gapLow: number | null;
  laserH: number | null; rentToday: number | null; score: number | null;
  belowDemandFloor: boolean; noCabinetData: boolean; hasCase: boolean;
}

type Group = "all" | "pass" | "warn" | "marginal" | "fail";
type SortKey = "score" | "demand" | "market" | "ssBase" | "gapBase" | "rentToday";

const GROUPS: { key: Group; label: string }[] = [
  { key: "all", label: "все" },
  { key: "pass", label: "проходят" },
  { key: "warn", label: "на грани / серийный" },
  { key: "marginal", label: "только маржинально" },
  { key: "fail", label: "не проходят" },
];



function inGroup(v: Verdict, g: Group) {
  if (g === "all") return true;
  if (g === "pass") return v === "PASS" || v === "PASS_CERT" || v === "PASS_PREMIUM";
  if (g === "warn") return v === "BORDER" || v === "BORDER_SERIAL" || v === "PASS_SERIAL_ONLY" || v === "PASS_SERIAL_ONLY_CERT";
  if (g === "marginal") return v === "PASS_ONLY_MARGINAL";
  return v === "FAIL";
}

export function NicheTable({ rows }: { rows: TableRow[] }) {
  const [group, setGroup] = useState<Group>("all");
  const [shop, setShop] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("score");

  const shops = useMemo(
    () => [...new Set(rows.map((r) => r.workshop || ""))].sort(),
    [rows]
  );

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (!inGroup(r.verdict, group)) return false;
      if (shop !== null && (r.workshop || "") !== shop) return false;
      if (needle && !`${r.name} ${r.query} ${r.id}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const val = (r: TableRow): number => {
      switch (sort) {
        case "score":
          return r.score ?? -1;
        case "rentToday":
          return r.rentToday ?? -99;
        case "demand":
          return r.demand;
        case "market":
          return r.market ?? -1;
        case "ssBase":
          return r.ssBase ?? -1;
        case "gapBase":
          return r.gapBase ?? -1;
      }
    };
    return [...filtered].sort((a, b) => val(b) - val(a));
  }, [rows, group, shop, q, sort]);

  const passCount = rows.filter((r) => PASS_VERDICTS.includes(r.verdict)).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setGroup(g.key)}
            aria-pressed={group === g.key}
            className={cn(
              "rounded-pill border px-3.5 py-1.5 font-display text-[13px] font-medium transition-colors",
              group === g.key ? "border-ink bg-ink text-ground" : "border-line-2 text-ink-2 hover:bg-surface"
            )}
          >
            {g.label}
          </button>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-line-2 sm:block" aria-hidden />
        {shops.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setShop(shop === s ? null : s)}
            aria-pressed={shop === s}
            className={cn(
              "rounded-pill border px-3.5 py-1.5 font-display text-[13px] font-medium transition-colors",
              shop === s ? "border-teal-ink bg-ok-bg text-teal-ink" : "border-line-2 text-ink-2 hover:bg-surface"
            )}
          >
            {WORKSHOP_LABEL[s] ?? s}
          </button>
        ))}
        <label className="relative ml-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по нишам"
            aria-label="Поиск по нишам"
            className="h-9 w-full rounded-pill border border-line-2 bg-card pl-9 pr-3 text-sm text-ink placeholder:text-muted"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px] text-muted">
        <span>
          Показано <b className="tnum text-ink">{view.length}</b> из {rows.length}
        </span>
        <span>
          проходят сито условно: <b className="tnum text-ink">{passCount}</b>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ArrowUpDown className="size-3.5" aria-hidden /> сортировка:
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Сортировка"
            className="rounded-pill border border-line-2 bg-card px-2 py-1 text-[13px] text-ink"
          >
            <option value="score">по потенциалу</option>
            <option value="demand">по спросу</option>
            <option value="market">по цене рынка</option>
            <option value="ssBase">по себестоимости</option>
            <option value="gapBase">по зазору</option>
            <option value="rentToday">по марже сегодня</option>
          </select>
        </span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-3xl border border-line">
        <table className="w-full min-w-[860px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface text-left">
              {["ID", "Ниша", "Цех", "Спрос ₽/28 дн", "Запросов", "Рынок", "С/С произв", "Целевая С/С", "Зазор", "Маржа", "Вердикт"].map(
                (h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "whitespace-nowrap px-3 py-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted",
                      i >= 3 && i <= 9 && "text-right",
                      i === 4 && "hidden xl:table-cell"
                    )}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.id} className="border-t border-line transition-colors hover:bg-surface">
                <td className="px-3 py-3 font-mono text-[11px] text-muted">{r.id}</td>
                <td className="min-w-[210px] px-3 py-3">
                  {r.hasCase ? (
                    <Link href={`/cases/${r.id}`} className="font-medium text-ink underline decoration-line-2 underline-offset-4 hover:decoration-teal-ink">
                      {r.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-ink">{r.name}</span>
                  )}
                  <div className="text-xs text-muted">
                    {r.query}
                    {r.noCabinetData && (
                      <span className="text-muted" title="Метрик кабинета по этой фразе нет">
                        {" · "}нет данных кабинета
                      </span>
                    )}
                    {r.belowDemandFloor && (
                      <span className="text-warn" title="Спрос ниже порога 300 000 ₽ за 28 дней">
                        {" · "}ниже порога спроса
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-ink-2">{WORKSHOP_LABEL[r.workshop || ""]}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right tnum font-mono text-[11.5px]">{r.noCabinetData ? <span className="text-muted">нет данных</span> : num(r.demand)}</td>
                <td className="hidden px-3 py-3 text-right tnum font-mono text-[11.5px] xl:table-cell">{num(r.pop)}</td>
                <td className="px-3 py-3 text-right tnum font-mono text-[11.5px]">{num(r.market)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right tnum font-mono text-[11.5px]">
                  {num(r.ssLow)} / {num(r.ssBase)}
                </td>
                <td className="px-3 py-3 text-right tnum font-mono text-[11.5px] font-bold text-teal-ink">{num(r.ssMax55)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right tnum font-mono text-[11.5px]">
                  {num(r.gapBase, 2)} / {num(r.gapLow, 2)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tnum font-mono text-[11.5px]">
                  {r.rentToday === null ? (
                    <span className="text-muted" title="Убыток съедает всю чистую выручку, процент теряет смысл">
                      убыток &gt; выручки
                    </span>
                  ) : (
                    <span className={r.rentToday >= 0.1 ? "text-ok" : "text-bad"}>{pct(r.rentToday)}</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <VerdictBadge verdict={r.verdict} short />
                </td>
              </tr>
            ))}
            {view.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-14 text-center text-muted">
                  Ничего не найдено. Снимите фильтр или измените запрос.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[13px] text-muted">
        «Целевая С/С» - себестоимость производства, при которой рыночная цена даёт 15% чистой рентабельности при
        софинансировании Ozon k&nbsp;0,55. «Зазор» - во сколько раз цена рынка отличается от нашей требуемой цены
        покупателя (база / серийный режим). «Маржа» - рентабельность к чистой выручке, если встать по целевой цене
        (верх рынка);{" "}
        <a href="/method#margin" className="text-teal-ink underline underline-offset-4">
          формула на странице методики
        </a>
        . «Убыток &gt; выручки» означает, что расходы площадки и себестоимость съедают всю выручку и процент теряет
        смысл.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="ok">проходит</Badge>
        <Badge tone="warn">на грани или серийный режим</Badge>
        <Badge tone="dim">только маржинально</Badge>
        <Badge tone="bad">не проходит</Badge>
        <span className="text-[13px] text-muted">
          - вердикт при комиссии 51-52% по данным ниши, АДМ 1,49 и рекламе 8%
        </span>
      </div>
    </div>
  );
}
