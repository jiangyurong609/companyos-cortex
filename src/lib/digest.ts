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
const stakes = (r: EventRecord) => r.derivedTotalUsd ?? r.event!.opportunity_value_usd ?? 0;
const strategic = (r: EventRecord) =>
  r.diff.find((d) => d.kind === "proposed" && /priorit|roadmap/i.test(d.title)) ?? r.diff.find((d) => d.kind === "proposed" && d.op !== "action");

/**
 * The CEO digest is composed in code from verified fields only (what changed / what needs you /
 * already handled). Free-form model prose invented names and dates in testing, so it is not used here.
 */
function compose(recs: EventRecord[]): Digest {
  const ceo = recs.filter((r) => r.triage?.route === "ceo").sort((a, b) => stakes(b) - stakes(a));
  const managed = recs.filter((r) => r.triage?.route === "manager");
  const sentences: Digest["sentences"] = [];
  let headline = `${recs.length} new signal${recs.length === 1 ? "" : "s"} from the field today`;
  const top = ceo[0];
  if (top) {
    const ev = top.event!;
    const org = ev.organization ?? "A customer";
    const orgs = relatedOrgs(top);
    if (top.derivedTotalUsd && orgs.length) {
      headline = `${ev.requirement} now blocks ${fmtUsd(top.derivedTotalUsd)} across ${orgs.length + 1} customers`;
      sentences.push({
        text: `${org} became the ${ordinal(orgs.length + 1)} customer blocked on ${ev.requirement}, joining ${orgs.join(" and ")} — ${fmtUsd(top.derivedTotalUsd)} in opportunities now depend on it, and nobody had connected them until ${top.reporter?.name ?? "the field"}'s note.`,
        cites: [ev.id, ...relatedRefs(top)],
      });
    } else {
      headline = `${org}: ${ev.summary.replace(/\.$/, "")}`;
      sentences.push({ text: `${top.reporter?.name ?? "The field"} reported: ${ev.summary}`, cites: [ev.id] });
    }
    const p = strategic(top);
    if (top.decision)
      sentences.push({
        text: `You decided to ${lower1(top.decision.text)}${top.action?.owner ? `; ${top.action.owner} owns the plan` : top.action?.status === "drafting" ? "; QM is drafting the plan" : ""}.`,
        cites: [ev.id, top.decision.ref],
      });
    else if (p)
      sentences.push({ text: `Your call: ${lower1(p.title).replace(/\.$/, "")}${ev.deadline_text ? ` — ${org} needs an answer ${ev.deadline_text}` : ""}.`, cites: [ev.id] });
  }
  if (managed.length) {
    const byMgr = new Map<string, EventRecord[]>();
    for (const r of managed) byMgr.set(r.reporter?.reportsTo ?? "Managers", [...(byMgr.get(r.reporter?.reportsTo ?? "Managers") ?? []), r]);
    for (const [mgr, rs] of byMgr)
      sentences.push({
        text: `${mgr} is handling ${rs.length} other signal${rs.length > 1 ? "s" : ""} without escalation: ${rs.map((r) => r.event!.summary.replace(/\.$/, "")).join("; ")}.`,
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
