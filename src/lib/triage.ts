import { RIVER_SIDECAR_URL } from "./compiler";
import { fmtUsd } from "./diff";
import type { EventRecord, Triage } from "./schemas";
import { featuresOf } from "./learning/ledger";
import { applyPolicy, policyStore } from "./learning/policy";
import { events } from "./store";

/** Past human decisions become River's in-context examples of this CEO's judgment. */
function pastDecisions() {
  return [...events.values()]
    .filter((r) => r.event && (r.decision || r.stage === "REJECTED" || r.stage === "ACCEPTED"))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((r) => ({
      decision: r.decision ? `CEO approved "${r.decision.text}"` : r.stage === "REJECTED" ? "CEO rejected" : "merged as fact, no CEO decision",
      summary: `${r.event!.summary}${r.derivedTotalUsd ? ` (${fmtUsd(r.derivedTotalUsd)} related)` : ""}`,
    }));
}

/**
 * Route an item to the CEO or the reporter's manager — this replaces the reporting chain.
 * Company policy is a hard floor; River decides the rest, learning from past decisions.
 */
export async function triage(rec: EventRecord): Promise<Triage> {
  const ev = rec.event!;
  const related = rec.diff.filter((d) => d.id.startsWith("recalled-")).length;
  const stakes = rec.derivedTotalUsd ?? ev.opportunity_value_usd ?? 0;
  const past = pastDecisions();
  const { current } = policyStore();
  const rule = applyPolicy(current.rules, featuresOf(rec));
  if (rule)
    return {
      route: rule.route,
      priority: rule.route === "ceo" ? "high" : "medium",
      why: `Policy v${current.version}: ${rule.why}${related && stakes ? ` (${related + 1} customers, ${fmtUsd(stakes)})` : ""}`,
      by: "policy",
      learnedFrom: past.length,
    };
  try {
    const res = await fetch(`${RIVER_SIDECAR_URL}/triage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        item: {
          type: ev.type,
          summary: ev.summary,
          reporter: rec.reporter ? `${rec.reporter.name}, ${rec.reporter.role} (${rec.reporter.team})` : rec.observation.actor,
          stakes_usd: stakes,
          related_customers: rec.diff.filter((d) => d.id.startsWith("recalled-")).map((d) => d.title),
          deadline: ev.deadline_text,
        },
        past,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const j = (await res.json()) as { triage?: { route?: string; priority?: string; why?: string } };
    const t = j.triage;
    if (!t || (t.route !== "ceo" && t.route !== "manager")) throw new Error("bad triage");
    const priority = t.priority === "high" || t.priority === "low" ? t.priority : "medium";
    return { route: t.route, priority, why: t.why ?? "", by: "river", learnedFrom: past.length };
  } catch {
    const ceo = ev.type === "customer.blocker" && stakes >= 50_000;
    return { route: ceo ? "ceo" : "manager", priority: ceo ? "high" : "medium", why: "Rule fallback (River unavailable).", by: "rule", learnedFrom: past.length };
  }
}
