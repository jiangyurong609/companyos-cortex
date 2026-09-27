import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { CompiledEvent, type RawObservation, type RealityEvent } from "./schemas";
import { newId } from "./ids";

const MODEL = process.env.CORTEX_COMPILER_MODEL ?? "claude-opus-5";

const SYSTEM = `You are the CompanyOS Reality Event compiler.
Compile one raw human observation into a typed organizational event.
Rules:
- Use only the observation text. Never invent names, values, or dates.
- If something is ambiguous or missing, leave the field null and describe it in "unresolved".
- Money: convert "$120K" to 120000. Deadline: copy the phrase as spoken ("Friday"); never resolve it to a calendar date, and list the exact date as unresolved.
- claims are direct statements from the text only (subject/predicate/object), not implications.
- suggested_memory_queries: 2-4 short search queries likely to link this event to existing company memory (other customers with the same requirement, this customer's opportunity, roadmap decisions).`;

export function llmCompilerAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export const RIVER_SIDECAR_URL = process.env.RIVER_SIDECAR_URL ?? "http://127.0.0.1:8765";

/** River-hosted model via the Python sidecar (river/sidecar.py). Validated + invention-guarded. */
async function compileWithRiver(obs: RawObservation): Promise<CompiledEvent[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${RIVER_SIDECAR_URL}/compile`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: obs.text }),
        signal: AbortSignal.timeout(30_000),
      });
      const j = (await res.json()) as { events?: unknown[]; error?: string };
      if (!res.ok || !j.events) throw new Error(j.error ?? `sidecar ${res.status}`);
      // Validate each extracted signal independently; drop malformed ones rather than failing the capture.
      const events = j.events.flatMap((e) => {
        const r = CompiledEvent.safeParse(e);
        if (!r.success) return [];
        const parsed = guardAgainstInvention(obs.text, r.data);
        // A requirement must be a capability, not a clause; prefer the deterministic match if River rambles.
        if (parsed.requirement && parsed.requirement.split(/\s+/).length > 4) parsed.requirement = compileDeterministic(obs.text).requirement ?? null;
        return [parsed];
      });
      if (events.length === 0) throw new Error("no valid signals in River output");
      return events.slice(0, 5);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/** Compile raw input into one or more Reality Events (long notes can carry several signals). */
export async function compileObservation(obs: RawObservation): Promise<RealityEvent[]> {
  if (process.env.CORTEX_COMPILER === "river" || (!llmCompilerAvailable() && process.env.RIVER_API_KEY)) {
    try {
      return (await compileWithRiver(obs)).map((e) => finalize(obs, e, "river"));
    } catch {
      // River unavailable or output failed validation: fall back, and the event says so.
      return [finalize(obs, compileDeterministic(obs.text), "deterministic")];
    }
  }
  if (!llmCompilerAvailable() || process.env.CORTEX_COMPILER === "deterministic") {
    return [finalize(obs, compileDeterministic(obs.text), "deterministic")];
  }
  const client = new Anthropic();
  let lastError: unknown;
  // Retry malformed/refused output once, then surface the error.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.parse({
        model: MODEL,
        max_tokens: 4000,
        output_config: { effort: "low", format: zodOutputFormat(CompiledEvent) },
        system: SYSTEM,
        messages: [{ role: "user", content: `Observation (actor: ${obs.actor ?? "unknown"}):\n${obs.text}` }],
      });
      if (response.stop_reason === "refusal") throw new Error("compiler model refused the observation");
      if (!response.parsed_output) throw new Error("compiler returned no parseable output");
      const parsed = CompiledEvent.parse(response.parsed_output);
      return [finalize(obs, guardAgainstInvention(obs.text, parsed), "llm")];
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Reality Event compile failed after retry: ${String(lastError)}`);
}

function finalize(obs: RawObservation, c: CompiledEvent, compiler: RealityEvent["compiler"]): RealityEvent {
  const filled = [c.organization, c.requirement, c.opportunity_value_usd, c.owner, c.deadline_text].filter(
    (v) => v !== null,
  ).length;
  return { ...c, id: newId("evt"), observationId: obs.id, compiler, confidence: Math.round((filled / 5) * 100) / 100 };
}

