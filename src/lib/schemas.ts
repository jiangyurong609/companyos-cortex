import { z } from "zod";

/** The four knowledge categories. Never collapse them. */
export const KnowledgeKind = z.enum(["observed", "recalled", "derived", "proposed"]);
export type KnowledgeKind = z.infer<typeof KnowledgeKind>;

export const ObservationInput = z.object({
  modality: z.enum(["text", "voice", "image"]).default("text"),
  text: z.string().trim().min(3).max(4000),
  actor: z.string().trim().max(80).optional(),
});
export type ObservationInput = z.infer<typeof ObservationInput>;

export interface RawObservation extends ObservationInput {
  id: string;
  createdAt: string;
}

export const RealityEventType = z.enum([
  "customer.blocker",
  "customer.request",
  "product.bug",
  "decision.changed",
  "competitor.signal",
  "operational.risk",
]);

export const Claim = z.object({
  subject: z.string(),
  predicate: z.string(),
  object: z.union([z.string(), z.number(), z.boolean()]),
  confidence: z.number().min(0).max(1),
});

/** What the LLM (or deterministic fallback) must return. No invented values. */
export const CompiledEvent = z.object({
  type: RealityEventType,
  summary: z.string(),
  organization: z.string().nullable().describe("Customer / org named in the text, or null"),
  requirement: z.string().nullable().describe("Capability requested or blocking, e.g. SAML, or null"),
  opportunity_value_usd: z.number().nullable().describe("Deal value in whole USD if stated, e.g. 120000, else null"),
  owner: z.string().nullable().describe("Internal person named as owner/source, or null"),
  deadline_text: z.string().nullable().describe("Deadline exactly as spoken, e.g. 'Friday'. Never convert to a date."),
  urgency: z.enum(["low", "medium", "high"]),
  entities: z.array(z.string()),
  claims: z.array(Claim),
  unresolved: z.array(z.string()),
  suggested_memory_queries: z.array(z.string()).min(2).max(4),
});
export type CompiledEvent = z.infer<typeof CompiledEvent>;

export interface RealityEvent extends CompiledEvent {
  id: string;
  observationId: string;
  compiler: "llm" | "river" | "deterministic";
  confidence: number;
}

export interface MemoryHit {
  id: string; // GBrain note path / id — the provenance ref
  title: string;
  snippet: string;
  source?: string;
  score?: number;
}

/** One fact recalled from memory, with its provenance. */
export const RecalledFact = z.object({
  statement: z.string(),
  organization: z.string().nullable(),
  requirement: z.string().nullable(),
  value_usd: z.number().nullable(),
  source_ref: z.string().describe("GBrain note id/path this fact came from"),
  quote: z.string().describe("Verbatim text from the source that supports the fact"),
});
export type RecalledFact = z.infer<typeof RecalledFact>;

/** Contract of the QM grounding turn (docs/15_QM_INTEGRATION.md). */
export const GroundedResolution = z.object({
  recalled: z.array(RecalledFact),
  contradictions: z.array(z.string()),
  missing: z.array(z.string()),
  proposals: z.array(z.string()),
  source_refs: z.array(z.string()),
});
export type GroundedResolution = z.infer<typeof GroundedResolution>;

export interface DiffRow {
  id: string;
  kind: KnowledgeKind;
  op: "add" | "update" | "conflict" | "action";
  domain: "sales" | "product" | "engineering" | "company";
  title: string;
  detail?: string;
  evidenceRefs: string[];
  evidence: { ref: string; quote: string }[];
  /** Only observed facts are writable as canonical memory. Proposals never are. */
  acceptable: boolean;
}

export type IntegrationMode = "live" | "fixture" | "unavailable";

export interface IntegrationStatus {
  gbrain: { mode: IntegrationMode; detail: string };
  qm: { mode: IntegrationMode; detail: string };
  compiler: { mode: "llm" | "river" | "deterministic"; detail: string };
}

export type EventStage =
  | "CAPTURED"
  | "COMPILED"
  | "RESOLVING_MEMORY"
  | "DIFF_READY"
  | "WRITING"
  | "ACCEPTED"
  | "REJECTED"
  | "FAILED";

export interface TraceStep {
  at: string;
  stage: string;
  message: string;
  via?: "qm" | "gbrain" | "compiler" | "companyos";
}

export interface WriteResult {
  ref: string;
  via: "qm" | "direct";
  deduplicated: boolean;
  raw?: unknown;
}

export interface EventRecord {
  id: string;
  observation: RawObservation;
  stage: EventStage;
  event?: RealityEvent;
  hits: MemoryHit[];
  resolution?: GroundedResolution;
  resolvedVia?: "qm" | "direct";
  diff: DiffRow[];
  /** Recalled facts dropped because their cited page or quote could not be verified in GBrain. */
  rejected?: { ref: string; statement: string; reason: string }[];
  derivedTotalUsd?: number;
  memoryNote?: string;
  write?: WriteResult;
  /** A CEO decision merged from a proposal — written to memory as a decision, never as a fact. */
  decision?: { text: string; ref: string; via: "qm" | "direct"; at: string };
  proof?: { query: string; hits: MemoryHit[]; found: boolean; via: "qm" | "direct" };
  trace: TraceStep[];
  error?: { stage: string; message: string; retryable: boolean };
  updatedAt: string;
}
