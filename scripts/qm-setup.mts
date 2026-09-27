/**
 * One-time QM setup + proof:
 *   1. register GBrain as an org MCP connector (PUT /v1/admin/mcp-servers/gbrain)
 *   2. create the `cortex-demo` project if QM_PROJECT_ID is unset (POST /v1/projects)
 *   3. run one QM turn in that project that searches GBrain
 * Requires QM_CORE_URL, QM_SIGNING_SECRET, QM_ACTOR_ID (+ GBRAIN_TOKEN for step 1).
 */
import { qmFetch, QmRuntime, type QmConfig } from "../src/lib/runtime/qm";

const url = process.env.QM_CORE_URL, secret = process.env.QM_SIGNING_SECRET, actorId = process.env.QM_ACTOR_ID;
if (!url || !secret || !actorId) throw new Error("set QM_CORE_URL, QM_SIGNING_SECRET, QM_ACTOR_ID");
const cfg: QmConfig = { url: url.replace(/\/$/, ""), secret, actorId, projectId: process.env.QM_PROJECT_ID ?? "", timeoutMs: 180_000 };

if (process.env.GBRAIN_TOKEN && !process.argv.includes("--skip-connector")) {
  const r = await qmFetch(cfg, "PUT", "/v1/admin/mcp-servers/gbrain", {
    name: "GBrain", url: process.env.GBRAIN_MCP_URL ?? "https://gbrain.io/mcp", auth: "bearer",
    bearerToken: process.env.GBRAIN_TOKEN, readOnly: false, enabled: true,
  });
  console.log(`connector gbrain → ${r.status}`, JSON.stringify(r.json).slice(0, 200));
}

if (!cfg.projectId) {
  const r = await qmFetch(cfg, "POST", "/v1/projects", { principalId: actorId, name: "cortex-demo" });
  console.log(`create project → ${r.status}`, JSON.stringify(r.json).slice(0, 300));
  cfg.projectId = (r.json as { project?: { id?: string } }).project?.id ?? "";
  if (!cfg.projectId) process.exit(1);
  console.log(`\n>>> add to .env.local:  QM_PROJECT_ID=${cfg.projectId}\n`);
}

const { hits, log } = await new QmRuntime(cfg).recall("SAML enterprise customer requests");
console.log(log.join("\n"));
for (const h of hits) console.log(`  [${h.id}] ${h.snippet.slice(0, 120)}`);
process.exit(0);
