import { compileObservation } from "./compiler";
import { buildDiff, buildMemoryNote } from "./diff";
import { newId } from "./ids";
import type { EventRecord, ObservationInput, RawObservation } from "./schemas";
import { events, save, writes } from "./store";
import { resolveReporter } from "./org";
import { recordLabel, recordOutcome, recordPrediction } from "./learning/ledger";
import { triage } from "./triage";
import { getMemory, getRuntime } from "./wiring";
import type { GroundedResolution } from "./schemas";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9$]+/g, " ").trim();

/** Provenance or it didn't happen: every recalled fact must cite a real page containing its quote. */
async function verifyProvenance(res: GroundedResolution) {
  const memory = getMemory();
  const refs = [...new Set(res.recalled.map((f) => f.source_ref).filter(Boolean))];
  const pages = new Map(await Promise.all(refs.map(async (r) => [r, await memory.getPage(r)] as const)));
  const rejected: { ref: string; statement: string; reason: string }[] = [];
  const recalled = res.recalled.filter((f) => {
    const page = f.source_ref ? pages.get(f.source_ref) : null;
    const reason = !f.source_ref ? "no source" : !page ? "cited page not found in GBrain" : !f.quote.trim() || !norm(page).includes(norm(f.quote)) ? "quote not in cited page" : null;
    if (reason) rejected.push({ ref: f.source_ref || "—", statement: f.statement, reason });
    return !reason;
  });
  return { resolution: { ...res, recalled }, rejected };
}

export function createObservation(input: ObservationInput): EventRecord {
  const observation: RawObservation = { ...input, id: newId("obs"), createdAt: new Date().toISOString() };
  const rec: EventRecord = { id: observation.id, observation, stage: "CAPTURED", hits: [], diff: [], trace: [], updatedAt: observation.createdAt };
  save(rec, { stage: "CAPTURED", message: `${input.source} capture (${input.modality}) from ${input.actor ?? "unknown"}`, via: "companyos" });
  void runPipeline(rec);
  return rec;
}

function fail(rec: EventRecord, stage: string, err: unknown, retryable = true) {
  rec.stage = "FAILED";
  rec.error = { stage, message: err instanceof Error ? err.message : String(err), retryable };
  save(rec, { stage: "FAILED", message: `${stage}: ${rec.error.message}` });
}

async function runPipeline(rec: EventRecord) {
  let compiled;
  try {
    [compiled, rec.reporter] = await Promise.all([compileObservation(rec.observation), resolveReporter(rec.observation.actor)]);
  } catch (err) {
    return fail(rec, "compile", err);
  }
  // Models sometimes emit the same signal twice; keep one per (type, org, requirement, value).
  const seen = new Set<string>();
  compiled = compiled.filter((e) => {
    const k = [e.type, e.organization, e.requirement, e.opportunity_value_usd].join("|").toLowerCase();
    return seen.has(k) ? false : (seen.add(k), true);
  });
  // One capture can carry several signals; each becomes its own record and is grounded in parallel.
  const records = compiled.map((ev, i) => {
    const r: EventRecord = i === 0 ? rec : { ...rec, id: `${rec.id}-${i + 1}`, hits: [], diff: [], trace: [...rec.trace] };
    r.event = ev;
    r.signal = { index: i + 1, count: compiled.length };
    r.stage = "COMPILED";
    save(r, {
      stage: "COMPILED",
      message: `${ev.type} via ${ev.compiler} compiler${compiled.length > 1 ? ` (signal ${i + 1} of ${compiled.length})` : ""}${rec.reporter ? ` · ${rec.reporter.role}, ${rec.reporter.team} (GBrain ${rec.reporter.ref})` : ""}`,
      via: "compiler",
    });
    return r;
  });
  await Promise.all(records.map(ground));
}

/** Cap concurrent QM grounding turns so a busy workday doesn't overload the agent runtime. */
const MAX_GROUNDING = Number(process.env.CORTEX_MAX_GROUNDING ?? 5);
let active = 0;
const waiters: (() => void)[] = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_GROUNDING) await new Promise<void>((r) => waiters.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiters.shift()?.();
  }
}

async function ground(rec: EventRecord) {
  return withSlot(() => groundNow(rec));
}

