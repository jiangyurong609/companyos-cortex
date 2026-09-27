import type { GroundedResolution, MemoryHit, RealityEvent } from "../schemas";
import type { MemoryWrite } from "../memory/types";

/**
 * The execution harness for a turn. In the intended path this is QM (scope `cortex-demo`),
 * whose agent calls GBrain over MCP. The direct runtime is the honest fallback when QM is
 * unreachable: CompanyOS queries memory itself and the UI says so.
 */
export interface PlanInput {
  decision: string;
  slug: string;
  eventId: string;
  summary: string;
  evidence: string[];
  decisionRef: string;
}

export interface TurnRuntime {
  readonly via: "qm" | "direct";
  readonly label: string;
  ground(event: RealityEvent): Promise<{ hits: MemoryHit[]; resolution: GroundedResolution; log: string[] }>;
  write(input: MemoryWrite): Promise<{ ref: string; raw?: unknown; log: string[] }>;
  /** After a CEO decision: draft an owned action plan as a GBrain page (the company reacts). */
  plan(input: PlanInput): Promise<{ ref: string; owner: string; steps: string[]; log: string[] }>;
  /** Fresh recall used as persistence proof: entity-scoped facts + page search. */
  recall(query: string, entity?: string): Promise<{ hits: MemoryHit[]; log: string[] }>;
}
