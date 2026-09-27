# CompanyOS Cortex

Turn human reality into company state, then let the company react.

```
phone capture → typed RealityEvent → QM turn (project cortex-demo) → GBrain recall over MCP
→ grounded Company Diff → human approval → QM → GBrain remember → fresh recall proves persistence
```

Specs are in `docs/`.

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
