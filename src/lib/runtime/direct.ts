import { moneyMentions } from "../compiler";
import type { CompanyMemory, MemoryWrite } from "../memory/types";
import type { GroundedResolution, MemoryHit, RealityEvent, RecalledFact } from "../schemas";
import type { TurnRuntime } from "./types";

const REQ = /\b(SAML|SSO|SCIM|SOC ?2|HIPAA|OAuth)\b/i;

/** Deterministic hit -> fact extraction, so the direct path never needs an LLM to ground. */
export function hitToFact(h: MemoryHit): RecalledFact {
  const fromPath = h.id.match(/^sales\/([^/.]+)(?:\.md)?$/)?.[1];
  const organization = fromPath ? fromPath[0].toUpperCase() + fromPath.slice(1) : null;
  const req = h.snippet.match(REQ)?.[1] ?? null;
  // Prefer SAML when a note names both "SSO" and "SAML".
  const requirement = /\bSAML\b/i.test(h.snippet) ? "SAML" : req;
  return {
    statement: h.snippet.split(/(?<=\.)\s/)[0] ?? h.snippet,
    organization,
    requirement,
    value_usd: moneyMentions(h.snippet)[0] ?? null,
    source_ref: h.id,
    quote: h.snippet,
  };
}

export async function searchAll(memory: CompanyMemory, queries: string[]): Promise<MemoryHit[]> {
  const results = await Promise.all(queries.map((q) => memory.search(q)));
  const byId = new Map<string, MemoryHit>();
  for (const h of results.flat()) if (!byId.has(h.id) && !/(^|\/)events\//.test(h.id)) byId.set(h.id, h);
  return [...byId.values()];
}

export class DirectRuntime implements TurnRuntime {
  readonly via = "direct" as const;
  constructor(private memory: CompanyMemory, readonly label = "Direct (QM not configured)") {}

  async ground(event: RealityEvent) {
    const hits = await searchAll(this.memory, event.suggested_memory_queries);
    const recalled = hits.map(hitToFact);
    const resolution: GroundedResolution = {
      recalled,
      contradictions: [],
      missing: event.unresolved,
      proposals: [],
      source_refs: hits.map((h) => h.id),
    };
    return {
      hits,
      resolution,
      log: event.suggested_memory_queries.map((q) => `${this.memory.mode === "live" ? "gbrain" : "fixture"} search: "${q}"`),
    };
  }

  async write(input: MemoryWrite) {
    const r = await this.memory.remember(input);
    return { ...r, log: [`${this.memory.mode === "live" ? "gbrain" : "fixture"} remember → ${r.ref}`] };
  }

  async recall(query: string, entity?: string) {
    const hits = await this.memory.recall(query, entity);
    return { hits, log: [`recall${entity ? ` entity=${entity}` : ""}: "${query}"`] };
  }
}
