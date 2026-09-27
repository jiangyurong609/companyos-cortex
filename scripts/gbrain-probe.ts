/** Verify GBrain MCP: list tools with their argument schemas, then run one search. */
import { GBrainMemory, listGbrainTools } from "../src/lib/memory/gbrain";

const tools = await listGbrainTools();
console.log(`GBrain exposes ${tools.length} tools:`);
for (const t of tools) console.log(`- ${t.name}(${Object.keys(t.inputSchema.properties ?? {}).join(", ")}) — ${t.description?.slice(0, 90) ?? ""}`);
const q = process.argv[2] ?? "SAML enterprise customer requests";
const hits = await new GBrainMemory().search(q);
console.log(`\nsearch "${q}" → ${hits.length} hits`);
for (const h of hits) console.log(`  [${h.id}] ${h.title}: ${h.snippet.slice(0, 120)}`);
process.exit(0);
