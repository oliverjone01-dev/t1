import { cn } from "@/lib/utils";

export function StatTile({
  value, label, note, tone = "plain", className,
}: {
  value: React.ReactNode; label: string; note?: string;
  tone?: "plain" | "accent" | "alert"; className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface p-5", className)}>
      <div
        className={cn(
          "font-display text-[32px] font-extrabold leading-none tracking-[-0.04em] tnum",
          tone === "accent" && "text-teal-ink",
          tone === "alert" && "text-orange-ink"
        )}
      >
        {value}
      </div>
      <div className="mt-2 text-[13px] font-medium text-ink-2">{label}</div>
      {note && <div className="mt-1.5 text-xs leading-snug text-muted">{note}</div>}
    </div>
  );
}
