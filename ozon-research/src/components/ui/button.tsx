import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-pill font-display font-semibold transition-colors disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-ink text-ground hover:bg-ink-2",
        secondary: "border border-line-2 text-ink hover:bg-surface",
        accent: "bg-teal text-[#06251f] hover:brightness-105",
        ghost: "text-ink-2 hover:bg-surface hover:text-ink",
      },
      size: { sm: "h-9 px-4 text-[13px]", md: "h-11 px-5 text-sm", lg: "h-12 px-6 text-[15px]" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

type ButtonBase = VariantProps<typeof button> & { className?: string; children: React.ReactNode };

export function Button({ className, variant, size, ...props }: ButtonBase & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn(button({ variant, size }), className)} {...props} />;
}

export function ButtonLink({ href, className, variant, size, ...props }: ButtonBase & { href: string }) {
  return <Link href={href} className={cn(button({ variant, size }), className)} {...props} />;
}
