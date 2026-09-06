import Image from "next/image";
import { unsplash } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Примерная фотография. Меняется через поле photo в src/content/cases.json. */
export function Photo({
  id, alt, className, sizes = "(max-width: 768px) 100vw, 33vw", priority = false,
}: {
  id: string | null; alt: string; className?: string; sizes?: string; priority?: boolean;
}) {
  const src = unsplash(id, 1000);
  return (
    <div className={cn("relative overflow-hidden bg-surface-2", className)}>
      {src ? (
        <Image src={src} alt={`${alt}. Примерное фото, не наше изделие`} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--teal)_18%,var(--surface-2))] to-[color-mix(in_srgb,var(--orange)_12%,var(--surface-2))]" />
      )}
      <span className="absolute bottom-2 left-2 rounded-pill bg-[color-mix(in_srgb,var(--ground)_82%,transparent)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted backdrop-blur-sm">
        примерное фото
      </span>
    </div>
  );
}
