"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className="inline-flex items-center gap-1 rounded-pill border border-line bg-surface p-1" role="group" aria-label="Тема оформления">
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={mounted ? !isDark : undefined}
        aria-label="Светлая тема"
        className={cn(
          "flex size-8 items-center justify-center rounded-pill transition-colors",
          mounted && !isDark ? "bg-ink text-ground" : "text-muted hover:text-ink"
        )}
      >
        <Sun className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={mounted ? isDark : undefined}
        aria-label="Тёмная тема"
        className={cn(
          "flex size-8 items-center justify-center rounded-pill transition-colors",
          isDark ? "bg-ink text-ground" : "text-muted hover:text-ink"
        )}
      >
        <Moon className="size-4" aria-hidden />
      </button>
    </div>
  );
}
