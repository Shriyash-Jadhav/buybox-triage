import { SKUS } from "@/lib/data";
import { triage } from "@/lib/triage-engine";
import { TriageView } from "@/components/triage-view";

export default function Home() {
  // Server-side triage — runs once, instantly, no LLM involved.
  // The page can render the structure of the answer before any AI work begins.
  const lanes = triage(SKUS);

  return <TriageView lanes={lanes} />;
}
