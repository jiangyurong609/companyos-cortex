import { createHmac } from "node:crypto";
import { z } from "zod";
import { eventSlug, pageContent } from "../memory/gbrain";
import type { MemoryWrite } from "../memory/types";
import { GroundedResolution, type MemoryHit, type RealityEvent } from "../schemas";
import type { TurnRuntime } from "./types";

/**
 * QM core API client. Turns run in the `cortex-demo` project's shared scope
 * (conversation kind "group", channelRef `web-project-<id>`), where the org-wide
 * GBrain MCP connector is available to the agent.
 * Signing matches QM src/auth/source-auth-sign.ts.
 */
export interface QmConfig {
  url: string;
  secret: string;
  projectId: string;
  actorId: string;
  timeoutMs: number;
}

export function qmConfig(): QmConfig | null {
  const url = process.env.QM_CORE_URL;
  const secret = process.env.QM_SIGNING_SECRET;
  const projectId = process.env.QM_PROJECT_ID;
  const actorId = process.env.QM_ACTOR_ID;
  if (!url || !secret || !projectId || !actorId) return null;
  return { url: url.replace(/\/$/, ""), secret, projectId, actorId, timeoutMs: Number(process.env.QM_TURN_TIMEOUT_MS ?? 180_000) };
}

export function signedHeaders(secret: string, method: string, pathWithQuery: string, body: string, nowSec = Math.floor(Date.now() / 1000)) {
  const canonical = `${method}\n${pathWithQuery}\n${body}`;
  const sig = createHmac("sha256", secret).update(`v0:${nowSec}:${canonical}`).digest("hex");
  return { "content-type": "application/json", "x-timestamp": String(nowSec), "x-signature": `v0=${sig}` };
}

