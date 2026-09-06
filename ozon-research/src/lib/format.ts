const nbsp = " ";

/** 11000 → «11 000 ₽» */
export function rub(value: number | null | undefined, opts?: { short?: boolean }): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  if (opts?.short && Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}${nbsp}млн${nbsp}₽`;
  }
  if (opts?.short && Math.abs(value) >= 1_000) {
    return `${Math.round(value / 1000).toLocaleString("ru-RU")}${nbsp}тыс.${nbsp}₽`;
  }
  return `${Math.round(value).toLocaleString("ru-RU")}${nbsp}₽`;
}

export function num(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}

/** 0.15 → «15%» */
export function pct(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${(value * 100).toLocaleString("ru-RU", { maximumFractionDigits: digits })}%`;
}

/**
 * Ссылка на фотографию кейса.
 * slug - полный идентификатор Unsplash (photo-1593850577500-e09291dee089)
 * либо локальный путь, начинающийся со слеша (/photos/drovnitsa.jpg) - тогда отдаём как есть.
 */
export function unsplash(slug: string | null | undefined, w = 800): string | null {
  if (!slug) return null;
  if (slug.startsWith("/") || slug.startsWith("http")) return slug;
  return `https://images.unsplash.com/${slug}?auto=format&fit=crop&w=${w}&q=70`;
}
