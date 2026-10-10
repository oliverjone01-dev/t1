# GENGROUP dashboard design rules

These rules apply to all brands, dashboards and their sections. A design correction is implemented through shared components and theme tokens, then verified across affected pages.

- TURBIUM is the source for typography, spacing, surfaces and visualization patterns. Extensions must reuse those roles.
- Dark is the default theme. Resolve the explicitly saved theme in the document head before first paint; retain an explicit light-theme choice across pages.
- KPI cards have separate borders and uniform gaps. Figures use neutral text colors; semantic changes use restrained green for improvement and red for deterioration, including inverted loss metrics.
- Charts label the current and comparison series explicitly. Their filters, definitions and endpoint totals must agree with the displayed metrics. Distinguish event counts from snapshots; disclose limits of reconstructed historical data.
- Plan and fact use one bullet scale: one neutral background track, a fact bar inside, and a target marker at 100%. Managers share the same completion-percentage scale for the selected metric; distinguish a workload norm from a sales plan. Lead and deal plans keep their full period quantities without a sales-cycle coefficient.
- Changes require desktop and mobile checks in both themes and verification after publication on the domain.
- Use sentence case for ordinary interface labels; preserve uppercase brand names (GENGLASS, GENGROUP) and established abbreviations. Compact navigation may use `РОП GG`, with the full name in the page title and accessible label.

Implementation: the common shell and theme are generated for ROP, the company structure and 24 native dashboard pages. Native document hydration is preserved in a same-origin content frame where required. The frame changes the content area only; shared navigation stays outside it.

## Requested addition — AI analysis

Status: the radar sample is implemented in Communications at /dialog/#ai-analysis. Its two profiles are explicitly marked as demonstration values; connecting saved real AI results remains separate work. No live AI requests are made by this sample.

- Add a radar/spider chart based on the supplied reference, with two clearly labeled comparison contours.
- Intended use: compare several assessment criteria for a manager or department, for example the selected period against the previous period or an explicitly defined target.
- Choose the axes from available AI-analysis results; use comparable, explicitly defined scales. Do not plot counts, currency and percentages on an unexplained common scale or invent scores.
- Show the criterion, both values, period and definition on hover; provide an accessible textual equivalent and mobile interaction. Use the shared dashboard theme and restrained fills.
- The reference is a visualization pattern; the age/sex labels in the example are not dashboard requirements.
- Saved local reference: outputs/ai-analysis-radar-reference.png.

## Compact widgets and composition

- A widget must fit within the viewport height after the shared header and filters. Aim for two overview widgets on a normal desktop screen. Long tables scroll inside the widget; do not hide data or shrink text until it becomes unreadable.
- Manager plan/fact rows use a compact 28 px height without an inner vertical scrollbar; calendar rows use 26 px. Repeated labels above row sparklines are omitted because the table already names each row.
- Vertical funnel stages meet at shared boundaries with only a small separator; stage metrics stay beside the silhouette.
- Composition rings use separated sectors, a centered total, restrained hover movement and a matching legend highlight. Use the same treatment for native SVG and supported chart-engine rings.
- Source-to-stage flow widths count selected-period deals and must conserve the total on both sides. State that the right side uses current stages; do not imply historical transitions.
- Only managers with published individual dashboards appear separately in aggregate manager tables. Others share one Другие row. Add counts and money before deriving ratios or medians; keep raw CRM records and drill-down names unchanged.

