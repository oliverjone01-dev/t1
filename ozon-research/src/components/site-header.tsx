"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/method", label: "Методика" },
  { href: "/niches", label: "Карта ниш" },
  { href: "/cases", label: "Кейсы" },
  { href: "/knowhow", label: "Ноу-хау" },
  { href: "/audit", label: "Аудит" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-6 focus:z-50 focus:rounded-pill focus:bg-ink focus:px-4 focus:py-2 focus:font-display focus:text-sm focus:font-semibold focus:text-ground"
      >
        К содержимому
      </a>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-pill border border-line bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] py-2 pl-5 pr-2 backdrop-blur-xl">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 font-display text-sm font-bold tracking-tight">
          <span className="block size-4 rounded-[5px] bg-linear-to-br from-lime to-teal" aria-hidden />
          Ozon Research
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname.startsWith(item.href) ? "page" : undefined}
              className={cn(
                "rounded-pill px-3 py-1.5 font-display text-[13.5px] font-medium transition-colors",
                pathname.startsWith(item.href) ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/decisions"
            className="hidden rounded-pill bg-ink px-4 py-2 font-display text-[13px] font-semibold text-ground transition-colors hover:bg-ink-2 sm:block"
          >
            Решения
          </Link>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-pill border border-line text-ink-2 md:hidden"
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={open}
          >
            {open ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="mx-auto mt-2 max-w-5xl rounded-3xl border border-line bg-card p-3 md:hidden">
          {[...NAV, { href: "/decisions", label: "Решения" }].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-2xl px-4 py-3 font-display text-[15px] font-semibold text-ink hover:bg-surface"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
