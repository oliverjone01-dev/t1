import Link from "next/link";
import { meta } from "@/lib/data";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line px-4 py-12 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md">
          <div className="flex items-center gap-2.5 font-display text-sm font-bold">
            <span className="block size-4 rounded-[5px] bg-linear-to-br from-lime to-teal" aria-hidden />
            Ozon Research
          </div>
          <p className="mt-3 text-sm text-muted">
            Исследование от {meta.date}: {meta.counts.niches} ниш проверено, {meta.counts.withEcon} посчитано по
            экономике, {meta.counts.withCabinet} с метриками кабинета Ozon Seller. Данные собраны из кабинета продавца,
            витрины Ozon и внутренней таблицы себестоимости.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
          {[
            { href: "/method", label: "Методика и экономика" },
            { href: "/niches", label: "Карта 180 ниш" },
            { href: "/cases", label: "Кейсы шорт-листа" },
            { href: "/knowhow", label: "Идеи ноу-хау" },
            { href: "/audit", label: "Reality Audit" },
            { href: "/decisions", label: "Решения собственника" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="text-ink-2 transition-colors hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="mx-auto mt-10 max-w-6xl text-xs text-muted">
        Фотографии - Unsplash, подобраны как примерные. Постоянное место правки - словарь PHOTOS в{" "}
        <code className="font-mono">scripts/build_content.py</code>, затем npm run content.
      </p>
    </footer>
  );
}
