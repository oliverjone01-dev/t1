// Объединённые карточки OZON из атрибутов товара (/v4/product/info/attributes), без гугл-таблицы.
//
// Зачем другой источник: таблица заполнялась руками, она неполная, и правило родства из-за
// этого держалось на префиксе артикула, то есть на догадке. Ключ склейки у OZON свой -
// model_id: все SKU одной карточки несут один и тот же model_id, а count говорит, сколько
// их должно быть. Это позволяет не только собрать состав, но и увидеть, что состав неполный.
//
// Форма ответа НЕ проверена из этого контейнера (OZON закрыт сетевой политикой), поэтому
// разбор намеренно терпим к вариантам вложенности, а подтверждает форму card-groups-probe.
import type { CardGroup, CardSku } from "./card-groups.js";

/** Минимум участников, ниже которого это не объединённая карточка, а одиночный товар. */
export const MIN_MEMBERS = 2;

export interface ModelStats {
  /** Сколько товаров пришло всего. */
  items: number;
  /** У скольких удалось прочитать model_id. */
  withModel: number;
  /** Сколько групп собралось (>= MIN_MEMBERS участников). */
  groups: number;
  /** Группы, где собранных участников меньше, чем обещает count OZON. */
  incomplete: Array<{ model: string; have: number; want: number }>;
}

const str = (v: unknown): string => (v == null ? "" : String(v).trim());

/** model_id из любого разумного места ответа. Ноль и пустая строка это «нет модели». */
export function modelIdOf(it: any): string {
  const raw = it?.model_info?.model_id ?? it?.modelInfo?.modelId ?? it?.model_id ?? it?.model?.id;
  const s = str(raw);
  return s && s !== "0" ? s : "";
}

/** Обещанный размер карточки. Ноль означает «OZON не сказал», а не «карточка пустая». */
export function modelCountOf(it: any): number {
  const raw = it?.model_info?.count ?? it?.modelInfo?.count ?? it?.model_count;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Человекочитаемое имя карточки: общее начало названий участников. Если общего нет -
 *  «модель <id>». Номер модели в подписи дашборда читать невозможно, а имя товара одного
 *  из участников выдавало бы карточку за него одного. */
export function commonName(names: string[], model: string): string {
  const clean = names.map((n) => str(n)).filter(Boolean);
  if (!clean.length) return `модель ${model}`;
  if (clean.length === 1) return clean[0]!;
  const words = clean.map((n) => n.split(/\s+/));
  const out: string[] = [];
  for (let i = 0; i < words[0]!.length; i++) {
    const w = words[0]![i]!;
    if (!words.every((ws) => ws[i] === w)) break;
    out.push(w);
  }
  const label = out.join(" ").replace(/[\s,;:-]+$/, "");
  return label.length >= 3 ? label : `модель ${model}`;
}

/** Товары из /v4/product/info/attributes -> группы одной карточки + что с ними не так. */
export function itemsToCardGroups(items: any[]): { groups: CardGroup[]; stats: ModelStats; warnings: string[] } {
  const byModel = new Map<string, { want: number; skus: CardSku[]; names: string[] }>();
  let withModel = 0;

  for (const it of items ?? []) {
    const model = modelIdOf(it);
    if (!model) continue;
    withModel += 1;
    const offer = str(it?.offer_id ?? it?.offerId);
    const sku = str(it?.sku ?? it?.id ?? it?.product_id);
    const name = str(it?.name);
    const g = byModel.get(model) ?? { want: 0, skus: [], names: [] };
    g.want = Math.max(g.want, modelCountOf(it));
    // Дубль по offer возможен при пагинации внахлёст: карточка от этого не вырастает.
    if (offer && !g.skus.some((s) => s.offer === offer)) g.skus.push({ sku, offer, name, role: "" });
    if (name) g.names.push(name);
    byModel.set(model, g);
  }

  const groups: CardGroup[] = [];
  const incomplete: ModelStats["incomplete"] = [];
  const warnings: string[] = [];

  for (const [model, g] of [...byModel.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (g.skus.length < MIN_MEMBERS) continue;
    if (g.want && g.skus.length < g.want) incomplete.push({ model, have: g.skus.length, want: g.want });
    groups.push({ model: commonName(g.names, model), main: model, skus: g.skus });
  }

  if (!items?.length) warnings.push("ответ пустой: ни одного товара");
  else if (!withModel) warnings.push("ни у одного товара не нашлось model_id: проверь форму ответа через card-groups-probe");
  if (incomplete.length) warnings.push(`групп с недобором участников: ${incomplete.length}`);

  return { groups, stats: { items: items?.length ?? 0, withModel, groups: groups.length, incomplete }, warnings };
}
