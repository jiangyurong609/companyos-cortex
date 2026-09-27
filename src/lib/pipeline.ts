import { compileObservation } from "./compiler";
import { buildDiff, buildMemoryNote } from "./diff";
import { newId } from "./ids";
import type { EventRecord, ObservationInput, RawObservation } from "./schemas";
import { events, save, writes } from "./store";
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
  save(rec, { stage: "CAPTURED", message: `${input.modality} observation from ${input.actor ?? "unknown"}`, via: "companyos" });
  void runPipeline(rec);
  return rec;
}

function fail(rec: EventRecord, stage: string, err: unknown, retryable = true) {
  rec.stage = "FAILED";
  rec.error = { stage, message: err instanceof Error ? err.message : String(err), retryable };
  save(rec, { stage: "FAILED", message: `${stage}: ${rec.error.message}` });
}

async function runPipeline(rec: EventRecord) {
  try {
    rec.event = await compileObservation(rec.observation);
    rec.stage = "COMPILED";
    save(rec, { stage: "COMPILED", message: `${rec.event.type} via ${rec.event.compiler} compiler`, via: "compiler" });
  } catch (err) {
    return fail(rec, "compile", err);
  }

  const runtime = getRuntime();
  try {
    rec.stage = "RESOLVING_MEMORY";
    save(rec, { stage: "RESOLVING_MEMORY", message: runtime.via === "qm" ? "QM turn started in scope cortex-demo" : runtime.label, via: runtime.via === "qm" ? "qm" : "companyos" });
    const { hits, resolution, log } = await runtime.ground(rec.event);
    for (const l of log) rec.trace.push({ at: new Date().toISOString(), stage: "RESOLVING_MEMORY", message: l, via: "gbrain" });
    const verified = await verifyProvenance(resolution);
    rec.rejected = verified.rejected;
    if (verified.rejected.length)
      rec.trace.push({ at: new Date().toISOString(), stage: "RESOLVING_MEMORY", message: `provenance check rejected ${verified.rejected.length} fact(s)`, via: "companyos" });
    rec.hits = hits.filter((h) => verified.resolution.recalled.some((f) => f.source_ref === h.id));
    rec.resolution = verified.resolution;
    rec.resolvedVia = runtime.via;
    const { rows, derivedTotalUsd } = buildDiff(rec.observation, rec.event, verified.resolution);
    rec.diff = rows;
    rec.derivedTotalUsd = derivedTotalUsd;
    rec.memoryNote = buildMemoryNote(rec.observation, rec.event).body;
    rec.stage = "DIFF_READY";
    save(rec, { stage: "DIFF_READY", message: `${verified.resolution.recalled.length} memories linked, ${rows.length} diff rows`, via: "companyos" });
  } catch (err) {
    return fail(rec, "resolve", err);
  }
}

export async function acceptEvent(id: string, editedNote?: string): Promise<EventRecord> {
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