async function groundNow(rec: EventRecord) {
  const runtime = getRuntime();
  try {
    rec.stage = "RESOLVING_MEMORY";
    save(rec, { stage: "RESOLVING_MEMORY", message: runtime.via === "qm" ? "QM turn started in scope cortex-demo" : runtime.label, via: runtime.via === "qm" ? "qm" : "companyos" });
    const { hits, resolution, log } = await runtime.ground(rec.event!);
    for (const l of log) rec.trace.push({ at: new Date().toISOString(), stage: "RESOLVING_MEMORY", message: l, via: "gbrain" });
    const verified = await verifyProvenance(resolution);
    rec.rejected = verified.rejected;
    if (verified.rejected.length)
      rec.trace.push({ at: new Date().toISOString(), stage: "RESOLVING_MEMORY", message: `provenance check rejected ${verified.rejected.length} fact(s)`, via: "companyos" });
    rec.hits = hits.filter((h) => verified.resolution.recalled.some((f) => f.source_ref === h.id));
    rec.resolution = verified.resolution;
    rec.resolvedVia = runtime.via;
    const { rows, derivedTotalUsd } = buildDiff(rec.observation, rec.event!, verified.resolution);
    rec.diff = rows;
    rec.derivedTotalUsd = derivedTotalUsd;
    rec.memoryNote = buildMemoryNote(rec.observation, rec.event!).body;
    rec.triage = await triage(rec);
    recordPrediction(rec);
    rec.trace.push({ at: new Date().toISOString(), stage: "TRIAGED", message: `routed to ${rec.triage.route} (${rec.triage.by}): ${rec.triage.why}`, via: "companyos" });
    rec.stage = "DIFF_READY";
    save(rec, { stage: "DIFF_READY", message: `${verified.resolution.recalled.length} memories linked, ${rows.length} diff rows`, via: "companyos" });
  } catch (err) {
    return fail(rec, "resolve", err);
  }
}

export async function acceptEvent(id: string, editedNote?: string, by?: "ceo" | "manager"): Promise<EventRecord> {
  if (by) recordLabel(id, by === "manager" ? "manager" : "ceo", by, "merged");
  const rec = events.get(id);
  if (!rec?.event) throw new Error("event not found or not compiled");
  // Idempotent: a repeated accept returns the original write.
  const prior = writes.get(id);
  if (prior) {
    rec.write = { ...prior, deduplicated: true };
    return save(rec, { stage: "ACCEPTED", message: `duplicate accept ignored → ${prior.ref}`, via: "companyos" });
  }
  if (rec.stage !== "DIFF_READY" && rec.stage !== "FAILED") throw new Error(`cannot accept in stage ${rec.stage}`);

  const note = buildMemoryNote(rec.observation, rec.event);
  const body = editedNote?.trim() || note.body;
  const runtime = getRuntime();
  rec.stage = "WRITING";
  save(rec, { stage: "WRITING", message: runtime.via === "qm" ? "QM approval turn → GBrain remember" : `${runtime.label} → remember`, via: runtime.via === "qm" ? "qm" : "companyos" });
  try {
    const w = await runtime.write({ key: rec.event.id, title: note.title, body });
    rec.write = { ref: w.ref, via: runtime.via, deduplicated: false, raw: w.raw };
    writes.set(id, rec.write);
    rec.memoryNote = body;
    for (const l of w.log) rec.trace.push({ at: new Date().toISOString(), stage: "WRITING", message: l, via: "gbrain" });
  } catch (err) {
    fail(rec, "write", err);
    return rec;
  }

  // Fresh recall proves persistence.
  const entity = rec.event.organization ?? undefined;
  const query = `What do we know about ${[rec.event.organization, rec.event.requirement].filter(Boolean).join(" and ")}?`;
  try {
    // Independent check: query GBrain directly, not through the agent that did the write.
    const memory = getMemory();
    const hits = await memory.recall(query, entity);
    const log = [`${memory.mode === "live" ? "GBrain" : "fixture"} recall${entity ? ` entity=${entity}` : ""}: "${query}"`];
    const evId = rec.event.id;
    const found = hits.some((h) => h.id === rec.write!.ref || h.snippet.includes(evId) || (h.source ?? "").includes(evId) || h.title === note.title);
    rec.proof = { query, hits, found, via: "direct" };
    rec.stage = "ACCEPTED";
    for (const l of log) rec.trace.push({ at: new Date().toISOString(), stage: "ACCEPTED", message: l, via: "gbrain" });
    return save(rec, { stage: "ACCEPTED", message: found ? "fresh recall returned the new note" : "write succeeded but fresh recall did not return it yet", via: "gbrain" });
  } catch (err) {
    rec.stage = "ACCEPTED";
    rec.proof = { query, hits: [], found: false, via: runtime.via };
    return save(rec, { stage: "ACCEPTED", message: `persistence re-query failed: ${String(err)}` });
  }
}

export function rejectEvent(id: string): EventRecord {
  const rec = events.get(id);
  if (!rec) throw new Error("event not found");
  rec.stage = "REJECTED";
  return save(rec, { stage: "REJECTED", message: "human rejected — nothing written", via: "companyos" });
}

