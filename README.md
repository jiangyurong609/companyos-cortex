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

1. **GBrain.** In your workspace, create a client with **Full** memory access, add a connection, and copy the token into `GBRAIN_TOKEN`. Then:
   - `pnpm gbrain:probe` lists the real tool names and arguments and runs one search.
   - `pnpm gbrain:seed` writes the synthetic Northstar API notes.
2. **QM.** Set `QM_CORE_URL`, `QM_SIGNING_SECRET` (the deployment's `CORE_SIGNING_SECRET`) and `QM_ACTOR_ID`. Then run `pnpm qm:setup`. It:
   - registers GBrain as an MCP connector,
   - creates the `cortex-demo` project and prints `QM_PROJECT_ID`,
   - runs one QM → GBrain round trip.
3. **Compiler.** Set `ANTHROPIC_API_KEY`. Without it, the deterministic parser is used.

With no keys set, the app runs on local fixture memory, with QM bypassed. The header and a banner say so; nothing is faked as live.

## Checks

`pnpm test` · `pnpm typecheck` · `pnpm lint`
