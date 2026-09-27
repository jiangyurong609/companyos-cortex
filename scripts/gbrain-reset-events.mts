/** Delete rehearsal pages (cortex/events/*, decisions/evt-*, plans/*) from GBrain before the real demo. Seed pages are kept. */
import { gbrainSession } from "../src/lib/memory/gbrain";

const { client } = await gbrainSession();
const text = (r: unknown) => ((r as { content?: { text?: string }[] }).content ?? []).map((c) => c.text ?? "").join("");
const listed = text(await client.callTool({ name: "list_pages", arguments: { limit: 500 } }));
const slugs = [...new Set(listed.match(/(?:cortex\/events\/|decisions\/evt-|plans\/)[a-z0-9-]+/g) ?? [])];
for (const slug of slugs) {
  await client.callTool({ name: "delete_page", arguments: { slug } });
  console.log(`deleted ${slug}`);
}
console.log(`${slugs.length} rehearsal page(s) removed`);
process.exit(0);
