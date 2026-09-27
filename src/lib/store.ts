import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { EventRecord, TraceStep } from "./schemas";

/** Ephemeral pending-event state. Canonical memory lives in GBrain only. */
const g = globalThis as unknown as { __cortexEvents?: Map<string, EventRecord>; __cortexWrites?: Map<string, EventRecord["write"]> };
export const events = (g.__cortexEvents ??= new Map());
/** Idempotency ledger: event id -> write result. */
export const writes = (g.__cortexWrites ??= new Map());

export function save(rec: EventRecord, step?: Omit<TraceStep, "at">): EventRecord {
  const now = new Date().toISOString();
  if (step) rec.trace.push({ at: now, ...step });
  rec.updatedAt = now;
  events.set(rec.id, rec);
  void logTrajectory(rec, step?.stage);
  return rec;
}

export function latest(n = 10): EventRecord[] {
  return [...events.values()].sort((a, b) => b.observation.createdAt.localeCompare(a.observation.createdAt)).slice(0, n);
}

const TRAJ = path.join(process.cwd(), "data", "trajectories.jsonl");

/** River-ready trajectory log: one line per state transition (docs/06_AGENT_ORCHESTRATION.md). */
async function logTrajectory(rec: EventRecord, transition?: string) {
  if (!transition) return;
  const line = {
    at: rec.updatedAt,
    transition,
    event_id: rec.id,
    observation: rec.observation,
    state: rec.stage,
    reality_event: rec.event ?? null,
    context_refs: rec.hits.map((h) => h.id),
    agent_outputs: rec.resolution ?? null,
    human_decision: rec.stage === "ACCEPTED" ? "accept" : rec.stage === "REJECTED" ? "reject" : null,
    verification: rec.proof ? { found: rec.proof.found, query: rec.proof.query } : null,
    reward: null,
  };
  try {
    await mkdir(path.dirname(TRAJ), { recursive: true });
    await appendFile(TRAJ, JSON.stringify(line) + "\n");
  } catch {
    // Trajectory export is best-effort; never break the demo loop on it.
  }
}
