# GBrain Integration — P0 Requirement

## Why GBrain is core
GBrain provides persistent workspace memory as readable notes with provenance and exposes that memory to assistants through MCP. The same workspace memory can be searched and, with Full permissions, updated by external assistants.

Current documented MCP endpoint:

```text
https://gbrain.io/mcp
```

GBrain describes memory tools including recall/search/fetch/remember via connected assistants.

## Setup checklist
1. Create a new hackathon GBrain workspace.
2. Seed only demo-safe synthetic company context.
3. Create a client with **Full** memory access if writeback is required.
4. Connect the coding/runtime environment to `https://gbrain.io/mcp`.
5. Verify search/recall.
6. Verify remember/write.
7. Verify written note is visible in GBrain UI.

Claude Code documented connection pattern:

```bash
claude mcp add gbrain -t http https://gbrain.io/mcp
```

## Seed memory
Use a fictional company: **Northstar API**.

Seed notes:

### company/overview.md
- Developer infrastructure API.
- Primary buyer: engineering teams.
- Enterprise motion is new.

### sales/acme.md
- Acme opportunity: $120K annual contract.
- Owner: Sarah.
- Stage: technical evaluation.

### sales/ramp.md
- Ramp requested enterprise SSO in prior evaluation.
- Opportunity value: $140K.

### sales/globex.md
- Globex requested SAML support.
- Opportunity value: $80K.

### product/auth.md
- Current authentication: email/password + Google OAuth.
- SAML not currently supported.

### decisions/enterprise.md
- Enterprise readiness is a Q4 priority.

This allows the live event to discover:

```text
Acme fresh signal $120K
+ Ramp $140K
+ Globex $80K
= $340K of related opportunities
```

Use the number only as arithmetic over seeded synthetic demo data, never as a forecast.

## Application adapter contract

```ts
interface CompanyMemory {
  recall(query: string): Promise<MemoryHit[]>;
  search(query: string): Promise<MemoryHit[]>;
  fetch(ref: string): Promise<MemoryDocument>;
  remember(input: AcceptedMemoryWrite): Promise<MemoryWriteResult>;
}
```

Do not hardwire implementation details beyond the MCP tools exposed to the runtime.

## Query sequence for the demo
After compiling the Acme event, run searches such as:

1. `"SAML enterprise customer requests"`
2. `"Acme opportunity owner value"`
3. `"enterprise readiness authentication roadmap decision"`

Return top evidence with source/provenance.

## Writeback format
Accepted memory should be concise and source-aware:

```markdown
# Acme — SAML deployment blocker

Acme reported that security approval is blocked by lack of SAML support.
The opportunity is recorded as $120K and owned by Sarah.
The requested response deadline is Friday.

Source: CompanyOS Cortex Reality Event <event-id>
Captured: <timestamp>
```

## Demo proof
At the end of the demo:
1. open GBrain memory
2. show the newly written note
3. ask GBrain/search memory about Acme or SAML
4. show that the fresh observation is now durable

## Failure mode
If Full write permission cannot be obtained:
- keep GBrain as real read path
- show proposed memory write payload in UI
- explain write permission was unavailable
- do not fake persistence
