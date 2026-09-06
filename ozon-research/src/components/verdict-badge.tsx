import { Badge } from "@/components/ui/badge";
import { VERDICT_LABEL, VERDICT_SHORT, VERDICT_TONE, type Verdict } from "@/lib/types";

export function VerdictBadge({ verdict, short = false }: { verdict: Verdict; short?: boolean }) {
  const label = (short ? VERDICT_SHORT[verdict] : VERDICT_LABEL[verdict]) ?? verdict;
  return <Badge tone={VERDICT_TONE[verdict] ?? "muted"}>{label}</Badge>;
}

const AUDIT_TONE = { GO: "ok", GO_WITH_FIXES: "warn", NEED_DATA: "dim", NO_GO: "bad" } as const;
const AUDIT_LABEL = { GO: "GO", GO_WITH_FIXES: "GO с правками", NEED_DATA: "нужны данные", NO_GO: "NO_GO" } as const;

export function AuditBadge({ verdict }: { verdict: keyof typeof AUDIT_TONE }) {
  return <Badge tone={AUDIT_TONE[verdict]}>Аудит: {AUDIT_LABEL[verdict]}</Badge>;
}
