# CompanyOS Cortex

**Reporting becomes a byproduct of work.**

Every company gets dumber as it grows. What people learn is lost at the source: heads, Slack threads, call recordings nobody rereads. It's lost again on the way up, because every management layer re-summarizes it. So companies add more reporting, and builders spend their week explaining what they built.

Cortex listens where work happens: call recordings, Slack, support tickets, GitHub, email, or one sentence from a phone. It then:
- **Understands every signal** (River).
- **Grounds it against company memory** (QM agent → GBrain).
- **Connects what different people saw independently.** For example, "4 people on 4 teams flagged SAML today, $340K now depends on it."
- **Routes each item to whoever must act:** the CEO or the reporter's manager.
- **Turns the CEO's decision into owned action.** A QM agent finds the owner in the org chart and drafts a grounded plan.

Every claim links to its source, and nothing enters company memory without a human's approval.

> AI tools made each person faster. Cortex makes the company itself faster.

## How it works

```
connectors / phone ──▶ River: extract every signal ──▶ QM agent (project cortex-demo) ──▶ GBrain search
      │                                                         │
      │                  provenance check: each recalled fact is re-fetched from its GBrain page,
      │                  and its quote must match or the fact is rejected
      ▼                                                         ▼
 reporter's role/team from GBrain org-chart pages     Company Diff: observed / recalled / derived ($ computed in code) / proposed
                                                                 │
          routing: company policy + River triage (learns from past CEO decisions) ──▶ CEO briefing │ manager view
                                                                 │
     CEO approves ──▶ QM writes fact + decision to GBrain ──▶ QM assigns owner + writes plan page ──▶ GBrain recall proves it
```

| Sponsor | Role in Cortex |
|---|---|
| **River AI** | Extracts every distinct signal from raw notes, transcripts and threads. Routes each signal to the CEO or a manager, using past CEO decisions as in-context examples. The model runs on River, so the company owns it. |
| **QM** | The agent harness. Every grounding, memory write, decision and action plan is a QM turn in the `cortex-demo` project scope, with GBrain as its MCP connector. |
| **GBrain** | Company memory: customer history, the org chart, and every accepted fact (`cortex/events/*`), decision (`decisions/*`) and plan (`plans/*`), each with provenance. |

## Pages

- `/exec`: executive dashboard (live KPIs, $ at stake, signal flow, reality stream; **▶ Start the workday** replays connector captures)
- `/brief`: CEO briefing (cited digest, cross-team decisions, Approve → QM plan)
- `/team/<team>`: manager view
- `/capture`: phone capture
- `/command`: evidence view (every fact expands to its GBrain quote; rejected unsourced claims)

Built during the Own Your Intelligence hackathon; see `BUILD_LOG.md` for the timeline. `docs/` holds the original plan.

## Run

```bash
pnpm install
cp .env.example .env.local   # fill in keys (all optional; the UI labels every fallback)
pnpm dev                     # desktop: /command   phone: /capture (same LAN or a tunnel)
```

## Wire up the live integrations

1. **GBrain** (gbrain.io).
   - Open your workspace → Memory → **Connect to other AIs** → **Access token** → **Read and write**, then click **Copy**.
   - Run `sh scripts/set-gbrain-token.sh` to write the token from the clipboard into `.env.local` without printing it.
   - Then:
     - `pnpm gbrain:probe` lists the tools and runs a search.
     - `pnpm gbrain:seed` `put_page`s the Northstar API notes.
2. **QM**, run locally from github.com/yc-software/qm:
   - Start it:
     ```bash
     git clone https://github.com/yc-software/qm ~/Projects/qm && cd ~/Projects/qm && npm ci
     echo "CORE_SIGNING_SECRET=$(openssl rand -hex 32)" >> ~/.config/qm/dev.env
     HARNESS=codex npm run dev-instance:web     # core :8081, UI :8129; uses your Codex/ChatGPT login
     ```
   - Set these in `.env.local`:
     - `QM_CORE_URL=http://localhost:8081`
     - `QM_SIGNING_SECRET` — the same value you put in `dev.env`
     - `QM_ACTOR_ID` — the admin principal, e.g. your macOS username
     - `QM_ORG=acme`
   - Run `pnpm qm:setup`. It:
     - registers GBrain as a QM MCP connector,
     - creates the `cortex-demo` project and prints `QM_PROJECT_ID`,
     - runs one QM → GBrain round trip.
3. **Compiler (optional).** Set `ANTHROPIC_API_KEY`. Without it, the deterministic parser is used.
4. **River.** Set `RIVER_API_KEY`, then run `uv run river/health.py`.

With no keys set, the app runs on local fixture memory, with QM bypassed. The header and a banner say so; nothing is faked as live.

## Checks

`pnpm test` · `pnpm typecheck` · `pnpm lint`
