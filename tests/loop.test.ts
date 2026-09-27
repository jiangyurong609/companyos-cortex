import { beforeAll, describe, expect, it } from "vitest";
import { compileDeterministic } from "../src/lib/compiler";
import { buildDiff, isGroundedValue } from "../src/lib/diff";
import { FixtureMemory } from "../src/lib/memory/fixture";
import { DirectRuntime } from "../src/lib/runtime/direct";
import { extractJson, signedHeaders } from "../src/lib/runtime/qm";
import { createHmac } from "node:crypto";

const CANONICAL =
  "I just finished the Acme call. Their security team won't approve us without SAML. Sarah says it's blocking the $120K deal, and they need an answer Friday.";

beforeAll(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GBRAIN_TOKEN;
  delete process.env.QM_CORE_URL;
});

describe("reality event compiler (deterministic)", () => {
  it("parses the canonical observation 5/5", () => {
    for (let i = 0; i < 5; i++) {
      const ev = compileDeterministic(CANONICAL);
      expect(ev.type).toBe("customer.blocker");
      expect(ev.organization).toBe("Acme");
      expect(ev.requirement).toBe("SAML");
      expect(ev.opportunity_value_usd).toBe(120000);
      expect(ev.owner).toBe("Sarah");
      expect(ev.deadline_text).toBe("Friday");
      expect(ev.unresolved.join(" ")).toMatch(/calendar date/);
    }
  });

  it("does not invent missing values", () => {
    const ev = compileDeterministic("Heard from a prospect that onboarding docs are confusing.");
    expect(ev.organization).toBeNull();
    expect(ev.opportunity_value_usd).toBeNull();
    expect(ev.deadline_text).toBeNull();
  });
});

describe("grounded diff", () => {
  it("links Ramp + Globex and derives $340K in code", async () => {
    const compiled = compileDeterministic(CANONICAL);
    const ev = { ...compiled, id: "evt_test", observationId: "obs_test", compiler: "deterministic" as const, confidence: 1 };
    const obs = { id: "obs_test", createdAt: new Date().toISOString(), modality: "text" as const, text: CANONICAL };
    const { resolution } = await new DirectRuntime(new FixtureMemory()).ground(ev);
    const { rows, derivedTotalUsd, related } = buildDiff(obs, ev, resolution);
    expect(related.map((r) => r.organization).sort()).toEqual(["Globex", "Ramp"]);
    expect(derivedTotalUsd).toBe(340000);
    const kinds = new Set(rows.map((r) => r.kind));
    expect(kinds).toEqual(new Set(["observed", "recalled", "derived", "proposed"]));
    // every non-proposal row carries evidence; proposals are never acceptable
    for (const r of rows) {
      if (r.kind !== "proposed") expect(r.evidence.length).toBeGreaterThan(0);
      if (r.kind === "proposed") expect(r.acceptable).toBe(false);
    }
  });

  it("refuses to count a value that is not in the cited quote", () => {
    expect(isGroundedValue({ statement: "x", organization: "Ramp", requirement: "SAML", value_usd: 999000, source_ref: "sales/ramp.md", quote: "Opportunity value: $140K." })).toBe(false);
    expect(isGroundedValue({ statement: "x", organization: "Ramp", requirement: "SAML", value_usd: 140000, source_ref: "sales/ramp.md", quote: "Opportunity value: $140K." })).toBe(true);
  });
});

describe("QM adapter", () => {
  it("signs exactly like QM source-auth", () => {
    const h = signedHeaders("s3cret", "POST", "/v1/turns", "{}", 1700000000);
    const expected = createHmac("sha256", "s3cret").update("v0:1700000000:POST\n/v1/turns\n{}").digest("hex");
    expect(h["x-signature"]).toBe(`v0=${expected}`);
  });
  it("extracts fenced JSON from an agent reply", () => {
    expect(extractJson('Here you go:\n```json\n{"ref":"events/a.md"}\n```')).toEqual({ ref: "events/a.md" });
  });
});

describe("approval + writeback", () => {
  it("writes once, dedupes repeat accepts, and proves persistence", async () => {
    const { createObservation, acceptEvent } = await import("../src/lib/pipeline");
    const { events } = await import("../src/lib/store");
    const rec = createObservation({ modality: "text", text: CANONICAL, actor: "Yurong" });
    for (let i = 0; i < 50 && events.get(rec.id)?.stage !== "DIFF_READY"; i++) await new Promise((r) => setTimeout(r, 10));
    expect(events.get(rec.id)?.stage).toBe("DIFF_READY");
    const first = await acceptEvent(rec.id);
    expect(first.stage).toBe("ACCEPTED");
    expect(first.proof?.found).toBe(true);
    const ref = first.write!.ref;
    const second = await acceptEvent(rec.id);
    expect(second.write).toMatchObject({ ref, deduplicated: true });
  });
});
