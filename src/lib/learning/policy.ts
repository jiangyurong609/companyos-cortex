import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fmtUsd } from "../diff";
import { getMemory } from "../wiring";
import { type Features, type LedgerEntry, ledger, type Route } from "./ledger";

/**
 * The company's routing policy: explicit, versioned rules applied before River's judgment.
 * The learner proposes rule changes from the decision ledger; a human merges them (company RSI, gated).
 */
export interface Rule {
  id: string;
  when: { types?: string[]; minStakes?: number; minRelated?: number };
  route: Route;
  why: string;
}

export interface PolicyVersion {
  version: number;
  rules: Rule[];
  mergedAt: string;
  mergedBy: string;
  evidence?: string;
  ref?: string;
}

const FILE = path.join(process.cwd(), "data", "policy.json");
const V1: PolicyVersion = {
  version: 1,
  rules: [{ id: "cross-customer", when: { minRelated: 1, minStakes: 100_000 }, route: "ceo", why: "A pattern across customers with ≥$100K at stake reaches the CEO." }],
  mergedAt: "2026-09-27T14:40:00.000Z",
  mergedBy: "initial policy",
};

type Store = { current: PolicyVersion; history: PolicyVersion[] };
const g = globalThis as unknown as { __cortexPolicy?: Store };

export function policyStore(): Store {
  if (g.__cortexPolicy) return g.__cortexPolicy;
  g.__cortexPolicy = existsSync(FILE) ? (JSON.parse(readFileSync(FILE, "utf8")) as Store) : { current: V1, history: [V1] };
  return g.__cortexPolicy;
}

function save(s: Store) {
  g.__cortexPolicy = s;
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(s, null, 1));
}

export function matches(rule: Rule, f: Features): boolean {
  const w = rule.when;
  if (w.types && !w.types.includes(f.type)) return false;
  if (w.minStakes !== undefined && f.stakesUsd < w.minStakes) return false;
  if (w.minRelated !== undefined && f.relatedCount < w.minRelated) return false;
  return true;
}

export function applyPolicy(rules: Rule[], f: Features): Rule | null {
  return rules.find((r) => matches(r, f)) ?? null;
}

/** What the system would route under `rules`: a matching rule wins, else River's recorded call. */
const decide = (rules: Rule[], e: LedgerEntry): Route => applyPolicy(rules, e.features)?.route ?? e.predicted.route;

const labeled = () => [...ledger().values()].filter((e) => e.label);
const isTest = (e: LedgerEntry) => parseInt(createHash("sha1").update(e.eventId).digest("hex").slice(0, 6), 16) % 10 < 3;

export function accuracy(rules: Rule[], es: LedgerEntry[]) {
  if (!es.length) return 0;
  return es.filter((e) => decide(rules, e) === e.label!.route).length / es.length;
}

function describe(rule: Omit<Rule, "id" | "why">): string {
  const parts = [
    rule.when.types && `${rule.when.types.map((t) => t.replace(/\.signal$/, "").replace(/\./g, " ")).join(" / ")} signals`,
    rule.when.minStakes !== undefined && `≥${fmtUsd(rule.when.minStakes)} at stake`,
    rule.when.minRelated !== undefined && `${rule.when.minRelated}+ related customers`,
  ].filter(Boolean);
  return `Route ${parts.join(" with ")} to the ${rule.route === "ceo" ? "CEO" : "reporter's manager"}`;
}

export interface Proposal {
  id: string;
  rule: Rule;
  description: string;
  train: { before: number; after: number; n: number };
  test: { before: number; after: number; n: number };
  fixes: { eventId: string; summary: string; from: Route; to: Route; synthetic: boolean }[];
  breaks: number;
}

