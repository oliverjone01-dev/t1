import type { Metadata } from "next";
import { Onest, Golos_Text, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const onest = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-onest", display: "swap" });
const golos = Golos_Text({ subsets: ["latin", "cyrillic"], variable: "--font-golos", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Ozon Research - карта ниш для производства", template: "%s · Ozon Research" },
  description:
    "Исследование 180 ниш Ozon для производственных цехов: спрос из кабинета продавца, экономика по каждой нише, кейсы конкурентов, идеи ноу-хау и Reality Audit.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${onest.variable} ${golos.variable} ${jetbrains.variable}`}>
      <body>
        <ThemeProvider>
          <SiteHeader />
          <main id="content">{children}</main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