export async function qmFetch(cfg: QmConfig, method: string, path: string, payload?: unknown): Promise<{ status: number; json: unknown }> {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const res = await fetch(cfg.url + path, {
    method,
    // Admin routes resolve the caller from x-admin-actor (QM src/api/routes/shared.ts).
    headers: { ...signedHeaders(cfg.secret, method, path, body), ...(path.startsWith("/v1/admin/") ? { "x-admin-actor": `${cfg.actorId}@${process.env.QM_ORG ?? "acme"}` } : {}) },
    body: body || undefined,
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { status: res.status, json };
}

interface TurnResult {
  status: string;
  reply?: string;
  reason?: string;
  runId?: string;
  sessionId?: string;
}

/** Pull the first JSON object out of an agent reply (fenced or bare). */
export function extractJson(reply: string): unknown {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1);
  return JSON.parse(candidate);
}

const GROUND_INSTRUCTION = `You are CompanyOS Cortex's grounded resolver.
You are operating in project scope cortex-demo.
Use GBrain memory tools (recall/search/fetch) to verify and contextualize the supplied RealityEvent. Run each of the supplied queries.
Do not invent company facts. Never write to memory in this turn.
For every recalled fact include the GBrain note path/id as source_ref and a verbatim quote from that note.
Include facts about other customers with the same or equivalent requirement (e.g. SAML ~ enterprise SSO), this customer's existing opportunity, and relevant product/roadmap decisions.
Put recommendations only in "proposals" — never in "recalled". Do not compute totals.
Reply with ONLY a JSON object in a \`\`\`json fence, matching:
{"recalled":[{"statement":string,"organization":string|null,"requirement":string|null,"value_usd":number|null,"source_ref":string,"quote":string}],"contradictions":[string],"missing":[string],"proposals":[string],"source_refs":[string]}`;

const HitsReply = z.object({ hits: z.array(z.object({ id: z.string(), title: z.string(), snippet: z.string(), source: z.string().optional() })) });
const WriteReply = z.object({ ref: z.string(), written: z.boolean().optional() });

export class QmRuntime implements TurnRuntime {
  readonly via = "qm" as const;
  readonly label: string;
  constructor(private cfg: QmConfig) {
    this.label = `QM project cortex-demo (${cfg.projectId})`;
  }

  private async turn(threadRef: string, text: string, idempotencyKey?: string): Promise<TurnResult> {
    const { status, json } = await qmFetch(this.cfg, "POST", "/v1/turns", {
      surface: "web",
      actor: { externalId: this.cfg.actorId, displayName: "CompanyOS Cortex" },
      conversation: { kind: "group", channelRef: `web-project-${this.cfg.projectId}`, threadRef },
      text,
      // Bounded extraction turns: low reasoning effort keeps the demo loop fast.
      thinkingLevel: process.env.QM_THINKING_LEVEL ?? "low",
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
    const r = json as TurnResult;
    if (status >= 400 || typeof r !== "object") throw new Error(`QM /v1/turns ${status}: ${JSON.stringify(json).slice(0, 300)}`);
    if (r.status === "pending_approval") throw new Error("QM turn is waiting for tool approval — approve it in the QM UI, then retry");
    if (r.status !== "ok" || !r.reply) throw new Error(`QM turn ${r.status}${r.reason ? `: ${r.reason}` : ""}`);
    return r;
  }

  /** Run a turn and validate its JSON reply; one corrective retry on malformed output. */
  private async structuredTurn<T>(threadRef: string, text: string, schema: z.ZodType<T>, idempotencyKey?: string): Promise<{ value: T; log: string[] }> {
    const log: string[] = [];
    let prompt = text;
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await this.turn(threadRef, prompt, attempt === 0 ? idempotencyKey : undefined);
      log.push(`QM run ${r.runId ?? r.sessionId ?? "?"} → ${r.status}`);
      try {
        return { value: schema.parse(extractJson(r.reply!)), log };
      } catch (err) {
        log.push(`QM reply failed schema: ${String(err).slice(0, 160)}`);
        prompt = `Your previous reply was not valid JSON for the required schema (${String(err).slice(0, 200)}). Reply again with ONLY the JSON object.`;
      }
    }
    throw new Error(`QM reply did not match schema after retry: ${log.join(" | ")}`);
  }

  async ground(event: RealityEvent) {
    const payload = {
      event: {
        id: event.id,
        type: event.type,
        organization: event.organization,
        requirement: event.requirement,
        opportunity_value: event.opportunity_value_usd,
        owner: event.owner,
        deadline_text: event.deadline_text,
        summary: event.summary,
      },
      queries: event.suggested_memory_queries,
    };
    const { value, log } = await this.structuredTurn(
      `cortex:${event.id}`,
      `${GROUND_INSTRUCTION}\n\nInput:\n${JSON.stringify(payload, null, 2)}`,
      GroundedResolution,
    );
    const hits: MemoryHit[] = value.recalled.map((f) => ({ id: f.source_ref, title: f.statement, snippet: f.quote, source: `gbrain:${f.source_ref}` }));
    return { hits, resolution: value, log: [...event.suggested_memory_queries.map((q) => `QM → GBrain: "${q}"`), ...log] };
  }

  async write(input: MemoryWrite) {
    const slug = eventSlug(input.key);
    const text = `The user has approved this CompanyOS state transition. Persist it to GBrain memory in exactly two tool calls:
1. put_page with slug "${slug}" and content set to EXACTLY the page between the markers (it is idempotent — re-running replaces the same page).
2. remember with entity "${input.title.split(" — ")[0]}", kind "event", provenance "CompanyOS Cortex Reality Event ${input.key} (page ${slug})", and fact set to the first sentence of the note body.
Do not add roadmap recommendations or any other content. Do not write anything else.
Reply with ONLY a JSON object in a \`\`\`json fence: {"ref": "${slug}", "written": true}

--- PAGE ---
${pageContent(input.title, input.body, ["companyos-cortex", "reality-event"])}--- END PAGE ---`;
    const { value, log } = await this.structuredTurn(`cortex:${input.key}:write`, text, WriteReply, `cortex-write-${input.key}`);
    return { ref: value.ref, raw: value, log: ["QM → GBrain put_page + remember", ...log] };
  }

  async recall(query: string, entity?: string) {
    const text = `Fresh recall from GBrain memory. Do not write anything.
Call the GBrain recall tool with ${entity ? `entity "${entity}" and ` : ""}query "${query}".
Return every fact and page result. For a fact use id "fact:<fact_id>", title = its entity, snippet = the fact text, source = its provenance, verbatim. For a page use its slug verbatim as id and source "gbrain:<slug>".
Reply with ONLY a JSON object in a \`\`\`json fence: {"hits":[{"id":string,"title":string,"snippet":string,"source":string}]} (max 8).`;
    const { value, log } = await this.structuredTurn(`cortex:recall:${Date.now()}`, text, HitsReply);
    return { hits: value.hits, log: [`QM → GBrain recall${entity ? ` entity=${entity}` : ""}: "${query}"`, ...log] };
  }
}
