import nichesRaw from "@/content/niches.json";
import casesRaw from "@/content/cases.json";
import knowhowRaw from "@/content/knowhow.json";
import metaRaw from "@/content/meta.json";
import type { Case, Idea, Meta, Niche } from "@/lib/types";

export type { Case, Competitor, AuditItem, Idea, Meta, Niche, Verdict, Workshop } from "@/lib/types";
export { PASS_VERDICTS, VERDICT_LABEL, VERDICT_TONE, WORKSHOP_LABEL } from "@/lib/types";

export const meta = metaRaw as unknown as Meta;
export const niches = nichesRaw as unknown as Niche[];
export const ideas = knowhowRaw as unknown as Idea[];
export const cases = casesRaw as unknown as Case[];

export function nicheById(id: string): Niche | undefined {
  return niches.find((n) => n.id === id);
}

export function caseById(id: string): Case | undefined {
  return cases.find((c) => c.id === id);
}
