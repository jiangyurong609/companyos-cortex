import type { GroundedResolution, MemoryHit, RealityEvent } from "../schemas";
import type { MemoryWrite } from "../memory/types";

/**
 * The execution harness for a turn. In the intended path this is QM (scope `cortex-demo`),
 * whose agent calls GBrain over MCP. The direct runtime is the honest fallback when QM is
 * unreachable: CompanyOS queries memory itself and the UI says so.
 */
export interface TurnRuntime {
  readonly via: "qm" | "direct";
  readonly label: string;
  ground(event: RealityEvent): Promise<{ hits: MemoryHit[]; resolution: GroundedResolution; log: string[] }>;
  write(input: MemoryWrite): Promise<{ ref: string; raw?: unknown; log: string[] }>;
  /** Fresh recall used as persistence proof: entity-scoped facts + page search. */
  recall(query: string, entity?: string): Promise<{ hits: MemoryHit[]; log: string[] }>;
}
