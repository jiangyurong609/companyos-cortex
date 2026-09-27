/** Seed the synthetic Northstar API memory into GBrain as pages (idempotent: put_page by slug). */
import { putPage } from "../src/lib/memory/gbrain";
import { SEED_NOTES } from "../src/lib/memory/seed";

for (const n of SEED_NOTES) {
  const body = `${n.body}\n\nSource: Northstar API synthetic hackathon seed (fictional company).`;
  console.log(`put_page ${await putPage(n.path, n.title, body, ["northstar-demo"])}`);
}
process.exit(0);
