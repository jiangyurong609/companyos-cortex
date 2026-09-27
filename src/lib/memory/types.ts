import type { MemoryHit } from "../schemas";

export interface MemoryWrite {
  /** Stable key derived from the event id — makes writes idempotent. */
  key: string;
  title: string;
  body: string;
}

export interface CompanyMemory {
  readonly mode: "live" | "fixture";
  readonly label: string;
  search(query: string): Promise<MemoryHit[]>;
  recall(query: string, entity?: string): Promise<MemoryHit[]>;
  remember(input: MemoryWrite): Promise<{ ref: string; raw?: unknown }>;
}
