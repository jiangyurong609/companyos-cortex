import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// The ledger and policy persist under cwd/data — isolate them.
beforeAll(() => {
  process.chdir(mkdtempSync(path.join(tmpdir(), "cortex-learn-")));
  delete process.env.GBRAIN_TOKEN;
});

describe("company learning loop", () => {
  it("learns a routing rule from human overrides that generalizes to held-out decisions", async () => {
    const { seedSyntheticHistory, ledger } = await import("../src/lib/learning/ledger");
    const { propose, merge, policyStore, accuracy } = await import("../src/lib/learning/policy");
    expect(seedSyntheticHistory()).toBe(90);
    const p = propose();
    expect(p).not.toBeNull();
    expect(p!.rule.when.types).toEqual(["competitor.signal"]);
    expect(p!.rule.route).toBe("ceo");
    expect(p!.test.after).toBeGreaterThan(p!.test.before);
    const v = await merge(p!.id, "test");
    expect(v.version).toBe(2);
    expect(policyStore().current.rules).toHaveLength(2);
    const labeled = [...ledger().values()].filter((e) => e.label);
    expect(accuracy(v.rules, labeled)).toBeGreaterThan(accuracy(policyStore().history[0].rules, labeled));
  });
});
