import { cn } from "@/lib/utils";

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)} {...props} />;
}

export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("font-mono text-[11.5px] font-bold uppercase tracking-[0.14em] text-teal-ink", className)}
      {...props}
    />
  );
}

export function PageHeader({
  eyebrow, title, lead, children,
}: {
  eyebrow: string; title: string; lead?: string; children?: React.ReactNode;
}) {
  return (
    <Container className="pb-10 pt-14 sm:pt-20">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-4 font-display text-[clamp(32px,5vw,58px)] font-extrabold">{title}</h1>
      {lead && <p className="measure mt-5 text-[17px] leading-relaxed text-ink-2">{lead}</p>}
      {children}
    </Container>
  );
}
