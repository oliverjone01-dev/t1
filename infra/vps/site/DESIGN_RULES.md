# GENGROUP dashboard design rules

These rules apply to all brands, dashboards and their sections. A design correction is implemented through shared components and theme tokens, then verified across affected pages.

- TURBIUM is the source for typography, spacing, surfaces and visualization patterns. Extensions must reuse those roles.
- Dark is the default theme. Resolve the explicitly saved theme in the document head before first paint; retain an explicit light-theme choice across pages.
- KPI cards have separate borders and uniform gaps. Figures use neutral text colors; semantic changes use restrained green for improvement and red for deterioration, including inverted loss metrics.
- Charts label the current and comparison series explicitly. Their filters, definitions and endpoint totals must agree with the displayed metrics. Distinguish event counts from snapshots; disclose limits of reconstructed historical data.
- Plan and fact use one bullet scale: a wider gray target, a thin fact bar inside, and a target marker. Managers share the same scale for the selected metric; distinguish a workload norm from a sales plan. Lead and deal plans keep their full period quantities without a sales-cycle coefficient.
- Changes require desktop and mobile checks in both themes and verification after publication on the domain.
- Use sentence case for ordinary interface labels; preserve uppercase brand names (GENGLASS, GENGROUP) and established abbreviations. Compact navigation may use `РОП GG`, with the full name in the page title and accessible label.

Implementation status: the early theme bootstrap and updated KPI/plan presentation are being rolled out first to ROP. Other dashboards still require the same shared-theme migration; this document does not claim that rollout is complete.

