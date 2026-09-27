import type { MemoryHit } from "../schemas";

export interface MemoryWrite {
  /** Stable key derived from the event id — makes writes idempotent. */
  key: string;
  /** Page slug to write; defaults to cortex/events/<key>. */
  slug?: string;
  title: string;
  body: string;
}

export interface CompanyMemory {
  readonly mode: "live" | "fixture";
  readonly label: string;
  search(query: string): Promise<MemoryHit[]>;
  recall(query: string, entity?: string): Promise<MemoryHit[]>;
  /** Full text of one note, or null if it does not exist. Used to verify provenance. */
  getPage(ref: string): Promise<string | null>;
  remember(input: MemoryWrite): Promise<{ ref: string; raw?: unknown }>;
}
