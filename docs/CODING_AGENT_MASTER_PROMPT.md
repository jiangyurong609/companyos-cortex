# Coding Agent Master Prompt — v2

Build CompanyOS Cortex as a net-new hackathon project. Do not reuse pre-existing CompanyOS source code.

Read every markdown file in this package before coding. The architecture has one non-negotiable P0 path:

```text
mobile capture
-> typed RealityEvent
-> QM project scope `cortex-demo`
-> GBrain recall/search via MCP
-> grounded resolution
-> Company Diff
-> human approval
-> QM executes GBrain remember
-> fresh QM/GBrain recall proves persistence
```

## Priorities
P0:
1. real GBrain read
2. real GBrain write
3. real QM turn that can invoke GBrain
4. `/capture` phone UI
5. `/command` desktop UI
6. strict RealityEvent compiler
7. grounded Company Diff with provenance
8. approval/writeback/re-query

P1:
- one QM sandbox-generated markdown artifact

Do not build unless P0 is green:
- native iOS
- Superset
- Memorable
- River live training
- UFO
- multi-agent personas
- WebSockets
- auth

## Engineering style
- use TypeScript strict mode
- use Zod for model outputs and API contracts
- keep secrets server-side
- use 1-second polling for the demo
- use in-memory pending event state
- use deterministic code for arithmetic and diff rules
- never label an LLM proposal as a fact
- every recalled fact must carry GBrain provenance
- retry structured model parsing once, then surface an explicit error
- make every external write idempotent using event id

## Build process
Work in vertical slices. After each slice:
1. run tests/typecheck
2. manually verify the current vertical loop
3. fix failures before adding scope
4. commit with a descriptive message

Required commits:
- scaffold + fixture demo
- gbrain integration
- qm + gbrain round trip
- reality event compiler
- company diff
- writeback + persistence proof
- demo hardening

## Canonical demo data
Use fictional company Northstar API and the exact synthetic seed memory defined in `04_GBRAIN_INTEGRATION.md`.

Canonical live observation:
> I just finished the Acme call. Their security team won't approve us without SAML. Sarah says it's blocking the $120K deal, and they need an answer Friday.

The canonical flow must pass five consecutive runs before adding any stretch feature.