/** Greedy search over simple rule candidates; propose only if it also improves held-out decisions. */
export function propose(): Proposal | null {
  const rules = policyStore().current.rules;
  const es = labeled();
  const train = es.filter((e) => !isTest(e));
  const test = es.filter(isTest);
  if (train.length < 10 || test.length < 5) return null;
  const types = [...new Set(es.map((e) => e.features.type))];
  const candidates: Omit<Rule, "id" | "why">[] = [
    ...types.flatMap((t) => (["ceo", "manager"] as Route[]).map((route) => ({ when: { types: [t] }, route }))),
    ...[50_000, 75_000, 100_000, 150_000].map((s) => ({ when: { minStakes: s }, route: "ceo" as Route })),
    ...[1, 2].map((k) => ({ when: { minRelated: k }, route: "ceo" as Route })),
  ];
  const base = accuracy(rules, train);
  let best: { cand: Omit<Rule, "id" | "why">; gain: number } | null = null;
  for (const cand of candidates) {
    const next = [...rules, { ...cand, id: "cand", why: "" }];
    const gain = accuracy(next, train) - base;
    if (gain > 0.001 && (!best || gain > best.gain)) best = { cand, gain };
  }
  if (!best) return null;
  const description = describe(best.cand);
  const rule: Rule = { ...best.cand, id: createHash("sha1").update(JSON.stringify(best.cand)).digest("hex").slice(0, 8), why: `${description} (learned from human overrides).` };
  const next = [...rules, rule];
  const testBefore = accuracy(rules, test);
  const testAfter = accuracy(next, test);
  if (testAfter - testBefore < 0.02) return null; // must generalize to decisions it didn't learn from
  const changed = es.filter((e) => decide(rules, e) !== decide(next, e));
  const fixes = changed
    .filter((e) => decide(next, e) === e.label!.route)
    .sort((a, b) => Number(a.synthetic ?? false) - Number(b.synthetic ?? false))
    .slice(0, 6)
    .map((e) => ({ eventId: e.eventId, summary: e.summary, from: decide(rules, e), to: decide(next, e), synthetic: Boolean(e.synthetic) }));
  return {
    id: rule.id,
    rule,
    description,
    train: { before: base, after: accuracy(next, train), n: train.length },
    test: { before: testBefore, after: testAfter, n: test.length },
    fixes,
    breaks: changed.filter((e) => decide(next, e) !== e.label!.route).length,
  };
}

async function publish(v: PolicyVersion): Promise<string | undefined> {
  const body = [
    `# Routing policy v${v.version}`,
    "",
    `Merged ${v.mergedAt} by ${v.mergedBy}.${v.evidence ? ` Evidence: ${v.evidence}` : ""}`,
    "",
    ...v.rules.map((r, i) => `${i + 1}. ${r.why}`),
    "",
    "Anything no rule covers is routed by River, using past decisions as examples.",
  ].join("\n");
  try {
    const r = await getMemory().remember({ key: `policy-routing-v${v.version}`, slug: "policies/routing", title: `Routing policy v${v.version}`, body });
    return r.ref;
  } catch {
    return undefined;
  }
}

export async function merge(proposalId: string, by: string): Promise<PolicyVersion> {
  const p = propose();
  if (!p || p.id !== proposalId) throw new Error("proposal is stale — reload");
  const s = policyStore();
  const v: PolicyVersion = {
    version: s.current.version + 1,
    rules: [...s.current.rules, p.rule],
    mergedAt: new Date().toISOString(),
    mergedBy: by,
    evidence: `held-out agreement with human decisions ${Math.round(p.test.before * 100)}% → ${Math.round(p.test.after * 100)}% (n=${p.test.n})`,
  };
  v.ref = await publish(v);
  save({ current: v, history: [...s.history, v] });
  return v;
}

export async function rollback(by: string): Promise<PolicyVersion> {
  const s = policyStore();
  if (s.history.length < 2) throw new Error("nothing to roll back");
  const prev = s.history[s.history.length - 2];
  const v: PolicyVersion = { ...prev, version: s.current.version + 1, mergedAt: new Date().toISOString(), mergedBy: `${by} (rollback to v${prev.version})` };
  v.ref = await publish(v);
  save({ current: v, history: [...s.history, v] });
  return v;
}
