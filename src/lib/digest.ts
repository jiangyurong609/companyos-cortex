import { buildClusters, strategicProposal } from "./clusters";
import { fmtUsd } from "./diff";
import type { EventRecord } from "./schemas";
import { events } from "./store";

export interface Digest {
  headline: string;
  sentences: { text: string; cites: string[] }[];
  dropped: number;
  basedOn: number;
  model: string;
  at: string;
}

const grounded = () =>
  [...events.values()].filter((r) => r.event && (r.stage === "DIFF_READY" || r.stage === "ACCEPTED")).sort((a, b) => a.id.localeCompare(b.id));

const lower1 = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const relatedOrgs = (r: EventRecord) => r.diff.filter((d) => d.id.startsWith("recalled-")).map((d) => d.title.split(" → ")[0]);
const relatedRefs = (r: EventRecord) => r.diff.filter((d) => d.id.startsWith("recalled-")).flatMap((d) => d.evidenceRefs);

/**
 * The CEO digest is composed in code from verified fields only (what changed / what needs you /
 * already handled). Free-form model prose invented names and dates in testing, so it is not used here.
 */
const SOURCE: Record<string, string> = { phone: "phone", call: "call recording", slack: "Slack", ticket: "support ticket", github: "GitHub", email: "email" };
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

function compose(recs: EventRecord[]): Digest {
  const clusters = buildClusters(recs);
  const clustered = new Set(clusters.flatMap((c) => c.items.map((r) => r.id)));
  const managed = recs.filter((r) => r.triage?.route === "manager" && !clustered.has(r.id));
  const sentences: Digest["sentences"] = [];
  let headline = `${recs.length} new signal${recs.length === 1 ? "" : "s"} from the field today`;
  const top = clusters[0];
  if (top) {
    const lead = top.lead;
    const ev = lead.event!;
    const org = ev.organization ?? "A customer";
    const orgs = relatedOrgs(lead);
    if (top.contributors.length > 1) {
      headline = `${top.contributors.length} people on ${top.teams.length} teams flagged ${top.label} today`;
      sentences.push({
        text: `${top.contributors.length} people on ${top.teams.length} teams reported ${top.label} today without talking to each other: ${list(top.contributors.map((c) => `${c.name} (${c.team}, ${SOURCE[c.source] ?? c.source})`))}.`,
        cites: top.contributors.map((c) => c.eventId),
      });
      if (lead.derivedTotalUsd && orgs.length)
        sentences.push({
          text: `Joined with what the company already knew, ${fmtUsd(lead.derivedTotalUsd)} across ${list([org, ...orgs])} now depends on it${top.orgs.filter((o) => o !== org && !orgs.includes(o)).length ? `, and ${list(top.orgs.filter((o) => o !== org && !orgs.includes(o)))} ${top.orgs.filter((o) => o !== org && !orgs.includes(o)).length > 1 ? "are" : "is"} affected too` : ""}.`,
          cites: [ev.id, ...relatedRefs(lead)],
        });
    } else if (lead.derivedTotalUsd && orgs.length) {
      headline = `${ev.requirement} now blocks ${fmtUsd(lead.derivedTotalUsd)} across ${orgs.length + 1} customers`;
      sentences.push({
        text: `${org} became the ${ordinal(orgs.length + 1)} customer blocked on ${ev.requirement}, joining ${list(orgs)} — ${fmtUsd(lead.derivedTotalUsd)} in opportunities now depend on it, and nobody had connected them until ${lead.reporter?.name ?? "the field"}'s note.`,
        cites: [ev.id, ...relatedRefs(lead)],
      });
    } else {
      headline = `${org}: ${ev.summary.replace(/\.$/, "")}`;
      sentences.push({ text: `${lead.reporter?.name ?? "The field"} reported: ${ev.summary}`, cites: [ev.id] });
    }
    const p = strategicProposal(lead);
    if (lead.decision)
      sentences.push({
        text: `You decided to ${lower1(lead.decision.text)}${lead.action?.owner ? `; ${lead.action.owner} owns the plan` : lead.action?.status === "drafting" ? "; QM is drafting the plan" : ""}.`,
        cites: [ev.id, lead.decision.ref],
      });
    else if (p)
      sentences.push({ text: `Your call: ${lower1(p.title).replace(/\.$/, "")}${ev.deadline_text ? ` — ${org} needs an answer ${ev.deadline_text}` : ""}.`, cites: [ev.id] });
  }
  for (const c of clusters.slice(1))
    sentences.push({
      text: c.key.startsWith("event:") ? `Also needs you: ${c.label}.` : `Also needs you: ${c.label} — ${c.lead.event!.summary.replace(/\.$/, "")}.`,
      cites: c.items.map((r) => r.event!.id),
    });
  if (managed.length) {
    const byMgr = new Map<string, EventRecord[]>();
    for (const r of managed) byMgr.set(r.reporter?.reportsTo ?? "Managers", [...(byMgr.get(r.reporter?.reportsTo ?? "Managers") ?? []), r]);
    for (const [mgr, rs] of byMgr)
      sentences.push({
        text: mgr === (process.env.CORTEX_CEO_NAME ?? "Yurong")
          ? `From your direct reports, FYI (no decision needed): ${rs.map((r) => r.event!.summary.replace(/\.$/, "")).join("; ")}.`
          : `${mgr} is handling ${rs.length} signal${rs.length > 1 ? "s" : ""} without escalation: ${rs.map((r) => r.event!.summary.replace(/\.$/, "")).join("; ")}.`,
        cites: rs.map((r) => r.event!.id),
      });
  }
  return { headline, sentences, dropped: 0, basedOn: recs.length, model: "composed from verified facts", at: new Date().toISOString() };
}

const ordinal = (n: number) => (["", "first", "second", "third", "fourth", "fifth"][n] ?? `${n}th`);

/** Current digest over grounded, triaged signals (pure function of verified state). */
export function currentDigest() {
  const recs = grounded().filter((r) => r.triage);
  return { digest: recs.length ? compose(recs) : null, generating: [...events.values()].some((r) => !r.triage && r.stage !== "FAILED" && r.stage !== "REJECTED") };
}
