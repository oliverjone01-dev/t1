// Common date boundaries for the main dashboard and Problems. No browser state here.
function dashboardPeriodDates(p, from, to, floor, max) {
  const valid = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && Number.isFinite(Date.parse(d + 'T00:00:00Z'));
  const add = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  const clamp = d => d < floor ? floor : d > max ? max : d;
  if (p === 'range' && valid(from) && valid(to)) return {from: (from < to ? from : to) < floor ? floor : (from < to ? from : to), to: (from < to ? to : from) > max ? max : (from < to ? to : from)};
  if (p === 'all') return {from: floor, to: max};
  const count = {today: 1, '7d': 7, '30d': 30, '90d': 90, year: 365}[p] || 30;
  return {from: clamp(add(max, 1 - count)), to: max};
}
