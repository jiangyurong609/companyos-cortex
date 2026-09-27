# BUILD_LOG — CompanyOS Cortex

Net-new repo created during hackathon hours. No prior CompanyOS source reused.

## 2026-09-27

- **14:30** — Repo initialized. Next.js 16 + TypeScript strict + Tailwind + Zod scaffold.
- **14:45** — Slice 1 (scaffold + fixture demo):
  - `/capture` phone UI with text, optional browser voice and a hidden "Use demo transcript" item.
  - `/command` desktop UI with the Company Diff (observed / recalled / derived / proposed), evidence expanders, Accept / Edit / Reject, a persistence-proof panel, a QM/GBrain trace, and 1s polling.
  - Reality Event compiler:
    - Claude (`claude-opus-5`, Zod structured output, retry once, anti-invention guard).
    - Deterministic parser when no API key is set.
  - Deterministic diff engine: $340K is computed in code, and a recalled value only counts when it appears verbatim in the cited GBrain quote.
  - Idempotent writes keyed on the event id. `data/trajectories.jsonl` is written in River-ready trajectory format.
- **14:50** — Integration adapters written (not yet run against live services):
  - **GBrain:** MCP over streamable HTTP with a bearer token. Tool argument names are discovered from `tools/list`, because the schemas aren't public.
  - **QM:** `POST /v1/turns` on core, HMAC-signed exactly like QM's `source-auth-sign.ts`. It runs in the `cortex-demo` project scope (`group` / `web-project-<id>`) with a strict JSON reply contract and one corrective retry.
- **Verified (fixture mode only):**
  - `pnpm test`: 7/7 pass.
  - Canonical transcript through the running server, 5/5: Acme / SAML / 120000 / Friday → Ramp + Globex linked → $340K → write → fresh recall finds the note → repeat accept deduplicated.
- **Pending (needs keys):**
  - `GBRAIN_TOKEN` → `pnpm gbrain:probe`, then `pnpm gbrain:seed`.
  - QM core credentials → `pnpm qm:setup`.
  - `ANTHROPIC_API_KEY` → run the LLM compiler 5×.
- **15:05** — **River connected.** `river/health.py` (Python `river-client` via `uv`) lists 13 base models and returned a live sample.
- **15:15** — **QM running locally** from github.com/yc-software/qm (`npm run dev-instance:web` with `HARNESS=codex`).
  - Core is at :8081 and the web/admin UI at :8129.
  - The signed core API works.
  - The `cortex-demo` project was created (`POST /v1/projects`, scope `group:web-project-24f04858…`).
  - A first real QM turn in that project scope returned `status: ok`.
- **15:25** — **GBrain connected.** Sign-in and an "Access token" client (Read and write) were set up in the gbrain.io workspace.
  - The token went clipboard → `.env.local` via `scripts/set-gbrain-token.sh` and was never displayed.
  - `tools/list` exposes around 100 tools. The adapter now uses the real ones:
    - `search` for hybrid search, keyed by page slug;
    - `put_page` for slug-addressed notes, which is idempotent;
    - `remember` for facts, with required provenance.
  - Seeded the 6 Northstar API pages (`sales/acme`, `sales/ramp`, `sales/globex`, `product/auth`, `decisions/enterprise`, `company/overview`). All 3 demo queries return them.
- **15:35** — **QM → GBrain connected.** `PUT /v1/admin/mcp-servers/gbrain` (bearer auth, shared). A QM turn in `cortex-demo` searched GBrain and returned the seeded pages with their slugs.
- **15:40** — **First full live loop through QM + GBrain:**
  - Acme/SAML/$120K/Friday → Ramp + Globex linked from GBrain pages → $340K.
  - The accept went through QM, and a repeat accept was deduplicated.
  - Proof failed: the agent saved a bare fact instead of the page. Fixed by giving the write turn the exact `put_page` slug and content and requiring the slug back.
  - QM turns now run at `thinkingLevel: low`.
- **16:05** — **River is on the live path.** The Reality Event compiler is River-hosted Qwen (`Qwen3.6-35B-A3B`) behind `river/sidecar.py`.
  - Its output is Zod-validated and invention-guarded, with an honest fallback to the deterministic parser.
  - It handles arbitrary sentences, e.g. Initech / audit logs / $60K / end of month.
- **16:10** — **Provenance filter.** Every recalled fact is re-fetched from its cited GBrain page (`get_page`), and its quote is verified. Failures are rejected before the diff and shown with a count.
  - The persistence proof is now an independent direct GBrain `recall(entity)`. Write+proof dropped from ~55s to ~15s.
  - `pnpm gbrain:reset` clears rehearsal pages.
- **16:12** — Live runs: canonical sentence (River → QM → GBrain → $340K → write → proof ✓) and a judge-style Initech sentence end to end ✓.
