import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { MemoryHit } from "../schemas";
import type { CompanyMemory, MemoryWrite } from "./types";

/**
 * GBrain over MCP (streamable HTTP, bearer token from the workspace's "Access token" client).
 * Uses GBrain's page tools: search (hybrid), put_page (slug-addressed notes), remember (facts).
 */
export const GBRAIN_URL = process.env.GBRAIN_MCP_URL ?? "https://gbrain.io/mcp";

type Tool = { name: string; description?: string; inputSchema: { properties?: Record<string, unknown>; required?: string[] } };

const g = globalThis as unknown as { __gbrain?: Promise<{ client: Client; tools: Tool[] }> };

async function connect(): Promise<{ client: Client; tools: Tool[] }> {
  const token = process.env.GBRAIN_TOKEN;
  if (!token) throw new Error("GBRAIN_TOKEN not set");
  const client = new Client({ name: "companyos-cortex", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(GBRAIN_URL), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  const { tools } = await client.listTools();
  return { client, tools: tools as Tool[] };
}

export function gbrainSession() {
  g.__gbrain ??= connect().catch((err) => {
    g.__gbrain = undefined; // allow reconnect on next call
    throw err;
  });
  return g.__gbrain;
}

export async function listGbrainTools(): Promise<Tool[]> {
  return (await gbrainSession()).tools;
}

function textOf(result: unknown): string {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  return content.filter((c) => c.type === "text" && c.text).map((c) => c.text).join("\n");
}

/** Drop YAML frontmatter and markdown heading lines so snippets read as prose. */
export function cleanChunk(chunk: string): string {
  return chunk
    .replace(/^---[\s\S]*?---\s*/, "")
    .split("\n")
    .filter((l) => !/^#{1,6}\s/.test(l))
    .join("\n")
    .trim();
}

/**
 * Normalize GBrain results into MemoryHits keyed by page slug (the provenance ref).
 * `search` returns an array of {slug,title,chunk_text}; `recall` returns {facts[], results[{slug,chunk}]}.
 */
export function toHits(result: unknown): MemoryHit[] {
  const text = textOf(result);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return text.trim() ? [{ id: "gbrain:text-result", title: "GBrain result", snippet: text.trim(), source: "gbrain" }] : [];
  }
  const obj = data as Record<string, unknown>;
  const pages = (Array.isArray(data) ? data : (obj.results as unknown[] | undefined)) ?? [];
  const hits: MemoryHit[] = [];
  const seen = new Set<string>();
  for (const raw of pages) {
    const r = raw as Record<string, unknown>;
    const id = String(r.slug ?? r.id ?? "");
    if (!id || seen.has(id)) continue; // one hit per page (search returns one row per chunk)
    seen.add(id);
    hits.push({
      id,
      title: String(r.title ?? id),
      snippet: cleanChunk(String(r.chunk_text ?? r.chunk ?? r.text ?? "")),
      source: `gbrain:${id}`,
      score: typeof r.score === "number" ? r.score : undefined,
    });
  }
  for (const raw of (obj.facts as unknown[] | undefined) ?? []) {
    const f = raw as Record<string, unknown>;
    const id = `fact:${String(f.fact_id ?? f.id ?? hits.length)}`;
    hits.push({ id, title: String(f.entity ?? "fact"), snippet: String(f.fact ?? f.text ?? ""), source: String(f.provenance ?? "gbrain fact") });
  }
  return hits;
}

async function call(name: string, args: Record<string, unknown>): Promise<unknown> {
  const { client } = await gbrainSession();
  const result = await client.callTool({ name, arguments: args });
  if ((result as { isError?: boolean }).isError) throw new Error(`GBrain ${name} error: ${textOf(result).slice(0, 300)}`);
  return result;
}

export const eventSlug = (key: string) => `cortex/events/${key.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;

export function pageContent(title: string, body: string, tags: string[]): string {
  return `---\ntitle: ${JSON.stringify(title)}\ntype: note\ntags: [${tags.join(", ")}]\n---\n\n${body.startsWith("# ") ? body : `# ${title}\n\n${body}`}\n`;
}

/** Idempotent page write: put_page replaces the page at this slug. */
export async function putPage(slug: string, title: string, body: string, tags: string[]): Promise<string> {
  await call("put_page", { slug, content: pageContent(title, body, tags) });
  return slug;
}

export class GBrainMemory implements CompanyMemory {
  readonly mode = "live" as const;
  readonly label = `GBrain MCP (${GBRAIN_URL})`;

  async search(query: string): Promise<MemoryHit[]> {
    return toHits(await call("search", { query, limit: 8 }));
  }

  /** GBrain recall: entity facts (instant, carry provenance) + page search results. */
  async recall(query: string, entity?: string): Promise<MemoryHit[]> {
    return toHits(await call("recall", { query, ...(entity ? { entity } : {}), limit: 8 }));
  }

  async getPage(ref: string): Promise<string | null> {
    try {
      const text = textOf(await call("get_page", { slug: ref }));
      const page = JSON.parse(text) as { title?: string; compiled_truth?: string };
      return `${page.title ?? ""}\n${page.compiled_truth ?? ""}`;
    } catch {
      return null;
    }
  }

  /** Canonical note as a page (slug = provenance, idempotent) + one attributed fact for recall. */
  async remember(input: MemoryWrite): Promise<{ ref: string; raw?: unknown }> {
    const slug = eventSlug(input.key);
    await putPage(slug, input.title, input.body, ["companyos-cortex", "reality-event"]);
    const entity = input.title.split(" — ")[0];
    const fact = input.body.split("\n").find((l) => l.trim() && !l.startsWith("#")) ?? input.title;
    await call("remember", { fact, entity, provenance: `CompanyOS Cortex Reality Event ${input.key} (page ${slug})`, kind: "event" });
    return { ref: slug, raw: { page: slug, fact_entity: entity } };
  }
}
