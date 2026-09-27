/** Seed the synthetic Northstar API memory into GBrain (Full-access client required). */
import { GBrainMemory } from "../src/lib/memory/gbrain";
import { SEED_NOTES } from "../src/lib/memory/seed";

const mem = new GBrainMemory();
for (const n of SEED_NOTES) {
  const body = `# ${n.title}\n\n${n.body}\n\nPath: ${n.path}\nSource: Northstar API synthetic hackathon seed (fictional)`;
  const r = await mem.remember({ key: n.path, title: n.title, body });
  console.log(`remembered ${n.path} → ${r.ref}`);
}
process.exit(0);
