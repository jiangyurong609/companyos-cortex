import { ledger, seedSyntheticHistory } from "@/lib/learning/ledger";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { accuracy, policyStore, propose } from "@/lib/learning/policy";

export const dynamic = "force-dynamic";

export async function GET() {
  seedSyntheticHistory();
  const all = [...ledger().values()];
  const labeled = all.filter((e) => e.label);
  const { current, history } = policyStore();
  return Response.json({
    stats: {
      decisions: all.length,
      live: all.filter((e) => !e.synthetic).length,
      synthetic: all.filter((e) => e.synthetic).length,
      labeled: labeled.length,
      overrides: labeled.filter((e) => e.label!.action === "override").length,
      outcomes: {
        worked: all.filter((e) => e.outcome?.result === "worked").length,
        didnt: all.filter((e) => e.outcome?.result === "didnt").length,
      },
      agreement: accuracy(current.rules, labeled),
    },
    policy: current,
    history,
    proposal: propose(),
    river: (() => {
      const f = path.join(process.cwd(), "data", "river_router.json");
      return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
    })(),
    recentLive: all.filter((e) => !e.synthetic).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8),
  });
}
