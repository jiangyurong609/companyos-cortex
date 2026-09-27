import { moneyMentions } from "./compiler";
import type { DiffRow, GroundedResolution, RawObservation, RealityEvent, RecalledFact } from "./schemas";

/** Requirements treated as the same capability family when linking opportunities. */
const FAMILIES = [["saml", "sso", "single sign-on", "enterprise sso"], ["scim", "provisioning"], ["soc 2", "soc2"]];

function family(req: string | null): string[] {
  if (!req) return [];
  const r = req.toLowerCase();
  return FAMILIES.find((f) => f.some((t) => r.includes(t))) ?? [r];
}

export function sameCapability(a: string | null, b: string | null): boolean {
  const fa = family(a);
  const bl = (b ?? "").toLowerCase();
  return fa.length > 0 && fa.some((t) => bl.includes(t));
}

/** A recalled value only counts if it literally appears in the quoted source text. */
export function isGroundedValue(f: RecalledFact): boolean {
  return f.value_usd !== null && moneyMentions(f.quote).includes(f.value_usd);
}

export const fmtUsd = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`);

export interface DiffOutput {
  rows: DiffRow[];
  derivedTotalUsd?: number;
  related: RecalledFact[];
}

export function buildDiff(obs: RawObservation, ev: RealityEvent, res: GroundedResolution): DiffOutput {
  const rows: DiffRow[] = [];
  const obsRef = `observation:${obs.id}`;
  const org = ev.organization ?? "Customer";
  const req = ev.requirement;

  rows.push({
    id: "observed-1",
    kind: "observed",
    op: "add",
    domain: "sales",
    title: `${org} ${ev.type === "customer.blocker" ? "blocked by" : "requests"} ${req ?? "change"}${
      ev.opportunity_value_usd ? ` — ${fmtUsd(ev.opportunity_value_usd)}` : ""
    }`,
    detail: [ev.owner && `Reported by ${ev.owner}`, ev.deadline_text && `Answer needed ${ev.deadline_text}`]
      .filter(Boolean)
      .join(" · "),
    evidenceRefs: [obsRef],
    evidence: [{ ref: obsRef, quote: obs.text }],
    acceptable: true,
  });

  // Other organizations with the same capability need — the non-obvious cross-link.
  const related = res.recalled.filter(
    (f) =>
      f.organization &&
      f.organization.toLowerCase() !== org.toLowerCase() &&
      sameCapability(req, `${f.requirement ?? ""} ${f.statement}`),
  );
  const context = res.recalled.filter((f) => !related.includes(f));

  related.forEach((f, i) =>
    rows.push({
      id: `recalled-${i + 1}`,
      kind: "recalled",
      op: "add",
      domain: "sales",
      title: `${f.organization} → ${f.requirement ?? req} ${f.value_usd && isGroundedValue(f) ? `— ${fmtUsd(f.value_usd)}` : ""}`.trim(),
      detail: f.statement,
      evidenceRefs: [f.source_ref],
      evidence: [{ ref: f.source_ref, quote: f.quote }],
      acceptable: false,
    }),
  );
  context.forEach((f, i) =>
    rows.push({
      id: `context-${i + 1}`,
      kind: "recalled",
      op: "add",
      domain: /auth|roadmap|priority|decision/i.test(f.statement) ? "product" : "company",
      title: f.statement,
      evidenceRefs: [f.source_ref],
      evidence: [{ ref: f.source_ref, quote: f.quote }],
      acceptable: false,
    }),
  );

  let derivedTotalUsd: number | undefined;
  const counted = related.filter(isGroundedValue);
  if (ev.opportunity_value_usd && counted.length > 0) {
    derivedTotalUsd = ev.opportunity_value_usd + counted.reduce((s, f) => s + (f.value_usd ?? 0), 0);
    const parts = [`${org} ${fmtUsd(ev.opportunity_value_usd)}`, ...counted.map((f) => `${f.organization} ${fmtUsd(f.value_usd!)}`)];
    rows.push({
      id: "derived-1",
      kind: "derived",
      op: "add",
      domain: "sales",
      title: `Related ${req ?? ""} opportunities: ${fmtUsd(derivedTotalUsd)}`.replace(/\s+/g, " "),
      detail: `${parts.join(" + ")} = ${fmtUsd(derivedTotalUsd)} · arithmetic over recorded values, not a forecast`,
      evidenceRefs: [obsRef, ...counted.map((f) => f.source_ref)],
      evidence: [{ ref: obsRef, quote: obs.text }, ...counted.map((f) => ({ ref: f.source_ref, quote: f.quote }))],
      acceptable: false,
    });
  }
  if (related.length > 0) {
    rows.push({
      id: "derived-2",
      kind: "derived",
      op: "update",
      domain: "product",
      title: `${org} is request #${related.length + 1} for ${req ?? "this capability"}`,
      evidenceRefs: related.map((f) => f.source_ref),
      evidence: related.map((f) => ({ ref: f.source_ref, quote: f.quote })),
      acceptable: false,
    });
  }

  const proposals = [...res.proposals];
  if (req && related.length > 0 && !proposals.some((p) => /priorit/i.test(p))) proposals.unshift(`Review ${req} roadmap priority`);
  if (req && !proposals.some((p) => /feasib|estimate/i.test(p))) proposals.push(`Engineering feasibility check for ${req}`);
  proposals.forEach((p, i) =>
    rows.push({
      id: `proposed-${i + 1}`,
      kind: "proposed",
      op: /feasib|estimate|investigat/i.test(p) ? "action" : "update",
      domain: /feasib|estimate|implement/i.test(p) ? "engineering" : "product",
      title: p,
      detail: "Recommendation only — not written to company memory as fact.",
      evidenceRefs: [obsRef, ...related.map((f) => f.source_ref)],
      evidence: [],
      acceptable: false,
    }),
  );

  for (const c of res.contradictions)
    rows.push({ id: `conflict-${rows.length}`, kind: "recalled", op: "conflict", domain: "company", title: c, evidenceRefs: [], evidence: [], acceptable: false });

  return { rows, derivedTotalUsd, related };
}

/** The exact note written to GBrain on approval. Observed facts only. */
export function buildMemoryNote(obs: RawObservation, ev: RealityEvent): { title: string; body: string } {
  const org = ev.organization ?? "Customer";
  const title = `${org} — ${ev.requirement ?? "customer"} ${ev.type === "customer.blocker" ? "deployment blocker" : "request"}`;
  const lines = [
    `# ${title}`,
    "",
    ev.requirement
      ? `${org} reported that ${ev.type === "customer.blocker" ? "approval is blocked by lack of" : "they need"} ${ev.requirement} support.`
      : ev.summary,
    ev.opportunity_value_usd ? `The opportunity is recorded as ${fmtUsd(ev.opportunity_value_usd)}${ev.owner ? ` and was reported by ${ev.owner}` : ""}.` : null,
    ev.deadline_text ? `The requested response deadline is ${ev.deadline_text}.` : null,
    "",
    `Observation: "${obs.text}"`,
    "",
    `Source: CompanyOS Cortex Reality Event ${ev.id}`,
    `Captured: ${obs.createdAt}${obs.actor ? ` by ${obs.actor}` : ""}`,
  ].filter((l): l is string => l !== null);
  return { title, body: lines.join("\n") };
}
