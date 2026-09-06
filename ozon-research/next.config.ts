import type { NextConfig } from "next";

/**
 * Обычная сборка (npm run dev / build) - как была: сервер Next и оптимизация картинок.
 * Сборка для GitHub Pages включается переменной PAGES_BASE с путём подпапки,
 * например PAGES_BASE=/t1/ozon-research: тогда это статический экспорт в out/.
 */
const base = process.env.PAGES_BASE ?? "";
const staticExport = base !== "" || process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(staticExport
    ? { output: "export" as const, trailingSlash: true, images: { unoptimized: true } }
    : { images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] } }),
  ...(base ? { basePath: base, assetPrefix: `${base}/` } : {}),
};

export default nextConfig;
