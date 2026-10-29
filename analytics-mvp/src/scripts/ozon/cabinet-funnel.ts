// One source adapter for dashboard consumers. Never writes API or cabinet archives.
import {readCaptureFile, type CabinetCapture, type CaptureFile} from './cabinet-capture.js';
import type {FunnelRead, FunnelRole} from '../funnel-tests.js';

/** Pick one observation per day; morning/evening are replacements, not increments. */
export function captureDays(file: CaptureFile | null): CabinetCapture[] {
  const byDay = new Map<string, CabinetCapture>();
  for (const r of file?.snapshots ?? []) {
    const old = byDay.get(r.day);
    if (!old || Date.parse(r.captured_at) > Date.parse(old.captured_at)) byDay.set(r.day, r);
  }
  return [...byDay.values()].sort((a,b) => a.day.localeCompare(b.day));
}

export function captureIsOpen(r: CabinetCapture): boolean {
  const observedDay = new Date(Date.parse(r.captured_at) + 3 * 3600e3).toISOString().slice(0,10);
  return r.day_in_progress || observedDay <= r.day;
}

export type NativeFunnel = {
  date: string; sku: string; views: number | null; vsearch: number | null;
  pdp: number | null; cart: number | null; units: number | null;
  pos: number | null; loaded_at: string; partial: boolean;
};

export function nativeFunnel(file: CaptureFile | null): NativeFunnel[] {
  return captureDays(file).flatMap(r => {
    const seen = new Set<string>();
    return r.items.map(item => {
      // Report rows may be split by scheme. Without a documented position estimator,
      // refusing an ambiguous SKU is safer than adding an invented mean or duplicate.
      if (seen.has(item.sku)) throw Error(`Cabinet funnel: multiple scheme rows for ${item.sku} on ${r.day}`);
      seen.add(item.sku);
      return {date:r.day, sku:item.sku, views:item.views, vsearch:item.search_views,
        pdp:item.pdp_views, cart:item.cart, units:item.ordered_units,
        pos:item.search_position && item.search_position > 0 ? item.search_position : null,
        loaded_at:r.captured_at, partial:captureIsOpen(r)};
    });
  });
}

/** Closed-day observations override only fields actually measured for that SKU/day.
 * Missing SKUs retain their API observation; money, returns, delivery and cancellations
 * are never manufactured from this report. Open days stay out of closed-day comparisons.
 */
export function mergeCabinetViews(api: any[], file: CaptureFile | null): any[] {
  const rows = new Map<string, any>();
  const measuredDays = new Set<string>();
  for (const r of api) {
    const key = `${r.date}|${r.sku}`;
    if (rows.has(key)) throw Error(`Cabinet funnel: duplicate API SKU/day ${key}`);
    rows.set(key, {...r});
  }
  for (const r of nativeFunnel(file)) {
    if (r.partial) continue;
    measuredDays.add(r.date);
    const key = `${r.date}|${r.sku}`, old = rows.get(key) ?? {date:r.date,sku:r.sku};
    const next = {...old};
    for (const k of ['views','vsearch','pdp','cart','units'] as const) if (r[k] !== null) next[k] = r[k];
    next.cabinet_loaded_at = r.loaded_at;
    rows.set(key,next);
  }
  for (const r of rows.values()) if (measuredDays.has(r.date)) {
    for (const k of ['views','vsearch','pdp','cart','units'] as const) {
      if (!Number.isFinite(r[k])) throw Error(`Cabinet funnel: missing closed-day measure ${r.date}|${r.sku}|${k}`);
    }
  }
  return [...rows.values()];
}

export const readCabinetFunnel = (dir: string) => nativeFunnel(readCaptureFile(dir));

/** Channel funnel and category breakdown must use the same SKU/day population.
 * Keep the financial and post-order columns of the API totals unchanged. */
export function mergeCabinetTotals(apiTotals: any[], mergedViews: any[], file: CaptureFile|null): any[] {
  const days=new Set(nativeFunnel(file).filter(r=>!r.partial).map(r=>r.date));
  const names=[['views','views'],['vsearch','views_search'],['pdp','pdp_views'],['cart','to_cart'],['units','units']] as const;
  const totals=new Map<string,any>();
  for (const t of apiTotals) {
    if (totals.has(t.date)) throw Error(`Cabinet funnel: duplicate API day ${t.date}`);
    totals.set(t.date,t);
  }
  for (const date of days) if (!totals.has(date)) totals.set(date,{date,cabinet_only:true});
  return [...totals.values()].map(t=>{
    if (!days.has(t.date)) return t;
    const rows=mergedViews.filter(r=>r.date===t.date),next={...t};
    for (const [field,total] of names) {
      // Do not let a missing field become an apparently measured zero.
      if (rows.length && rows.every(r=>Number.isFinite(r[field]))) next[total]=rows.reduce((sum,r)=>sum+r[field],0);
    }
    return next;
  });
}

/** Reuse the existing experiment roles; never infer a control from traffic levels. */
export function cabinetTestRows(file: CaptureFile | null, skuToArt: Record<string,string>,
  base: FunnelRead, members: Map<string,FunnelRole>): unknown[] {
  const templates = new Map([...base.rows,...base.partial].filter(r=>r.art).map(r=>[r.art,r]));
  const seen = new Set<string>();
  return nativeFunnel(file).flatMap(r => {
    const art = skuToArt[r.sku];
    if (!art) return [];
    const template = templates.get(art);
    let role = members.get(art) ?? template?.role;
    if (role==='test_ad' && template?.role==='test_sibling') role='test_sibling';
    if (!role) return [];
    const key = `${r.date}|${art}`;
    if (seen.has(key)) throw Error(`Cabinet funnel: multiple SKUs for article ${key}`);
    seen.add(key);
    // A partial metric is missing, not zero. Keep that article out of the all-field
    // FunnelRow contract rather than synthesize its missing counts.
    if ([r.vsearch,r.pdp,r.cart,r.units].some(v=>v===null)) return [];
    return [{date:r.date,art,role,test_id:template?.test_id ?? '',group:template?.group ?? '',
      search_position:r.pos,search_views:r.vsearch,pdp_views:r.pdp,hits_to_cart:r.cart,
      ordered_units:r.units,full:!r.partial,
      ts:new Date(Date.parse(r.loaded_at)+3*3600e3).toISOString().replace('Z','+03:00'),snap:'native'}];
  });
}
