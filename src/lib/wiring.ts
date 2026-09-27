import { llmCompilerAvailable } from "./compiler";
import { FixtureMemory } from "./memory/fixture";
import { GBrainMemory, GBRAIN_URL } from "./memory/gbrain";
import type { CompanyMemory } from "./memory/types";
import { DirectRuntime } from "./runtime/direct";
import { QmRuntime, qmConfig } from "./runtime/qm";
import type { TurnRuntime } from "./runtime/types";
import type { IntegrationStatus } from "./schemas";

/** Chooses real integrations when configured; falls back honestly and says so. */
export function getMemory(): CompanyMemory {
  return process.env.GBRAIN_TOKEN ? new GBrainMemory() : new FixtureMemory();
}

export function getRuntime(): TurnRuntime {
  const cfg = qmConfig();
  // QM's agent reaches memory only through the GBrain connector, so QM needs GBrain configured.
  if (cfg && process.env.GBRAIN_TOKEN && process.env.CORTEX_RUNTIME !== "direct") return new QmRuntime(cfg);
  const memory = getMemory();
  return new DirectRuntime(memory, `Direct → ${memory.mode === "live" ? "GBrain" : "fixture"} (QM not configured)`);
}

export function integrationStatus(): IntegrationStatus {
  const memory = getMemory();
  const runtime = getRuntime();
  return {
    gbrain: process.env.GBRAIN_TOKEN
      ? { mode: "live", detail: `GBrain MCP ${GBRAIN_URL}` }
      : { mode: "fixture", detail: memory.label },
    qm:
      runtime.via === "qm"
        ? { mode: "live", detail: runtime.label }
        : qmConfig()
          ? { mode: "unavailable", detail: "QM ready — waiting for GBRAIN_TOKEN (then run pnpm qm:setup)" }
          : { mode: "unavailable", detail: "Set QM_CORE_URL, QM_SIGNING_SECRET, QM_PROJECT_ID, QM_ACTOR_ID" },
    compiler:
      llmCompilerAvailable() && process.env.CORTEX_COMPILER !== "deterministic"
        ? { mode: "llm", detail: process.env.CORTEX_COMPILER_MODEL ?? "claude-opus-5" }
        : { mode: "deterministic", detail: "Deterministic parser (no ANTHROPIC_API_KEY)" },
  };
}
