import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva(
  "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold font-display leading-none whitespace-nowrap",
  {
    variants: {
      tone: {
        ok: "bg-ok-bg text-ok",
        warn: "bg-warn-bg text-warn",
        bad: "bg-bad-bg text-bad",
        dim: "bg-surface-2 text-ink-2",
        muted: "bg-surface-2 text-muted",
        lime: "bg-lime text-[#111310]",
        orange: "bg-[color-mix(in_srgb,var(--orange)_15%,transparent)] text-orange-ink",
        outline: "border border-line-2 text-ink-2",
      },
    },
    defaultVariants: { tone: "muted" },
  }
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
