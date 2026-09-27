import type { EventRecord } from "./schemas";

/**
 * Connect signals that different people captured independently: same capability family,
 * plus any signal whose raw text names one of the cluster's customers (e.g. a forecast risk on Acme).
 * Client-safe (no server imports) — used by the digest and the CEO briefing.
 */
const FAMILIES: [string, RegExp][] = [
  ["SAML", /\b(saml|sso|single sign-on)\b/i],
  ["Audit logs", /\baudit logs?\b/i],
  ["Rate limits", /\brate[- ]limit/i],
  ["SCIM", /\bscim\b/i],
];

export function capability(r: EventRecord): string | null {
  const req = r.event?.requirement;
  if (!req) return null;
  return FAMILIES.find(([, re]) => re.test(req))?.[0] ?? req;
}

export interface Contributor {
  name: string;
  team: string;
  source: string;
  eventId: string;
  summary: string;
}

export interface Cluster {
  key: string;
  label: string;
  lead: EventRecord; // highest-stakes signal; decisions act on it
  items: EventRecord[];
  contributors: Contributor[];
  teams: string[];
  orgs: string[];
  totalUsd: number;
}

const stakes = (r: EventRecord) => r.derivedTotalUsd ?? r.event?.opportunity_value_usd ?? 0;
const relatedOrgs = (r: EventRecord) => r.diff.filter((d) => d.id.startsWith("recalled-")).map((d) => d.title.split(" → ")[0]);

const known = (r: EventRecord) => {
  const c = capability(r);
  return c && FAMILIES.some(([k]) => k === c) ? c : null;
};

export function buildClusters(recs: EventRecord[]): Cluster[] {
  const ready = recs.filter((r) => r.event && r.triage);
  const ceo = ready.filter((r) => r.triage!.route === "ceo");
  // 1) capability families (SAML, audit logs…) reported by anyone
  const byKey = new Map<string, EventRecord[]>();
  for (const r of ceo) {
    const k = known(r);
    if (k) byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  // Anyone else who reported the same capability joins that escalated pattern, however they were routed.
  for (const r of ready.filter((r) => r.triage!.route !== "ceo")) {
    const k = known(r);
    if (k && byKey.has(k)) byKey.set(k, [...byKey.get(k)!, r]);
  }
  const orgsOf = (items: EventRecord[]) =>
    // Competitors are not affected customers.
    [...new Set(items.flatMap((r) => [r.event!.type === "competitor.signal" ? null : r.event!.organization, ...relatedOrgs(r)]).filter((o): o is string => !!o))];
  // 2) other escalated signals attach to the family whose customers they name (e.g. a forecast risk on Acme)
  const attachable = ready.filter(
    (r) => !known(r) && (r.triage!.route === "ceo" || r.event!.type === "competitor.signal" || r.event!.type === "operational.risk"),
  );
  for (const r of attachable) {
    const home = [...byKey.entries()].find(([, items]) => orgsOf(items).some((o) => r.observation.text.includes(o)));
    if (!home && r.triage!.route !== "ceo") continue; // unrelated non-escalated items stay with managers
    const key = home?.[0] ?? `event:${r.id}`;
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }
  const clusters: Cluster[] = [...byKey.entries()].map(([key, items]) => {
    const lead = [...items].sort((a, b) => stakes(b) - stakes(a))[0];
    const seen = new Set<string>();
    const contributors = items
      .map((r) => ({
        name: r.reporter?.name ?? r.observation.actor ?? "field",
        team: r.reporter?.team ?? "",
        source: r.observation.source ?? "phone",
        eventId: r.event!.id,
        summary: r.event!.summary,
      }))
      .filter((c) => (seen.has(c.name) ? false : (seen.add(c.name), true)));
    return {
      key,
      label: key.startsWith("event:") ? lead.event!.summary.replace(/\.$/, "") : key,
      lead,
      items,
      contributors,
      teams: [...new Set(contributors.map((c) => c.team).filter(Boolean))],
      orgs: orgsOf(items),
      totalUsd: Math.max(...items.map(stakes)),
    };
  });
  return clusters.sort((a, b) => b.contributors.length - a.contributors.length || b.totalUsd - a.totalUsd);
}

/** Prefer the concise strategic proposal (ours) over verbose agent phrasings. */
export function strategicProposal(r: EventRecord) {
  const ps = r.diff.filter((d) => d.kind === "proposed");
  const strategic = ps.filter((d) => /priorit|roadmap/i.test(d.title)).sort((a, b) => a.title.length - b.title.length);
  return strategic[0] ?? ps.find((d) => d.op !== "action") ?? ps[0];
}