/** CEO merges a proposal as a decision. Facts are merged first; the decision is its own page. */
export async function decideEvent(id: string, proposal: string): Promise<EventRecord> {
  let rec: EventRecord | undefined = events.get(id);
  if (!rec?.event) throw new Error("event not found or not compiled");
  if (rec.decision) return rec; // idempotent
  recordLabel(id, "ceo", "ceo", "approved");
  if (!rec.diff.some((r) => r.kind === "proposed" && r.title === proposal)) throw new Error("unknown proposal");
  if (rec.stage === "DIFF_READY") rec = await acceptEvent(id);
  const runtime = getRuntime();
  const ev = rec.event!;
  const key = `decision-${ev.id}`;
  const slug = `decisions/${ev.id.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
  const related = rec.diff.filter((r) => r.kind === "recalled" || r.kind === "derived").map((r) => `- ${r.title} (${r.evidenceRefs.join(", ")})`);
  const body = [
    `# Decision — ${proposal}`,
    "",
    `Decided by the CEO on ${new Date().toISOString().slice(0, 10)} after reviewing CompanyOS Cortex Reality Event ${ev.id}.`,
    "",
    "Why:",
    `- ${ev.summary}`,
    ...related,
    "",
    `Source: CompanyOS Cortex Reality Event ${ev.id} (page ${rec.write?.ref ?? "pending"})`,
  ].join("\n");
  save(rec, { stage: rec.stage, message: `CEO approved decision: ${proposal}`, via: "companyos" });
  const w = await runtime.write({ key, slug, title: `Decision — ${proposal}`, body });
  rec.decision = { text: proposal, ref: w.ref, via: runtime.via, at: new Date().toISOString() };
  for (const l of w.log) rec.trace.push({ at: new Date().toISOString(), stage: "DECIDED", message: l, via: "gbrain" });
  save(rec, { stage: rec.stage, message: `decision written → ${w.ref}`, via: runtime.via === "qm" ? "qm" : "companyos" });
  void reactToDecision(rec, proposal);
  return rec;
}

/** The company reacts: QM finds an owner in the org chart and drafts a grounded plan page. */
async function reactToDecision(rec: EventRecord, proposal: string) {
  const ev = rec.event!;
  rec.action = { status: "drafting" };
  save(rec, { stage: rec.stage, message: "QM drafting action plan…", via: "qm" });
  try {
    const p = await getRuntime().plan({
      decision: proposal,
      slug: `plans/${ev.id.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`,
      eventId: ev.id,
      summary: `${ev.summary}${rec.derivedTotalUsd ? ` Related opportunities total $${Math.round(rec.derivedTotalUsd / 1000)}K.` : ""}`,
      evidence: [...new Set(rec.diff.flatMap((d) => d.evidenceRefs).filter((r) => !r.startsWith("observation:")))],
      decisionRef: rec.decision!.ref,
    });
    rec.action = { status: "ready", ref: p.ref, owner: p.owner, steps: p.steps };
    for (const l of p.log) rec.trace.push({ at: new Date().toISOString(), stage: "ACTING", message: l, via: "qm" });
    save(rec, { stage: rec.stage, message: `plan ready → ${p.ref} · owner ${p.owner}`, via: "gbrain" });
  } catch (err) {
    rec.action = { status: "failed", error: String(err).slice(0, 200) };
    save(rec, { stage: rec.stage, message: `plan failed: ${rec.action.error}` });
  }
}

/** A human re-routes an item: the CEO sends it back to a manager, or a manager escalates it. That override is a label. */
export function rerouteEvent(id: string, route: "ceo" | "manager", by: "ceo" | "manager"): EventRecord {
  const rec = events.get(id);
  if (!rec?.triage) throw new Error("event not triaged yet");
  const from = rec.triage.route;
  rec.triage = { ...rec.triage, route, by: "rule", why: `${by === "ceo" ? "CEO" : "Manager"} re-routed this (${from} → ${route}); recorded as a learning signal.` };
  recordLabel(id, route, by, from === route ? "confirmed" : "override");
  return save(rec, { stage: rec.stage, message: `${by} re-routed ${from} → ${route} (label recorded)`, via: "companyos" });
}

/** Close the loop: record whether a decision worked. Written to GBrain as outcomes/<event>. */
export async function recordEventOutcome(id: string, result: "worked" | "didnt", note: string | undefined, source: string) {
  const rec = events.get(id);
  const entry = recordOutcome(id, result, source, note);
  if (!entry) throw new Error("no ledger entry for this event");
  const slug = `outcomes/${id.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
  const body = [
    `# Outcome — ${rec?.decision?.text ?? entry.summary}`,
    "",
    `Result: ${result === "worked" ? "worked" : "did not work"}${note ? ` — ${note}` : ""}`,
    `Recorded by: ${source}`,
    rec?.decision ? `Decision: ${rec.decision.ref}` : "",
    rec?.action?.ref ? `Plan: ${rec.action.ref}` : "",
  ].filter(Boolean).join("\n");
  const w = await getMemory().remember({ key: `outcome-${id}`, slug, title: `Outcome — ${entry.summary}`, body });
  if (rec) {
    rec.outcome = { result, note, ref: w.ref, source };
    save(rec, { stage: rec.stage, message: `outcome recorded: ${result} → ${w.ref}`, via: "gbrain" });
  }
  return { entry, ref: w.ref };
}