/** Drop any extracted value that does not literally appear in the observation. */
function guardAgainstInvention(text: string, c: CompiledEvent): CompiledEvent {
  const lower = text.toLowerCase();
  const present = (s: string | null) => (s && lower.includes(s.toLowerCase()) ? s : null);
  const unresolved = [...c.unresolved];
  const out = { ...c, organization: present(c.organization), owner: present(c.owner), requirement: present(c.requirement), deadline_text: present(c.deadline_text) };
  if (c.opportunity_value_usd !== null && !moneyMentions(text).includes(c.opportunity_value_usd)) {
    out.opportunity_value_usd = null;
    unresolved.push("Opportunity value could not be verified in the observation text");
  }
  return { ...out, unresolved };
}

// ---------------------------------------------------------------------------
// Deterministic compiler: offline / no-key path, and the prevalidated fallback.

const REQUIREMENTS = ["SAML", "SCIM", "SSO", "SOC 2", "SOC2", "HIPAA", "audit logs", "RBAC", "data residency", "on-prem"];
const DEADLINE = /\b(?:by |on |before )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|end of (?:the )?(?:week|month|quarter)|next week|eod|eow)\b/i;

export function moneyMentions(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\$\s?(\d+(?:\.\d+)?)\s?([kKmM])?\b/g)) {
    const n = parseFloat(m[1]);
    const mult = m[2]?.toLowerCase() === "k" ? 1_000 : m[2]?.toLowerCase() === "m" ? 1_000_000 : 1;
    out.push(Math.round(n * mult));
  }
  return out;
}

export function compileDeterministic(text: string): CompiledEvent {
  const orgMatch =
    text.match(/\b(?:the|with|to|from)\s+([A-Z][\w&.-]+)\s+(?:call|meeting|team|deal|demo)\b/) ??
    text.match(/\b(?:talked to|spoke (?:with|to)|call with|meeting with)\s+([A-Z][\w&.-]+)/);
  const organization = orgMatch?.[1] ?? null;
  const requirement = REQUIREMENTS.find((r) => new RegExp(`\\b${r}\\b`, "i").test(text)) ?? null;
  const value = moneyMentions(text)[0] ?? null;
  const ownerMatch = text.match(/\b([A-Z][a-z]+)\s+(?:says|said|thinks|mentioned|reports)\b/);
  const owner = ownerMatch?.[1] ?? null;
  const deadline = text.match(DEADLINE);
  const deadline_text = deadline ? deadline[1][0].toUpperCase() + deadline[1].slice(1) : null;
  const blocker = /\b(won'?t approve|block|blocking|blocker|without|can'?t (?:sign|buy|deploy))\b/i.test(text);

  const claims: CompiledEvent["claims"] = [];
  const org = organization ?? "Customer";
  if (requirement) claims.push({ subject: org, predicate: blocker ? "blocked_by" : "requests", object: requirement, confidence: 0.95 });
  if (value !== null) claims.push({ subject: `${org} opportunity`, predicate: "value_usd", object: value, confidence: 0.95 });
  if (owner) claims.push({ subject: `${org} opportunity`, predicate: "reported_by", object: owner, confidence: 0.85 });
  if (deadline_text) claims.push({ subject: org, predicate: "response_deadline", object: deadline_text, confidence: 0.9 });

  const unresolved: string[] = [];
  if (!organization) unresolved.push("Customer organization not named");
  if (!value) unresolved.push("Opportunity value not stated");
  if (deadline_text) unresolved.push(`Exact calendar date for "${deadline_text}"`);

  const summary = [
    organization ?? "A customer",
    blocker ? "reports" : "requests",
    requirement ? `${requirement}${blocker ? " as a blocker" : ""}` : "a change",
    value ? `for a $${Math.round(value / 1000)}K opportunity` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .concat(".");

  const queries = [
    requirement ? `${requirement} enterprise customer requests` : null,
    organization ? `${organization} opportunity owner value` : null,
    requirement ? "enterprise authentication roadmap decision" : "enterprise readiness roadmap decision",
  ].filter((q): q is string => q !== null);
  while (queries.length < 2) queries.push("recent customer blockers");

  return {
    type: blocker ? "customer.blocker" : "customer.request",
    summary,
    organization,
    requirement,
    opportunity_value_usd: value,
    owner,
    deadline_text,
    urgency: deadline_text || blocker ? "high" : "medium",
    entities: [organization, owner, requirement].filter((e): e is string => e !== null),
    claims,
    unresolved,
    suggested_memory_queries: queries.slice(0, 4),
  };
}
