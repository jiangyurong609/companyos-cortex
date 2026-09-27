import type { MemoryHit } from "../schemas";
import { SEED_NOTES } from "./seed";
import type { CompanyMemory, MemoryWrite } from "./types";

/**
 * Local stand-in for GBrain used only when no GBrain credentials are configured.
 * Always surfaced in the UI as "fixture" — never presented as GBrain.
 */
const g = globalThis as unknown as { __cortexFixtureNotes?: Map<string, { title: string; body: string }> };
const notes = (g.__cortexFixtureNotes ??= new Map(SEED_NOTES.map((n) => [n.path, { title: n.title, body: n.body }])));

const STOP = new Set(["the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "is", "what", "do", "we", "know", "about"]);
const tokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9$]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));

export class FixtureMemory implements CompanyMemory {
  readonly mode = "fixture" as const;
  readonly label = "Local fixture memory (GBrain not configured)";

  async search(query: string): Promise<MemoryHit[]> {
    const q = tokens(query).map((t) => (t === "sso" ? "sso" : t));
    const scored = [...notes.entries()].map(([path, n]) => {
      const hay = tokens(`${path} ${n.title} ${n.body}`);
      const score = q.filter((t) => hay.includes(t) || (t === "saml" && hay.includes("sso"))).length;
      return { id: path, title: n.title, snippet: n.body, source: `fixture:${path}`, score };
    });
    return scored.filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  }

  async recall(query: string, entity?: string): Promise<MemoryHit[]> {
    return this.search(`${entity ?? ""} ${query}`);
  }

  async remember(input: MemoryWrite): Promise<{ ref: string }> {
    const path = `events/${input.key}.md`;
    notes.set(path, { title: input.title, body: input.body });
    return { ref: path };
  }
}
