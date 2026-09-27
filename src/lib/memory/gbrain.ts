import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { MemoryHit } from "../schemas";
import type { CompanyMemory, MemoryWrite } from "./types";

/**
 * GBrain over MCP (streamable HTTP, static bearer token from a GBrain client page).
 * Tool argument names are discovered from tools/list at connect time rather than hardcoded,
 * because GBrain's schemas are only visible to an authenticated client.
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

function pickTool(tools: Tool[], names: string[]): Tool {
  for (const n of names) {
    const t = tools.find((t) => t.name === n) ?? tools.find((t) => t.name.toLowerCase().endsWith(n));
    if (t) return t;
  }
  throw new Error(`GBrain exposes no ${names.join("/")} tool (has: ${tools.map((t) => t.name).join(", ")})`);
}

/** Map our semantic arguments onto whatever property names the tool actually declares. */
function buildArgs(tool: Tool, values: Record<string, string>, aliases: Record<string, string[]>): Record<string, unknown> {
  const props = Object.keys(tool.inputSchema.properties ?? {});
  const args: Record<string, unknown> = {};
  for (const [semantic, candidates] of Object.entries(aliases)) {
    const hit = candidates.find((c) => props.includes(c));
    if (hit && values[semantic] !== undefined) args[hit] = values[semantic];
  }
  // A single-string-arg tool whose name we didn't anticipate: use the primary value.
  if (Object.keys(args).length === 0 && props.length >= 1) args[tool.inputSchema.required?.[0] ?? props[0]] = Object.values(values)[0];
  return args;
}

function textOf(result: unknown): string {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  return content.filter((c) => c.type === "text" && c.text).map((c) => c.text).join("\n");
}

/** Normalize GBrain's result (structured JSON or text) into MemoryHits that keep provenance. */
export function toHits(result: unknown): MemoryHit[] {
  const structured = (result as { structuredContent?: unknown }).structuredContent;
  const text = textOf(result);
  let data: unknown = structured;
  if (!data) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }
  const list = Array.isArray(data)
    ? data
    : ((data as Record<string, unknown> | undefined)?.results ??
      (data as Record<string, unknown> | undefined)?.notes ??
      (data as Record<string, unknown> | undefined)?.memories ??
      (data as Record<string, unknown> | undefined)?.items);
  if (Array.isArray(list)) {
    return list.map((raw, i) => {
      const r = raw as Record<string, unknown>;
      const id = String(r.path ?? r.id ?? r.ref ?? r.url ?? r.name ?? `gbrain-hit-${i}`);
      return {
        id,
        title: String(r.title ?? r.name ?? id),
        snippet: String(r.text ?? r.snippet ?? r.content ?? r.body ?? r.summary ?? ""),
        source: typeof r.url === "string" ? r.url : `gbrain:${id}`,
        score: typeof r.score === "number" ? r.score : undefined,
      };
    });
  }
  // Plain-text result: keep it whole as one hit so nothing is dropped or invented.
  return text.trim() ? [{ id: "gbrain:text-result", title: "GBrain result", snippet: text.trim(), source: "gbrain" }] : [];
}

export class GBrainMemory implements CompanyMemory {
  readonly mode = "live" as const;
  readonly label = `GBrain MCP (${GBRAIN_URL})`;

  async search(query: string): Promise<MemoryHit[]> {
    const { client, tools } = await gbrainSession();
    const tool = pickTool(tools, (process.env.GBRAIN_SEARCH_TOOL ?? "recall,search").split(","));
    const result = await client.callTool({ name: tool.name, arguments: buildArgs(tool, { query }, { query: ["query", "q", "question", "text", "search"] }) });
    if ((result as { isError?: boolean }).isError) throw new Error(`GBrain ${tool.name} error: ${textOf(result)}`);
    return toHits(result);
  }

  async remember(input: MemoryWrite): Promise<{ ref: string; raw?: unknown }> {
    const { client, tools } = await gbrainSession();
    const tool = pickTool(tools, [process.env.GBRAIN_REMEMBER_TOOL ?? "remember"]);
    const args = buildArgs(
      tool,
      { content: input.body, title: input.title, key: input.key },
      { content: ["content", "text", "note", "body", "memory", "markdown"], title: ["title", "name", "subject"], key: ["key", "id", "idempotencyKey", "slug"] },
    );
    const result = await client.callTool({ name: tool.name, arguments: args });
    if ((result as { isError?: boolean }).isError) throw new Error(`GBrain ${tool.name} error: ${textOf(result)}`);
    const text = textOf(result);
    const ref = text.match(/[\w/-]+\.md\b/)?.[0] ?? text.match(/\b(?:id|ref)["':\s]+([\w/-]+)/i)?.[1] ?? input.title;
    return { ref, raw: { tool: tool.name, args: Object.keys(args), text: text.slice(0, 500) } };
  }
}
