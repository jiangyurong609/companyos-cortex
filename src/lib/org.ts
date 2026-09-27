import type { Reporter } from "./schemas";
import { getMemory } from "./wiring";

/** Who said it: role, team and manager come from the org chart pages in GBrain (people/<name>). */
export async function resolveReporter(actor: string | undefined): Promise<Reporter | null> {
  if (!actor) return null;
  const ref = `people/${actor.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const page = await getMemory().getPage(ref).catch(() => null);
  if (!page) return null;
  const field = (k: string) => page.match(new RegExp(`${k}:\\s*(.+)`))?.[1]?.trim() ?? "";
  return { name: actor.trim(), role: field("Role"), team: field("Team"), reportsTo: field("Reports to"), ref };
}

export { teamSlug } from "./slug";
