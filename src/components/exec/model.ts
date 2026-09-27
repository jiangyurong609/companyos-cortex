import type { EventRecord, KnowledgeKind } from "@/lib/schemas";

export type Digest = { headline: string; sentences: { text: string; cites: string[] }[]; basedOn: number };
export type DigestResponse = { digest: Digest | null; generating: boolean };
export type StatusResponse = { gbrain?: { mode: string }; qm?: { mode: string }; compiler?: { mode: string } };

export const fmtUsd = (n: number) =>
  n <= 0 ? "$0" : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`;
export const fmtTime = (iso: string | number) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

export const personOf = (r: EventRecord) => r.reporter?.name ?? r.observation.actor ?? "Unknown";
export const teamOf = (r: EventRecord) => r.reporter?.team ?? "Unassigned";
export type Route = "ceo" | "manager" | "pending";
export const routeOf = (r: EventRecord): Route => r.triage?.route ?? "pending";

export const ROUTE_COLOR: Record<Route, string> = {
  ceo: "var(--derived)",
  manager: "var(--observed)",
  pending: "var(--muted)",
};
export const ROUTE_LABEL: Record<Route, string> = { ceo: "CEO", manager: "Managers", pending: "Triaging" };

export const KIND_COLOR: Record<KnowledgeKind, string> = {
  observed: "var(--observed)",
  recalled: "var(--recalled)",
  derived: "var(--derived)",
  proposed: "var(--proposed)",
};

export const TYPE_LABEL: Record<string, string> = {
  "customer.blocker": "Customer blocker",
  "customer.request": "Customer request",
  "product.bug": "Product bug",
  "decision.changed": "Decision changed",
  "competitor.signal": "Competitor signal",
  "operational.risk": "Operational risk",
};

export interface StakeRow {
  key: string;
  label: string;
  reported: number;
  recalled: number;
  total: number;
  reportedOrgs: string[];
  recalledOrgs: string[];
}

export interface Capture {
  id: string;
  t: number;
  count: number;
  person: string;
  ceo: boolean;
}

export interface Model {
  events: EventRecord[];
  signals: number;
  captures: Capture[];
  people: number;
  stake: StakeRow[];
  stakeTotal: number;
  ceo: number;
  manager: number;
  ceoAwaiting: number;
  written: number;
  blocked: number;
  kinds: { kind: KnowledgeKind; n: number }[];
  types: { type: string; n: number }[];
}

const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];

export function buildModel(all: EventRecord[]): Model {
  // "Today" = the 24h window ending at the newest activity (no wall-clock read in render).
  const latest = Math.max(0, ...all.map((r) => Date.parse(r.observation.createdAt) || 0));
  const events = all.filter((r) => latest - (Date.parse(r.observation.createdAt) || 0) < 86_400_000);

  // $ at stake: one row per distinct requirement (or org when no requirement), counted once.
  const groups = new Map<string, StakeRow>();
  for (const r of events) {
    const ev = r.event;
    if (!ev) continue;
    const reported = ev.opportunity_value_usd ?? 0;
    const total = Math.max(r.derivedTotalUsd ?? 0, reported);
    if (total <= 0) continue;
    const label = ev.requirement ?? ev.organization ?? "Unlabelled";
    const key = label.trim().toLowerCase();
    const g = groups.get(key) ?? {
      key,
      label,
      reported: 0,
      recalled: 0,
      total: 0,
      reportedOrgs: [],
      recalledOrgs: [],
    };
    if (total > g.total) {
      g.total = total;
      g.reported = Math.min(reported, total);
      g.recalled = total - g.reported;
    }
    g.reportedOrgs = uniq([...g.reportedOrgs, ev.organization ?? ""]);
    g.recalledOrgs = uniq([
      ...g.recalledOrgs,
      ...(r.resolution?.recalled ?? []).filter((f) => (f.value_usd ?? 0) > 0).map((f) => f.organization ?? ""),
    ]).filter((o) => !g.reportedOrgs.includes(o));
    groups.set(key, g);
  }
  const stake = [...groups.values()].sort((a, b) => b.total - a.total);

  const capMap = new Map<string, Capture>();
  for (const r of events) {
    const c = capMap.get(r.observation.id) ?? {
      id: r.observation.id,
      t: Date.parse(r.observation.createdAt) || 0,
      count: 0,
      person: personOf(r),
      ceo: false,
    };
    c.count += 1;
    c.ceo = c.ceo || routeOf(r) === "ceo";
    capMap.set(r.observation.id, c);
  }
  const captures = [...capMap.values()].sort((a, b) => a.t - b.t);

  const kindCount: Record<KnowledgeKind, number> = { observed: 0, recalled: 0, derived: 0, proposed: 0 };
  for (const r of events) for (const d of r.diff) kindCount[d.kind] = (kindCount[d.kind] ?? 0) + 1;
  const typeCount = new Map<string, number>();
  for (const r of events) if (r.event) typeCount.set(r.event.type, (typeCount.get(r.event.type) ?? 0) + 1);

  return {
    events,
    signals: events.length,
    captures,
    people: uniq(events.map(personOf)).length,
    stake,
    stakeTotal: stake.reduce((s, g) => s + g.total, 0),
    ceo: events.filter((r) => routeOf(r) === "ceo").length,
    manager: events.filter((r) => routeOf(r) === "manager").length,
    ceoAwaiting: events.filter((r) => routeOf(r) === "ceo" && r.stage === "DIFF_READY").length,
    written: events.filter((r) => r.stage === "ACCEPTED" || !!r.write?.ref).length,
    blocked: events.reduce((s, r) => s + (r.rejected?.length ?? 0), 0),
    kinds: (["observed", "recalled", "derived", "proposed"] as const).map((kind) => ({ kind, n: kindCount[kind] })),
    types: [...typeCount.entries()].map(([type, n]) => ({ type, n })).sort((a, b) => b.n - a.n),
  };
}
