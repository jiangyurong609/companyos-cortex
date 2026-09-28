import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ledger } from "@/lib/learning/ledger";

/** Export human-labeled routing decisions as a River SFT dataset (prompt → route JSON). */
export async function POST() {
  const rows = [...ledger().values()]
    .filter((e) => e.label)
    .map((e) => ({
      eventId: e.eventId,
      prompt: `Route this company signal to "ceo" or "manager".\nSignal: ${JSON.stringify({ summary: e.summary, ...e.features })}\nAnswer:`,
      completion: ` ${JSON.stringify({ route: e.label!.route })}`,
      synthetic: Boolean(e.synthetic),
    }));
  const file = path.join(process.cwd(), "data", "river_sft.jsonl");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return Response.json({ file: "data/river_sft.jsonl", examples: rows.length, live: rows.filter((r) => !r.synthetic).length });
}
