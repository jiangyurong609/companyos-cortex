import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { capability } from "../clusters";
import type { EventRecord } from "../schemas";

/**
 * The decision ledger: what the system predicted, what a human decided, and what happened.
 * Human overrides are the labels; outcomes are the reward. Append-only JSONL, last write per event wins.
 */
export type Route = "ceo" | "manager";

export interface Features {
  type: string;
  organization: string | null;
  capability: string | null;
  stakesUsd: number;
  relatedCount: number;
  team: string;
  source: string;
  hasDeadline: boolean;
}

export interface LedgerEntry {
  eventId: string;
  at: string;
  summary: string;
  features: Features;
  predicted: { route: Route; by: string };
  label?: { route: Route; by: "ceo" | "manager"; action: string; at: string };
  outcome?: { result: "worked" | "didnt"; note?: string; source: string; at: string };
  synthetic?: boolean;
}

const FILE = path.join(process.cwd(), "data", "ledger.jsonl");
const g = globalThis as unknown as { __cortexLedger?: Map<string, LedgerEntry> };

export function ledger(): Map<string, LedgerEntry> {
  if (g.__cortexLedger) return g.__cortexLedger;
  const m = new Map<string, LedgerEntry>();
  if (existsSync(FILE))
    for (const line of readFileSync(FILE, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line) as LedgerEntry;
        m.set(e.eventId, e);
      } catch {
        /* skip a torn line */
      }
    }
  g.__cortexLedger = m;
  return m;
}

function persist(e: LedgerEntry) {
  ledger().set(e.eventId, e);
  mkdirSync(path.dirname(FILE), { recursive: true });
  appendFileSync(FILE, JSON.stringify(e) + "\n");
}

export function featuresOf(r: EventRecord): Features {
  const ev = r.event!;
  return {
    type: ev.type,
    organization: ev.organization,
    capability: capability(r),
    stakesUsd: r.derivedTotalUsd ?? ev.opportunity_value_usd ?? 0,
    relatedCount: r.diff.filter((d) => d.id.startsWith("recalled-")).length,
    team: r.reporter?.team ?? "",
    source: r.observation.source ?? "phone",
    hasDeadline: Boolean(ev.deadline_text),
  };
}

export function recordPrediction(r: EventRecord) {
  if (!r.event || !r.triage) return;
  persist({
    eventId: r.id,
    at: new Date().toISOString(),
    summary: r.event.summary,
    features: featuresOf(r),
    predicted: { route: r.triage.route, by: r.triage.by },
  });
}

export function recordLabel(eventId: string, route: Route, by: "ceo" | "manager", action: string) {
  const e = ledger().get(eventId);
  if (!e) return;
  persist({ ...e, label: { route, by, action, at: new Date().toISOString() } });
}

export function recordOutcome(eventId: string, result: "worked" | "didnt", source: string, note?: string) {
  const e = ledger().get(eventId);
  if (!e) return null;
  const next = { ...e, outcome: { result, note, source, at: new Date().toISOString() } };
  persist(next);
  return next;
}

/**
 * Seed a clearly-marked synthetic history ("the last six weeks at Northstar") so the learner has
 * enough labels to work with in a demo. Real decisions from the live app are added on top.
 * Pattern baked in: managers keep escalating competitor signals that River routed to them.
 */
export function seedSyntheticHistory() {
  if ([...ledger().values()].some((e) => e.synthetic)) return 0;
  const orgs = ["Acme", "Ramp", "Globex", "Initech", "Hooli", "Umbrella", "Soylent", "Vandelay", "Wonka", "Stark"];
  const teams = ["Sales", "Customer Success", "Product", "Marketing", "Finance"];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const rows: LedgerEntry[] = [];
  for (let i = 0; i < 90; i++) {
    const kind = rnd();
    const org = pick(orgs);
    let type: string, cap: string | null, stakes: number, related: number, predicted: Route, label: Route, summary: string;
    if (kind < 0.25) {
      // competitor signals: River tends to send to managers; humans escalate most of them
      type = "competitor.signal"; cap = pick(["SAML", "Audit logs", null]); stakes = 0; related = 0;
      predicted = rnd() < 0.8 ? "manager" : "ceo"; label = rnd() < 0.85 ? "ceo" : "manager";
      summary = `Competitor pitched ${org}${cap ? ` with ${cap}` : ""}`;
    } else if (kind < 0.5) {
      // cross-customer blockers with real money: policy already sends to CEO
      type = "customer.blocker"; cap = pick(["SAML", "Audit logs", "SCIM"]); stakes = 100_000 + Math.round(rnd() * 300) * 1000; related = 1 + Math.floor(rnd() * 3);
      predicted = "ceo"; label = rnd() < 0.92 ? "ceo" : "manager";
      summary = `${org} blocked by ${cap}`;
    } else if (kind < 0.8) {
      // operational bugs / small requests: managers handle
      type = pick(["product.bug", "customer.request"]); cap = pick(["Rate limits", null]); stakes = rnd() < 0.7 ? 0 : Math.round(rnd() * 40) * 1000; related = 0;
      predicted = rnd() < 0.85 ? "manager" : "ceo"; label = rnd() < 0.9 ? "manager" : "ceo";
      summary = type === "product.bug" ? `${org} hit an operational issue` : `${org} asked for a small change`;
    } else {
      // single-account requests with mid stakes: mixed
      type = "customer.request"; cap = pick(["SSO", "Audit logs", null]); stakes = 40_000 + Math.round(rnd() * 60) * 1000; related = 0;
      predicted = rnd() < 0.5 ? "ceo" : "manager"; label = stakes >= 80_000 ? "ceo" : "manager";
      summary = `${org} requested ${cap ?? "a feature"}`;
    }
    const at = new Date(Date.now() - (42 - (i * 42) / 90) * 86_400_000).toISOString();
    rows.push({
      eventId: `hist_${i}`,
      at,
      summary,
      features: { type, organization: org, capability: cap, stakesUsd: stakes, relatedCount: related, team: pick(teams), source: pick(["call", "slack", "ticket", "email", "github"]), hasDeadline: rnd() < 0.3 },
      predicted: { route: predicted, by: "river" },
      label: { route: label, by: label === "ceo" ? "ceo" : "manager", action: label === predicted ? "confirmed" : "override", at },
      outcome: rnd() < 0.6 ? { result: rnd() < 0.7 ? "worked" : "didnt", source: "synthetic", at } : undefined,
      synthetic: true,
    });
  }
  for (const r of rows) persist(r);
  return rows.length;
}
